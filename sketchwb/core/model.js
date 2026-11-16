(function (global) {
  'use strict';

  /**
   * Pure JS Sketch Data Model (DOM-free, FreeCAD SketchObject-inspired).
   * PointPos: 'start' | 'end' | 'center' | 'none'
   */
  class SketchModel {
    constructor() {
      this.geometries = [];
      this.constraints = [];
      this.nextGeoId = 1;
      this.nextConstId = 1;
      this.undoStack = [];
      this.redoStack = [];
    }

    cloneState() {
      return JSON.stringify({
        geometries: this.geometries,
        constraints: this.constraints,
        nextGeoId: this.nextGeoId,
        nextConstId: this.nextConstId,
      });
    }

    pushHistory() {
      this.undoStack.push(this.cloneState());
      if (this.undoStack.length > 60) this.undoStack.shift();
      this.redoStack.length = 0;
    }

    undo() {
      if (!this.undoStack.length) return false;
      this.redoStack.push(this.cloneState());
      this._restore(this.undoStack.pop());
      return true;
    }

    redo() {
      if (!this.redoStack.length) return false;
      this.undoStack.push(this.cloneState());
      this._restore(this.redoStack.pop());
      return true;
    }

    _restore(json) {
      const s = JSON.parse(json);
      this.geometries = s.geometries;
      this.constraints = s.constraints;
      this.nextGeoId = s.nextGeoId;
      this.nextConstId = s.nextConstId;
    }

    getGeo(id) {
      return this.geometries.find((g) => g.id === id) || null;
    }

    addPoint(x, y, construction = false) {
      const g = { id: this.nextGeoId++, type: 'point', x, y, construction };
      this.geometries.push(g);
      return g;
    }

    addLine(x1, y1, x2, y2, construction = false) {
      const g = { id: this.nextGeoId++, type: 'line', x1, y1, x2, y2, construction };
      this.geometries.push(g);
      return g;
    }

    addCircle(cx, cy, r, construction = false) {
      const g = { id: this.nextGeoId++, type: 'circle', cx, cy, r: Math.max(0.5, r), construction };
      this.geometries.push(g);
      return g;
    }

    /**
     * Arc defined by center (cx, cy), radius r, startAngle, endAngle (radians, CCW).
     */
    addArc(cx, cy, r, startAngle, endAngle, construction = false) {
      const g = {
        id: this.nextGeoId++,
        type: 'arc',
        cx,
        cy,
        r: Math.max(0.5, r),
        startAngle,
        endAngle,
        construction,
      };
      this.geometries.push(g);
      return g;
    }

    /**
     * Returns {x, y} for a (geoId, pos) pair.
     * Supports geoId === 0 as Origin (0,0).
     */
    getPoint(geoId, pos) {
      if (geoId === 0) return { x: 0, y: 0 };
      const g = this.getGeo(geoId);
      if (!g) return null;
      if (g.type === 'point') return { x: g.x, y: g.y };
      if (g.type === 'line') {
        if (pos === 'start') return { x: g.x1, y: g.y1 };
        if (pos === 'end') return { x: g.x2, y: g.y2 };
        if (pos === 'mid') return { x: (g.x1 + g.x2) / 2, y: (g.y1 + g.y2) / 2 };
      }
      if (g.type === 'circle') {
        if (pos === 'center') return { x: g.cx, y: g.cy };
      }
      if (g.type === 'arc') {
        if (pos === 'center') return { x: g.cx, y: g.cy };
        if (pos === 'start') return { x: g.cx + g.r * Math.cos(g.startAngle), y: g.cy + g.r * Math.sin(g.startAngle) };
        if (pos === 'end') return { x: g.cx + g.r * Math.cos(g.endAngle), y: g.cy + g.r * Math.sin(g.endAngle) };
      }
      return null;
    }

    setPoint(geoId, pos, x, y) {
      const g = this.getGeo(geoId);
      if (!g) return;
      if (g.type === 'point') {
        g.x = x;
        g.y = y;
      } else if (g.type === 'line') {
        if (pos === 'start') { g.x1 = x; g.y1 = y; }
        else if (pos === 'end') { g.x2 = x; g.y2 = y; }
      } else if (g.type === 'circle') {
        if (pos === 'center') { g.cx = x; g.cy = y; }
      } else if (g.type === 'arc') {
        if (pos === 'center') { g.cx = x; g.cy = y; }
        else if (pos === 'start') { g.startAngle = Math.atan2(y - g.cy, x - g.cx); }
        else if (pos === 'end') { g.endAngle = Math.atan2(y - g.cy, x - g.cx); }
      }
    }

    getPointsOfGeo(g) {
      const pts = [];
      if (g.type === 'point') pts.push({ geoId: g.id, pos: 'start', x: g.x, y: g.y });
      else if (g.type === 'line') {
        pts.push({ geoId: g.id, pos: 'start', x: g.x1, y: g.y1 });
        pts.push({ geoId: g.id, pos: 'end', x: g.x2, y: g.y2 });
      } else if (g.type === 'circle') {
        pts.push({ geoId: g.id, pos: 'center', x: g.cx, y: g.cy });
      } else if (g.type === 'arc') {
        pts.push({ geoId: g.id, pos: 'center', x: g.cx, y: g.cy });
        pts.push({ geoId: g.id, pos: 'start', x: g.cx + g.r * Math.cos(g.startAngle), y: g.cy + g.r * Math.sin(g.startAngle) });
        pts.push({ geoId: g.id, pos: 'end', x: g.cx + g.r * Math.cos(g.endAngle), y: g.cy + g.r * Math.sin(g.endAngle) });
      }
      return pts;
    }

    removeGeo(id) {
      this.geometries = this.geometries.filter((g) => g.id !== id);
      this.constraints = this.constraints.filter((c) => !c.refs.some((r) => r.geoId === id));
    }

    /**
     * Constraint format:
     * { id, type, refs: [{ geoId, pos }] }
     * types: coincident | pointOnObject | horizontal | vertical | parallel | perpendicular | equal | symmetric
     */
    addConstraint(type, refs, extra = null) {
      // Avoid exact duplicate (except dimensional constraints which might update)
      const key = (r) => `${r.geoId}:${r.pos || 'none'}`;
      const sig = `${type}|${refs.map(key).join(',')}`;
      const exists = this.constraints.some((c) => `${c.type}|${c.refs.map(key).join(',')}` === sig);
      if (exists) return null;

      const c = { id: this.nextConstId++, type, refs, ...(extra || {}) };
      this.constraints.push(c);
      return c;
    }

    removeConstraint(id) {
      this.constraints = this.constraints.filter((c) => c.id !== id);
    }

    clear() {
      this.geometries = [];
      this.constraints = [];
      this.nextGeoId = 1;
      this.nextConstId = 1;
    }

    toJSON() {
      return JSON.stringify({ geometries: this.geometries, constraints: this.constraints }, null, 2);
    }
  }

  global.SketchCore = { SketchModel };
})(window);
