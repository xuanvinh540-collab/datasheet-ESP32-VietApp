(function (global) {
  'use strict';

  /**
   * Pure JS 2D Geometric Constraint Solver (Levenberg-Marquardt).
   * Zero DOM dependency — works identically in browser or Node/Worker.
   */
  const EPS = 1e-6;

  function buildParamMap(model) {
    const params = [];
    const indexMap = new Map(); // `${geoId}:${field}` -> param index

    const add = (geoId, field, val) => {
      indexMap.set(`${geoId}:${field}`, params.length);
      params.push(val);
    };

    for (const g of model.geometries) {
      if (g.type === 'point') {
        add(g.id, 'x', g.x);
        add(g.id, 'y', g.y);
      } else if (g.type === 'line') {
        add(g.id, 'x1', g.x1);
        add(g.id, 'y1', g.y1);
        add(g.id, 'x2', g.x2);
        add(g.id, 'y2', g.y2);
      } else if (g.type === 'circle') {
        add(g.id, 'cx', g.cx);
        add(g.id, 'cy', g.cy);
        add(g.id, 'r', g.r);
      } else if (g.type === 'arc') {
        add(g.id, 'cx', g.cx);
        add(g.id, 'cy', g.cy);
        add(g.id, 'r', g.r);
        add(g.id, 'sa', g.startAngle);
        add(g.id, 'ea', g.endAngle);
      }
    }
    return { params, indexMap };
  }

  function applyParams(model, params, indexMap) {
    const get = (id, f) => params[indexMap.get(`${id}:${f}`)];
    for (const g of model.geometries) {
      if (g.type === 'point') {
        g.x = get(g.id, 'x');
        g.y = get(g.id, 'y');
      } else if (g.type === 'line') {
        g.x1 = get(g.id, 'x1');
        g.y1 = get(g.id, 'y1');
        g.x2 = get(g.id, 'x2');
        g.y2 = get(g.id, 'y2');
      } else if (g.type === 'circle') {
        g.cx = get(g.id, 'cx');
        g.cy = get(g.id, 'cy');
        g.r = Math.max(0.5, get(g.id, 'r'));
      } else if (g.type === 'arc') {
        g.cx = get(g.id, 'cx');
        g.cy = get(g.id, 'cy');
        g.r = Math.max(0.5, get(g.id, 'r'));
        g.startAngle = get(g.id, 'sa');
        g.endAngle = get(g.id, 'ea');
      }
    }
  }

  function readPt(model, params, indexMap, ref) {
    if (ref.geoId === 0) return { x: 0, y: 0 };
    const g = model.getGeo(ref.geoId);
    if (!g) return null;
    const get = (f) => params[indexMap.get(`${g.id}:${f}`)];
    if (g.type === 'point') return { x: get('x'), y: get('y') };
    if (g.type === 'line') {
      if (ref.pos === 'start') return { x: get('x1'), y: get('y1') };
      if (ref.pos === 'end') return { x: get('x2'), y: get('y2') };
      return { x: (get('x1') + get('x2')) / 2, y: (get('y1') + get('y2')) / 2 };
    }
    if (g.type === 'circle') return { x: get('cx'), y: get('cy') };
    if (g.type === 'arc') {
      const cx = get('cx'), cy = get('cy'), r = Math.max(0.5, get('r'));
      if (ref.pos === 'center') return { x: cx, y: cy };
      const ang = ref.pos === 'start' ? get('sa') : get('ea');
      return { x: cx + r * Math.cos(ang), y: cy + r * Math.sin(ang) };
    }
    return null;
  }

  function readLineVec(model, params, indexMap, geoId) {
    const g = model.getGeo(geoId);
    if (!g || g.type !== 'line') return null;
    const get = (f) => params[indexMap.get(`${g.id}:${f}`)];
    const x1 = get('x1'), y1 = get('y1'), x2 = get('x2'), y2 = get('y2');
    return { x1, y1, x2, y2, dx: x2 - x1, dy: y2 - y1 };
  }

  function evaluateResiduals(model, params, indexMap, softPin) {
    const res = [];
    const cRowOwner = []; // constraint id per residual row

    const push = (val, cid) => {
      res.push(val);
      cRowOwner.push(cid);
    };

    for (const c of model.constraints) {
      if (c.driven) continue;
      if (c.type === 'coincident' && c.refs.length >= 2) {
        const p1 = readPt(model, params, indexMap, c.refs[0]);
        const p2 = readPt(model, params, indexMap, c.refs[1]);
        if (p1 && p2) {
          push(p1.x - p2.x, c.id);
          push(p1.y - p2.y, c.id);
        }
      } else if (c.type === 'pointOnObject' && c.refs.length >= 2) {
        const pt = readPt(model, params, indexMap, c.refs[0]);
        const obj = model.getGeo(c.refs[1].geoId);
        if (pt && obj) {
          if (obj.type === 'line') {
            const lv = readLineVec(model, params, indexMap, obj.id);
            const len = Math.hypot(lv.dx, lv.dy) || 1;
            // Signed perpendicular distance from pt to infinite line
            const cross = ((pt.x - lv.x1) * lv.dy - (pt.y - lv.y1) * lv.dx) / len;
            push(cross, c.id);
          } else if (obj.type === 'circle' || obj.type === 'arc') {
            const cx = params[indexMap.get(`${obj.id}:cx`)];
            const cy = params[indexMap.get(`${obj.id}:cy`)];
            const r = Math.max(0.5, params[indexMap.get(`${obj.id}:r`)]);
            push(Math.hypot(pt.x - cx, pt.y - cy) - r, c.id);
          }
        }
      } else if (c.type === 'horizontal' && c.refs.length >= 1) {
        const lv = readLineVec(model, params, indexMap, c.refs[0].geoId);
        if (lv) push(lv.y2 - lv.y1, c.id);
      } else if (c.type === 'vertical' && c.refs.length >= 1) {
        const lv = readLineVec(model, params, indexMap, c.refs[0].geoId);
        if (lv) push(lv.x2 - lv.x1, c.id);
      } else if (c.type === 'diag45' && c.refs.length >= 1) {
        const lv = readLineVec(model, params, indexMap, c.refs[0].geoId);
        if (lv) push(lv.dy - (c.sign || 1) * lv.dx, c.id);
      } else if (c.type === 'fixAngle' && c.refs.length >= 1) {
        const lv = readLineVec(model, params, indexMap, c.refs[0].geoId);
        if (lv && Math.hypot(lv.dx, lv.dy) > 1e-6) {
          const ang = Math.atan2(lv.dy, lv.dx);
          const err = Math.atan2(Math.sin(ang - c.angle), Math.cos(ang - c.angle));
          push(err * 50, c.id);
        }
      } else if (c.type === 'parallel' && c.refs.length >= 2) {
        const l1 = readLineVec(model, params, indexMap, c.refs[0].geoId);
        const l2 = readLineVec(model, params, indexMap, c.refs[1].geoId);
        if (l1 && l2) {
          const n1 = Math.hypot(l1.dx, l1.dy) || 1;
          const n2 = Math.hypot(l2.dx, l2.dy) || 1;
          push((l1.dx * l2.dy - l1.dy * l2.dx) / (n1 * n2) * 50, c.id);
        }
      } else if (c.type === 'perpendicular' && c.refs.length >= 2) {
        const l1 = readLineVec(model, params, indexMap, c.refs[0].geoId);
        const l2 = readLineVec(model, params, indexMap, c.refs[1].geoId);
        if (l1 && l2) {
          const n1 = Math.hypot(l1.dx, l1.dy) || 1;
          const n2 = Math.hypot(l2.dx, l2.dy) || 1;
          push((l1.dx * l2.dx + l1.dy * l2.dy) / (n1 * n2) * 50, c.id);
        }
      } else if (c.type === 'equal' && c.refs.length >= 2) {
        const g1 = model.getGeo(c.refs[0].geoId);
        const g2 = model.getGeo(c.refs[1].geoId);
        if (g1 && g2) {
          if (g1.type === 'line' && g2.type === 'line') {
            const l1 = readLineVec(model, params, indexMap, g1.id);
            const l2 = readLineVec(model, params, indexMap, g2.id);
            push(Math.hypot(l1.dx, l1.dy) - Math.hypot(l2.dx, l2.dy), c.id);
          } else if ((g1.type === 'circle' || g1.type === 'arc') && (g2.type === 'circle' || g2.type === 'arc')) {
            const r1 = params[indexMap.get(`${g1.id}:r`)];
            const r2 = params[indexMap.get(`${g2.id}:r`)];
            push(r1 - r2, c.id);
          }
        }
      } else if (c.type === 'tangent' && c.refs.length >= 2) {
        const g1 = model.getGeo(c.refs[0].geoId);
        const g2 = model.getGeo(c.refs[1].geoId);
        if (g1 && g2) {
          const lineG = g1.type === 'line' ? g1 : (g2.type === 'line' ? g2 : null);
          const circG = (g1.type === 'circle' || g1.type === 'arc') ? g1 : ((g2.type === 'circle' || g2.type === 'arc') ? g2 : null);
          if (lineG && circG) {
            const lv = readLineVec(model, params, indexMap, lineG.id);
            const cx = params[indexMap.get(`${circG.id}:cx`)];
            const cy = params[indexMap.get(`${circG.id}:cy`)];
            const r = Math.max(0.5, params[indexMap.get(`${circG.id}:r`)]);
            const len = Math.hypot(lv.dx, lv.dy) || 1;
            const d = Math.abs((cx - lv.x1) * lv.dy - (cy - lv.y1) * lv.dx) / len;
            push(d - r, c.id);
          }
        }
      } else if (c.type === 'symmetric' && c.refs.length >= 3) {
        const p1 = readPt(model, params, indexMap, c.refs[0]);
        const p2 = readPt(model, params, indexMap, c.refs[1]);
        const symRef = c.refs[2];
        const symGeo = symRef.geoId === 0 ? null : model.getGeo(symRef.geoId);
        if (p1 && p2) {
          if (symGeo && symGeo.type === 'line' && (!symRef.pos || symRef.pos === 'none')) {
            // Line symmetry: midpoint on line + (p2 - p1) perpendicular to line
            const lv = readLineVec(model, params, indexMap, symGeo.id);
            const len = Math.hypot(lv.dx, lv.dy) || 1;
            const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
            const distMid = ((mx - lv.x1) * lv.dy - (my - lv.y1) * lv.dx) / len;
            const dot = ((p2.x - p1.x) * lv.dx + (p2.y - p1.y) * lv.dy) / len;
            push(distMid, c.id);
            push(dot, c.id);
          } else {
            // Point symmetry: midpoint == symPoint
            const sp = readPt(model, params, indexMap, symRef);
            if (sp) {
              push((p1.x + p2.x) / 2 - sp.x, c.id);
              push((p1.y + p2.y) / 2 - sp.y, c.id);
            }
          }
        }
      } else if (c.type === 'distance') {
        let p1, p2;
        if (c.refs.length === 1) {
          const lv = readLineVec(model, params, indexMap, c.refs[0].geoId);
          if (lv) { p1 = { x: lv.x1, y: lv.y1 }; p2 = { x: lv.x2, y: lv.y2 }; }
        } else if (c.refs.length >= 2) {
          const r0 = c.refs[0], r1 = c.refs[1];
          const g0 = model.getGeo(r0.geoId), g1 = model.getGeo(r1.geoId);
          // Point-to-Line perpendicular distance
          if ((r0.pos && r0.pos !== 'none') && (!r1.pos || r1.pos === 'none') && g1?.type === 'line') {
            const pt = readPt(model, params, indexMap, r0);
            const lv = readLineVec(model, params, indexMap, g1.id);
            if (pt && lv) {
              const len = Math.hypot(lv.dx, lv.dy) || 1;
              const d = Math.abs((pt.x - lv.x1) * lv.dy - (pt.y - lv.y1) * lv.dx) / len;
              push(d - c.value, c.id);
              continue;
            }
          } else if ((r1.pos && r1.pos !== 'none') && (!r0.pos || r0.pos === 'none') && g0?.type === 'line') {
            const pt = readPt(model, params, indexMap, r1);
            const lv = readLineVec(model, params, indexMap, g0.id);
            if (pt && lv) {
              const len = Math.hypot(lv.dx, lv.dy) || 1;
              const d = Math.abs((pt.x - lv.x1) * lv.dy - (pt.y - lv.y1) * lv.dx) / len;
              push(d - c.value, c.id);
              continue;
            }
          }
          p1 = readPt(model, params, indexMap, r0);
          p2 = readPt(model, params, indexMap, r1);
        }
        if (p1 && p2) push(Math.hypot(p2.x - p1.x, p2.y - p1.y) - c.value, c.id);
      } else if (c.type === 'distanceX') {
        let p1, p2;
        if (c.refs.length === 1) {
          const lv = readLineVec(model, params, indexMap, c.refs[0].geoId);
          if (lv) { p1 = { x: lv.x1, y: lv.y1 }; p2 = { x: lv.x2, y: lv.y2 }; }
        } else if (c.refs.length >= 2) {
          p1 = readPt(model, params, indexMap, c.refs[0]);
          p2 = readPt(model, params, indexMap, c.refs[1]);
        }
        if (p1 && p2) push((p2.x - p1.x) - (c.sign || 1) * c.value, c.id);
      } else if (c.type === 'distanceY') {
        let p1, p2;
        if (c.refs.length === 1) {
          const lv = readLineVec(model, params, indexMap, c.refs[0].geoId);
          if (lv) { p1 = { x: lv.x1, y: lv.y1 }; p2 = { x: lv.x2, y: lv.y2 }; }
        } else if (c.refs.length >= 2) {
          p1 = readPt(model, params, indexMap, c.refs[0]);
          p2 = readPt(model, params, indexMap, c.refs[1]);
        }
        if (p1 && p2) push((p2.y - p1.y) - (c.sign || 1) * c.value, c.id);
      } else if (c.type === 'radius' && c.refs.length >= 1) {
        const g = model.getGeo(c.refs[0].geoId);
        if (g && (g.type === 'circle' || g.type === 'arc')) {
          push(params[indexMap.get(`${g.id}:r`)] - c.value, c.id);
        }
      } else if (c.type === 'diameter' && c.refs.length >= 1) {
        const g = model.getGeo(c.refs[0].geoId);
        if (g && (g.type === 'circle' || g.type === 'arc')) {
          push(2 * params[indexMap.get(`${g.id}:r`)] - c.value, c.id);
        }
      } else if (c.type === 'angle' && c.refs.length >= 2) {
        const l1 = readLineVec(model, params, indexMap, c.refs[0].geoId);
        const l2 = readLineVec(model, params, indexMap, c.refs[1].geoId);
        if (l1 && l2) {
          const d1 = c.dir1 || 1, d2 = c.dir2 || 1;
          const targetRad = ((c.value || 90) * Math.PI) / 180;
          const a1 = Math.atan2(l1.dy * d1, l1.dx * d1);
          const a2 = Math.atan2(l2.dy * d2, l2.dx * d2);
          const diff = Math.atan2(Math.sin(a2 - a1), Math.cos(a2 - a1));
          const err = Math.atan2(Math.sin(diff - (c.sign || 1) * targetRad), Math.cos(diff - (c.sign || 1) * targetRad));
          push(err * 50, c.id);
        }
      } else if (c.type === 'lock' && c.refs.length >= 1) {
        const p = readPt(model, params, indexMap, c.refs[0]);
        if (p) {
          push(5 * (p.x - c.x), c.id);
          push(5 * (p.y - c.y), c.id);
        }
      }
    }

    // Optional soft pin when dragging a specific point
    if (softPin) {
      const p = readPt(model, params, indexMap, softPin);
      if (p) {
        push(0.4 * (p.x - softPin.x), -1);
        push(0.4 * (p.y - softPin.y), -1);
      }
    }

    return { res, cRowOwner };
  }

  function solveLinear(A, b) {
    const n = b.length;
    const M = A.map((row, i) => [...row, b[i]]);
    for (let col = 0; col < n; col++) {
      let maxRow = col;
      for (let r = col + 1; r < n; r++) {
        if (Math.abs(M[r][col]) > Math.abs(M[maxRow][col])) maxRow = r;
      }
      [M[col], M[maxRow]] = [M[maxRow], M[col]];
      const pivot = M[col][col];
      if (Math.abs(pivot) < 1e-12) continue;
      for (let c = col; c <= n; c++) M[col][c] /= pivot;
      for (let r = 0; r < n; r++) {
        if (r === col || Math.abs(M[r][col]) < 1e-12) continue;
        const factor = M[r][col];
        for (let c = col; c <= n; c++) M[r][c] -= factor * M[col][c];
      }
    }
    return M.map((row) => row[n]);
  }

  function computeJacobianRank(J, m, n) {
    if (m === 0 || n === 0) return 0;
    const M = J.map((r) => [...r]);
    let rank = 0;
    for (let col = 0; col < n && rank < m; col++) {
      let pivotRow = rank;
      for (let r = rank + 1; r < m; r++) {
        if (Math.abs(M[r][col]) > Math.abs(M[pivotRow][col])) pivotRow = r;
      }
      if (Math.abs(M[pivotRow][col]) < 1e-4) continue;
      [M[rank], M[pivotRow]] = [M[pivotRow], M[rank]];
      const div = M[rank][col];
      for (let c = col; c < n; c++) M[rank][c] /= div;
      for (let r = 0; r < m; r++) {
        if (r === rank || Math.abs(M[r][col]) < 1e-6) continue;
        const f = M[r][col];
        for (let c = col; c < n; c++) M[r][c] -= f * M[rank][c];
      }
      rank++;
    }
    return rank;
  }

  function buildLockedMap(model, indexMap) {
    const locked = new Map();
    const lockPt = (geoId, pos, x, y) => {
      const g = model.getGeo(geoId);
      if (!g) return;
      const set = (f, v) => { const idx = indexMap.get(`${geoId}:${f}`); if (idx !== undefined) locked.set(idx, v); };
      if (g.type === 'point') { set('x', x); set('y', y); }
      else if (g.type === 'line') {
        if (pos === 'start') { set('x1', x); set('y1', y); }
        else if (pos === 'end') { set('x2', x); set('y2', y); }
      } else if (g.type === 'circle' && pos === 'center') { set('cx', x); set('cy', y); }
      else if (g.type === 'arc' && pos === 'center') { set('cx', x); set('cy', y); }
    };
    for (const c of model.constraints) {
      if (c.type === 'lock' && c.refs.length >= 1) {
        lockPt(c.refs[0].geoId, c.refs[0].pos, c.x, c.y);
      }
    }
    return locked;
  }

  function solve(model, softPin = null) {
    const { params, indexMap } = buildParamMap(model);
    const n = params.length;
    if (n === 0) return { status: 'under', dof: 0, maxError: 0, conflictingIds: [] };

    const lockedMap = buildLockedMap(model, indexMap);
    for (const [idx, val] of lockedMap) params[idx] = val;

    let lambda = 1e-3;
    let lastErr = Infinity;

    for (let iter = 0; iter < 35; iter++) {
      const { res } = evaluateResiduals(model, params, indexMap, softPin);
      const m = res.length;
      if (m === 0) break;

      const errNorm = res.reduce((s, v) => s + v * v, 0);
      if (errNorm < 1e-8) break;

      // Numerical Jacobian (m x n), zero columns for hard-locked params
      const J = Array.from({ length: m }, () => new Float64Array(n));
      const h = 1e-5;
      for (let j = 0; j < n; j++) {
        if (lockedMap.has(j)) continue;
        const orig = params[j];
        params[j] = orig + h;
        const { res: rPlus } = evaluateResiduals(model, params, indexMap, softPin);
        params[j] = orig;
        for (let i = 0; i < m; i++) {
          J[i][j] = (rPlus[i] - res[i]) / h;
        }
      }

      // Normal equations: (J^T J + lambda I) dp = -J^T r
      const JTJ = Array.from({ length: n }, () => new Float64Array(n));
      const JTr = new Float64Array(n);
      for (let i = 0; i < m; i++) {
        const row = J[i];
        const ri = res[i];
        for (let a = 0; a < n; a++) {
          const ja = row[a];
          if (ja === 0) continue;
          JTr[a] += ja * ri;
          for (let b = a; b < n; b++) {
            JTJ[a][b] += ja * row[b];
          }
        }
      }
      for (let a = 0; a < n; a++) {
        for (let b = 0; b < a; b++) JTJ[a][b] = JTJ[b][a];
        JTJ[a][a] += lambda;
      }

      const negJTr = Array.from(JTr, (v) => -v);
      const dp = solveLinear(JTJ, negJTr);

      const nextParams = params.map((v, i) => lockedMap.has(i) ? lockedMap.get(i) : v + dp[i]);
      const { res: nextRes } = evaluateResiduals(model, nextParams, indexMap, softPin);
      const nextErr = nextRes.reduce((s, v) => s + v * v, 0);

      if (nextErr < errNorm) {
        for (let i = 0; i < n; i++) params[i] = nextParams[i];
        lambda = Math.max(1e-6, lambda * 0.5);
        if (Math.abs(lastErr - nextErr) < 1e-9) break;
        lastErr = nextErr;
      } else {
        lambda = Math.min(1e4, lambda * 4);
      }
    }

    applyParams(model, params, indexMap);

    // Evaluate final status without softPin
    const { res: finalRes, cRowOwner } = evaluateResiduals(model, params, indexMap, null);
    const m = finalRes.length;
    const conflictingIds = new Set();
    let maxError = 0;
    for (let i = 0; i < m; i++) {
      const e = Math.abs(finalRes[i]);
      if (e > maxError) maxError = e;
      if (e > 0.05 && cRowOwner[i] > 0) conflictingIds.add(cRowOwner[i]);
    }

    // Compute Jacobian rank for DOF
    const J = Array.from({ length: m }, () => new Float64Array(n));
    const h = 1e-5;
    for (let j = 0; j < n; j++) {
      const orig = params[j];
      params[j] = orig + h;
      const { res: rPlus } = evaluateResiduals(model, params, indexMap, null);
      params[j] = orig;
      for (let i = 0; i < m; i++) J[i][j] = (rPlus[i] - finalRes[i]) / h;
    }

    const rank = computeJacobianRank(J, m, n);
    const dof = Math.max(0, n - rank);

    let status = 'under';
    if (conflictingIds.size > 0) status = 'over';
    else if (m > rank) status = 'redundant';
    else if (dof === 0 && n > 0) status = 'fully';

    return {
      status,
      dof,
      maxError,
      conflictingIds: [...conflictingIds],
    };
  }

  global.SketchSolver = { solve };
})(window);
