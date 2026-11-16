(function (global) {
  'use strict';

  /**
   * Isolated Sketcher Tools (State-machine per tool).
   * Each tool receives ctx: { model, vp, solve, updateUI, isConstruction, autoConst, opts }
   */
  function createTools(ctx) {
    const tools = {};
    const notify = (msg, type = 'warn') => (ctx.notify ? ctx.notify(msg, type) : alert(msg));

    const applyAutoHV = (line, autoConst) => {
      if (!autoConst) return;
      const dx = Math.abs(line.x2 - line.x1);
      const dy = Math.abs(line.y2 - line.y1);
      const len = Math.hypot(dx, dy);
      if (len < 2) return;
      if (dy / len < 0.04) ctx.model.addConstraint('horizontal', [{ geoId: line.id }]);
      else if (dx / len < 0.04) ctx.model.addConstraint('vertical', [{ geoId: line.id }]);
    };

    const snapLineTarget = (p0, w, e) => {
      const s = ctx.vp.snap(w.x, w.y);
      const useShift = !!(e && e.shiftKey) || !!(ctx.isShiftLock && ctx.isShiftLock());
      if (!p0 || !useShift) return s;
      const dx = s.x - p0.x, dy = s.y - p0.y;
      if (Math.hypot(dx, dy) < 1e-6) return { x: p0.x, y: p0.y, snapRef: null, snapKind: null, orthoLbl: null };
      const k = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
      const ang = k * (Math.PI / 4);
      const ca = Math.abs(Math.cos(ang)) < 1e-6 ? 0 : Math.cos(ang);
      const sa = Math.abs(Math.sin(ang)) < 1e-6 ? 0 : Math.sin(ang);
      const proj = dx * ca + dy * sa;
      const ox = Number((ca === 0 ? p0.x : p0.x + proj * ca).toFixed(3));
      const oy = Number((sa === 0 ? p0.y : p0.y + proj * sa).toFixed(3));
      const samePt = Math.hypot(ox - s.x, oy - s.y) < 0.02;
      const kMod = ((k % 4) + 4) % 4;
      const orthoLbl = kMod === 0 ? 'H 0°' : kMod === 2 ? 'V 90°' : '45°';
      return {
        x: ox,
        y: oy,
        snapRef: samePt ? s.snapRef : null,
        snapKind: samePt ? s.snapKind : 'ortho45',
        fixedAnchor: samePt ? s.fixedAnchor : false,
        orthoLbl,
      };
    };

    const snapCoincident = (geoId, pos, snapOrRef) => {
      if (!snapOrRef) return;
      const ref = snapOrRef.snapRef !== undefined ? snapOrRef.snapRef : snapOrRef;
      if (ref) {
        ctx.model.addConstraint('coincident', [{ geoId, pos }, ref]);
      }
      if (snapOrRef.fixedAnchor) {
        ctx.model.addConstraint('lock', [{ geoId, pos }], { x: snapOrRef.x, y: snapOrRef.y });
      }
    };

    const drawGhostShapes = (g, el, shapes) => {
      for (const s of shapes) {
        if (s.type === 'line') el('line', { x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2, class: 'preview-shape' }, g);
        else if (s.type === 'circle') el('circle', { cx: s.cx, cy: s.cy, r: s.r, class: 'preview-shape' }, g);
        else if (s.type === 'arc') el('path', { d: ctx.vp._arcPath(s), class: 'preview-shape' }, g);
        else if (s.type === 'point') el('circle', { cx: s.x, cy: s.y, r: 3.5 / ctx.vp.scale, class: 'preview-shape' }, g);
      }
    };

    const findCornerPairAt = (pt) => {
      const tol = 1e-2;
      const touching = ctx.model.geometries.filter((g) =>
        g.type === 'line' && (Math.hypot(g.x1 - pt.x, g.y1 - pt.y) < tol || Math.hypot(g.x2 - pt.x, g.y2 - pt.y) < tol)
      );
      return touching.length >= 2 ? [touching[0].id, touching[1].id] : null;
    };

    // 1. SELECT / DRAG / MARQUEE BOX / DBLCLICK CHAIN
    tools.select = {
      hint: 'Click: select • Double-click: select connected chain • Drag empty: box select • Drag point/geo: move',
      dragTarget: null,
      marqueeStart: null,
      lastW: null,
      lastClick: { time: 0, geoId: null, dimId: null, x: 0, y: 0 },
      onDown(e, w) {
        const now = Date.now();
        const dimEl = e.target.closest('[data-dim-id]');
        if (dimEl) {
          const cid = Number(dimEl.getAttribute('data-dim-id'));
          if (this.lastClick.dimId === cid && now - this.lastClick.time < 350) {
            this.lastClick.time = 0;
            this.dragTarget = null;
            if (ctx.openInlineDim) {
              ctx.openInlineDim(cid, e.clientX, e.clientY);
            } else {
              const c = ctx.model.constraints.find((x) => x.id === cid);
              if (c) {
                const val = prompt(`Edit ${c.type} value:`, c.value);
                if (val !== null && !isNaN(Number(val)) && Number(val) > 0) {
                  ctx.model.pushHistory();
                  c.value = Number(val);
                  ctx.solve(); ctx.vp.render(); ctx.updateUI();
                }
              }
            }
            return;
          }
          this.lastClick = { time: now, geoId: null, dimId: cid, x: e.clientX, y: e.clientY };
          if (!e.shiftKey) ctx.vp.clearSelection();
          ctx.vp.selectedConstraints.add(cid);
          this.dragTarget = { kind: 'dim', cid };
          ctx.vp.render();
          ctx.updateUI();
          return;
        }

        const constEl = e.target.closest('[data-const-id]');
        if (constEl) {
          const cid = Number(constEl.getAttribute('data-const-id'));
          if (!e.shiftKey) ctx.vp.clearSelection();
          if (ctx.vp.selectedConstraints.has(cid)) ctx.vp.selectedConstraints.delete(cid);
          else ctx.vp.selectedConstraints.add(cid);
          ctx.vp.render();
          ctx.updateUI();
          return;
        }

        const ptEl = e.target.closest('[data-pt-geo]');
        const geoEl = e.target.closest('[data-geo]');
        const multi = e.shiftKey;
        const hitPt = ptEl
          ? { geoId: Number(ptEl.getAttribute('data-pt-geo')), pos: ptEl.getAttribute('data-pt-pos') }
          : global.SketchOps.findPointAt?.(ctx.model, w.x, w.y, 7 / ctx.vp.scale);

        if (hitPt) {
          this.lastClick.time = 0;
          const geoId = hitPt.geoId;
          const pos = hitPt.pos;
          ctx.vp.togglePointSelection(geoId, pos, multi);
          if (geoId !== 0) {
            this.dragTarget = { kind: 'point', geoId, pos };
            ctx.model.pushHistory();
          }
        } else {
          const hitGeoId = geoEl ? Number(geoEl.getAttribute('data-geo')) : global.SketchOps.findGeoAt(ctx.model, w.x, w.y, 10 / ctx.vp.scale);
          if (hitGeoId) {
            // Reliable Double-click detection (immune to SVG DOM re-render)
            if (this.lastClick.geoId === hitGeoId && now - this.lastClick.time < 350) {
              this.lastClick.time = 0;
              this.dragTarget = null;
              const chain = global.SketchOps.getConnectedChain(ctx.model, hitGeoId);
              if (!multi) ctx.vp.clearSelection();
              for (const id of chain) ctx.vp.selectedGeos.add(id);
              ctx.vp.render();
              ctx.updateUI();
              return;
            }
            this.lastClick = { time: now, geoId: hitGeoId, dimId: null, x: e.clientX, y: e.clientY };
            ctx.vp.toggleGeoSelection(hitGeoId, multi);
            this.dragTarget = { kind: 'geo', geoId: hitGeoId };
            this.lastW = w;
            ctx.model.pushHistory();
          } else {
            this.lastClick.time = 0;
            if (!multi) ctx.vp.clearSelection();
            this.marqueeStart = w;
          }
        }
        ctx.vp.render();
        ctx.updateUI();
      },
      onMove(e, w) {
        if (this.lastClick.time && Math.hypot(e.clientX - this.lastClick.x, e.clientY - this.lastClick.y) > 4) {
          this.lastClick.time = 0;
        }
        if (this.marqueeStart) {
          const x = Math.min(this.marqueeStart.x, w.x);
          const y = Math.min(this.marqueeStart.y, w.y);
          const bw = Math.abs(w.x - this.marqueeStart.x);
          const bh = Math.abs(w.y - this.marqueeStart.y);
          const crossing = w.x < this.marqueeStart.x;
          ctx.vp.drawPreview((g, el) => {
            el('rect', { x, y, width: bw, height: bh, class: crossing ? 'marquee-cross' : 'marquee-win' }, g);
          });
          return;
        }
        if (!this.dragTarget) return;
        if (this.dragTarget.kind === 'dim') {
          const c = ctx.model.constraints.find((x) => x.id === this.dragTarget.cid);
          if (c) { c.lx = w.x; c.ly = w.y; }
        } else if (this.dragTarget.kind === 'point') {
          ctx.model.setPoint(this.dragTarget.geoId, this.dragTarget.pos, w.x, w.y);
          ctx.solve({ geoId: this.dragTarget.geoId, pos: this.dragTarget.pos, x: w.x, y: w.y });
        } else if (this.dragTarget.kind === 'geo' && this.lastW) {
          const dx = w.x - this.lastW.x;
          const dy = w.y - this.lastW.y;
          this.lastW = w;
          const dg = ctx.model.getGeo(this.dragTarget.geoId);
          if (dg && dg.chamferOf && global.SketchOps.slideChamfer?.(ctx.model, dg.id, w.x, w.y)) {
            ctx.solve();
          } else {
            global.SketchOps.moveGeos(ctx.model, [this.dragTarget.geoId], dx, dy, false);
            ctx.solve();
          }
        }
        ctx.vp.render();
      },
      onUp(e, w) {
        if (this.marqueeStart) {
          const crossing = w.x < this.marqueeStart.x;
          if (Math.hypot(w.x - this.marqueeStart.x, w.y - this.marqueeStart.y) > 2 / ctx.vp.scale) {
            const ids = global.SketchOps.geometriesInBox(ctx.model, this.marqueeStart.x, this.marqueeStart.y, w.x, w.y, crossing);
            for (const id of ids) ctx.vp.selectedGeos.add(id);
          }
          this.marqueeStart = null;
          ctx.vp.clearPreview();
          ctx.vp.render();
          ctx.updateUI();
          return;
        }
        if (this.dragTarget) {
          this.dragTarget = null;
          this.lastW = null;
          ctx.solve();
          ctx.vp.render();
          ctx.updateUI();
        }
      },
    };

    // 2. POINT
    tools.point = {
      hint: 'Click to place Point • Esc to finish',
      onDown(e, w) {
        const s = ctx.vp.snap(w.x, w.y);
        ctx.model.pushHistory();
        const pt = ctx.model.addPoint(s.x, s.y, ctx.isConstruction());
        snapCoincident(pt.id, 'start', s.snapRef);
        ctx.solve();
        ctx.vp.render();
        ctx.updateUI();
      },
    };

    // 3. LINE
    tools.line = {
      hint: 'Click start point, then end point • Hold Shift: H/V/45° • Esc to cancel',
      p1: null,
      activate() { this.p1 = null; },
      onDown(e, w) {
        const s = snapLineTarget(this.p1, w, e);
        if (!this.p1) {
          this.p1 = s;
          ctx.vp.render();
          ctx.syncCtxBar?.();
        } else {
          const p1 = this.p1;
          this.p1 = null;
          if (Math.hypot(s.x - p1.x, s.y - p1.y) > 0.5) {
            ctx.model.pushHistory();
            const l = ctx.model.addLine(p1.x, p1.y, s.x, s.y, ctx.isConstruction());
            snapCoincident(l.id, 'start', p1);
            snapCoincident(l.id, 'end', s);
            applyAutoHV(l, ctx.autoConst() || !!(e && e.shiftKey) || !!(ctx.isShiftLock && ctx.isShiftLock()));
            ctx.solve();
            ctx.updateUI();
          }
          ctx.vp.clearPreview();
          ctx.vp.render();
          ctx.syncCtxBar?.();
        }
      },
      onMove(e, w) {
        const s = snapLineTarget(this.p1, w, e);
        ctx.vp.drawPreview((g, el) => {
          if (s.snapRef || s.snapKind) el('circle', { cx: s.x, cy: s.y, r: 5 / ctx.vp.scale, class: 'snap-ring' }, g);
          if (this.p1) {
            el('line', { x1: this.p1.x, y1: this.p1.y, x2: s.x, y2: s.y, class: 'preview-shape' }, g);
            if (s.orthoLbl) {
              const invS = 1 / Math.max(0.5, ctx.vp.scale);
              const tx = s.x + 10 * invS, ty = s.y - 10 * invS;
              const t = el('text', { x: 0, y: 0, transform: ctx.vp.textTransform ? ctx.vp.textTransform(tx, ty) : `translate(${tx}, ${ty}) scale(${invS})`, class: 'dim-text', style: 'fill:#38bdf8;font-size:11px;font-weight:700;' }, g);
              t.textContent = s.orthoLbl;
            }
          }
        });
      },
      onKey(e) {
        if (e.key === 'Escape') { this.p1 = null; ctx.vp.clearPreview(); ctx.vp.render(); }
      },
    };

    // 4. POLYLINE
    tools.polyline = {
      hint: 'Click vertices sequentially • Hold Shift: H/V/45° • Right-click or Esc to finish segment chain',
      startPt: null,
      lastPt: null,
      lastGeoId: null,
      activate() { this.startPt = null; this.lastPt = null; this.lastGeoId = null; },
      onDown(e, w) {
        if (e.button === 2) {
          this.startPt = null; this.lastPt = null; this.lastGeoId = null; ctx.vp.clearPreview(); ctx.vp.render();
          ctx.syncCtxBar?.();
          return;
        }
        const s = snapLineTarget(this.lastPt, w, e);
        if (!this.lastPt) {
          this.startPt = s;
          this.lastPt = s;
          this.lastGeoId = null;
          ctx.vp.render();
          ctx.syncCtxBar?.();
        } else if (Math.hypot(s.x - this.lastPt.x, s.y - this.lastPt.y) > 0.5) {
          ctx.model.pushHistory();
          const l = ctx.model.addLine(this.lastPt.x, this.lastPt.y, s.x, s.y, ctx.isConstruction());
          if (this.lastGeoId) {
            ctx.model.addConstraint('coincident', [{ geoId: this.lastGeoId, pos: 'end' }, { geoId: l.id, pos: 'start' }]);
          } else {
            snapCoincident(l.id, 'start', this.lastPt);
          }
          snapCoincident(l.id, 'end', s);
          applyAutoHV(l, ctx.autoConst() || !!(e && e.shiftKey) || !!(ctx.isShiftLock && ctx.isShiftLock()));
          this.lastPt = s;
          this.lastGeoId = l.id;
          ctx.solve();
          ctx.vp.render();
          ctx.updateUI();
          ctx.syncCtxBar?.();
        }
      },
      onMove(e, w) {
        const s = snapLineTarget(this.lastPt, w, e);
        ctx.vp.drawPreview((g, el) => {
          if (s.snapRef || s.snapKind) el('circle', { cx: s.x, cy: s.y, r: 5 / ctx.vp.scale, class: 'snap-ring' }, g);
          if (this.lastPt) {
            el('line', { x1: this.lastPt.x, y1: this.lastPt.y, x2: s.x, y2: s.y, class: 'preview-shape' }, g);
            if (s.orthoLbl) {
              const invS = 1 / Math.max(0.5, ctx.vp.scale);
              const tx = s.x + 10 * invS, ty = s.y - 10 * invS;
              const t = el('text', { x: 0, y: 0, transform: ctx.vp.textTransform ? ctx.vp.textTransform(tx, ty) : `translate(${tx}, ${ty}) scale(${invS})`, class: 'dim-text', style: 'fill:#38bdf8;font-size:11px;font-weight:700;' }, g);
              t.textContent = s.orthoLbl;
            }
          }
        });
      },
      onKey(e) {
        if (e.key === 'Escape') { this.startPt = null; this.lastPt = null; this.lastGeoId = null; ctx.vp.clearPreview(); ctx.vp.render(); }
      },
    };

    // 5. CIRCLE
    tools.circle = {
      hint: 'Click center, then click point on circumference',
      center: null,
      onDown(e, w) {
        const s = ctx.vp.snap(w.x, w.y);
        if (!this.center) {
          this.center = s;
        } else {
          const r = Math.hypot(s.x - this.center.x, s.y - this.center.y);
          if (r > 0.5) {
            ctx.model.pushHistory();
            const c = ctx.model.addCircle(this.center.x, this.center.y, r, ctx.isConstruction());
            snapCoincident(c.id, 'center', this.center.snapRef);
            ctx.solve();
            ctx.vp.render();
            ctx.updateUI();
          }
          this.center = null;
          ctx.vp.clearPreview();
        }
      },
      onMove(e, w) {
        const s = ctx.vp.snap(w.x, w.y);
        ctx.vp.drawPreview((g, el) => {
          if (s.snapRef) el('circle', { cx: s.x, cy: s.y, r: 6 / ctx.vp.scale, class: 'snap-ring' }, g);
          if (this.center) {
            const r = Math.hypot(s.x - this.center.x, s.y - this.center.y);
            el('circle', { cx: this.center.x, cy: this.center.y, r, class: 'preview-shape' }, g);
          }
        });
      },
      onKey(e) { if (e.key === 'Escape') { this.center = null; ctx.vp.clearPreview(); } },
    };

    // 6. RECTANGLE
    tools.rectangle = {
      hint: 'Click first corner, then opposite corner (auto H/V & Coincident)',
      p1: null,
      onDown(e, w) {
        const s = ctx.vp.snap(w.x, w.y);
        if (!this.p1) {
          this.p1 = s;
        } else {
          if (Math.abs(s.x - this.p1.x) > 1 && Math.abs(s.y - this.p1.y) > 1) {
            ctx.model.pushHistory();
            const c = ctx.isConstruction();
            const l1 = ctx.model.addLine(this.p1.x, this.p1.y, s.x, this.p1.y, c);
            const l2 = ctx.model.addLine(s.x, this.p1.y, s.x, s.y, c);
            const l3 = ctx.model.addLine(s.x, s.y, this.p1.x, s.y, c);
            const l4 = ctx.model.addLine(this.p1.x, s.y, this.p1.x, this.p1.y, c);
            ctx.model.addConstraint('horizontal', [{ geoId: l1.id }]);
            ctx.model.addConstraint('horizontal', [{ geoId: l3.id }]);
            ctx.model.addConstraint('vertical', [{ geoId: l2.id }]);
            ctx.model.addConstraint('vertical', [{ geoId: l4.id }]);
            ctx.model.addConstraint('coincident', [{ geoId: l1.id, pos: 'end' }, { geoId: l2.id, pos: 'start' }]);
            ctx.model.addConstraint('coincident', [{ geoId: l2.id, pos: 'end' }, { geoId: l3.id, pos: 'start' }]);
            ctx.model.addConstraint('coincident', [{ geoId: l3.id, pos: 'end' }, { geoId: l4.id, pos: 'start' }]);
            ctx.model.addConstraint('coincident', [{ geoId: l4.id, pos: 'end' }, { geoId: l1.id, pos: 'start' }]);
            snapCoincident(l1.id, 'start', this.p1.snapRef);
            ctx.solve();
            ctx.vp.render();
            ctx.updateUI();
          }
          this.p1 = null;
          ctx.vp.clearPreview();
        }
      },
      onMove(e, w) {
        const s = ctx.vp.snap(w.x, w.y);
        ctx.vp.drawPreview((g, el) => {
          if (this.p1) {
            const x = Math.min(this.p1.x, s.x), y = Math.min(this.p1.y, s.y);
            el('rect', { x, y, width: Math.abs(s.x - this.p1.x), height: Math.abs(s.y - this.p1.y), class: 'preview-shape' }, g);
          }
        });
      },
      onKey(e) { if (e.key === 'Escape') { this.p1 = null; ctx.vp.clearPreview(); } },
    };

    // 7. REGULAR POLYGON
    tools.polygon = {
      hint: 'Click center, then click radius/vertex (set Sides in Tool Options)',
      center: null,
      onDown(e, w) {
        const s = ctx.vp.snap(w.x, w.y);
        if (!this.center) {
          this.center = s;
        } else {
          const r = Math.hypot(s.x - this.center.x, s.y - this.center.y);
          const n = Math.max(3, Math.min(24, ctx.opts.polygonSides || 6));
          if (r > 1) {
            ctx.model.pushHistory();
            const a0 = Math.atan2(s.y - this.center.y, s.x - this.center.x);
            const c = ctx.isConstruction();
            const lines = [];
            for (let i = 0; i < n; i++) {
              const a1 = a0 + (i * Math.PI * 2) / n;
              const a2 = a0 + ((i + 1) * Math.PI * 2) / n;
              lines.push(ctx.model.addLine(
                this.center.x + r * Math.cos(a1), this.center.y + r * Math.sin(a1),
                this.center.x + r * Math.cos(a2), this.center.y + r * Math.sin(a2),
                c
              ));
            }
            for (let i = 0; i < n; i++) {
              const next = (i + 1) % n;
              ctx.model.addConstraint('coincident', [{ geoId: lines[i].id, pos: 'end' }, { geoId: lines[next].id, pos: 'start' }]);
              if (i > 0) ctx.model.addConstraint('equal', [{ geoId: lines[0].id }, { geoId: lines[i].id }]);
            }
            ctx.model.addCircle(this.center.x, this.center.y, r, true);
            ctx.solve();
            ctx.vp.render();
            ctx.updateUI();
          }
          this.center = null;
          ctx.vp.clearPreview();
        }
      },
      onMove(e, w) {
        const s = ctx.vp.snap(w.x, w.y);
        ctx.vp.drawPreview((g, el) => {
          if (!this.center) return;
          const r = Math.hypot(s.x - this.center.x, s.y - this.center.y);
          const n = Math.max(3, Math.min(24, ctx.opts.polygonSides || 6));
          const a0 = Math.atan2(s.y - this.center.y, s.x - this.center.x);
          const pts = [];
          for (let i = 0; i < n; i++) {
            const a = a0 + (i * Math.PI * 2) / n;
            pts.push(`${this.center.x + r * Math.cos(a)},${this.center.y + r * Math.sin(a)}`);
          }
          el('polygon', { points: pts.join(' '), class: 'preview-shape' }, g);
        });
      },
      onKey(e) { if (e.key === 'Escape') { this.center = null; ctx.vp.clearPreview(); } },
    };

    // 8. SLOT
    tools.slot = {
      hint: 'Click center 1, center 2, then drag slot radius',
      c1: null,
      c2: null,
      onDown(e, w) {
        const s = ctx.vp.snap(w.x, w.y);
        if (!this.c1) { this.c1 = s; return; }
        if (!this.c2) {
          if (Math.hypot(s.x - this.c1.x, s.y - this.c1.y) > 1) this.c2 = s;
          return;
        }
        const dx = this.c2.x - this.c1.x, dy = this.c2.y - this.c1.y;
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len, uy = dy / len;
        const nx = -uy, ny = ux;
        const r = Math.max(2, Math.abs((s.x - this.c1.x) * nx + (s.y - this.c1.y) * ny));
        const ang = Math.atan2(dy, dx);
        const c = ctx.isConstruction();

        ctx.model.pushHistory();
        const l1 = ctx.model.addLine(this.c1.x + nx * r, this.c1.y + ny * r, this.c2.x + nx * r, this.c2.y + ny * r, c);
        const l2 = ctx.model.addLine(this.c2.x - nx * r, this.c2.y - ny * r, this.c1.x - nx * r, this.c1.y - ny * r, c);
        const a1 = ctx.model.addArc(this.c2.x, this.c2.y, r, ang - Math.PI / 2, ang + Math.PI / 2, c);
        const a2 = ctx.model.addArc(this.c1.x, this.c1.y, r, ang + Math.PI / 2, ang + 1.5 * Math.PI, c);
        ctx.model.addConstraint('parallel', [{ geoId: l1.id }, { geoId: l2.id }]);
        ctx.model.addConstraint('equal', [{ geoId: a1.id }, { geoId: a2.id }]);
        ctx.model.addConstraint('coincident', [{ geoId: l1.id, pos: 'end' }, { geoId: a1.id, pos: 'end' }]);
        ctx.model.addConstraint('coincident', [{ geoId: a1.id, pos: 'start' }, { geoId: l2.id, pos: 'start' }]);
        ctx.model.addConstraint('coincident', [{ geoId: l2.id, pos: 'end' }, { geoId: a2.id, pos: 'end' }]);
        ctx.model.addConstraint('coincident', [{ geoId: a2.id, pos: 'start' }, { geoId: l1.id, pos: 'start' }]);
        ctx.solve();
        ctx.vp.render();
        ctx.updateUI();

        this.c1 = null; this.c2 = null; ctx.vp.clearPreview();
      },
      onMove(e, w) {
        const s = ctx.vp.snap(w.x, w.y);
        ctx.vp.drawPreview((g, el) => {
          if (this.c1 && !this.c2) {
            el('line', { x1: this.c1.x, y1: this.c1.y, x2: s.x, y2: s.y, class: 'preview-shape' }, g);
          } else if (this.c1 && this.c2) {
            const dx = this.c2.x - this.c1.x, dy = this.c2.y - this.c1.y;
            const len = Math.hypot(dx, dy) || 1;
            const nx = -dy / len, ny = dx / len;
            const r = Math.max(2, Math.abs((s.x - this.c1.x) * nx + (s.y - this.c1.y) * ny));
            el('line', { x1: this.c1.x + nx * r, y1: this.c1.y + ny * r, x2: this.c2.x + nx * r, y2: this.c2.y + ny * r, class: 'preview-shape' }, g);
            el('line', { x1: this.c1.x - nx * r, y1: this.c1.y - ny * r, x2: this.c2.x - nx * r, y2: this.c2.y - ny * r, class: 'preview-shape' }, g);
          }
        });
      },
      onKey(e) { if (e.key === 'Escape') { this.c1 = null; this.c2 = null; ctx.vp.clearPreview(); } },
    };

    // 9. TRIM (findGeoAt + PCB Trace Intersections + Hover Segment Preview)
    tools.trim = {
      hint: 'Hover & click any segment to trim to nearest intersections',
      onDown(e, w) {
        const geoId = global.SketchOps.findGeoAt(ctx.model, w.x, w.y, 10 / ctx.vp.scale);
        if (!geoId) return;
        const extra = ctx.getExtraGeos ? ctx.getExtraGeos() : [];
        ctx.model.pushHistory();
        if (global.SketchOps.trimAt(ctx.model, geoId, w.x, w.y, extra)) {
          ctx.vp.clearPreview();
          ctx.solve();
          ctx.vp.render();
          ctx.updateUI();
        }
      },
      onMove(e, w) {
        const geoId = global.SketchOps.findGeoAt(ctx.model, w.x, w.y, 10 / ctx.vp.scale);
        ctx.vp.drawPreview((g, el) => {
          if (!geoId || !global.SketchOps.previewTrimAt) return;
          const extra = ctx.getExtraGeos ? ctx.getExtraGeos() : [];
          const seg = global.SketchOps.previewTrimAt(ctx.model, geoId, w.x, w.y, extra);
          if (!seg) return;
          if (seg.type === 'line') el('line', { x1: seg.x1, y1: seg.y1, x2: seg.x2, y2: seg.y2, class: 'trim-preview' }, g);
          else if (seg.type === 'circle') el('circle', { cx: seg.cx, cy: seg.cy, r: seg.r, class: 'trim-preview' }, g);
          else if (seg.type === 'arc') el('path', { d: ctx.vp._arcPath(seg), class: 'trim-preview' }, g);
        });
      },
      onKey(e) { if (e.key === 'Escape') ctx.vp.clearPreview(); },
    };

    // 10. FILLET (Live Corner Preview + Fixed-Line Radius Popup)
    tools.fillet = {
      hint: 'Hover/click a corner vertex OR click 2 lines sequentially to Fillet',
      firstLine: null,
      _applyFillet(id1, id2, e) {
        const initR = ctx.opts.filletRadius !== undefined ? ctx.opts.filletRadius : 0;
        const snapState = ctx.model.cloneState();
        ctx.model.pushHistory();
        const res = global.SketchOps.filletLines(ctx.model, id1, id2, initR);
        this.firstLine = null;
        ctx.vp.clearPreview();
        ctx.vp.clearSelection();
        if (!res.ok) {
          notify(res.msg, 'error');
          ctx.vp.render();
          ctx.updateUI();
          return;
        }
        ctx.solve(); ctx.vp.render(); ctx.updateUI();
        if (ctx.openValuePopup) {
          ctx.openValuePopup({
            title: 'Fillet Radius (0 = góc nhọn)', label: 'Radius:', unit: 'mm', value: initR,
            clientX: e.clientX, clientY: e.clientY,
            onApply: (newR) => {
              const rVal = Math.max(0, Number(newR) || 0);
              ctx.model._restore(snapState);
              const r2 = global.SketchOps.filletLines(ctx.model, id1, id2, rVal);
              if (r2.ok) {
                ctx.opts.filletRadius = rVal;
                ctx.solve();
              } else {
                notify(r2.msg, 'error');
                global.SketchOps.filletLines(ctx.model, id1, id2, initR);
              }
              ctx.vp.render(); ctx.updateUI();
            },
          });
        }
      },
      onDown(e, w) {
        const ptEl = e.target.closest('[data-pt-geo]');
        if (ptEl) {
          const pt = ctx.model.getPoint(Number(ptEl.getAttribute('data-pt-geo')), ptEl.getAttribute('data-pt-pos'));
          const pair = pt ? findCornerPairAt(pt) : null;
          if (pair) { this._applyFillet(pair[0], pair[1], e); return; }
        }
        const hitId = global.SketchOps.findGeoAt(ctx.model, w.x, w.y, 10 / ctx.vp.scale);
        const g = hitId ? ctx.model.getGeo(hitId) : null;
        if (!g || g.type !== 'line') return;
        if (!this.firstLine || this.firstLine === hitId) {
          this.firstLine = hitId;
          ctx.vp.toggleGeoSelection(hitId, false);
          ctx.vp.render();
        } else {
          this._applyFillet(this.firstLine, hitId, e);
        }
      },
      onMove(e, w) {
        let pair = null;
        const ptEl = e.target.closest('[data-pt-geo]');
        if (ptEl) {
          const pt = ctx.model.getPoint(Number(ptEl.getAttribute('data-pt-geo')), ptEl.getAttribute('data-pt-pos'));
          if (pt) pair = findCornerPairAt(pt);
        } else if (this.firstLine) {
          const hitId = global.SketchOps.findGeoAt(ctx.model, w.x, w.y, 10 / ctx.vp.scale);
          if (hitId && hitId !== this.firstLine) pair = [this.firstLine, hitId];
        }
        ctx.vp.drawPreview((g, el) => {
          if (!pair || !global.SketchOps.previewCornerOp) return;
          const r = ctx.opts.filletRadius !== undefined ? ctx.opts.filletRadius : 0;
          const shape = global.SketchOps.previewCornerOp(ctx.model, pair[0], pair[1], r, false);
          if (shape) drawGhostShapes(g, el, [shape]);
        });
      },
      onKey(e) { if (e.key === 'Escape') { this.firstLine = null; ctx.vp.clearPreview(); ctx.vp.clearSelection(); ctx.vp.render(); } },
    };

    // 10b. CHAMFER (Live Corner Drag Preview — keeps line angles fixed, adjusts linear setback)
    tools.chamfer = {
      hint: 'Click & drag a corner vertex (or click 2 lines) to Chamfer linearly without changing line angles',
      firstLine: null,
      drag: null,
      _startDrag(id1, id2, e, w) {
        const l1 = ctx.model.getGeo(id1), l2 = ctx.model.getGeo(id2);
        if (!l1 || !l2 || l1.type !== 'line' || l2.type !== 'line') return false;
        const a1 = l1.x2 - l1.x1, b1 = l1.y2 - l1.y1;
        const a2 = l2.x2 - l2.x1, b2 = l2.y2 - l2.y1;
        const den = a1 * b2 - b1 * a2;
        if (Math.abs(den) < 1e-6) { notify('Lines are parallel', 'error'); return false; }
        const t = ((l2.x1 - l1.x1) * b2 - (l2.y1 - l1.y1) * a2) / den;
        const ix = l1.x1 + t * a1, iy = l1.y1 + t * b1;
        const d1 = Math.max(Math.hypot(l1.x1 - ix, l1.y1 - iy), Math.hypot(l1.x2 - ix, l1.y2 - iy));
        const d2 = Math.max(Math.hypot(l2.x1 - ix, l2.y1 - iy), Math.hypot(l2.x2 - ix, l2.y2 - iy));
        const maxDist = Math.max(0.5, Math.min(d1, d2) * 0.92);
        this.drag = { id1, id2, ix, iy, maxDist, startPx: { x: e.clientX, y: e.clientY }, dist: Math.min(maxDist, ctx.opts.chamferDist || 2) };
        this.firstLine = null;
        return true;
      },
      _commitDist(id1, id2, dist, e, openPop) {
        const dVal = Math.max(0.3, Number(dist) || 2);
        const snapState = ctx.model.cloneState();
        ctx.model.pushHistory();
        const res = global.SketchOps.chamferLines(ctx.model, id1, id2, dVal);
        ctx.vp.clearPreview();
        ctx.vp.clearSelection();
        if (!res.ok) { notify(res.msg, 'error'); ctx.vp.render(); ctx.updateUI(); return; }
        ctx.opts.chamferDist = dVal;
        ctx.solve(); ctx.vp.render(); ctx.updateUI();
        if (openPop && ctx.openValuePopup) {
          ctx.openValuePopup({
            title: 'Chamfer Distance', label: 'Dist:', unit: 'mm', value: dVal,
            clientX: e.clientX, clientY: e.clientY,
            onApply: (newD) => {
              const nd = Math.max(0.3, Number(newD) || 0);
              ctx.model._restore(snapState);
              const r2 = global.SketchOps.chamferLines(ctx.model, id1, id2, nd);
              if (r2.ok) { ctx.opts.chamferDist = nd; ctx.solve(); }
              else { notify(r2.msg, 'error'); global.SketchOps.chamferLines(ctx.model, id1, id2, dVal); }
              ctx.vp.render(); ctx.updateUI();
            },
          });
        }
      },
      onDown(e, w) {
        const ptEl = e.target.closest('[data-pt-geo]');
        const hitPt = ptEl
          ? { geoId: Number(ptEl.getAttribute('data-pt-geo')), pos: ptEl.getAttribute('data-pt-pos') }
          : global.SketchOps.findPointAt?.(ctx.model, w.x, w.y, 8 / Math.max(0.5, ctx.vp.scale));
        if (hitPt) {
          const pt = ctx.model.getPoint(hitPt.geoId, hitPt.pos);
          const pair = pt ? findCornerPairAt(pt) : null;
          if (pair && this._startDrag(pair[0], pair[1], e, w)) return;
        }
        const hitId = global.SketchOps.findGeoAt(ctx.model, w.x, w.y, 10 / Math.max(0.5, ctx.vp.scale));
        const g = hitId ? ctx.model.getGeo(hitId) : null;
        if (!g || g.type !== 'line') return;
        if (!this.firstLine || this.firstLine === hitId) {
          this.firstLine = hitId;
          ctx.vp.toggleGeoSelection(hitId, false);
          ctx.vp.render();
        } else {
          this._startDrag(this.firstLine, hitId, e, w);
        }
      },
      onMove(e, w) {
        if (this.drag) {
          const moved = Math.hypot(e.clientX - this.drag.startPx.x, e.clientY - this.drag.startPx.y);
          if (moved > 3) {
            this.drag.dist = Math.max(0.4, Math.min(this.drag.maxDist, Math.hypot(w.x - this.drag.ix, w.y - this.drag.iy)));
          }
          ctx.vp.drawPreview((g, el) => {
            const shape = global.SketchOps.previewCornerOp(ctx.model, this.drag.id1, this.drag.id2, this.drag.dist, true);
            if (shape) drawGhostShapes(g, el, [shape]);
          });
          return;
        }
        let pair = null;
        const ptEl = e.target.closest('[data-pt-geo]');
        const hitPt = ptEl
          ? { geoId: Number(ptEl.getAttribute('data-pt-geo')), pos: ptEl.getAttribute('data-pt-pos') }
          : global.SketchOps.findPointAt?.(ctx.model, w.x, w.y, 8 / Math.max(0.5, ctx.vp.scale));
        if (hitPt) {
          const pt = ctx.model.getPoint(hitPt.geoId, hitPt.pos);
          if (pt) pair = findCornerPairAt(pt);
        } else if (this.firstLine) {
          const hitId = global.SketchOps.findGeoAt(ctx.model, w.x, w.y, 10 / Math.max(0.5, ctx.vp.scale));
          if (hitId && hitId !== this.firstLine) pair = [this.firstLine, hitId];
        }
        ctx.vp.drawPreview((g, el) => {
          if (!pair || !global.SketchOps.previewCornerOp) return;
          const shape = global.SketchOps.previewCornerOp(ctx.model, pair[0], pair[1], ctx.opts.chamferDist || 2, true);
          if (shape) drawGhostShapes(g, el, [shape]);
        });
      },
      onUp(e, w) {
        if (!this.drag) return;
        const d = this.drag;
        this.drag = null;
        const moved = Math.hypot(e.clientX - d.startPx.x, e.clientY - d.startPx.y);
        this._commitDist(d.id1, d.id2, d.dist, e, moved <= 3);
      },
      onKey(e) { if (e.key === 'Escape') { this.firstLine = null; this.drag = null; ctx.vp.clearPreview(); ctx.vp.clearSelection(); ctx.vp.render(); } },
    };

    // 11. OFFSET (FreeCAD-style Live Preview + Intersection/Arc corners)
    tools.offset = {
      hint: 'Select geometries (or click one), move mouse to preview offset distance & side, click to apply',
      _distToGeos(ids, w) {
        let best = Infinity;
        for (const id of ids) {
          const g = ctx.model.getGeo(id);
          if (!g) continue;
          if (g.type === 'line') {
            const dx = g.x2 - g.x1, dy = g.y2 - g.y1, len2 = dx * dx + dy * dy || 1;
            const t = Math.max(0, Math.min(1, ((w.x - g.x1) * dx + (w.y - g.y1) * dy) / len2));
            best = Math.min(best, Math.hypot(w.x - (g.x1 + t * dx), w.y - (g.y1 + t * dy)));
          } else if (g.type === 'circle' || g.type === 'arc') {
            best = Math.min(best, Math.abs(Math.hypot(w.x - g.cx, w.y - g.cy) - g.r));
          }
        }
        return best < Infinity ? Math.max(1, Math.round(best)) : (ctx.opts.offsetDist || 10);
      },
      onDown(e, w) {
        let ids = [...ctx.vp.selectedGeos];
        if (!ids.length) {
          const geoId = global.SketchOps.findGeoAt(ctx.model, w.x, w.y, 10 / ctx.vp.scale);
          if (geoId) {
            ctx.vp.selectedGeos.add(geoId);
            ctx.vp.render();
            ctx.updateUI();
            return;
          }
        }
        if (!ids.length) return;
        const dist = ctx.opts.offsetLockDist ? (ctx.opts.offsetDist || 10) : this._distToGeos(ids, w);
        ctx.model.pushHistory();
        const created = global.SketchOps.offsetGeos(ctx.model, ids, dist, w, {
          mode: ctx.opts.offsetMode || 'intersection',
          deleteOriginal: !!ctx.opts.offsetDeleteOrig,
          addConstraints: ctx.opts.offsetAddConst !== false,
        });
        ctx.vp.clearPreview();
        ctx.vp.clearSelection();
        ctx.solve();
        ctx.vp.render();
        ctx.updateUI();
        if (created.dimId && ctx.openInlineDim) {
          ctx.openInlineDim(created.dimId, e.clientX, e.clientY, false);
        }
      },
      onMove(e, w) {
        const ids = [...ctx.vp.selectedGeos];
        if (!ids.length || !global.SketchOps.computeOffsetShapes) return;
        const dist = ctx.opts.offsetLockDist ? (ctx.opts.offsetDist || 10) : this._distToGeos(ids, w);
        const shapes = global.SketchOps.computeOffsetShapes(ctx.model, ids, dist, w, {
          mode: ctx.opts.offsetMode || 'intersection',
        });
        ctx.vp.drawPreview((g, el) => {
          const invS = 1 / ctx.vp.scale;
          for (const s of shapes) {
            if (s.type === 'line') el('line', { x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2, class: 'preview-shape' }, g);
            else if (s.type === 'circle') el('circle', { cx: s.cx, cy: s.cy, r: s.r, class: 'preview-shape' }, g);
            else if (s.type === 'arc') el('path', { d: ctx.vp._arcPath(s), class: 'preview-shape' }, g);
          }
          const t = el('text', {
            x: 0, y: 0, transform: `translate(${w.x + 10 * invS}, ${w.y + 10 * invS}) scale(${invS}, ${-invS})`,
            class: 'dim-label',
          }, g);
          t.textContent = `${dist.toFixed(1)} mm`;
        });
      },
      onKey(e) { if (e.key === 'Escape') ctx.vp.clearPreview(); },
    };

    // 12. SYMMETRY (Mirror with Live Ghost Preview)
    tools.symmetry = {
      hint: 'Select geometries first, then hover & click the mirror axis line',
      onDown(e, w) {
        const axisId = global.SketchOps.findGeoAt(ctx.model, w.x, w.y, 10 / ctx.vp.scale);
        if (!axisId) return;
        const ids = [...ctx.vp.selectedGeos];
        if (!ids.length) { notify('Select geometries to mirror first (using Select tool).'); return; }
        ctx.model.pushHistory();
        global.SketchOps.mirrorGeos(ctx.model, ids, axisId);
        ctx.vp.clearPreview();
        ctx.vp.render();
        ctx.updateUI();
      },
      onMove(e, w) {
        const ids = [...ctx.vp.selectedGeos];
        if (!ids.length) return;
        const axisId = global.SketchOps.findGeoAt(ctx.model, w.x, w.y, 10 / ctx.vp.scale);
        ctx.vp.drawPreview((g, el) => {
          if (!axisId || !global.SketchOps.previewMirror) return;
          drawGhostShapes(g, el, global.SketchOps.previewMirror(ctx.model, ids, axisId));
        });
      },
      onKey(e) { if (e.key === 'Escape') ctx.vp.clearPreview(); },
    };

    // 13. MOVE / CLONE (Unified: default Move, tick Clone for Copy + Confirmation Popup)
    tools.move = {
      hint: 'Select geometries, click base point & target point to Move (tick Clone for Copy)',
      base: null,
      onDown(e, w) {
        const ids = [...ctx.vp.selectedGeos];
        if (!ids.length) { notify('Select geometries first.'); return; }
        const s = ctx.vp.snap(w.x, w.y);
        if (!this.base) { this.base = s; return; }
        const dx = s.x - this.base.x, dy = s.y - this.base.y;
        const dist = Math.hypot(dx, dy);
        const ux = dist > 1e-6 ? dx / dist : 1, uy = dist > 1e-6 ? dy / dist : 0;
        const isClone = !!ctx.opts.moveClone;
        const snapState = ctx.model.cloneState();

        ctx.model.pushHistory();
        global.SketchOps.moveGeos(ctx.model, ids, dx, dy, isClone);
        this.base = null;
        ctx.vp.clearPreview();
        ctx.solve(); ctx.vp.render(); ctx.updateUI();

        if (ctx.openValuePopup) {
          ctx.openValuePopup({
            title: 'Move / Clone', label: 'Distance:', unit: 'mm', value: dist,
            checkLabel: 'Clone (Copy)', checked: isClone,
            clientX: e.clientX, clientY: e.clientY,
            onApply: (newDist, cloneChecked) => {
              ctx.opts.moveClone = !!cloneChecked;
              ctx.model._restore(snapState);
              global.SketchOps.moveGeos(ctx.model, ids, ux * newDist, uy * newDist, !!cloneChecked);
              ctx.solve(); ctx.vp.render(); ctx.updateUI();
            },
            onCancel: () => {
              ctx.model._restore(snapState);
              ctx.solve(); ctx.vp.render(); ctx.updateUI();
            },
          });
        }
      },
      onMove(e, w) {
        if (!this.base) return;
        const ids = [...ctx.vp.selectedGeos];
        const s = ctx.vp.snap(w.x, w.y);
        const dx = s.x - this.base.x, dy = s.y - this.base.y;
        const dist = Math.hypot(dx, dy);
        const invS = 1 / ctx.vp.scale;
        ctx.vp.drawPreview((g, el) => {
          el('line', { x1: this.base.x, y1: this.base.y, x2: s.x, y2: s.y, class: 'dim-line' }, g);
          if (global.SketchOps.previewTranslate) drawGhostShapes(g, el, global.SketchOps.previewTranslate(ctx.model, ids, dx, dy));
          const t = el('text', { x: 0, y: 0, transform: `translate(${s.x + 10 * invS}, ${s.y + 10 * invS}) scale(${invS}, ${-invS})`, class: 'dim-label' }, g);
          t.textContent = `${dist.toFixed(1)} mm`;
        });
      },
      onKey(e) { if (e.key === 'Escape') { this.base = null; ctx.vp.clearPreview(); } },
    };
    tools.clone = tools.move;

    // 14. SCALE (Interactive 2-step + Factor Popup)
    tools.scale = {
      hint: 'Select geometries, click center, drag to preview scale & click to set exact Factor',
      center: null,
      onDown(e, w) {
        const ids = [...ctx.vp.selectedGeos];
        if (!ids.length) { notify('Select geometries first.'); return; }
        const s = ctx.vp.snap(w.x, w.y);
        if (!this.center) { this.center = s; return; }
        const cx = this.center.x, cy = this.center.y;
        const factor = Math.max(0.1, Number((Math.hypot(s.x - cx, s.y - cy) / 40).toFixed(2)));
        const snapState = ctx.model.cloneState();
        ctx.model.pushHistory();
        global.SketchOps.scaleGeos(ctx.model, ids, cx, cy, factor, ctx.opts.transformCopy);
        this.center = null;
        ctx.vp.clearPreview();
        ctx.solve(); ctx.vp.render(); ctx.updateUI();
        if (ctx.openValuePopup) {
          ctx.openValuePopup({
            title: 'Scale Factor', label: 'Factor:', unit: '×', value: factor,
            clientX: e.clientX, clientY: e.clientY,
            onApply: (val) => {
              ctx.model._restore(snapState);
              global.SketchOps.scaleGeos(ctx.model, ids, cx, cy, val, ctx.opts.transformCopy);
              ctx.solve(); ctx.vp.render(); ctx.updateUI();
            },
          });
        }
      },
      onMove(e, w) {
        if (!this.center) return;
        const ids = [...ctx.vp.selectedGeos];
        const s = ctx.vp.snap(w.x, w.y);
        const factor = Math.max(0.1, Math.hypot(s.x - this.center.x, s.y - this.center.y) / 40);
        const invS = 1 / ctx.vp.scale;
        ctx.vp.drawPreview((g, el) => {
          el('line', { x1: this.center.x, y1: this.center.y, x2: s.x, y2: s.y, class: 'dim-line' }, g);
          if (global.SketchOps.previewScale) drawGhostShapes(g, el, global.SketchOps.previewScale(ctx.model, ids, this.center.x, this.center.y, factor));
          const t = el('text', { x: 0, y: 0, transform: `translate(${s.x + 10 * invS}, ${s.y + 10 * invS}) scale(${invS}, ${-invS})`, class: 'dim-label' }, g);
          t.textContent = `${factor.toFixed(2)}×`;
        });
      },
      onKey(e) { if (e.key === 'Escape') { this.center = null; ctx.vp.clearPreview(); } },
    };

    // 15. ROTATE (Interactive 2-step + Angle Popup)
    tools.rotate = {
      hint: 'Select geometries, click pivot center, drag to preview angle & click to set exact Degrees',
      center: null,
      onDown(e, w) {
        const ids = [...ctx.vp.selectedGeos];
        if (!ids.length) { notify('Select geometries first.'); return; }
        const s = ctx.vp.snap(w.x, w.y);
        if (!this.center) { this.center = s; return; }
        const cx = this.center.x, cy = this.center.y;
        const rad = Math.atan2(s.y - cy, s.x - cx);
        const deg = Number(((rad * 180) / Math.PI).toFixed(1));
        const snapState = ctx.model.cloneState();
        ctx.model.pushHistory();
        global.SketchOps.rotateGeos(ctx.model, ids, cx, cy, rad, ctx.opts.transformCopy);
        this.center = null;
        ctx.vp.clearPreview();
        ctx.solve(); ctx.vp.render(); ctx.updateUI();
        if (ctx.openValuePopup) {
          ctx.openValuePopup({
            title: 'Rotate Angle', label: 'Angle:', unit: '°', value: deg,
            clientX: e.clientX, clientY: e.clientY,
            onApply: (newDeg) => {
              ctx.model._restore(snapState);
              global.SketchOps.rotateGeos(ctx.model, ids, cx, cy, (newDeg * Math.PI) / 180, ctx.opts.transformCopy);
              ctx.solve(); ctx.vp.render(); ctx.updateUI();
            },
          });
        }
      },
      onMove(e, w) {
        if (!this.center) return;
        const ids = [...ctx.vp.selectedGeos];
        const s = ctx.vp.snap(w.x, w.y);
        const rad = Math.atan2(s.y - this.center.y, s.x - this.center.x);
        const deg = (rad * 180) / Math.PI;
        const invS = 1 / ctx.vp.scale;
        ctx.vp.drawPreview((g, el) => {
          el('line', { x1: this.center.x, y1: this.center.y, x2: s.x, y2: s.y, class: 'dim-line' }, g);
          if (global.SketchOps.previewRotate) drawGhostShapes(g, el, global.SketchOps.previewRotate(ctx.model, ids, this.center.x, this.center.y, rad));
          const t = el('text', { x: 0, y: 0, transform: `translate(${s.x + 10 * invS}, ${s.y + 10 * invS}) scale(${invS}, ${-invS})`, class: 'dim-label' }, g);
          t.textContent = `${deg.toFixed(1)}°`;
        });
      },
      onKey(e) { if (e.key === 'Escape') { this.center = null; ctx.vp.clearPreview(); } },
    };

    // 16. ARRAY (Live Rect / Polar Preview)
    tools.array = {
      hint: 'Select geometries, configure Rect/Polar in Edit Controls, hover to preview & click to place',
      onDown(e, w) {
        const ids = [...ctx.vp.selectedGeos];
        if (!ids.length) { notify('Select geometries first.'); return; }
        const s = ctx.vp.snap(w.x, w.y);
        ctx.model.pushHistory();
        global.SketchOps.arrayGeos(ctx.model, ids, {
          mode: ctx.opts.arrayMode || 'rect',
          cols: ctx.opts.arrayCols || 3,
          rows: ctx.opts.arrayRows || 2,
          dx: ctx.opts.arrayDx || 40,
          dy: ctx.opts.arrayDy || 40,
          count: ctx.opts.arrayCount || 6,
          cx: s.x,
          cy: s.y,
        });
        ctx.vp.clearPreview();
        ctx.vp.render();
        ctx.updateUI();
      },
      onMove(e, w) {
        const ids = [...ctx.vp.selectedGeos];
        if (!ids.length || !global.SketchOps.previewArray) return;
        const s = ctx.vp.snap(w.x, w.y);
        const shapes = global.SketchOps.previewArray(ctx.model, ids, {
          mode: ctx.opts.arrayMode || 'rect',
          cols: ctx.opts.arrayCols || 3,
          rows: ctx.opts.arrayRows || 2,
          dx: ctx.opts.arrayDx || 40,
          dy: ctx.opts.arrayDy || 40,
          count: ctx.opts.arrayCount || 6,
          cx: s.x,
          cy: s.y,
        });
        ctx.vp.drawPreview((g, el) => drawGhostShapes(g, el, shapes));
      },
      onKey(e) { if (e.key === 'Escape') ctx.vp.clearPreview(); },
    };

    // 17. MODAL DIMENSION TOOL (FreeCAD DrawSketchHandlerDimension workflow)
    tools.dimension = {
      hint: 'Dimension: Pick point/edge, pick 2nd or click empty space to place • M: switch mode • Right-click: cancel/exit',
      picks: [],
      modeOverride: null,
      modeIdx: 0,
      activate(mode = null) {
        this.modeOverride = mode === 'smart' ? null : mode;
        this.modeIdx = 0;
        this.picks = [];
        // Load existing selection (handleInitialSelection)
        for (const p of ctx.vp.selectedPoints) this.picks.push({ kind: 'point', geoId: p.geoId, pos: p.pos });
        for (const id of ctx.vp.selectedGeos) this.picks.push({ kind: 'geo', geoId: id });
        if (this.picks.length > 2) this.picks = this.picks.slice(0, 2);
      },
      _getModes() {
        if (this.modeOverride) return [this.modeOverride];
        if (this.picks.length === 1 && this.picks[0].kind === 'geo') {
          const g = ctx.model.getGeo(this.picks[0].geoId);
          if (g?.type === 'circle' || g?.type === 'arc') return ['radius', 'diameter'];
          if (g?.type === 'line') return ['distance', 'distanceX', 'distanceY'];
        }
        if (this.picks.length === 1 && this.picks[0].kind === 'point') {
          return ['lock'];
        }
        if (this.picks.length === 2) {
          const [a, b] = this.picks;
          const ga = ctx.model.getGeo(a.geoId), gb = ctx.model.getGeo(b.geoId);
          if (a.kind === 'geo' && b.kind === 'geo' && ga?.type === 'line' && gb?.type === 'line') {
            return ['angle'];
          }
          if ((a.kind === 'point' && b.kind === 'geo' && gb?.type === 'line') ||
              (b.kind === 'point' && a.kind === 'geo' && ga?.type === 'line')) {
            return ['distance'];
          }
          return ['distance', 'distanceX', 'distanceY'];
        }
        return [];
      },
      _currentMode() {
        const modes = this._getModes();
        if (!modes.length) return null;
        return modes[this.modeIdx % modes.length];
      },
      _measure(mode) {
        if (!mode || !this.picks.length) return null;
        if (mode === 'lock') {
          const p = ctx.model.getPoint(this.picks[0].geoId, this.picks[0].pos);
          return p ? { refs: [{ geoId: this.picks[0].geoId, pos: this.picks[0].pos }], extra: { x: p.x, y: p.y }, text: 'Lock' } : null;
        }
        if (mode === 'radius' || mode === 'diameter') {
          const g = ctx.model.getGeo(this.picks[0].geoId);
          if (!g) return null;
          const val = mode === 'radius' ? g.r : g.r * 2;
          return { refs: [{ geoId: g.id }], extra: { value: val }, val, text: (mode === 'radius' ? 'R' : 'Ø') + val.toFixed(1) };
        }
        if (mode === 'angle') {
          const l1 = ctx.model.getGeo(this.picks[0].geoId), l2 = ctx.model.getGeo(this.picks[1].geoId);
          if (!l1 || !l2) return null;
          const dx1 = l1.x2 - l1.x1, dy1 = l1.y2 - l1.y1;
          const dx2 = l2.x2 - l2.x1, dy2 = l2.y2 - l2.y1;
          const den = dx1 * dy2 - dy1 * dx2;
          if (Math.abs(den) < 1e-6) return null; // parallel lines
          const t = ((l2.x1 - l1.x1) * dy2 - (l2.y1 - l1.y1) * dx2) / den;
          const sx = l1.x1 + t * dx1, sy = l1.y1 + t * dy1;
          const dir1 = Math.hypot(l1.x1 - sx, l1.y1 - sy) <= Math.hypot(l1.x2 - sx, l1.y2 - sy) ? 1 : -1;
          const dir2 = Math.hypot(l2.x1 - sx, l2.y1 - sy) <= Math.hypot(l2.x2 - sx, l2.y2 - sy) ? 1 : -1;
          const a1 = Math.atan2(dy1 * dir1, dx1 * dir1);
          const a2 = Math.atan2(dy2 * dir2, dx2 * dir2);
          const diff = Math.atan2(Math.sin(a2 - a1), Math.cos(a2 - a1));
          const val = Math.abs((diff * 180) / Math.PI);
          return {
            refs: [{ geoId: l1.id }, { geoId: l2.id }],
            l1, l2, dir1, dir2,
            extra: { value: val, sign: diff >= 0 ? 1 : -1, dir1, dir2 },
            val,
            text: `${val.toFixed(1)}°`,
          };
        }
        // distance / distanceX / distanceY
        let refs = [], p1, p2;
        if (this.picks.length === 1 && this.picks[0].kind === 'geo') {
          const l = ctx.model.getGeo(this.picks[0].geoId);
          if (!l || l.type !== 'line') return null;
          refs = [{ geoId: l.id }];
          p1 = { x: l.x1, y: l.y1 }; p2 = { x: l.x2, y: l.y2 };
        } else if (this.picks.length === 2) {
          const [a, b] = this.picks;
          const ga = ctx.model.getGeo(a.geoId), gb = ctx.model.getGeo(b.geoId);
          if (a.kind === 'point' && b.kind === 'geo' && gb?.type === 'line') {
            p1 = ctx.model.getPoint(a.geoId, a.pos);
            const dx = gb.x2 - gb.x1, dy = gb.y2 - gb.y1, len2 = dx * dx + dy * dy || 1;
            const t = ((p1.x - gb.x1) * dx + (p1.y - gb.y1) * dy) / len2;
            p2 = { x: gb.x1 + t * dx, y: gb.y1 + t * dy };
            refs = [{ geoId: a.geoId, pos: a.pos }, { geoId: b.geoId, pos: 'none' }];
          } else if (b.kind === 'point' && a.kind === 'geo' && ga?.type === 'line') {
            p1 = ctx.model.getPoint(b.geoId, b.pos);
            const dx = ga.x2 - ga.x1, dy = ga.y2 - ga.y1, len2 = dx * dx + dy * dy || 1;
            const t = ((p1.x - ga.x1) * dx + (p1.y - ga.y1) * dy) / len2;
            p2 = { x: ga.x1 + t * dx, y: ga.y1 + t * dy };
            refs = [{ geoId: b.geoId, pos: b.pos }, { geoId: a.geoId, pos: 'none' }];
          } else {
            p1 = ctx.model.getPoint(a.geoId, a.pos);
            p2 = ctx.model.getPoint(b.geoId, b.pos);
            refs = [{ geoId: a.geoId, pos: a.pos }, { geoId: b.geoId, pos: b.pos }];
          }
        }
        if (!p1 || !p2) return null;
        const val = mode === 'distanceX' ? Math.abs(p2.x - p1.x) : mode === 'distanceY' ? Math.abs(p2.y - p1.y) : Math.hypot(p2.x - p1.x, p2.y - p1.y);
        const sign = mode === 'distanceX' ? (p2.x >= p1.x ? 1 : -1) : mode === 'distanceY' ? (p2.y >= p1.y ? 1 : -1) : 1;
        return { refs, p1, p2, extra: { value: val, sign }, val, text: val.toFixed(1) };
      },
      _syncHighlight() {
        ctx.vp.clearSelection();
        for (const p of this.picks) {
          if (p.kind === 'point') ctx.vp.selectedPoints.push({ geoId: p.geoId, pos: p.pos });
          else ctx.vp.selectedGeos.add(p.geoId);
        }
        ctx.vp.render();
      },
      _commitAt(e, w) {
        const mode = this._currentMode();
        const m = this._measure(mode);
        if (!m) return;
        ctx.model.pushHistory();
        const extra = { ...m.extra, lx: w.x, ly: w.y };
        const c = ctx.model.addConstraint(mode, m.refs, extra);
        this.picks = [];
        this.modeIdx = 0;
        ctx.vp.clearPreview();
        ctx.vp.clearSelection();
        ctx.solve();
        ctx.vp.render();
        ctx.updateUI();
        if (c && mode !== 'lock' && ctx.openInlineDim) {
          ctx.openInlineDim(c.id, e.clientX, e.clientY, true);
        }
      },
      onDown(e, w) {
        const ptEl = e.target.closest('[data-pt-geo]');
        const hitPt = ptEl
          ? { geoId: Number(ptEl.getAttribute('data-pt-geo')), pos: ptEl.getAttribute('data-pt-pos') }
          : global.SketchOps.findPointAt?.(ctx.model, w.x, w.y, 8 / Math.max(0.5, ctx.vp.scale));
        const hitGeoId = !hitPt ? global.SketchOps.findGeoAt(ctx.model, w.x, w.y, 10 / Math.max(0.5, ctx.vp.scale)) : null;

        if (hitPt) {
          const geoId = hitPt.geoId;
          const pos = hitPt.pos;
          const idx = this.picks.findIndex((p) => p.kind === 'point' && p.geoId === geoId && p.pos === pos);
          if (idx >= 0) this.picks.splice(idx, 1);
          else if (this.picks.length < 2) this.picks.push({ kind: 'point', geoId, pos });
          this._syncHighlight();
          if (this.modeOverride === 'lock' && this.picks.length === 1) {
            this._commitAt(e, w);
          }
          return;
        }

        if (hitGeoId) {
          const idx = this.picks.findIndex((p) => p.kind === 'geo' && p.geoId === hitGeoId);
          if (idx >= 0) this.picks.splice(idx, 1);
          else if (this.picks.length < 2) this.picks.push({ kind: 'geo', geoId: hitGeoId });
          this._syncHighlight();
          return;
        }

        // Blank space click -> finalize & place dimension!
        if (this.picks.length >= 1) {
          this._commitAt(e, w);
        }
      },
      onMove(e, w) {
        const mode = this._currentMode();
        const m = this._measure(mode);
        const pcbTol = 10 / Math.max(0.5, ctx.vp.scale);
        const pcb = this.picks.length < 2 && ctx.getPcbDimSnap ? ctx.getPcbDimSnap(w.x, w.y, pcbTol) : null;
        ctx.vp.drawPreview((g, el) => {
          for (const pk of this.picks) {
            if (pk.kind === 'pcbPt') el('circle', { cx: pk.x, cy: pk.y, r: 5 / Math.max(0.5, ctx.vp.scale), class: 'snap-ring' }, g);
          }
          if (pcb) el('circle', { cx: pcb.x, cy: pcb.y, r: 5 / Math.max(0.5, ctx.vp.scale), class: 'snap-ring' }, g);
          if (!m) return;
          const invS = 1 / ctx.vp.scale;
          let tx = w.x, ty = w.y;
          if (mode === 'angle' && m.l1 && m.l2 && ctx.vp._drawAngleDim) {
            const pos = ctx.vp._drawAngleDim(g, m.l1, m.l2, w.x, w.y, invS, false, m.dir1, m.dir2);
            if (pos) { tx = pos.tx; ty = pos.ty; }
          } else if (m.p1 && m.p2 && ctx.vp._drawCadDim) {
            const pos = ctx.vp._drawCadDim(g, m.p1, m.p2, w.x, w.y, mode, invS, false);
            tx = pos.tx; ty = pos.ty;
          }
          const lbl = mode === 'angle' || mode === 'lock' ? m.text : `${m.text} mm`;
          const t = el('text', {
            x: 0, y: 0,
            'dominant-baseline': 'central',
            transform: ctx.vp.textTransform ? ctx.vp.textTransform(tx, ty) : `translate(${tx}, ${ty}) scale(${invS}, ${-invS})`,
            class: 'dim-label',
          }, g);
          t.textContent = lbl;
        });
      },
      onKey(e) {
        if (e.key.toLowerCase() === 'm') {
          this.modeIdx++;
          return;
        }
        if (e.key === 'Escape') {
          if (this.picks.length) {
            this.picks = [];
            ctx.vp.clearPreview();
            this._syncHighlight();
            return true; // signal stayed in tool
          }
          return false;
        }
      },
    };

    // 18. CONTINUOUS COINCIDENT / POINT-ON-OBJECT / CONCENTRIC TOOL
    tools.coincident = {
      hint: 'Coincident: Pick 2 points, OR point + edge, OR 2 circles/arcs (Concentric) • Right-click: exit',
      first: null,
      activate(arg = null) { this.first = arg || null; },
      _pickAt(e, w, excludePt = null) {
        const tol = 8 / Math.max(0.5, ctx.vp.scale);
        const ptEl = e && e.target && e.target.closest ? e.target.closest('[data-pt-geo]') : null;
        if (ptEl) {
          const geoId = Number(ptEl.getAttribute('data-pt-geo')), pos = ptEl.getAttribute('data-pt-pos');
          if (!excludePt || geoId !== excludePt.geoId || pos !== excludePt.pos) return { kind: 'point', geoId, pos };
        }
        const hitPt = global.SketchOps.findPointAt?.(ctx.model, w.x, w.y, tol, excludePt);
        if (hitPt) return { kind: 'point', geoId: hitPt.geoId, pos: hitPt.pos };
        const hitGeoId = global.SketchOps.findGeoAt(ctx.model, w.x, w.y, tol);
        return hitGeoId ? { kind: 'geo', geoId: hitGeoId } : null;
      },
      onMove(e, w) {
        const excl = this.first && this.first.kind === 'point' ? this.first : null;
        const pick = this._pickAt(e, w, excl);
        const nextPt = pick && pick.kind === 'point' ? { geoId: pick.geoId, pos: pick.pos } : null;
        const nextGeo = pick && pick.kind === 'geo' ? pick.geoId : null;
        const prevPt = ctx.vp.hoverPoint;
        const changed = (!!prevPt !== !!nextPt)
          || (prevPt && nextPt && (prevPt.geoId !== nextPt.geoId || prevPt.pos !== nextPt.pos))
          || ctx.vp.hoverGeoId !== nextGeo;
        if (changed) {
          ctx.vp.hoverPoint = nextPt;
          ctx.vp.hoverGeoId = nextGeo;
          ctx.vp.render();
        }
      },
      onDown(e, w) {
        const excl = this.first && this.first.kind === 'point' ? this.first : null;
        const pick = this._pickAt(e, w, excl);
        if (!pick) return;

        if (!this.first) {
          this.first = pick;
          ctx.vp.clearSelection();
          if (pick.kind === 'point') ctx.vp.selectedPoints.push({ geoId: pick.geoId, pos: pick.pos });
          else ctx.vp.selectedGeos.add(pick.geoId);
          ctx.vp.render();
          notify('Coincident: chọn điểm hoặc cạnh thứ 2', 'info');
          return;
        }

        const a = this.first, b = pick;
        let applied = false;
        let msg = null;
        if (a.kind === 'point' && b.kind === 'point') {
          if (!(a.geoId === b.geoId && a.pos === b.pos)) {
            ctx.model.pushHistory();
            ctx.model.addConstraint('coincident', [{ geoId: a.geoId, pos: a.pos }, { geoId: b.geoId, pos: b.pos }]);
            applied = true;
            msg = 'Đã gắn Coincident';
          }
        } else if (a.kind === 'point' && b.kind === 'geo' && a.geoId !== b.geoId) {
          ctx.model.pushHistory();
          ctx.model.addConstraint('pointOnObject', [{ geoId: a.geoId, pos: a.pos }, { geoId: b.geoId }]);
          applied = true;
          msg = 'Đã gắn Điểm trên cạnh';
        } else if (b.kind === 'point' && a.kind === 'geo' && b.geoId !== a.geoId) {
          ctx.model.pushHistory();
          ctx.model.addConstraint('pointOnObject', [{ geoId: b.geoId, pos: b.pos }, { geoId: a.geoId }]);
          applied = true;
          msg = 'Đã gắn Điểm trên cạnh';
        } else if (a.kind === 'geo' && b.kind === 'geo' && a.geoId !== b.geoId) {
          const ga = ctx.model.getGeo(a.geoId), gb = ctx.model.getGeo(b.geoId);
          if ((ga?.type === 'circle' || ga?.type === 'arc') && (gb?.type === 'circle' || gb?.type === 'arc')) {
            ctx.model.pushHistory();
            ctx.model.addConstraint('coincident', [{ geoId: ga.id, pos: 'center' }, { geoId: gb.id, pos: 'center' }]);
            applied = true;
            msg = 'Đã gắn Đồng tâm (Concentric)';
          } else {
            notify('Coincident chỉ áp dụng cho 2 điểm, điểm + cạnh, hoặc 2 đường tròn/cung tròn', 'warn');
          }
        }

        this.first = null;
        ctx.vp.hoverPoint = null;
        ctx.vp.hoverGeoId = null;
        ctx.vp.clearSelection();
        if (applied) { ctx.solve(); if (msg) notify(msg, 'ok'); }
        ctx.vp.render();
        ctx.updateUI();
      },
      onKey(e) {
        if (e.key === 'Escape') {
          if (this.first) { this.first = null; ctx.vp.hoverPoint = null; ctx.vp.hoverGeoId = null; ctx.vp.clearSelection(); ctx.vp.render(); return true; }
          ctx.vp.hoverPoint = null; ctx.vp.hoverGeoId = null;
          return false;
        }
      },
    };

    return tools;
  }

  global.SketchTools = { createTools };
})(window);
