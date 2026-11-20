(function (global) {
  'use strict';

  /**
   * Pure JS 2D Geometry Operations (DOM-free).
   * Trim, Fillet, Offset, Mirror/Symmetry, Clone, Move, Rotate, Scale, Array.
   */
  const TWO_PI = Math.PI * 2;
  const normAngle = (a) => ((a % TWO_PI) + TWO_PI) % TWO_PI;

  function isAngleOnArc(ang, sa, ea) {
    const a = normAngle(ang - sa);
    const span = normAngle(ea - sa);
    return a <= span + 1e-6;
  }

  function intersectLineLine(l1, l2, segOnly = true) {
    const dx1 = l1.x2 - l1.x1, dy1 = l1.y2 - l1.y1;
    const dx2 = l2.x2 - l2.x1, dy2 = l2.y2 - l2.y1;
    const den = dx1 * dy2 - dy1 * dx2;
    if (Math.abs(den) < 1e-9) return [];
    const t = ((l2.x1 - l1.x1) * dy2 - (l2.y1 - l1.y1) * dx2) / den;
    const u = ((l2.x1 - l1.x1) * dy1 - (l2.y1 - l1.y1) * dx1) / den;
    if (segOnly && (t < -1e-5 || t > 1 + 1e-5 || u < -1e-5 || u > 1 + 1e-5)) return [];
    return [{ x: l1.x1 + t * dx1, y: l1.y1 + t * dy1, t1: t, t2: u }];
  }

  function intersectLineCircle(l, c, segOnly = true) {
    const dx = l.x2 - l.x1, dy = l.y2 - l.y1;
    const fx = l.x1 - c.cx, fy = l.y1 - c.cy;
    const a = dx * dx + dy * dy;
    if (a < 1e-9) return [];
    const b = 2 * (fx * dx + fy * dy);
    const cc = fx * fx + fy * fy - c.r * c.r;
    const disc = b * b - 4 * a * cc;
    if (disc < -1e-6) return [];
    const sq = Math.sqrt(Math.max(0, disc));
    const out = [];
    for (const t of [(-b - sq) / (2 * a), (-b + sq) / (2 * a)]) {
      if (segOnly && (t < -1e-5 || t > 1 + 1e-5)) continue;
      const x = l.x1 + t * dx, y = l.y1 + t * dy;
      if (c.type === 'arc') {
        const ang = Math.atan2(y - c.cy, x - c.cx);
        if (!isAngleOnArc(ang, c.startAngle, c.endAngle)) continue;
      }
      out.push({ x, y, t });
    }
    return out;
  }

  function intersectCircleCircle(c1, c2) {
    const dx = c2.cx - c1.cx, dy = c2.cy - c1.cy;
    const d = Math.hypot(dx, dy);
    if (d < 1e-6 || d > c1.r + c2.r + 1e-5 || d < Math.abs(c1.r - c2.r) - 1e-5) return [];
    const a = (c1.r * c1.r - c2.r * c2.r + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, c1.r * c1.r - a * a));
    const xm = c1.cx + (a * dx) / d;
    const ym = c1.cy + (a * dy) / d;
    const rx = (-dy * h) / d;
    const ry = (dx * h) / d;
    const pts = [{ x: xm + rx, y: ym + ry }];
    if (h > 1e-5) pts.push({ x: xm - rx, y: ym - ry });
    return pts.filter((p) => {
      if (c1.type === 'arc' && !isAngleOnArc(Math.atan2(p.y - c1.cy, p.x - c1.cx), c1.startAngle, c1.endAngle)) return false;
      if (c2.type === 'arc' && !isAngleOnArc(Math.atan2(p.y - c2.cy, p.x - c2.cx), c2.startAngle, c2.endAngle)) return false;
      return true;
    });
  }

  function getIntersections(g1, g2) {
    if (g1.type === 'line' && g2.type === 'line') return intersectLineLine(g1, g2, true);
    if (g1.type === 'line' && (g2.type === 'circle' || g2.type === 'arc')) return intersectLineCircle(g1, g2, true);
    if ((g1.type === 'circle' || g1.type === 'arc') && g2.type === 'line') return intersectLineCircle(g2, g1, true);
    if ((g1.type === 'circle' || g1.type === 'arc') && (g2.type === 'circle' || g2.type === 'arc')) return intersectCircleCircle(g1, g2);
    return [];
  }

  function removeEndpointConstraints(model, geoId, pos) {
    model.constraints = model.constraints.filter((c) => {
      if (c.type !== 'coincident' && c.type !== 'pointOnObject' && c.type !== 'lock') return true;
      return !c.refs.some((r) => r.geoId === geoId && r.pos === pos);
    });
  }

  function transferEndpointConstraints(model, oldId, oldPos, newId, newPos) {
    for (const c of model.constraints) {
      if (c.type !== 'coincident' && c.type !== 'pointOnObject' && c.type !== 'lock') continue;
      for (const r of c.refs) {
        if (r.geoId === oldId && r.pos === oldPos) {
          r.geoId = newId;
          r.pos = newPos;
        }
      }
    }
  }

  function computeTrimInfo(model, geoId, px, py, extraGeos = []) {
    const g = model.getGeo(geoId);
    if (!g || g.type === 'point') return null;
    const hits = [];
    for (const other of model.geometries) {
      if (other.id === g.id || other.type === 'point') continue;
      for (const p of getIntersections(g, other)) hits.push(p);
    }
    for (const ex of extraGeos) {
      for (const p of getIntersections(g, ex)) hits.push(p);
    }

    if (g.type === 'line') {
      const dx = g.x2 - g.x1, dy = g.y2 - g.y1;
      const len2 = dx * dx + dy * dy;
      if (len2 < 1e-6) return null;
      const tClick = Math.max(0, Math.min(1, ((px - g.x1) * dx + (py - g.y1) * dy) / len2));
      const ts = [0, 1];
      for (const h of hits) {
        const t = ((h.x - g.x1) * dx + (h.y - g.y1) * dy) / len2;
        if (t > 1e-4 && t < 1 - 1e-4) ts.push(t);
      }
      ts.sort((a, b) => a - b);
      const uniq = ts.filter((v, i) => i === 0 || v - ts[i - 1] > 1e-4);
      let segIdx = 0;
      for (let i = 0; i < uniq.length - 1; i++) {
        if (tClick >= uniq[i] && tClick <= uniq[i + 1]) { segIdx = i; break; }
      }
      const ptAt = (t) => ({ x: g.x1 + t * dx, y: g.y1 + t * dy });
      const tA = uniq[segIdx], tB = uniq[segIdx + 1];
      const pA = ptAt(tA), pB = ptAt(tB);
      return { g, uniq, segIdx, pA, pB, preview: { type: 'line', x1: pA.x, y1: pA.y, x2: pB.x, y2: pB.y } };
    }

    if (g.type === 'circle') {
      const angs = hits.map((h) => normAngle(Math.atan2(h.y - g.cy, h.x - g.cx))).sort((a, b) => a - b);
      const uniq = angs.filter((v, i) => i === 0 || v - angs[i - 1] > 1e-3);
      if (uniq.length < 2) return { g, uniq, preview: { type: 'circle', cx: g.cx, cy: g.cy, r: g.r } };
      const aClick = normAngle(Math.atan2(py - g.cy, px - g.cx));
      let idx = uniq.length - 1;
      for (let i = 0; i < uniq.length - 1; i++) {
        if (aClick >= uniq[i] && aClick <= uniq[i + 1]) { idx = i; break; }
      }
      const sa = uniq[(idx + 1) % uniq.length], ea = uniq[idx];
      return { g, uniq, idx, sa, ea, preview: { type: 'arc', cx: g.cx, cy: g.cy, r: g.r, startAngle: ea, endAngle: sa } };
    }

    if (g.type === 'arc') {
      const sa = normAngle(g.startAngle);
      const span = normAngle(g.endAngle - g.startAngle);
      const aClick = normAngle(Math.atan2(py - g.cy, px - g.cx) - sa);
      const rel = [0, span];
      for (const h of hits) {
        const a = normAngle(Math.atan2(h.y - g.cy, h.x - g.cx) - sa);
        if (a > 1e-3 && a < span - 1e-3) rel.push(a);
      }
      rel.sort((a, b) => a - b);
      const uniq = rel.filter((v, i) => i === 0 || v - rel[i - 1] > 1e-3);
      if (uniq.length <= 2) return { g, uniq, preview: { type: 'arc', cx: g.cx, cy: g.cy, r: g.r, startAngle: g.startAngle, endAngle: g.endAngle } };
      let idx = 0;
      for (let i = 0; i < uniq.length - 1; i++) {
        if (aClick >= uniq[i] && aClick <= uniq[i + 1]) { idx = i; break; }
      }
      return { g, uniq, idx, sa, preview: { type: 'arc', cx: g.cx, cy: g.cy, r: g.r, startAngle: sa + uniq[idx], endAngle: sa + uniq[idx + 1] } };
    }
    return null;
  }

  function previewTrimAt(model, geoId, px, py, extraGeos = []) {
    const info = computeTrimInfo(model, geoId, px, py, extraGeos);
    return info ? info.preview : null;
  }

  /**
   * Trim geometry at click point (px, py) to nearest intersection points,
   * cleaning/transferring endpoint constraints so solver won't snap trimmed ends back.
   */
  function trimAt(model, geoId, px, py, extraGeos = []) {
    const info = computeTrimInfo(model, geoId, px, py, extraGeos);
    if (!info) return false;
    const { g } = info;

    if (g.type === 'line') {
      const { uniq, segIdx, pA, pB } = info;
      if (uniq.length <= 2) {
        model.removeGeo(g.id);
        return true;
      }
      if (segIdx === 0) {
        removeEndpointConstraints(model, g.id, 'start');
        g.x1 = pB.x; g.y1 = pB.y;
      } else if (segIdx === uniq.length - 2) {
        removeEndpointConstraints(model, g.id, 'end');
        g.x2 = pA.x; g.y2 = pA.y;
      } else {
        const origX2 = g.x2, origY2 = g.y2;
        g.x2 = pA.x; g.y2 = pA.y;
        const newL = model.addLine(pB.x, pB.y, origX2, origY2, g.construction);
        transferEndpointConstraints(model, g.id, 'end', newL.id, 'end');
        for (const c of [...model.constraints]) {
          if ((c.type === 'horizontal' || c.type === 'vertical' || c.type === 'diag45') && c.refs.some((r) => r.geoId === g.id)) {
            model.addConstraint(c.type, [{ geoId: newL.id }], c.sign !== undefined ? { sign: c.sign } : null);
          }
        }
      }
      return true;
    }

    if (g.type === 'circle') {
      if (info.uniq.length < 2) { model.removeGeo(g.id); return true; }
      model.removeGeo(g.id);
      model.addArc(g.cx, g.cy, g.r, info.sa, info.ea, g.construction);
      return true;
    }

    if (g.type === 'arc') {
      const { uniq, idx, sa } = info;
      if (uniq.length <= 2) { model.removeGeo(g.id); return true; }
      if (idx === 0) {
        removeEndpointConstraints(model, g.id, 'start');
        g.startAngle = sa + uniq[1];
      } else if (idx === uniq.length - 2) {
        removeEndpointConstraints(model, g.id, 'end');
        g.endAngle = sa + uniq[uniq.length - 2];
      } else {
        const origEnd = g.endAngle;
        g.endAngle = sa + uniq[idx];
        const newArc = model.addArc(g.cx, g.cy, g.r, sa + uniq[idx + 1], origEnd, g.construction);
        transferEndpointConstraints(model, g.id, 'end', newArc.id, 'end');
      }
      return true;
    }
    return false;
  }

  /**
   * Fillet two lines with given radius.
   */
  function filletLines(model, id1, id2, radius = 0) {
    const l1 = model.getGeo(id1), l2 = model.getGeo(id2);
    if (!l1 || !l2 || l1.type !== 'line' || l2.type !== 'line') return { ok: false, msg: 'Select 2 lines' };
    const inter = intersectLineLine(l1, l2, false);
    if (!inter.length) return { ok: false, msg: 'Lines are parallel' };
    const ix = inter[0].x, iy = inter[0].y;

    // Pick direction from intersection toward the farther endpoint of each line
    const farEnd = (l) => {
      const d1 = Math.hypot(l.x1 - ix, l.y1 - iy);
      const d2 = Math.hypot(l.x2 - ix, l.y2 - iy);
      return d1 >= d2 ? { end: 'start', fx: l.x1, fy: l.y1, len: d1 } : { end: 'end', fx: l.x2, fy: l.y2, len: d2 };
    };
    const f1 = farEnd(l1), f2 = farEnd(l2);
    if (f1.len < 1e-3 || f2.len < 1e-3) return { ok: false, msg: 'Line too short' };

    const pos1 = f1.end === 'start' ? 'end' : 'start';
    const pos2 = f2.end === 'start' ? 'end' : 'start';

    // Sharp corner (radius <= 0): extend/trim both lines to meet cleanly at intersection vertex
    if (!(radius > 0)) {
      removeEndpointConstraints(model, l1.id, pos1);
      removeEndpointConstraints(model, l2.id, pos2);
      if (f1.end === 'start') { l1.x2 = ix; l1.y2 = iy; } else { l1.x1 = ix; l1.y1 = iy; }
      if (f2.end === 'start') { l2.x2 = ix; l2.y2 = iy; } else { l2.x1 = ix; l2.y1 = iy; }
      model.addConstraint('coincident', [{ geoId: l1.id, pos: pos1 }, { geoId: l2.id, pos: pos2 }]);
      return { ok: true, arc: null, dimId: null };
    }

    const u1x = (f1.fx - ix) / f1.len, u1y = (f1.fy - iy) / f1.len;
    const u2x = (f2.fx - ix) / f2.len, u2y = (f2.fy - iy) / f2.len;
    const dot = Math.max(-0.999, Math.min(0.999, u1x * u2x + u1y * u2y));
    const halfAngle = Math.acos(dot) / 2;
    const tanHalf = Math.tan(halfAngle);
    if (tanHalf < 1e-4) return { ok: false, msg: 'Angle too small' };

    const tDist = radius / tanHalf;
    if (tDist > f1.len * 0.95 || tDist > f2.len * 0.95) {
      return { ok: false, msg: 'Fillet radius too large for lines' };
    }

    const t1x = ix + u1x * tDist, t1y = iy + u1y * tDist;
    const t2x = ix + u2x * tDist, t2y = iy + u2y * tDist;

    // Trim lines to tangent points
    if (f1.end === 'start') { l1.x2 = t1x; l1.y2 = t1y; } else { l1.x1 = t1x; l1.y1 = t1y; }
    if (f2.end === 'start') { l2.x2 = t2x; l2.y2 = t2y; } else { l2.x1 = t2x; l2.y1 = t2y; }

    // Bisector for arc center
    let bx = u1x + u2x, by = u1y + u2y;
    const bl = Math.hypot(bx, by) || 1;
    bx /= bl; by /= bl;
    const cDist = radius / Math.sin(halfAngle);
    const cx = ix + bx * cDist, cy = iy + by * cDist;

    const a1 = Math.atan2(t1y - cy, t1x - cx);
    const a2 = Math.atan2(t2y - cy, t2x - cx);
    const cross = (t1x - cx) * (t2y - cy) - (t1y - cy) * (t2x - cx);
    const arc = cross >= 0
      ? model.addArc(cx, cy, radius, a1, a2, l1.construction)
      : model.addArc(cx, cy, radius, a2, a1, l1.construction);

    // Remove any existing coincident constraint between the two trimmed endpoints (e.g. Rectangle/Polyline corner)
    model.constraints = model.constraints.filter((c) => {
      if (c.type !== 'coincident' || c.refs.length < 2) return true;
      const has1 = c.refs.some((r) => r.geoId === l1.id && r.pos === pos1);
      const has2 = c.refs.some((r) => r.geoId === l2.id && r.pos === pos2);
      return !(has1 && has2);
    });

    model.addConstraint('coincident', [{ geoId: l1.id, pos: pos1 }, { geoId: arc.id, pos: cross >= 0 ? 'start' : 'end' }]);
    model.addConstraint('coincident', [{ geoId: l2.id, pos: pos2 }, { geoId: arc.id, pos: cross >= 0 ? 'end' : 'start' }]);
    model.addConstraint('tangent', [{ geoId: l1.id }, { geoId: arc.id }]);
    model.addConstraint('tangent', [{ geoId: l2.id }, { geoId: arc.id }]);
    const rConst = model.addConstraint('radius', [{ geoId: arc.id }], { value: radius, hidden: true });
    return { ok: true, arc, dimId: rConst ? rConst.id : null };
  }

  function previewCornerOp(model, id1, id2, distOrR = 10, isChamfer = false) {
    const l1 = model.getGeo(id1), l2 = model.getGeo(id2);
    if (!l1 || !l2 || l1.type !== 'line' || l2.type !== 'line') return null;
    const inter = intersectLineLine(l1, l2, false);
    if (!inter.length) return null;
    const ix = inter[0].x, iy = inter[0].y;
    const farEnd = (l) => {
      const d1 = Math.hypot(l.x1 - ix, l.y1 - iy);
      const d2 = Math.hypot(l.x2 - ix, l.y2 - iy);
      return d1 >= d2 ? { fx: l.x1, fy: l.y1, len: d1 } : { fx: l.x2, fy: l.y2, len: d2 };
    };
    const f1 = farEnd(l1), f2 = farEnd(l2);
    if (f1.len < 1e-3 || f2.len < 1e-3) return null;
    const u1x = (f1.fx - ix) / f1.len, u1y = (f1.fy - iy) / f1.len;
    const u2x = (f2.fx - ix) / f2.len, u2y = (f2.fy - iy) / f2.len;

    if (isChamfer) {
      if (distOrR >= f1.len * 0.95 || distOrR >= f2.len * 0.95) return null;
      return { type: 'line', x1: ix + u1x * distOrR, y1: iy + u1y * distOrR, x2: ix + u2x * distOrR, y2: iy + u2y * distOrR };
    }
    if (!(distOrR > 0)) {
      return { type: 'point', x: ix, y: iy };
    }

    const dot = Math.max(-0.999, Math.min(0.999, u1x * u2x + u1y * u2y));
    const halfAngle = Math.acos(dot) / 2;
    const tanHalf = Math.tan(halfAngle);
    if (tanHalf < 1e-4) return null;
    const tDist = distOrR / tanHalf;
    if (tDist > f1.len * 0.95 || tDist > f2.len * 0.95) return null;

    const t1x = ix + u1x * tDist, t1y = iy + u1y * tDist;
    const t2x = ix + u2x * tDist, t2y = iy + u2y * tDist;
    let bx = u1x + u2x, by = u1y + u2y;
    const bl = Math.hypot(bx, by) || 1;
    bx /= bl; by /= bl;
    const cDist = distOrR / Math.sin(halfAngle);
    const cx = ix + bx * cDist, cy = iy + by * cDist;
    const a1 = Math.atan2(t1y - cy, t1x - cx), a2 = Math.atan2(t2y - cy, t2x - cx);
    const cross = (t1x - cx) * (t2y - cy) - (t1y - cy) * (t2x - cx);
    return cross >= 0
      ? { type: 'arc', cx, cy, r: distOrR, startAngle: a1, endAngle: a2 }
      : { type: 'arc', cx, cy, r: distOrR, startAngle: a2, endAngle: a1 };
  }

  /**
   * Compute offset shapes for a set of geometries (supports chains/loops with Intersection or Arc corners).
   */
  function computeOffsetShapes(model, geoIds, dist, sidePt, opts = {}) {
    const mode = opts.mode || 'intersection';
    const tol = 0.05;
    const shapes = [];

    // Separate circles/arcs and line chains
    const lines = [];
    for (const id of geoIds) {
      const g = model.getGeo(id);
      if (!g) continue;
      if (g.type === 'circle' || g.type === 'arc') {
        const d = sidePt ? Math.hypot(sidePt.x - g.cx, sidePt.y - g.cy) - g.r : dist;
        const nr = Math.max(1, g.r + (d >= 0 ? dist : -dist));
        if (g.type === 'circle') shapes.push({ type: 'circle', cx: g.cx, cy: g.cy, r: nr, construction: g.construction, srcId: g.id });
        else shapes.push({ type: 'arc', cx: g.cx, cy: g.cy, r: nr, startAngle: g.startAngle, endAngle: g.endAngle, construction: g.construction, srcId: g.id });
      } else if (g.type === 'line') {
        lines.push(g);
      }
    }

    // Order lines into connected chains
    const used = new Set();
    const chains = [];
    for (const l of lines) {
      if (used.has(l.id)) continue;
      used.add(l.id);
      const chain = [{ x1: l.x1, y1: l.y1, x2: l.x2, y2: l.y2, construction: l.construction, srcId: l.id }];
      let grew = true;
      while (grew) {
        grew = false;
        const head = chain[0], tail = chain[chain.length - 1];
        for (const o of lines) {
          if (used.has(o.id)) continue;
          if (Math.hypot(o.x1 - tail.x2, o.y1 - tail.y2) < tol) {
            used.add(o.id); chain.push({ x1: o.x1, y1: o.y1, x2: o.x2, y2: o.y2, construction: o.construction, srcId: o.id }); grew = true; break;
          }
          if (Math.hypot(o.x2 - tail.x2, o.y2 - tail.y2) < tol) {
            used.add(o.id); chain.push({ x1: o.x2, y1: o.y2, x2: o.x1, y2: o.y1, construction: o.construction, srcId: o.id }); grew = true; break;
          }
          if (Math.hypot(o.x2 - head.x1, o.y2 - head.y1) < tol) {
            used.add(o.id); chain.unshift({ x1: o.x1, y1: o.y1, x2: o.x2, y2: o.y2, construction: o.construction, srcId: o.id }); grew = true; break;
          }
          if (Math.hypot(o.x1 - head.x1, o.y1 - head.y1) < tol) {
            used.add(o.id); chain.unshift({ x1: o.x2, y1: o.y2, x2: o.x1, y2: o.y1, construction: o.construction, srcId: o.id }); grew = true; break;
          }
        }
      }
      chains.push(chain);
    }

    for (const chain of chains) {
      const n = chain.length;
      const isClosed = n >= 2 && Math.hypot(chain[0].x1 - chain[n - 1].x2, chain[0].y1 - chain[n - 1].y2) < tol;

      // Determine consistent side sign (+1 left normal, -1 right normal) from nearest segment to sidePt
      let sideSign = 1;
      if (sidePt) {
        let bestD = Infinity;
        for (const s of chain) {
          const dx = s.x2 - s.x1, dy = s.y2 - s.y1, len2 = dx * dx + dy * dy || 1;
          const t = Math.max(0, Math.min(1, ((sidePt.x - s.x1) * dx + (sidePt.y - s.y1) * dy) / len2));
          const px = s.x1 + t * dx, py = s.y1 + t * dy;
          const d = Math.hypot(sidePt.x - px, sidePt.y - py);
          if (d < bestD) {
            bestD = d;
            const cross = (sidePt.x - s.x1) * dy - (sidePt.y - s.y1) * dx;
            // Left normal is (-dy, dx): dot with (sidePt - p1) is -(sidePt.x-x1)*dy + (sidePt.y-y1)*dx = -cross
            sideSign = -cross >= 0 ? 1 : -1;
          }
        }
      }

      const offSegs = chain.map((s) => {
        const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
        const len = Math.hypot(dx, dy) || 1;
        const nx = (-dy / len) * sideSign, ny = (dx / len) * sideSign;
        return {
          x1: s.x1 + nx * dist, y1: s.y1 + ny * dist,
          x2: s.x2 + nx * dist, y2: s.y2 + ny * dist,
          cx: s.x2, cy: s.y2,
          construction: s.construction, srcId: s.srcId,
        };
      });

      const cornerArcs = [];
      const limit = isClosed ? n : n - 1;
      for (let i = 0; i < limit; i++) {
        const a = offSegs[i];
        const b = offSegs[(i + 1) % n];
        const inter = intersectLineLine(a, b, false);
        if (inter.length) {
          // Check if corner is convex outward (arc mode inserts arc when expanding)
          const gap = Math.hypot(a.x2 - b.x1, a.y2 - b.y1);
          const v1x = a.x2 - a.x1, v1y = a.y2 - a.y1;
          const v2x = b.x2 - b.x1, v2y = b.y2 - b.y1;
          const cross = v1x * v2y - v1y * v2x;
          const isOutward = cross * sideSign < 0;

          if (mode === 'arc' && isOutward && gap > 0.5) {
            const cx = chain[i].x2, cy = chain[i].y2;
            const ang1 = Math.atan2(a.y2 - cy, a.x2 - cx);
            const ang2 = Math.atan2(b.y1 - cy, b.x1 - cx);
            const sweep = Math.atan2(Math.sin(ang2 - ang1), Math.cos(ang2 - ang1));
            cornerArcs.push(sweep >= 0
              ? { type: 'arc', cx, cy, r: dist, startAngle: ang1, endAngle: ang2, construction: a.construction }
              : { type: 'arc', cx, cy, r: dist, startAngle: ang2, endAngle: ang1, construction: a.construction });
          } else {
            a.x2 = inter[0].x; a.y2 = inter[0].y;
            b.x1 = inter[0].x; b.y1 = inter[0].y;
          }
        }
      }

      for (const s of offSegs) shapes.push({ type: 'line', ...s });
      for (const a of cornerArcs) shapes.push(a);
    }

    return shapes;
  }

  function offsetGeos(model, geoIds, dist, sidePt, opts = {}) {
    const shapes = computeOffsetShapes(model, geoIds, dist, sidePt, opts);
    const created = [];
    const createdLines = [];
    let firstDim = null;
    const offsetGroup = `off_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    for (const s of shapes) {
      let ng = null;
      if (s.type === 'line') {
        ng = model.addLine(s.x1, s.y1, s.x2, s.y2, s.construction);
        createdLines.push({ ng, srcId: s.srcId });
        if (opts.addConstraints && s.srcId && !opts.deleteOriginal) {
          model.addConstraint('parallel', [{ geoId: s.srcId }, { geoId: ng.id }]);
          const dc = model.addConstraint(
            'distance',
            [{ geoId: ng.id, pos: 'start' }, { geoId: s.srcId, pos: 'none' }],
            { value: dist, offsetGroup, hidden: true }
          );
          if (!firstDim) firstDim = dc;
        }
      } else if (s.type === 'circle') {
        ng = model.addCircle(s.cx, s.cy, s.r, s.construction);
      } else if (s.type === 'arc') {
        ng = model.addArc(s.cx, s.cy, s.r, s.startAngle, s.endAngle, s.construction);
      }
      if (ng) created.push(ng);
    }

    // Connect consecutive offset lines with coincident constraints in Intersection mode
    if (opts.addConstraints && (opts.mode || 'intersection') === 'intersection' && createdLines.length >= 2) {
      const tol = 0.05;
      for (let i = 0; i < createdLines.length; i++) {
        const a = createdLines[i].ng;
        const b = createdLines[(i + 1) % createdLines.length].ng;
        if (a.id !== b.id && Math.hypot(a.x2 - b.x1, a.y2 - b.y1) < tol) {
          model.addConstraint('coincident', [{ geoId: a.id, pos: 'end' }, { geoId: b.id, pos: 'start' }]);
        }
      }
    }

    if (opts.deleteOriginal) {
      for (const id of geoIds) model.removeGeo(id);
    }
    const offsetMeta = !opts.deleteOriginal ? {
      srcIds: [...geoIds],
      newIds: created.map((x) => x.id),
      sidePt: sidePt ? { x: sidePt.x, y: sidePt.y } : null,
      mode: opts.mode || 'intersection',
      offsetGroup,
    } : null;
    if (firstDim && offsetMeta) firstDim.offsetMeta = offsetMeta;
    created.dimId = firstDim ? firstDim.id : null;
    return created;
  }

  function updateOffsetDistance(model, offsetMeta, newDist) {
    if (!offsetMeta) return false;
    const shapes = computeOffsetShapes(model, offsetMeta.srcIds, newDist, offsetMeta.sidePt, { mode: offsetMeta.mode });
    for (let i = 0; i < Math.min(shapes.length, offsetMeta.newIds.length); i++) {
      const g = model.getGeo(offsetMeta.newIds[i]);
      const s = shapes[i];
      if (!g || !s || g.type !== s.type) continue;
      if (g.type === 'line') { g.x1 = s.x1; g.y1 = s.y1; g.x2 = s.x2; g.y2 = s.y2; }
      else if (g.type === 'circle') { g.cx = s.cx; g.cy = s.cy; g.r = s.r; }
      else if (g.type === 'arc') { g.cx = s.cx; g.cy = s.cy; g.r = s.r; g.startAngle = s.startAngle; g.endAngle = s.endAngle; }
    }
    for (const c of model.constraints) {
      if (c.offsetGroup === offsetMeta.offsetGroup) c.value = newDist;
    }
    return true;
  }

  function duplicateGeo(model, g, transformPt, transformAngle = (a) => a, scaleR = 1) {
    if (g.type === 'point') {
      const p = transformPt(g.x, g.y);
      return model.addPoint(p.x, p.y, g.construction);
    }
    if (g.type === 'line') {
      const p1 = transformPt(g.x1, g.y1), p2 = transformPt(g.x2, g.y2);
      return model.addLine(p1.x, p1.y, p2.x, p2.y, g.construction);
    }
    if (g.type === 'circle') {
      const c = transformPt(g.cx, g.cy);
      return model.addCircle(c.x, c.y, g.r * scaleR, g.construction);
    }
    if (g.type === 'arc') {
      const c = transformPt(g.cx, g.cy);
      return model.addArc(c.x, c.y, g.r * scaleR, transformAngle(g.startAngle), transformAngle(g.endAngle), g.construction);
    }
    return null;
  }

  function mirrorGeos(model, geoIds, axisLineId) {
    const ax = model.getGeo(axisLineId);
    if (!ax || ax.type !== 'line') return [];
    const dx = ax.x2 - ax.x1, dy = ax.y2 - ax.y1;
    const len2 = dx * dx + dy * dy;
    if (len2 < 1e-6) return [];
    const ux = dx / Math.sqrt(len2), uy = dy / Math.sqrt(len2);
    const axisAngle = Math.atan2(uy, ux);

    const reflectPt = (x, y) => {
      const vx = x - ax.x1, vy = y - ax.y1;
      const dot = vx * ux + vy * uy;
      const px = ax.x1 + dot * ux, py = ax.y1 + dot * uy;
      return { x: 2 * px - x, y: 2 * py - y };
    };

    const created = [];
    for (const id of geoIds) {
      if (id === axisLineId) continue;
      const g = model.getGeo(id);
      if (!g) continue;
      if (g.type === 'arc') {
        const c = reflectPt(g.cx, g.cy);
        const sa = 2 * axisAngle - g.endAngle;
        const ea = 2 * axisAngle - g.startAngle;
        created.push(model.addArc(c.x, c.y, g.r, sa, ea, g.construction));
      } else {
        const ng = duplicateGeo(model, g, reflectPt);
        if (ng) created.push(ng);
      }
    }
    return created;
  }

  function moveGeos(model, geoIds, dx, dy, copy = false) {
    const out = [];
    for (const id of geoIds) {
      const g = model.getGeo(id);
      if (!g) continue;
      if (copy) {
        const ng = duplicateGeo(model, g, (x, y) => ({ x: x + dx, y: y + dy }));
        if (ng) out.push(ng);
      } else {
        if (g.type === 'point') { g.x += dx; g.y += dy; }
        else if (g.type === 'line') { g.x1 += dx; g.y1 += dy; g.x2 += dx; g.y2 += dy; }
        else if (g.type === 'circle' || g.type === 'arc') { g.cx += dx; g.cy += dy; }
      }
    }
    return out;
  }

  function rotateGeos(model, geoIds, cx, cy, angleRad, copy = false) {
    const cos = Math.cos(angleRad), sin = Math.sin(angleRad);
    const rot = (x, y) => {
      const vx = x - cx, vy = y - cy;
      return { x: cx + vx * cos - vy * sin, y: cy + vx * sin + vy * cos };
    };
    const out = [];
    for (const id of geoIds) {
      const g = model.getGeo(id);
      if (!g) continue;
      if (copy) {
        const ng = duplicateGeo(model, g, rot, (a) => a + angleRad);
        if (ng) out.push(ng);
      } else {
        if (g.type === 'point') { const p = rot(g.x, g.y); g.x = p.x; g.y = p.y; }
        else if (g.type === 'line') {
          const p1 = rot(g.x1, g.y1), p2 = rot(g.x2, g.y2);
          g.x1 = p1.x; g.y1 = p1.y; g.x2 = p2.x; g.y2 = p2.y;
        } else if (g.type === 'circle') {
          const c = rot(g.cx, g.cy); g.cx = c.x; g.cy = c.y;
        } else if (g.type === 'arc') {
          const c = rot(g.cx, g.cy); g.cx = c.x; g.cy = c.y;
          g.startAngle += angleRad; g.endAngle += angleRad;
        }
      }
    }
    return out;
  }

  function scaleGeos(model, geoIds, cx, cy, factor, copy = false) {
    const f = Math.max(0.05, factor);
    const sc = (x, y) => ({ x: cx + (x - cx) * f, y: cy + (y - cy) * f });
    const out = [];
    for (const id of geoIds) {
      const g = model.getGeo(id);
      if (!g) continue;
      if (copy) {
        const ng = duplicateGeo(model, g, sc, (a) => a, f);
        if (ng) out.push(ng);
      } else {
        if (g.type === 'point') { const p = sc(g.x, g.y); g.x = p.x; g.y = p.y; }
        else if (g.type === 'line') {
          const p1 = sc(g.x1, g.y1), p2 = sc(g.x2, g.y2);
          g.x1 = p1.x; g.y1 = p1.y; g.x2 = p2.x; g.y2 = p2.y;
        } else if (g.type === 'circle' || g.type === 'arc') {
          const c = sc(g.cx, g.cy); g.cx = c.x; g.cy = c.y; g.r *= f;
        }
      }
    }
    return out;
  }

  function arrayGeos(model, geoIds, opts) {
    const created = [];
    if (opts.mode === 'polar') {
      const count = Math.max(2, opts.count || 6);
      const cx = opts.cx || 0, cy = opts.cy || 0;
      const step = (TWO_PI) / count;
      for (let i = 1; i < count; i++) {
        created.push(...rotateGeos(model, geoIds, cx, cy, step * i, true));
      }
    } else {
      const cols = Math.max(1, opts.cols || 3);
      const rows = Math.max(1, opts.rows || 2);
      const dx = opts.dx || 40, dy = opts.dy || 40;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (r === 0 && c === 0) continue;
          created.push(...moveGeos(model, geoIds, c * dx, r * dy, true));
        }
      }
    }
    return created;
  }

  function chamferLines(model, id1, id2, dist = 10) {
    const l1 = model.getGeo(id1), l2 = model.getGeo(id2);
    if (!l1 || !l2 || l1.type !== 'line' || l2.type !== 'line') return { ok: false, msg: 'Select 2 lines' };
    const inter = intersectLineLine(l1, l2, false);
    if (!inter.length) return { ok: false, msg: 'Lines are parallel' };
    const ix = inter[0].x, iy = inter[0].y;

    const farEnd = (l) => {
      const d1 = Math.hypot(l.x1 - ix, l.y1 - iy);
      const d2 = Math.hypot(l.x2 - ix, l.y2 - iy);
      return d1 >= d2 ? { end: 'start', fx: l.x1, fy: l.y1, len: d1 } : { end: 'end', fx: l.x2, fy: l.y2, len: d2 };
    };
    const f1 = farEnd(l1), f2 = farEnd(l2);
    if (dist >= f1.len * 0.95 || dist >= f2.len * 0.95) {
      return { ok: false, msg: 'Chamfer distance too large for lines' };
    }

    const u1x = (f1.fx - ix) / f1.len, u1y = (f1.fy - iy) / f1.len;
    const u2x = (f2.fx - ix) / f2.len, u2y = (f2.fy - iy) / f2.len;
    const p1x = ix + u1x * dist, p1y = iy + u1y * dist;
    const p2x = ix + u2x * dist, p2y = iy + u2y * dist;

    if (f1.end === 'start') { l1.x2 = p1x; l1.y2 = p1y; } else { l1.x1 = p1x; l1.y1 = p1y; }
    if (f2.end === 'start') { l2.x2 = p2x; l2.y2 = p2y; } else { l2.x1 = p2x; l2.y1 = p2y; }

    const pos1 = f1.end === 'start' ? 'end' : 'start';
    const pos2 = f2.end === 'start' ? 'end' : 'start';

    model.constraints = model.constraints.filter((c) => {
      if (c.type !== 'coincident' || c.refs.length < 2) return true;
      const has1 = c.refs.some((r) => r.geoId === l1.id && r.pos === pos1);
      const has2 = c.refs.some((r) => r.geoId === l2.id && r.pos === pos2);
      return !(has1 && has2);
    });

    const cham = model.addLine(p1x, p1y, p2x, p2y, l1.construction);
    cham.chamferOf = [l1.id, l2.id];
    model.addConstraint('coincident', [{ geoId: l1.id, pos: pos1 }, { geoId: cham.id, pos: 'start' }]);
    model.addConstraint('coincident', [{ geoId: l2.id, pos: pos2 }, { geoId: cham.id, pos: 'end' }]);

    // Preserve line orientations (including arbitrary angles) so dragging chamfer only changes linear lengths
    const addOrient = (ln) => {
      const dx = ln.x2 - ln.x1, dy = ln.y2 - ln.y1, len = Math.hypot(dx, dy);
      if (len < 1e-3) return;
      const hasOrient = model.constraints.some((c) => (c.type === 'horizontal' || c.type === 'vertical' || c.type === 'diag45' || c.type === 'fixAngle') && c.refs.some((r) => r.geoId === ln.id));
      if (hasOrient) return;
      if (Math.abs(dy) / len < 0.04) model.addConstraint('horizontal', [{ geoId: ln.id }]);
      else if (Math.abs(dx) / len < 0.04) model.addConstraint('vertical', [{ geoId: ln.id }]);
      else if (Math.abs(Math.abs(dx) - Math.abs(dy)) / len < 0.08) model.addConstraint('diag45', [{ geoId: ln.id }], { sign: dx * dy >= 0 ? 1 : -1 });
      else model.addConstraint('fixAngle', [{ geoId: ln.id }], { angle: Math.atan2(dy, dx) });
    };
    addOrient(l1);
    addOrient(l2);
    addOrient(cham);
    return { ok: true, line: cham };
  }

  function slideChamfer(model, chamId, wx, wy) {
    const cham = model.getGeo(chamId);
    if (!cham || !cham.chamferOf) return false;
    const l1 = model.getGeo(cham.chamferOf[0]), l2 = model.getGeo(cham.chamferOf[1]);
    if (!l1 || !l2 || l1.type !== 'line' || l2.type !== 'line') return false;
    const inter = intersectLineLine(l1, l2, false);
    if (!inter.length) return false;
    const ix = inter[0].x, iy = inter[0].y;
    const farEnd = (l) => {
      const d1 = Math.hypot(l.x1 - ix, l.y1 - iy), d2 = Math.hypot(l.x2 - ix, l.y2 - iy);
      return d1 >= d2 ? { end: 'start', fx: l.x1, fy: l.y1, len: d1 } : { end: 'end', fx: l.x2, fy: l.y2, len: d2 };
    };
    const f1 = farEnd(l1), f2 = farEnd(l2);
    const maxDist = Math.min(f1.len, f2.len) * 0.92;
    if (maxDist < 0.4) return false;
    const u1x = (f1.fx - ix) / f1.len, u1y = (f1.fy - iy) / f1.len;
    const u2x = (f2.fx - ix) / f2.len, u2y = (f2.fy - iy) / f2.len;
    let bx = u1x + u2x, by = u1y + u2y;
    const bl = Math.hypot(bx, by) || 1;
    bx /= bl; by /= bl;
    const cosH = Math.max(0.2, Math.abs(bx * u1x + by * u1y));
    const proj = ((wx - ix) * bx + (wy - iy) * by) / cosH;
    const dist = Math.max(0.3, Math.min(maxDist, proj));
    const p1x = ix + u1x * dist, p1y = iy + u1y * dist;
    const p2x = ix + u2x * dist, p2y = iy + u2y * dist;
    if (f1.end === 'start') { l1.x2 = p1x; l1.y2 = p1y; } else { l1.x1 = p1x; l1.y1 = p1y; }
    if (f2.end === 'start') { l2.x2 = p2x; l2.y2 = p2y; } else { l2.x1 = p2x; l2.y1 = p2y; }
    cham.x1 = p1x; cham.y1 = p1y; cham.x2 = p2x; cham.y2 = p2y;
    return true;
  }

  /**
   * BFS connected chain (multiline / loop) from a starting geometry id.
   * Checks both geometric endpoint proximity and coincident constraints.
   */
  function getConnectedChain(model, startGeoId) {
    const visited = new Set([startGeoId]);
    const queue = [startGeoId];
    const tol = 0.05;
    while (queue.length) {
      const curId = queue.shift();
      const cur = model.getGeo(curId);
      if (!cur) continue;
      const curPts = model.getPointsOfGeo(cur).filter((p) => p.pos !== 'center');

      // Check coincident constraints
      for (const c of model.constraints) {
        if (c.type !== 'coincident') continue;
        if (c.refs.some((r) => r.geoId === curId)) {
          for (const r of c.refs) {
            if (r.geoId > 0 && !visited.has(r.geoId)) {
              visited.add(r.geoId);
              queue.push(r.geoId);
            }
          }
        }
      }

      // Check geometric endpoint proximity
      for (const other of model.geometries) {
        if (visited.has(other.id)) continue;
        const otherPts = model.getPointsOfGeo(other).filter((p) => p.pos !== 'center');
        const touches = curPts.some((a) => otherPts.some((b) => Math.hypot(a.x - b.x, a.y - b.y) < tol));
        if (touches) {
          visited.add(other.id);
          queue.push(other.id);
        }
      }
    }
    return [...visited];
  }

  /**
   * Mathematical hit-test in world coordinates (immune to SVG DOM re-render).
   */
  function findPointAt(model, x, y, tol = 2, exclude = null) {
    let best = null;
    let bestD = tol;
    for (const g of model.geometries) {
      for (const p of model.getPointsOfGeo(g)) {
        if (exclude && p.geoId === exclude.geoId && p.pos === exclude.pos) continue;
        const d = Math.hypot(p.x - x, p.y - y);
        if (d < bestD) {
          bestD = d;
          best = { geoId: p.geoId, pos: p.pos, x: p.x, y: p.y };
        }
      }
    }
    return best;
  }

  function findGeoAt(model, x, y, tol = 5) {
    let bestId = null;
    let bestD = tol;
    for (const g of model.geometries) {
      let d = Infinity;
      if (g.type === 'line') {
        const dx = g.x2 - g.x1, dy = g.y2 - g.y1;
        const len2 = dx * dx + dy * dy;
        const t = len2 > 1e-9 ? Math.max(0, Math.min(1, ((x - g.x1) * dx + (y - g.y1) * dy) / len2)) : 0;
        d = Math.hypot(x - (g.x1 + t * dx), y - (g.y1 + t * dy));
      } else if (g.type === 'circle') {
        d = Math.abs(Math.hypot(x - g.cx, y - g.cy) - g.r);
      } else if (g.type === 'arc') {
        const ang = Math.atan2(y - g.cy, x - g.cx);
        if (isAngleOnArc(ang, g.startAngle, g.endAngle)) {
          d = Math.abs(Math.hypot(x - g.cx, y - g.cy) - g.r);
        }
      }
      if (d < bestD) { bestD = d; bestId = g.id; }
    }
    return bestId;
  }

  /**
   * Box / Marquee selection:
   * crossing=false (left-to-right): all endpoints/bbox inside box
   * crossing=true (right-to-left): any part inside or intersecting box
   */
  function geometriesInBox(model, x1, y1, x2, y2, crossing) {
    const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
    const inBox = (x, y) => x >= minX && x <= maxX && y >= minY && y <= maxY;

    const boxEdges = [
      { x1: minX, y1: minY, x2: maxX, y2: minY },
      { x1: maxX, y1: minY, x2: maxX, y2: maxY },
      { x1: maxX, y1: maxY, x2: minX, y2: maxY },
      { x1: minX, y1: maxY, x2: minX, y2: minY },
    ];

    const out = [];
    for (const g of model.geometries) {
      if (g.type === 'point') {
        if (inBox(g.x, g.y)) out.push(g.id);
      } else if (g.type === 'line') {
        const aIn = inBox(g.x1, g.y1), bIn = inBox(g.x2, g.y2);
        if (!crossing) {
          if (aIn && bIn) out.push(g.id);
        } else {
          if (aIn || bIn || boxEdges.some((e) => intersectLineLine(g, e, true).length > 0)) out.push(g.id);
        }
      } else if (g.type === 'circle') {
        const allIn = g.cx - g.r >= minX && g.cx + g.r <= maxX && g.cy - g.r >= minY && g.cy + g.r <= maxY;
        if (!crossing) {
          if (allIn) out.push(g.id);
        } else {
          if (allIn || inBox(g.cx, g.cy) || boxEdges.some((e) => intersectLineCircle(e, g, true).length > 0)) out.push(g.id);
        }
      } else if (g.type === 'arc') {
        const pts = model.getPointsOfGeo(g).filter((p) => p.pos !== 'center');
        const allIn = pts.every((p) => inBox(p.x, p.y));
        if (!crossing) {
          if (allIn) out.push(g.id);
        } else {
          if (pts.some((p) => inBox(p.x, p.y)) || boxEdges.some((e) => intersectLineCircle(e, g, true).length > 0)) out.push(g.id);
        }
      }
    }
    return out;
  }

  /**
   * Extract clean non-construction profiles (closed loops, open wires, circles, bbox)
   * when finishing a sketch (similar to FreeCAD's Wire/Shape output).
   */
  function extractProfiles(model) {
    const active = model.geometries.filter((g) => !g.construction && g.type !== 'point');
    const circles = active.filter((g) => g.type === 'circle');
    const segs = active.filter((g) => g.type === 'line' || g.type === 'arc');
    const used = new Set();
    const closedLoops = [];
    const openWires = [];
    const tol = 0.05;

    const getEnds = (g) => {
      const pts = model.getPointsOfGeo(g).filter((p) => p.pos === 'start' || p.pos === 'end');
      return { start: pts[0], end: pts[1] };
    };

    for (const g of segs) {
      if (used.has(g.id)) continue;
      used.add(g.id);
      const chain = [g];
      let head = getEnds(g).start;
      let tail = getEnds(g).end;
      let grew = true;
      while (grew) {
        grew = false;
        for (const other of segs) {
          if (used.has(other.id)) continue;
          const e = getEnds(other);
          if (Math.hypot(e.start.x - tail.x, e.start.y - tail.y) < tol) {
            used.add(other.id); chain.push(other); tail = e.end; grew = true; break;
          }
          if (Math.hypot(e.end.x - tail.x, e.end.y - tail.y) < tol) {
            used.add(other.id); chain.push(other); tail = e.start; grew = true; break;
          }
          if (Math.hypot(e.end.x - head.x, e.end.y - head.y) < tol) {
            used.add(other.id); chain.unshift(other); head = e.start; grew = true; break;
          }
          if (Math.hypot(e.start.x - head.x, e.start.y - head.y) < tol) {
            used.add(other.id); chain.unshift(other); head = e.end; grew = true; break;
          }
        }
      }
      const isClosed = chain.length >= 2 && Math.hypot(head.x - tail.x, head.y - tail.y) < tol;
      if (isClosed) closedLoops.push(chain.map((x) => x.id));
      else openWires.push(chain.map((x) => x.id));
    }

    return {
      closedProfiles: closedLoops.length + circles.length,
      closedLoops,
      circles: circles.map((c) => c.id),
      openWires,
      geometries: active,
    };
  }

  function transformShape(g, fn, angleFn = (a) => a, scaleR = 1) {
    if (g.type === 'point') { const p = fn(g.x, g.y); return { type: 'point', x: p.x, y: p.y }; }
    if (g.type === 'line') { const p1 = fn(g.x1, g.y1), p2 = fn(g.x2, g.y2); return { type: 'line', x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y }; }
    if (g.type === 'circle') { const c = fn(g.cx, g.cy); return { type: 'circle', cx: c.x, cy: c.y, r: Math.max(0.5, g.r * scaleR) }; }
    if (g.type === 'arc') {
      const c = fn(g.cx, g.cy);
      return { type: 'arc', cx: c.x, cy: c.y, r: Math.max(0.5, g.r * scaleR), startAngle: angleFn(g.startAngle), endAngle: angleFn(g.endAngle) };
    }
    return null;
  }

  function previewMirror(model, geoIds, axisLineId) {
    const ax = model.getGeo(axisLineId);
    if (!ax || ax.type !== 'line') return [];
    const dx = ax.x2 - ax.x1, dy = ax.y2 - ax.y1;
    const len2 = dx * dx + dy * dy;
    if (len2 < 1e-6) return [];
    const ux = dx / Math.sqrt(len2), uy = dy / Math.sqrt(len2);
    const axisAngle = Math.atan2(uy, ux);
    const reflectPt = (x, y) => {
      const vx = x - ax.x1, vy = y - ax.y1;
      const dot = vx * ux + vy * uy;
      const px = ax.x1 + dot * ux, py = ax.y1 + dot * uy;
      return { x: 2 * px - x, y: 2 * py - y };
    };
    const shapes = [];
    for (const id of geoIds) {
      if (id === axisLineId) continue;
      const g = model.getGeo(id);
      if (!g) continue;
      if (g.type === 'arc') {
        const c = reflectPt(g.cx, g.cy);
        shapes.push({ type: 'arc', cx: c.x, cy: c.y, r: g.r, startAngle: 2 * axisAngle - g.endAngle, endAngle: 2 * axisAngle - g.startAngle });
      } else {
        const s = transformShape(g, reflectPt);
        if (s) shapes.push(s);
      }
    }
    return shapes;
  }

  function previewTranslate(model, geoIds, dx, dy) {
    return geoIds.map((id) => model.getGeo(id)).filter(Boolean)
      .map((g) => transformShape(g, (x, y) => ({ x: x + dx, y: y + dy }))).filter(Boolean);
  }

  function previewRotate(model, geoIds, cx, cy, angleRad) {
    const cos = Math.cos(angleRad), sin = Math.sin(angleRad);
    const rot = (x, y) => ({ x: cx + (x - cx) * cos - (y - cy) * sin, y: cy + (x - cx) * sin + (y - cy) * cos });
    return geoIds.map((id) => model.getGeo(id)).filter(Boolean)
      .map((g) => transformShape(g, rot, (a) => a + angleRad)).filter(Boolean);
  }

  function previewScale(model, geoIds, cx, cy, factor) {
    const f = Math.max(0.05, factor);
    const sc = (x, y) => ({ x: cx + (x - cx) * f, y: cy + (y - cy) * f });
    return geoIds.map((id) => model.getGeo(id)).filter(Boolean)
      .map((g) => transformShape(g, sc, (a) => a, f)).filter(Boolean);
  }

  function previewArray(model, geoIds, opts) {
    const shapes = [];
    if (opts.mode === 'polar') {
      const count = Math.max(2, opts.count || 6);
      const step = TWO_PI / count;
      for (let i = 1; i < count; i++) shapes.push(...previewRotate(model, geoIds, opts.cx || 0, opts.cy || 0, step * i));
    } else {
      const cols = Math.max(1, opts.cols || 3), rows = Math.max(1, opts.rows || 2);
      const dx = opts.dx || 40, dy = opts.dy || 40;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (r === 0 && c === 0) continue;
          shapes.push(...previewTranslate(model, geoIds, c * dx, r * dy));
        }
      }
    }
    return shapes;
  }

  /**
   * Remove a joint vertex shared by 2 lines and merge the 2 lines directly
   * connecting their remaining outer endpoints.
   */
  function removeJointPoint(model, geoId, pos) {
    const pt = model.getPoint(geoId, pos);
    if (!pt) return { ok: false, msg: 'Point not found' };
    const tol = 0.05;
    const hits = [];
    for (const g of model.geometries) {
      if (g.type !== 'line') continue;
      if (Math.hypot(g.x1 - pt.x, g.y1 - pt.y) < tol) {
        hits.push({ g, jointPos: 'start', otherPos: 'end', ox: g.x2, oy: g.y2 });
      } else if (Math.hypot(g.x2 - pt.x, g.y2 - pt.y) < tol) {
        hits.push({ g, jointPos: 'end', otherPos: 'start', ox: g.x1, oy: g.y1 });
      }
    }
    if (hits.length !== 2) {
      return { ok: false, msg: hits.length < 2 ? 'Not a joint between 2 lines' : 'Joint connects >2 lines' };
    }
    const [a, b] = hits;
    const newL = model.addLine(a.ox, a.oy, b.ox, b.oy, a.g.construction && b.g.construction);

    // Preserve point constraints on the 2 outer endpoints before deleting old lines
    const preserved = [];
    for (const c of model.constraints) {
      if (c.type !== 'coincident' && c.type !== 'pointOnObject' && c.type !== 'lock') continue;
      let touched = false;
      const newRefs = c.refs.map((r) => {
        if (r.geoId === a.g.id && r.pos === a.otherPos) { touched = true; return { geoId: newL.id, pos: 'start' }; }
        if (r.geoId === b.g.id && r.pos === b.otherPos) { touched = true; return { geoId: newL.id, pos: 'end' }; }
        return { ...r };
      });
      if (touched) {
        // Ensure we don't keep references to the deleted lines' joint ends
        const valid = newRefs.every((r) => r.geoId !== a.g.id && r.geoId !== b.g.id);
        if (valid) preserved.push({ ...c, refs: newRefs });
      }
    }

    model.removeGeo(a.g.id);
    model.removeGeo(b.g.id);
    for (const c of preserved) {
      const extra = {};
      if (c.value !== undefined) extra.value = c.value;
      if (c.x !== undefined) { extra.x = c.x; extra.y = c.y; }
      model.addConstraint(c.type, c.refs, extra);
    }
    return { ok: true, line: newL };
  }

  // Thêm điểm vào giữa 1 đường: tách đường thành 2 nửa nối nhau (coincident + parallel nên vẫn thẳng hàng, điểm mới trượt được dọc đường).
  // Giữ: ràng buộc ở 2 đầu mút (coincident / pointOnObject / lock), ngang / dọc / song song / vuông góc của cả đường (áp cho cả 2 nửa). Bỏ: kích thước, equal, symmetric... (báo số lượng).
  function splitLineAt(model, lineId, x, y) {
    const g = model.geometries.find((q) => q.id === lineId && q.type === 'line');
    if (!g) return { ok: false, msg: 'Not a line' };
    const dx = g.x2 - g.x1, dy = g.y2 - g.y1, l2 = dx * dx + dy * dy;
    if (l2 < 1e-9) return { ok: false, msg: 'Line too short' };
    const t = ((x - g.x1) * dx + (y - g.y1) * dy) / l2;
    if (t < 0.03 || t > 0.97) return { ok: false, msg: 'Too close to an end point' };
    const px = Number((g.x1 + t * dx).toFixed(3)), py = Number((g.y1 + t * dy).toFixed(3));
    const a = model.addLine(g.x1, g.y1, px, py, g.construction), b = model.addLine(px, py, g.x2, g.y2, g.construction);
    const keep = [];
    let dropped = 0;
    for (const c of model.constraints) {
      if (!c.refs.some((r) => r.geoId === g.id)) continue;
      const extra = {};
      if (c.value !== undefined) extra.value = c.value;
      if (c.x !== undefined) { extra.x = c.x; extra.y = c.y; }
      const onEnd = c.refs.every((r) => r.geoId !== g.id || r.pos === 'start' || r.pos === 'end');
      if (onEnd && (c.type === 'coincident' || c.type === 'pointOnObject' || c.type === 'lock')) {
        keep.push({ type: c.type, extra, refs: c.refs.map((r) => (r.geoId !== g.id ? { ...r } : r.pos === 'start' ? { geoId: a.id, pos: 'start' } : { geoId: b.id, pos: 'end' })) });
      } else if (c.type === 'horizontal' || c.type === 'vertical' || c.type === 'parallel' || c.type === 'perpendicular') {
        for (const half of [a, b]) keep.push({ type: c.type, extra, refs: c.refs.map((r) => (r.geoId === g.id ? { geoId: half.id } : { ...r })) });
      } else dropped++;
    }
    model.removeGeo(g.id);
    for (const k of keep) model.addConstraint(k.type, k.refs, k.extra);
    model.addConstraint('coincident', [{ geoId: a.id, pos: 'end' }, { geoId: b.id, pos: 'start' }]);
    // parallel chỉ thêm khi 2 nửa chưa bị buộc cùng hướng (ngang / dọc / song song / vuông góc với đường khác) – tránh ràng buộc dư
    if (!keep.some((k) => k.type === 'horizontal' || k.type === 'vertical' || k.type === 'parallel' || k.type === 'perpendicular')) model.addConstraint('parallel', [{ geoId: a.id }, { geoId: b.id }]);
    return { ok: true, a, b, dropped, x: px, y: py };
  }

  global.SketchOps = {
    trimAt,
    splitLineAt,
    previewTrimAt,
    filletLines,
    chamferLines,
    slideChamfer,
    removeJointPoint,
    previewCornerOp,
    getConnectedChain,
    findPointAt,
    findGeoAt,
    geometriesInBox,
    extractProfiles,
    computeOffsetShapes,
    offsetGeos,
    updateOffsetDistance,
    mirrorGeos,
    previewMirror,
    moveGeos,
    previewTranslate,
    rotateGeos,
    previewRotate,
    scaleGeos,
    previewScale,
    arrayGeos,
    previewArray,
  };
})(window);
