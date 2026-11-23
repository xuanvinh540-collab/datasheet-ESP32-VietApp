(function (global) {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs = {}, parent = null) => {
    const n = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (parent) parent.appendChild(n);
    return n;
  };

  let initialized = false;
  let active = false;
  let bridge = null;
  let model = null;
  let vp = null;
  let tools = null;
  let solveFn = null;
  let activeToolName = 'polyline';
  let constructionMode = false;

  const opts = {
    polygonSides: 6, filletRadius: 0, chamferDist: 2, offsetDist: 2,
    offsetMode: 'intersection', offsetLockDist: false, offsetDeleteOrig: false, offsetAddConst: true,
    rotateDeg: 45, scaleFactor: 1.5, transformCopy: false, moveClone: false,
    arrayMode: 'rect', arrayCols: 3, arrayRows: 2, arrayDx: 10, arrayDy: 10, arrayCount: 6,
  };

  function iconPath(file) {
    const base = global.SKETCHWB_BASE || '/sketchwb/';
    return base + file;
  }

  function buildUI() {
    if (initialized || !bridge) return;
    const listEl = bridge.getList();
    const stageEl = bridge.getStage();
    const pcbSvg = bridge.getSvg();
    if (!listEl || !stageEl || !pcbSvg) return;
    initialized = true;

    // 1. Left Column Tabs: Linh kien | Sketch Props
    const tabs = document.createElement('div');
    tabs.className = 'swb-left-tabs';
    tabs.innerHTML = `<button type="button" class="swb-left-tab active" data-lt="parts">Linh kiện</button><button type="button" class="swb-left-tab" data-lt="sketch">Sketch Props</button>`;
    listEl.prepend(tabs);

    const propsPane = document.createElement('div');
    propsPane.id = 'swb-props-pane';
    propsPane.innerHTML = `
      <div class="swb-sec"><div class="swb-sec-hd">Solver messages</div><div id="swb-solver-box" class="swb-solver"><div id="swb-solver-msg">Under-constrained (0 DoFs)</div><div id="swb-solver-sub" class="swb-sub">Draw trace geometry</div></div></div>
      <div class="swb-sec"><div class="swb-sec-hd">Edit controls</div><div class="swb-sec-body"><div class="swb-opt"><label><input type="checkbox" id="swb-snap" checked/> Grid 1.27mm Snap</label></div><div class="swb-opt"><label><input type="checkbox" id="swb-auto" checked/> Auto constraints</label></div><div id="swb-dyn-opts"></div></div></div>
      <div class="swb-sec"><div class="swb-sec-hd">Constraints <span id="swb-cnt-c" class="swb-badge">0</span></div><ul id="swb-list-c" class="swb-list"></ul></div>
      <div class="swb-sec"><div class="swb-sec-hd">Elements <span id="swb-cnt-e" class="swb-badge">0</span></div><ul id="swb-list-e" class="swb-list"></ul></div>
    `;
    tabs.after(propsPane);

    const switchLeftTab = (which) => {
      tabs.querySelectorAll('.swb-left-tab').forEach((b) => b.classList.toggle('active', b.dataset.lt === which));
      const isSketch = which === 'sketch';
      propsPane.classList.toggle('open', isSketch);
      Array.from(listEl.children).forEach((ch) => {
        if (ch !== tabs && ch !== propsPane) ch.style.display = isSketch ? 'none' : '';
      });
    };
    tabs.addEventListener('click', (e) => {
      const b = e.target.closest('.swb-left-tab');
      if (b) switchLeftTab(b.dataset.lt);
    });
    const ensureLeftTabs = () => {
      const curList = bridge.getList();
      if (!curList) return;
      if (!curList.contains(tabs)) {
        curList.prepend(propsPane);
        curList.prepend(tabs);
      }
      switchLeftTab(active ? 'sketch' : 'parts');
    };
    bridge._ensureLeftTabs = ensureLeftTabs;

    // 2. Vertical Side Popout Toolbar (Replaces #plFlyP inside #plStage right beside #plVbar)
    const tb = document.createElement('div');
    tb.id = 'swb-toolbar';
    tb.innerHTML = `
      <div class="swb-grip" title="Drag to move • Double-click to dock right side"></div>
      <button class="swb-btn" data-tool="select" title="Select (Esc)"><span style="color:#e5e7eb;font-size:15px">↖</span></button>
      <button class="swb-btn active" data-tool="polyline" title="Polyline (M)"><img src="${iconPath('icons-kicad/lines_any.svg')}"/></button>
      <div class="swb-split">
        <button class="swb-btn" id="swb-btn-poly" data-tool="line" title="Shape: Line (L) / Circle / Rectangle (R) / Polygon (G) / Slot"><img src="${iconPath('icons-kicad/add_line.svg')}"/></button>
        <button class="swb-arrow" data-menu="swb-m-poly" title="Shape">▾</button>
        <div class="swb-menu" id="swb-m-poly">
          <button data-tool="line" data-poly-icon="${iconPath('icons-kicad/add_line.svg')}"><span><img src="${iconPath('icons-kicad/add_line.svg')}"/>Line</span><kbd>L</kbd></button>
          <button data-tool="circle" data-poly-icon="${iconPath('icons-kicad/add_circle.svg')}"><span><img src="${iconPath('icons-kicad/add_circle.svg')}"/>Hình tròn</span></button>
          <button data-tool="rectangle" data-poly-icon="${iconPath('icons-kicad/add_rectangle.svg')}"><span><img src="${iconPath('icons-kicad/add_rectangle.svg')}"/>Hình chữ nhật</span><kbd>R</kbd></button>
          <button data-tool="polygon" data-sides="3" data-poly-icon="${iconPath('icons/Sketcher_CreateTriangle.svg')}"><span><img src="${iconPath('icons/Sketcher_CreateTriangle.svg')}"/>Tam giác (3)</span><kbd>G</kbd></button>
          <button data-tool="polygon" data-sides="4" data-poly-icon="${iconPath('icons/Sketcher_CreateSquare.svg')}"><span><img src="${iconPath('icons/Sketcher_CreateSquare.svg')}"/>Hình vuông (4)</span></button>
          <button data-tool="polygon" data-sides="5" data-poly-icon="${iconPath('icons/Sketcher_CreatePentagon.svg')}"><span><img src="${iconPath('icons/Sketcher_CreatePentagon.svg')}"/>Ngũ giác (5)</span></button>
          <button data-tool="polygon" data-sides="6" data-poly-icon="${iconPath('icons/Sketcher_CreateHexagon.svg')}"><span><img src="${iconPath('icons/Sketcher_CreateHexagon.svg')}"/>Lục giác (6)</span></button>
          <button data-tool="polygon" data-sides="8" data-poly-icon="${iconPath('icons/Sketcher_CreateOctagon.svg')}"><span><img src="${iconPath('icons/Sketcher_CreateOctagon.svg')}"/>Bát giác (8)</span></button>
          <button data-tool="slot" data-poly-icon="${iconPath('icons/Sketcher_CreateSlot.svg')}"><span><img src="${iconPath('icons/Sketcher_CreateSlot.svg')}"/>Slot</span></button>
        </div>
      </div>
      <button class="swb-btn" id="swb-btn-const" data-action="const" title="Construction (N)"><img src="${iconPath('icons-kicad/add_dashed_line.svg')}"/></button>
      <div class="swb-sep"></div>
      <div class="swb-split">
        <button class="swb-btn" data-dim="smart" title="Dimension (D)"><img src="${iconPath('icons-kicad/add_aligned_dimension.svg')}"/></button>
        <button class="swb-arrow" data-menu="swb-m-dim" title="Dimension Menu">▾</button>
        <div class="swb-menu" id="swb-m-dim">
          <button data-dim="smart"><span><img src="${iconPath('icons-kicad/add_aligned_dimension.svg')}"/>Dimension</span><kbd>D</kbd></button>
          <button data-dim="distanceX"><span><img src="${iconPath('icons-kicad/add_orthogonal_dimension.svg')}"/>Horizontal</span><kbd>K,H</kbd></button>
          <button data-dim="distanceY"><span><img src="${iconPath('icons-kicad/add_orthogonal_dimension.svg')}"/>Vertical</span><kbd>K,V</kbd></button>
          <button data-dim="radius"><span><img src="${iconPath('icons-kicad/add_radial_dimension.svg')}"/>Radius</span><kbd>K,R</kbd></button>
          <button data-dim="angle"><span><img src="${iconPath('icons/Constraint_InternalAngle.svg')}"/>Angle</span><kbd>K,A</kbd></button>
          <button data-dim="lock"><span><img src="${iconPath('icons-kicad/locked.svg')}"/>Lock</span><kbd>K,L</kbd></button>
        </div>
      </div>
      <button class="swb-btn" id="swb-btn-coincident" data-c="coincident" title="Coincident / Concentric (O)"><img src="${iconPath('icons/Constraint_PointOnObject.svg')}"/></button>
      <div class="swb-split">
        <button class="swb-btn" id="swb-btn-cstr" data-c="autohv" title="Constraints (A: Auto H/V/45° • H/V)"><img src="${iconPath('icons/Constraint_Horizontal.svg')}"/></button>
        <button class="swb-arrow" data-menu="swb-m-cstr" title="All Constraints">▾</button>
        <div class="swb-menu" id="swb-m-cstr">
          <button data-c="autohv" data-icon="${iconPath('icons/Constraint_Horizontal.svg')}"><span><img src="${iconPath('icons/Constraint_Horizontal.svg')}"/>Auto H / V / 45°</span><kbd>A</kbd></button>
          <button data-c="horizontal" data-icon="${iconPath('icons/Constraint_Horizontal.svg')}"><span><img src="${iconPath('icons/Constraint_Horizontal.svg')}"/>Horizontal</span><kbd>H</kbd></button>
          <button data-c="vertical" data-icon="${iconPath('icons/Constraint_Vertical.svg')}"><span><img src="${iconPath('icons/Constraint_Vertical.svg')}"/>Vertical</span><kbd>V</kbd></button>
          <button data-c="parallel" data-icon="${iconPath('icons/Constraint_Parallel.svg')}"><span><img src="${iconPath('icons/Constraint_Parallel.svg')}"/>Parallel</span><kbd>//</kbd></button>
          <button data-c="perpendicular" data-icon="${iconPath('icons/Constraint_Perpendicular.svg')}"><span><img src="${iconPath('icons/Constraint_Perpendicular.svg')}"/>Perpendicular</span><kbd>⊥</kbd></button>
          <button data-c="equal" data-icon="${iconPath('icons/Constraint_EqualLength.svg')}"><span><img src="${iconPath('icons/Constraint_EqualLength.svg')}"/>Equal</span><kbd>=</kbd></button>
          <button data-c="symmetric" data-icon="${iconPath('icons/Constraint_Symmetric.svg')}"><span><img src="${iconPath('icons/Constraint_Symmetric.svg')}"/>Symmetric</span><kbd>&gt;&lt;</kbd></button>
        </div>
      </div>
      <div class="swb-sep"></div>
      <button class="swb-btn" data-tool="offset" title="Offset"><img src="${iconPath('icons/Sketcher_Offset.svg')}"/></button>
      <div class="swb-split">
        <button class="swb-btn" id="swb-btn-fc" data-tool="fillet" title="Fillet (F) / Chamfer (C)"><img src="${iconPath('icons-kicad/fillet.svg')}"/></button>
        <button class="swb-arrow" data-menu="swb-m-fc" title="Fillet / Chamfer">▾</button>
        <div class="swb-menu" id="swb-m-fc">
          <button data-tool="fillet" data-fc-icon="${iconPath('icons-kicad/fillet.svg')}"><span><img src="${iconPath('icons-kicad/fillet.svg')}"/>Fillet</span><kbd>F</kbd></button>
          <button data-tool="chamfer" data-fc-icon="${iconPath('icons-kicad/chamfer.svg')}"><span><img src="${iconPath('icons-kicad/chamfer.svg')}"/>Chamfer</span><kbd>C</kbd></button>
        </div>
      </div>
      <button class="swb-btn" data-tool="point" title="Point (X): click a line to add a point, click a joint to remove it"><img src="${iconPath('icons-kicad/slice_line.svg')}"/></button>
      <button class="swb-btn" data-tool="trim" title="Trim (T)"><img src="${iconPath('icons/Sketcher_Trimming.svg')}"/></button>
      <div class="swb-sep"></div>
      <button class="swb-btn" data-tool="symmetry" title="Mirror"><img src="${iconPath('icons-kicad/mirror_h.svg')}"/></button>
      <button class="swb-btn" data-tool="scale" title="Scale"><img src="${iconPath('icons/Sketcher_Scale.svg')}"/></button>
      <button class="swb-btn" data-tool="rotate" title="Rotate"><img src="${iconPath('icons-kicad/rotate_ccw.svg')}"/></button>
      <button class="swb-btn" data-tool="array" title="Array"><img src="${iconPath('icons-kicad/array.svg')}"/></button>
      <button class="swb-btn" data-tool="move" title="Move / Clone"><img src="${iconPath('icons-kicad/move.svg')}"/></button>
      <button class="swb-finish" id="swb-finish" title="Finish Sketch &amp; Set Trace Width">✓ Finish</button>
      <button class="swb-exit" id="swb-exit" title="Bỏ hết nét vẽ, thoát, bo giữ nguyên">✕ Exit</button>
    `;
    stageEl.appendChild(tb);

    // 3. Popup (with Slider + Number input for Trace Width) & Toast
    const dlg = document.createElement('div');
    dlg.id = 'swb-dlg';
    dlg.innerHTML = `
      <div class="swb-dlg-hd" id="swb-dlg-hd">Độ rộng đường vẽ</div>
      <div class="swb-dlg-row" id="swb-dlg-slider-row" style="display:none">
        <input id="swb-dlg-rng" type="range" min="0.2" max="3.0" step="0.1" value="0.8"/>
      </div>
      <div class="swb-dlg-row">
        <span id="swb-dlg-lbl">Value:</span>
        <input id="swb-dlg-inp" type="number" step="any"/>
        <span id="swb-dlg-unit">mm</span>
      </div>
      <div class="swb-dlg-row"><label><input type="checkbox" id="swb-dlg-chk"/> <span>Option</span></label></div>
      <div class="swb-dlg-row" id="swb-dlg-out" style="display:none;flex-wrap:wrap;gap:8px">
        <span>Output:</span>
        <label title="Đường đồng"><input type="radio" name="swb-out" value="cu" checked/> Copper</label>
        <label title="Lớp paint mặt trên"><input type="radio" name="swb-out" value="paint"/> Paint</label>
        <label title="Cưa bo theo nét vẽ: nét phải đi từ mép bo tới mép bo, hoặc là vòng kín trong bo"><input type="radio" name="swb-out" value="saw"/> Saw</label>
        <label title="Tô kín hình khép kín (chỉ với Paint)"><input type="checkbox" id="swb-dlg-solid" disabled/> Solid</label>
      </div>
      <div class="swb-dlg-btns"><button id="swb-dlg-ok" class="primary">OK</button><button id="swb-dlg-cancel">Cancel</button></div>
    `;
    document.body.appendChild(dlg);
    const rng = document.getElementById('swb-dlg-rng');
    const inpEl = document.getElementById('swb-dlg-inp');
    rng.oninput = () => { inpEl.value = Number(rng.value).toFixed(2); };
    inpEl.oninput = () => { if (!isNaN(Number(inpEl.value))) rng.value = inpEl.value; };
    inpEl.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); document.getElementById('swb-dlg-ok').click(); }
      else if (e.key === 'Escape') { e.preventDefault(); document.getElementById('swb-dlg-cancel').click(); }
    });

    const toast = document.createElement('div');
    toast.id = 'swb-toast';
    document.body.appendChild(toast);

    const ctxMenu = document.createElement('div');
    ctxMenu.id = 'swb-ctx-menu';
    document.body.appendChild(ctxMenu);
    document.addEventListener('pointerdown', (e) => {
      if (!e.target.closest('#swb-ctx-menu')) ctxMenu.style.display = 'none';
    });

    // 4. SVG Overlay Layer inside LY.root (matches toMM(e) even when board is flipped to BACK!)
    const overlayG = el('g', { id: 'swb-overlay' }, bridge.getRoot ? bridge.getRoot() : pcbSvg);
    const lSug = el('g', {}, overlayG), lConst = el('g', {}, overlayG), lGeo = el('g', {}, overlayG), lCstr = el('g', {}, overlayG), lPts = el('g', {}, overlayG), lPrev = el('g', {}, overlayG);
    const ensureOverlay = () => {
      const rootNode = (bridge.getRoot && bridge.getRoot()) || bridge.getSvg();
      if (rootNode && rootNode.lastChild !== overlayG) rootNode.appendChild(overlayG);
      bridge.clearTmp?.();
    };
    bridge._ensureOverlay = ensureOverlay;

    model = new global.SketchCore.SketchModel();
    let toastT = null;
    const notify = (msg, type = 'warn') => {
      toast.textContent = msg; toast.className = type; toast.style.display = 'block';
      clearTimeout(toastT); toastT = setTimeout(() => { toast.style.display = 'none'; }, 2800);
    };

    // Viewport adapter sharing PCB Maker's SVG coordinates (mm)
    vp = {
      scale: 4, snapEnabled: true, gridStep: 1.27,
      selectedGeos: new Set(), selectedPoints: [], selectedConstraints: new Set(),
      hoverGeoId: null, hoverPoint: null, conflictingIds: new Set(), solverStatus: 'under',
      syncScale() {
        if (bridge.getPxPerMm) { const s = bridge.getPxPerMm(); if (s > 0 && isFinite(s)) { this.scale = s; return s; } }
        const rootNode = (bridge.getRoot && bridge.getRoot()) || bridge.getSvg();
        const ctm = rootNode && rootNode.getScreenCTM ? rootNode.getScreenCTM() : null;
        if (ctm) { const s = Math.hypot(ctm.a, ctm.b); if (s > 0) { this.scale = s; return s; } }
        return this.scale;
      },
      clearSelection() { this.selectedGeos.clear(); this.selectedPoints = []; this.selectedConstraints.clear(); },
      isPointSelected(gid, pos) { return this.selectedPoints.some((p) => p.geoId === gid && p.pos === pos); },
      togglePointSelection(gid, pos, multi) {
        if (!multi) { this.selectedGeos.clear(); this.selectedPoints = [{ geoId: gid, pos }]; }
        else { const i = this.selectedPoints.findIndex((p) => p.geoId === gid && p.pos === pos); if (i >= 0) this.selectedPoints.splice(i, 1); else this.selectedPoints.push({ geoId: gid, pos }); }
      },
      toggleGeoSelection(gid, multi) {
        if (!multi) { this.selectedPoints = []; this.selectedGeos.clear(); this.selectedGeos.add(gid); }
        else { if (this.selectedGeos.has(gid)) this.selectedGeos.delete(gid); else this.selectedGeos.add(gid); }
      },
      snap(wx, wy) {
        if (!this.snapEnabled) return { x: wx, y: wy, snapRef: null, snapKind: null };
        // 1. SketchWB vertices & centers
        let best = null, bestD = 1.1;
        for (const g of model.geometries) for (const p of model.getPointsOfGeo(g)) {
          const d = Math.hypot(p.x - wx, p.y - wy);
          if (d < bestD) { bestD = d; best = p; }
        }
        if (best) return { x: best.x, y: best.y, snapRef: { geoId: best.geoId, pos: best.pos }, snapKind: 'vertex' };
        // 2. PCB component pads
        const pad = bridge.findPadNear ? bridge.findPadNear(wx, wy, 1.35) : null;
        if (pad) return { x: pad.x, y: pad.y, snapRef: null, snapKind: 'pad', fixedAnchor: true };
        // 3. PCB existing copper trace endpoints / bend vertices
        const tv = bridge.findTraceVertexNear ? bridge.findTraceVertexNear(wx, wy, 1.2) : null;
        if (tv) return { x: tv.x, y: tv.y, snapRef: null, snapKind: 'vertex', fixedAnchor: true };
        // 4. SketchWB line bodies
        let linePt = null, lineD = 0.9;
        for (const g of model.geometries) {
          if (g.type !== 'line') continue;
          const dx = g.x2 - g.x1, dy = g.y2 - g.y1, l2 = dx * dx + dy * dy || 1;
          const t = Math.max(0, Math.min(1, ((wx - g.x1) * dx + (wy - g.y1) * dy) / l2));
          const px = g.x1 + t * dx, py = g.y1 + t * dy, d = Math.hypot(wx - px, wy - py);
          if (d < lineD) { lineD = d; linePt = { x: Number(px.toFixed(3)), y: Number(py.toFixed(3)), geoId: g.id }; }
        }
        if (linePt) return { x: linePt.x, y: linePt.y, snapRef: null, snapKind: 'edge' };
        // 5. PCB existing copper trace bodies
        const pcbSeg = bridge.findLineSnapNear ? bridge.findLineSnapNear(wx, wy, 0.9) : null;
        if (pcbSeg) return { x: pcbSeg.x, y: pcbSeg.y, snapRef: null, snapKind: 'edge', fixedAnchor: true };
        // 6. 1.27 mm Grid ONLY when top Snap button is ON
        const gridOn = bridge.isGridSnapOn ? bridge.isGridSnapOn() : true;
        if (!gridOn) {
          return { x: Number(wx.toFixed(3)), y: Number(wy.toFixed(3)), snapRef: null, snapKind: null };
        }
        const st = this.gridStep;
        return { x: Number((Math.round(wx / st) * st).toFixed(3)), y: Number((Math.round(wy / st) * st).toFixed(3)), snapRef: null, snapKind: null };
      },
      _arcPath(g) {
        const sx = g.cx + g.r * Math.cos(g.startAngle), sy = g.cy + g.r * Math.sin(g.startAngle);
        const ex = g.cx + g.r * Math.cos(g.endAngle), ey = g.cy + g.r * Math.sin(g.endAngle);
        let sp = (g.endAngle - g.startAngle) % (Math.PI * 2); if (sp < 0) sp += Math.PI * 2;
        return `M ${sx} ${sy} A ${g.r} ${g.r} 0 ${sp > Math.PI ? 1 : 0} 1 ${ex} ${ey}`;
      },
      clearPreview() { lPrev.innerHTML = ''; },
      drawPreview(fn) { ensureOverlay(); lPrev.innerHTML = ''; fn(lPrev, el); try { this.drawHint(); } catch (e) {} },
      // gợi ý: 2 đỉnh gần con trỏ nhất (đỉnh Sketch + đỉnh đường đồng), nét đứt mờ theo trục lệch ít hơn. Chỉ để nhìn, không bắt điểm.
      drawHint() {
        if (!this.snapEnabled || !this._lw) return;
        const x = this._lw.x, y = this._lw.y, cand = [], add = (rx, ry) => { const d = Math.hypot(rx - x, ry - y); if (d > 0.2 && d < 12) cand.push([d, rx, ry]); };
        for (const g of model.geometries) for (const p of model.getPointsOfGeo(g)) add(p.x, p.y);
        for (const l of (bridge.getTraceLines ? bridge.getTraceLines() : [])) { if (l.x1 != null) { add(l.x1, l.y1); add(l.x2, l.y2); } }
        cand.sort((a, b) => a[0] - b[0]);
        const seen = [];
        for (const c of cand) {
          if (seen.length >= 2) break;
          if (seen.some(q => Math.hypot(q[1] - c[1], q[2] - c[2]) < 0.05)) continue;
          seen.push(c);
          const rx = c[1], ry = c[2], dx = Math.abs(rx - x), dy = Math.abs(ry - y);
          if (Math.min(dx, dy) < 3) { if (dy <= dx) el('line', { x1: rx, y1: ry, x2: x, y2: ry, class: 'swb-hint' }, lPrev); else el('line', { x1: rx, y1: ry, x2: rx, y2: y, class: 'swb-hint' }, lPrev); }
          el('circle', { cx: rx, cy: ry, r: 0.5, class: 'swb-hintpt' }, lPrev);
        }
      },
      textTransform(tx, ty) {
        const invS = 1 / Math.max(0.5, this.scale);
        const rootNode = (bridge.getRoot && bridge.getRoot()) || bridge.getSvg();
        const ctm = rootNode && rootNode.getScreenCTM ? rootNode.getScreenCTM() : null;
        const fx = ctm && ctm.a < 0 ? -1 : 1;
        const fy = ctm && ctm.d < 0 ? -1 : 1;
        return `translate(${tx}, ${ty}) scale(${fx * invS}, ${fy * invS})`;
      },
      _drawArrow(parent, tipX, tipY, dirX, dirY, invS, isDriven) {
        const len = 8 * invS, w = 3 * invS;
        const bx = tipX - dirX * len, by = tipY - dirY * len;
        const nx = -dirY * w, ny = dirX * w;
        el('polygon', {
          points: `${tipX},${tipY} ${bx + nx},${by + ny} ${bx - nx},${by - ny}`,
          class: `dim-arrow ${isDriven ? 'driven' : ''}`,
        }, parent);
      },
      _drawCadDim(parent, p1, p2, lx, ly, mode, invS, isDriven) {
        let q1, q2, tx, ty;
        if (mode === 'distanceX') {
          const y = ly !== undefined ? ly : Math.max(p1.y, p2.y) + 16 * invS;
          q1 = { x: p1.x, y }; q2 = { x: p2.x, y };
          tx = lx !== undefined ? lx : (q1.x + q2.x) / 2; ty = y;
        } else if (mode === 'distanceY') {
          const x = lx !== undefined ? lx : Math.max(p1.x, p2.x) + 16 * invS;
          q1 = { x, y: p1.y }; q2 = { x, y: p2.y };
          tx = x; ty = ly !== undefined ? ly : (q1.y + q2.y) / 2;
        } else {
          const dx = p2.x - p1.x, dy = p2.y - p1.y, len = Math.hypot(dx, dy) || 1;
          const ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
          const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
          const off = lx !== undefined ? (lx - mx) * nx + (ly - my) * ny : 16 * invS;
          q1 = { x: p1.x + nx * off, y: p1.y + ny * off };
          q2 = { x: p2.x + nx * off, y: p2.y + ny * off };
          const tProj = lx !== undefined ? (lx - mx) * ux + (ly - my) * uy : 0;
          tx = (q1.x + q2.x) / 2 + ux * tProj;
          ty = (q1.y + q2.y) / 2 + uy * tProj;
        }
        const cls = `dim-line ${isDriven ? 'driven' : ''}`;
        el('line', { x1: p1.x, y1: p1.y, x2: q1.x, y2: q1.y, class: cls }, parent);
        el('line', { x1: p2.x, y1: p2.y, x2: q2.x, y2: q2.y, class: cls }, parent);
        el('line', { x1: q1.x, y1: q1.y, x2: q2.x, y2: q2.y, class: cls }, parent);
        const bdx = q2.x - q1.x, bdy = q2.y - q1.y, blen = Math.hypot(bdx, bdy);
        if (blen > 14 * invS) {
          const bux = bdx / blen, buy = bdy / blen;
          this._drawArrow(parent, q1.x, q1.y, -bux, -buy, invS, isDriven);
          this._drawArrow(parent, q2.x, q2.y, bux, buy, invS, isDriven);
        }
        return { tx, ty };
      },
      _drawAngleDim(parent, l1, l2, lx, ly, invS, isDriven, dir1 = 1, dir2 = 1) {
        const dx1 = l1.x2 - l1.x1, dy1 = l1.y2 - l1.y1;
        const dx2 = l2.x2 - l2.x1, dy2 = l2.y2 - l2.y1;
        const den = dx1 * dy2 - dy1 * dx2;
        if (Math.abs(den) < 1e-6) return null;
        const t = ((l2.x1 - l1.x1) * dy2 - (l2.y1 - l1.y1) * dx2) / den;
        const sx = l1.x1 + t * dx1, sy = l1.y1 + t * dy1;
        const a1 = Math.atan2(dy1 * dir1, dx1 * dir1);
        const a2 = Math.atan2(dy2 * dir2, dx2 * dir2);
        const diff = Math.atan2(Math.sin(a2 - a1), Math.cos(a2 - a1));
        const r = lx !== undefined ? Math.max(14 * invS, Math.hypot(lx - sx, ly - sy)) : 28 * invS;
        const p1x = sx + r * Math.cos(a1), p1y = sy + r * Math.sin(a1);
        const p2x = sx + r * Math.cos(a2), p2y = sy + r * Math.sin(a2);
        const cls = `dim-line ${isDriven ? 'driven' : ''}`;
        el('line', { x1: sx, y1: sy, x2: p1x, y2: p1y, class: cls, 'stroke-opacity': '0.45' }, parent);
        el('line', { x1: sx, y1: sy, x2: p2x, y2: p2y, class: cls, 'stroke-opacity': '0.45' }, parent);
        el('path', { d: `M ${p1x} ${p1y} A ${r} ${r} 0 0 ${diff >= 0 ? 1 : 0} ${p2x} ${p2y}`, class: cls, fill: 'none' }, parent);
        const sgn = diff >= 0 ? 1 : -1;
        this._drawArrow(parent, p1x, p1y, Math.sin(a1) * sgn, -Math.cos(a1) * sgn, invS, isDriven);
        this._drawArrow(parent, p2x, p2y, -Math.sin(a2) * sgn, Math.cos(a2) * sgn, invS, isDriven);
        const midA = a1 + diff / 2;
        return { tx: sx + r * Math.cos(midA), ty: sy + r * Math.sin(midA) };
      },
      _renderDimConstraint(c, invS) {
        if (c.hidden) return;
        let tx = c.lx, ty = c.ly, label = '';
        const isDriven = !!c.driven;
        if (c.type === 'radius' || c.type === 'diameter') {
          const g = model.getGeo(c.refs[0].geoId);
          if (!g) return;
          const ang = tx !== undefined ? Math.atan2(ty - g.cy, tx - g.cx) : Math.PI / 4;
          const rx = g.cx + g.r * Math.cos(ang), ry = g.cy + g.r * Math.sin(ang);
          if (tx === undefined) { tx = rx + 14 * invS * Math.cos(ang); ty = ry + 14 * invS * Math.sin(ang); }
          el('line', { x1: g.cx, y1: g.cy, x2: tx, y2: ty, class: `dim-line ${isDriven ? 'driven' : ''}` }, lCstr);
          this._drawArrow(lCstr, rx, ry, Math.cos(ang), Math.sin(ang), invS, isDriven);
          label = (c.type === 'radius' ? 'R ' : 'Ø ') + Number(c.value).toFixed(2) + ' mm';
        } else if (c.type === 'angle') {
          const g1 = model.getGeo(c.refs[0].geoId), g2 = model.getGeo(c.refs[1].geoId);
          if (!g1 || !g2 || g1.type !== 'line' || g2.type !== 'line') return;
          const pos = this._drawAngleDim(lCstr, g1, g2, tx, ty, invS, isDriven, c.dir1 || 1, c.dir2 || 1);
          if (!pos) return;
          tx = pos.tx; ty = pos.ty;
          label = `${Number(c.value).toFixed(1)}°`;
        } else {
          let p1, p2;
          if (c.refs.length === 1) {
            const g = model.getGeo(c.refs[0].geoId);
            if (!g || g.type !== 'line') return;
            p1 = { x: g.x1, y: g.y1 }; p2 = { x: g.x2, y: g.y2 };
          } else {
            const r0 = c.refs[0], r1 = c.refs[1];
            const g0 = model.getGeo(r0.geoId), g1 = model.getGeo(r1.geoId);
            if ((r0.pos && r0.pos !== 'none') && (!r1.pos || r1.pos === 'none') && g1?.type === 'line') {
              p1 = model.getPoint(r0.geoId, r0.pos);
              const dx = g1.x2 - g1.x1, dy = g1.y2 - g1.y1, len2 = dx * dx + dy * dy || 1;
              const t = ((p1.x - g1.x1) * dx + (p1.y - g1.y1) * dy) / len2;
              p2 = { x: g1.x1 + t * dx, y: g1.y1 + t * dy };
            } else if ((r1.pos && r1.pos !== 'none') && (!r0.pos || r0.pos === 'none') && g0?.type === 'line') {
              p1 = model.getPoint(r1.geoId, r1.pos);
              const dx = g0.x2 - g0.x1, dy = g0.y2 - g0.y1, len2 = dx * dx + dy * dy || 1;
              const t = ((p1.x - g0.x1) * dx + (p1.y - g0.y1) * dy) / len2;
              p2 = { x: g0.x1 + t * dx, y: g0.y1 + t * dy };
            } else {
              p1 = model.getPoint(r0.geoId, r0.pos);
              p2 = model.getPoint(r1.geoId, r1.pos);
            }
          }
          if (!p1 || !p2) return;
          const pos = this._drawCadDim(lCstr, p1, p2, tx, ty, c.type, invS, isDriven);
          tx = pos.tx; ty = pos.ty;
          label = `${Number(c.value).toFixed(2)} mm`;
        }
        const padW = (label.length * 6.5 + 10) * invS, padH = 15 * invS;
        el('rect', {
          x: tx - padW / 2, y: ty - padH / 2, width: padW, height: padH,
          rx: 2 * invS, class: 'dim-bg', 'data-dim-id': c.id, 'data-const-id': c.id,
        }, lCstr);
        const t = el('text', {
          x: 0, y: 0, 'dominant-baseline': 'central',
          transform: this.textTransform(tx, ty),
          class: `dim-label ${isDriven ? 'driven' : ''} ${this.conflictingIds.has(c.id) ? 'conflict' : ''} ${this.selectedConstraints.has(c.id) ? 'selected' : ''}`,
          'data-dim-id': c.id, 'data-const-id': c.id,
        }, lCstr);
        t.textContent = label;
      },
      render() {
        ensureOverlay();
        this.syncScale();
        lSug.innerHTML = ''; lConst.innerHTML = ''; lGeo.innerHTML = ''; lCstr.innerHTML = ''; lPts.innerHTML = '';
        if (active && bridge.getSuggestedPads && (activeToolName === 'polyline' || activeToolName === 'line')) {
          try {
            const startPt = (activeToolName === 'polyline' && (tools?.polyline?.startPt || tools?.polyline?.lastPt))
              || (activeToolName === 'line' && tools?.line?.p1)
              || null;
            const sugs = bridge.getSuggestedPads(startPt) || [];
            for (const s of sugs) {
              el('circle', { cx: s.x, cy: s.y, r: 1.55, class: 'swb-sug-ring ' + (s.kind || 'pref') }, lSug);
            }
          } catch (e) {}
        }
        const ptR = 1.8 / Math.max(0.5, this.scale);
        for (const g of model.geometries) {
          const lay = g.construction ? lConst : lGeo;
          const cls = [g.type === 'line' ? 'geo-line' : g.type === 'circle' ? 'geo-circle' : 'geo-arc', g.construction ? 'geo-construction' : '', this.solverStatus === 'fully' && !g.construction ? 'geo-fully' : '', this.selectedGeos.has(g.id) ? 'geo-selected' : '', this.hoverGeoId === g.id ? 'geo-hover' : ''].filter(Boolean).join(' ');
          if (g.type === 'line') { el('line', { x1: g.x1, y1: g.y1, x2: g.x2, y2: g.y2, class: cls }, lay); el('line', { x1: g.x1, y1: g.y1, x2: g.x2, y2: g.y2, class: 'geo-hit', 'data-geo': g.id }, lay); }
          else if (g.type === 'circle') { el('circle', { cx: g.cx, cy: g.cy, r: g.r, class: cls }, lay); el('circle', { cx: g.cx, cy: g.cy, r: g.r, class: 'geo-hit', 'data-geo': g.id }, lay); }
          else if (g.type === 'arc') { const d = this._arcPath(g); el('path', { d, class: cls }, lay); el('path', { d, class: 'geo-hit', 'data-geo': g.id }, lay); }
          for (const p of model.getPointsOfGeo(g)) {
            const pCls = ['geo-point', this.isPointSelected(p.geoId, p.pos) ? 'selected' : '', this.hoverPoint && this.hoverPoint.geoId === p.geoId && this.hoverPoint.pos === p.pos ? 'hover' : ''].filter(Boolean).join(' ');
            el('circle', { cx: p.x, cy: p.y, r: ptR, class: pCls, 'data-pt-geo': p.geoId, 'data-pt-pos': p.pos }, lPts);
          }
        }
        // Dimension & Coincident constraint visuals
        const invS = 1 / Math.max(0.5, this.scale);
        const cSeen = new Set();
        for (const c of model.constraints) {
          if (['distance', 'distanceX', 'distanceY', 'radius', 'diameter', 'angle'].includes(c.type)) {
            this._renderDimConstraint(c, invS);
            continue;
          }
          if (c.type !== 'coincident' || !c.refs || !c.refs.length) continue;
          const ref = c.refs[0];
          const pt = model.getPoint(ref.geoId, ref.pos);
          if (!pt) continue;
          const key = `${Math.round(pt.x * 100)},${Math.round(pt.y * 100)}`;
          if (cSeen.has(key)) continue;
          cSeen.add(key);
          el('circle', { cx: pt.x, cy: pt.y, r: ptR * 1.85, class: 'const-coincident' }, lCstr);
        }
      },
    };

    let customPop = null, editCid = null;
    const closeDlg = (cancel) => { if (cancel && customPop?.onCancel) customPop.onCancel(); customPop = null; editCid = null; dlg.style.display = 'none'; };
    const bindDimOk = () => {
      document.getElementById('swb-dlg-ok').onclick = () => {
        const v = Number(document.getElementById('swb-dlg-inp').value);
        const chk = document.getElementById('swb-dlg-chk').checked;
        if (customPop && !isNaN(v)) customPop.onApply?.(v, chk);
        closeDlg(false);
      };
    };
    const openValuePopup = ({ title, label, unit, value, checkLabel, checked, clientX, clientY, onApply, onCancel }) => {
      customPop = { onApply, onCancel };
      bindDimOk();
      document.getElementById('swb-dlg-cancel').onclick = () => closeDlg(true);   // hộp Finish có thể đã đổi nút này
      document.getElementById('swb-dlg-hd').textContent = title || 'Value';
      document.getElementById('swb-dlg-lbl').textContent = label || 'Value:';
      document.getElementById('swb-dlg-unit').textContent = unit || '';
      document.getElementById('swb-dlg-slider-row').style.display = 'none';
      const chk = document.getElementById('swb-dlg-chk');
      chk.parentElement.style.display = checkLabel ? '' : 'none';
      if (checkLabel) { chk.nextElementSibling.textContent = checkLabel; chk.checked = !!checked; }
      const inp = document.getElementById('swb-dlg-inp');
      inp.value = Number(value).toFixed(2);
      dlg.style.left = `${Math.max(8, Math.min(window.innerWidth - 235, clientX + 10))}px`;
      dlg.style.top = `${Math.max(8, Math.min(window.innerHeight - 130, clientY - 15))}px`;
      dlg.style.display = 'block'; inp.focus(); inp.select();
    };
    const openInlineDim = (cid, cx, cy, isNew) => {
      const c = model.constraints.find((x) => x.id === cid);
      if (!c || c.value === undefined) return;
      openValuePopup({
        title: 'Insert Dimension', label: 'Value:', unit: c.type === 'angle' ? '°' : 'mm', value: c.value,
        checkLabel: 'Reference (Driven)', checked: !!c.driven, clientX: cx, clientY: cy,
        onApply: (v, chk) => {
          if (c.offsetMeta) global.SketchOps.updateOffsetDistance(model, c.offsetMeta, v);
          else { c.value = v; c.driven = chk; }
          solve(); vp.render(); updateUI();
        },
        onCancel: () => { if (isNew) { model.removeConstraint(cid); solve(); vp.render(); updateUI(); } },
      });
    };
    bindDimOk();
    document.getElementById('swb-dlg-cancel').onclick = () => closeDlg(true);

    const solve = (pin = null) => {
      const res = global.SketchSolver.solve(model, pin);
      vp.solverStatus = res.status; vp.conflictingIds = new Set(res.conflictingIds);
      const box = document.getElementById('swb-solver-box');
      box.className = `swb-solver ${res.status}`;
      document.getElementById('swb-solver-msg').textContent = res.status === 'fully' ? 'Fully constrained' : `Under-constrained (${res.dof} DoFs)`;
      return res;
    };
    solveFn = solve;

    const updateUI = () => {
      document.getElementById('swb-cnt-c').textContent = model.constraints.length;
      document.getElementById('swb-cnt-e').textContent = model.geometries.length;
      const lc = document.getElementById('swb-list-c'), le = document.getElementById('swb-list-e');
      lc.innerHTML = ''; le.innerHTML = '';
      for (const c of model.constraints) {
        const li = document.createElement('li');
        li.innerHTML = `<span>${c.type}${c.value !== undefined ? ' = ' + Number(c.value).toFixed(1) : ''}</span><button class="swb-del">✕</button>`;
        li.querySelector('.swb-del').onclick = () => { model.pushHistory(); model.removeConstraint(c.id); solve(); vp.render(); updateUI(); };
        lc.appendChild(li);
      }
      for (const g of model.geometries) {
        const li = document.createElement('li');
        if (vp.selectedGeos.has(g.id)) li.classList.add('selected');
        li.innerHTML = `<span>${g.id} - ${g.type}</span><button class="swb-del">✕</button>`;
        li.onclick = () => { vp.toggleGeoSelection(g.id, false); vp.render(); updateUI(); };
        li.querySelector('.swb-del').onclick = (ev) => { ev.stopPropagation(); model.pushHistory(); model.removeGeo(g.id); solve(); vp.render(); updateUI(); };
        le.appendChild(li);
      }
    };

    tools = global.SketchTools.createTools({
      model, vp, solve, updateUI, notify, openInlineDim, openValuePopup,
      getExtraGeos: () => (bridge.getTraceLines ? bridge.getTraceLines() : []),
      // Dim: bắt chân linh kiện, đỉnh đường đồng, mép bo PCB (khi không trúng hình Sketch)
      getPcbDimSnap: (x, y, tol) => {
        const pad = bridge.findPadNear ? bridge.findPadNear(x, y, Math.max(tol, 1.35)) : null;
        if (pad) return { kind: 'pt', x: pad.x, y: pad.y };
        const tv = bridge.findTraceVertexNear ? bridge.findTraceVertexNear(x, y, tol) : null;
        if (tv) return { kind: 'pt', x: tv.x, y: tv.y };
        let best = null, bd = tol;
        for (const [a, b] of (bridge.getBoardEdges ? bridge.getBoardEdges() : [])) {
          const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l2));
          const px = a[0] + t * dx, py = a[1] + t * dy, d = Math.hypot(x - px, y - py);
          if (Math.hypot(x - a[0], y - a[1]) < tol * 0.6) return { kind: 'pt', x: a[0], y: a[1] };   // góc bo
          if (d < bd) { bd = d; best = { kind: 'edge', x: px, y: py, x1: a[0], y1: a[1], x2: b[0], y2: b[1] }; }
        }
        return best;
      },
      isConstruction: () => constructionMode,
      autoConst: () => document.getElementById('swb-auto').checked,
      isShiftLock: () => !!(bridge.isShiftLock && bridge.isShiftLock()),
      syncCtxBar: () => bridge.syncCtxBar?.(),
      opts,
    });

    const setSwbTool = (name, arg = null) => {
      if (!tools[name]) return;
      activeToolName = name; vp.hoverPoint = null; vp.hoverGeoId = null; vp.clearPreview(); tools[name].activate?.(arg);
      stageEl.classList.toggle('swb-select', name === 'select');
      tb.querySelectorAll('.swb-btn[data-tool]').forEach((b) => b.classList.toggle('active', b.dataset.tool === name));
      tb.querySelectorAll('.swb-btn[data-dim]').forEach((b) => b.classList.toggle('active', name === 'dimension'));
      const pBtn = document.getElementById('swb-btn-poly');
      if (pBtn) pBtn.classList.toggle('active', ['polygon', 'slot', 'line', 'circle', 'rectangle'].includes(name));
      const oBtn = document.getElementById('swb-btn-coincident');
      if (oBtn) oBtn.classList.toggle('active', name === 'coincident');
      if (name === 'coincident' && !arg) notify('Coincident: chọn 2 điểm, hoặc điểm + cạnh, hoặc 2 đường tròn', 'info');
      vp.render();
      bridge.syncCtxBar?.();
    };
    bridge._setSwbTool = setSwbTool;
    bridge._getSwbCtxState = () => ({
      active,
      tool: activeToolName,
      drawing: (activeToolName === 'polyline' && !!tools?.polyline?.lastPt) || (activeToolName === 'line' && !!tools?.line?.p1),
    });
    bridge._finishSwbActive = () => {
      if (activeToolName === 'polyline' && tools?.polyline?.lastPt) tools.polyline.onKey({ key: 'Escape' });
      else if (activeToolName === 'line' && tools?.line?.p1) tools.line.onKey({ key: 'Escape' });
      bridge.syncCtxBar?.();
    };
    bridge._cancelSwbActive = () => {
      tools[activeToolName]?.onKey?.({ key: 'Escape' });
      bridge.syncCtxBar?.();
    };
    bridge._refreshSwbPreview = () => {
      if (active && lastWorldPt && (activeToolName === 'line' || activeToolName === 'polyline')) {
        vp.syncScale();
        tools[activeToolName]?.onMove?.({ shiftKey: !!(bridge.isShiftLock && bridge.isShiftLock()) }, lastWorldPt);
      }
    };

    const applyConstraintSwb = (tp) => {
      const pts = [...vp.selectedPoints], geos = [...vp.selectedGeos];
      if (tp === 'coincident') {
        if (!pts.length && !geos.length) { setSwbTool('coincident'); return; }
        if (pts.length === 1 && !geos.length) {
          setSwbTool('coincident', { kind: 'point', geoId: pts[0].geoId, pos: pts[0].pos });
          vp.render();
          notify('Coincident: chọn điểm hoặc cạnh thứ 2', 'info');
          return;
        }
        if (geos.length === 1 && !pts.length) {
          setSwbTool('coincident', { kind: 'geo', geoId: geos[0] });
          vp.render();
          notify('Coincident: chọn điểm hoặc đường tròn thứ 2', 'info');
          return;
        }
        if (pts.length >= 2) {
          model.pushHistory();
          for (let i = 1; i < pts.length; i++) model.addConstraint('coincident', [pts[0], pts[i]]);
          notify('Đã gắn Coincident', 'ok');
        } else if (pts.length >= 1 && geos.length >= 1) {
          let added = false;
          for (const p of pts) for (const gid of geos) if (p.geoId !== gid) {
            if (!added) { model.pushHistory(); added = true; }
            model.addConstraint('pointOnObject', [p, { geoId: gid }]);
          }
          if (!added) { notify('Chọn điểm và cạnh khác nhau', 'warn'); return; }
          notify('Đã gắn Điểm trên cạnh', 'ok');
        } else if (geos.length >= 2) {
          const allCirc = geos.every((id) => { const g = model.getGeo(id); return g && (g.type === 'circle' || g.type === 'arc'); });
          if (!allCirc) { notify('Chọn 2 điểm (Shift+Click), 1 điểm + 1 cạnh, hoặc 2 đường tròn/cung tròn', 'warn'); return; }
          model.pushHistory();
          for (let i = 1; i < geos.length; i++) model.addConstraint('coincident', [{ geoId: geos[0], pos: 'center' }, { geoId: geos[i], pos: 'center' }]);
          notify('Đã gắn Đồng tâm (Concentric)', 'ok');
        }
        vp.clearSelection();
      } else if (tp === 'autohv' || tp === 'horizontal' || tp === 'vertical') {
        const ls = geos.map((id) => model.getGeo(id)).filter((g) => g?.type === 'line');
        if (!ls.length) { notify('Select 1+ line(s)'); return; }
        const ensureEndpointLock = (gid, pos, x, y) => {
          const hasLock = model.constraints.some((c) => c.type === 'lock' && c.refs.some((r) => r.geoId === gid && r.pos === pos));
          if (hasLock) return true;
          const onPad = bridge.findPadNear?.(x, y, 0.15);
          const onTv = !onPad && bridge.findTraceVertexNear?.(x, y, 0.15);
          const onSeg = !onPad && !onTv && bridge.findLineSnapNear?.(x, y, 0.15);
          const anc = onPad || onTv || onSeg;
          if (anc) { model.addConstraint('lock', [{ geoId: gid, pos }], { x: anc.x, y: anc.y }); return true; }
          return false;
        };
        model.pushHistory();
        let lockedBothWarn = false;
        for (const l of ls) {
          const lockStart = ensureEndpointLock(l.id, 'start', l.x1, l.y1);
          const lockEnd = ensureEndpointLock(l.id, 'end', l.x2, l.y2);
          if (lockStart && lockEnd) { lockedBothWarn = true; continue; }
          if (tp === 'horizontal' || tp === 'vertical') model.addConstraint(tp, [{ geoId: l.id }]);
          else {
            const dx = l.x2 - l.x1, dy = l.y2 - l.y1, deg = (Math.atan2(Math.abs(dy), Math.abs(dx)) * 180) / Math.PI;
            model.addConstraint(deg <= 15 ? 'horizontal' : deg >= 75 ? 'vertical' : 'diag45', [{ geoId: l.id }], { sign: dx * dy >= 0 ? 1 : -1 });
          }
        }
        if (lockedBothWarn) notify('Hai đầu đoạn này đã neo vào chân/đường đồng — chỉ nắn được đoạn có đầu nối tự do', 'warn');
      } else if (tp === 'parallel' || tp === 'perpendicular' || tp === 'equal') {
        if (geos.length < 2) { notify('Select 2+ elements'); return; }
        model.pushHistory();
        for (let i = 1; i < geos.length; i++) model.addConstraint(tp, [{ geoId: geos[0] }, { geoId: geos[i] }]);
      } else if (tp === 'symmetric') {
        if (pts.length >= 2 && geos.length === 1) { model.pushHistory(); model.addConstraint('symmetric', [pts[0], pts[1], { geoId: geos[0], pos: 'none' }]); }
        else { notify('Select 2 points + 1 axis line'); return; }
      }
      solve(); vp.render(); updateUI();
    };

    // Toolbar events + Drag inside stage + Keyboard shortcuts
    tb.addEventListener('click', (e) => {
      const arr = e.target.closest('.swb-arrow');
      if (arr) {
        e.stopPropagation();
        const m = document.getElementById(arr.dataset.menu);
        const was = m.classList.contains('open');
        tb.querySelectorAll('.swb-menu.open').forEach((x) => x.classList.remove('open'));
        if (!was) m.classList.add('open');
        return;
      }
      tb.querySelectorAll('.swb-menu.open').forEach((m) => m.classList.remove('open'));
      const t = e.target.closest('[data-tool]');
      if (t) {
        const tk = t.dataset.tool;
        if (t.dataset.sides) opts.polygonSides = Number(t.dataset.sides);
        if (t.dataset.polyIcon) {
          const mainPoly = document.getElementById('swb-btn-poly');
          mainPoly.dataset.tool = tk;
          mainPoly.querySelector('img').src = t.dataset.polyIcon;
        }
        if (t.dataset.fcIcon) {
          const mainFc = document.getElementById('swb-btn-fc');
          mainFc.dataset.tool = tk;
          mainFc.querySelector('img').src = t.dataset.fcIcon;
        }
        setSwbTool(tk);
        return;
      }
      const d = e.target.closest('[data-dim]'); if (d) { setSwbTool('dimension', d.dataset.dim); return; }
      const c = e.target.closest('[data-c]');
      if (c) {
        const tp = c.dataset.c;
        if (c.dataset.icon) {
          const mainC = document.getElementById('swb-btn-cstr');
          mainC.dataset.c = tp;
          mainC.querySelector('img').src = c.dataset.icon;
        }
        applyConstraintSwb(tp);
        return;
      }
      if (e.target.closest('#swb-btn-const')) { constructionMode = !constructionMode; document.getElementById('swb-btn-const').classList.toggle('const-on', constructionMode); }
      if (e.target.closest('#swb-finish')) finishToPcb(e);
      if (e.target.closest('#swb-exit')) exitSketch();
    });

    const grip = tb.querySelector('.swb-grip');
    let dragging = false, ox = 0, oy = 0;
    grip.ondblclick = () => { tb.style.left = ''; tb.style.right = '6px'; tb.style.top = '6px'; };
    grip.onpointerdown = (e) => {
      e.preventDefault(); const sr = stageEl.getBoundingClientRect(), r = tb.getBoundingClientRect();
      dragging = true; ox = e.clientX - r.left; oy = e.clientY - r.top;
      tb.style.right = 'auto'; tb.style.left = `${r.left - sr.left}px`; tb.style.top = `${r.top - sr.top}px`;
      grip.setPointerCapture(e.pointerId);
    };
    grip.onpointermove = (e) => {
      if (!dragging) return;
      const sr = stageEl.getBoundingClientRect();
      tb.style.left = `${Math.max(4, Math.min(sr.width - 48, e.clientX - sr.left - ox))}px`;
      tb.style.top = `${Math.max(4, Math.min(sr.height - 80, e.clientY - sr.top - oy))}px`;
    };
    grip.onpointerup = () => { dragging = false; };

    let lastEscTime = 0;

    window.addEventListener('keydown', (e) => {
      if (!active || e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      const k = e.key.toLowerCase();
      if (k === 'a') { e.stopImmediatePropagation(); applyConstraintSwb('autohv'); }
      else if (k === 'h') { e.stopImmediatePropagation(); applyConstraintSwb('horizontal'); }
      else if (k === 'v') { e.stopImmediatePropagation(); applyConstraintSwb('vertical'); }
      else if (k === 'o') { e.stopImmediatePropagation(); applyConstraintSwb('coincident'); }
      else if (k === 'd') { e.stopImmediatePropagation(); setSwbTool('dimension', 'smart'); }
      else if (k === 'f') { e.stopImmediatePropagation(); setSwbTool('fillet'); }
      else if (k === 't') { e.stopImmediatePropagation(); setSwbTool('trim'); }
      else if (k === 'm') { e.stopImmediatePropagation(); setSwbTool('polyline'); }
      else if (k === 'l') { e.stopImmediatePropagation(); setSwbTool('line'); }
      else if (k === 'c') { e.stopImmediatePropagation(); setSwbTool('chamfer'); }
      else if (k === 'r') { e.stopImmediatePropagation(); setSwbTool('rectangle'); }
      else if (k === 'g') { e.stopImmediatePropagation(); setSwbTool('polygon'); }
      else if (k === 'n') { e.stopImmediatePropagation(); document.getElementById('swb-btn-const').click(); }
      else if (k === 'x') { e.stopImmediatePropagation(); setSwbTool('point'); }
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.stopImmediatePropagation();
        if (vp.selectedPoints.length === 1 && !vp.selectedGeos.size && !vp.selectedConstraints.size) {
          const p = vp.selectedPoints[0];
          model.pushHistory();
          const r = global.SketchOps.removeJointPoint(model, p.geoId, p.pos);
          if (r.ok) { vp.clearSelection(); solve(); vp.render(); updateUI(); }
          else notify(r.msg, 'warn');
        } else if (vp.selectedGeos.size || vp.selectedConstraints.size) {
          model.pushHistory();
          for (const cid of vp.selectedConstraints) model.removeConstraint(cid);
          for (const id of vp.selectedGeos) model.removeGeo(id);
          vp.clearSelection(); solve(); vp.render(); updateUI();
        }
      }
      else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        const stayed = tools[activeToolName]?.onKey?.(e);
        if (stayed) return;
        if (activeToolName !== 'select') {
          setSwbTool('select');
          lastEscTime = 0;
          return;
        }
        const now = Date.now();
        if (now - lastEscTime < 800) {
          lastEscTime = 0;
          closePlugin();
          bridge.setTool('sel');
        } else {
          lastEscTime = now;
          notify('Nhấn Esc lần nữa (hoặc ✓ Finish) để thoát Line Sketch', 'info');
        }
      }
      else if (e.key === 'Shift' && lastWorldPt && (activeToolName === 'line' || activeToolName === 'polyline')) {
        vp.syncScale();
        tools[activeToolName]?.onMove?.({ shiftKey: true }, lastWorldPt);
      }
    }, true);

    window.addEventListener('keyup', (e) => {
      if (!active || e.key !== 'Shift' || !lastWorldPt) return;
      if (activeToolName === 'line' || activeToolName === 'polyline') {
        vp.syncScale();
        tools[activeToolName]?.onMove?.({ shiftKey: false }, lastWorldPt);
      }
    }, true);

    // Block PCB contextmenu & handle Right-click to exit ONLY current SketchWB tool (stay in Line Sketch)
    stageEl.addEventListener('contextmenu', (e) => {
      if (!active) return;
      e.preventDefault();
      e.stopImmediatePropagation();
    }, true);

    // Capture-phase mouse events on PCB stage when SketchWB is active
    // Ignore events originating on #swb-toolbar, #swb-dlg, #swb-toast, or #plCtxBar!
    const isSwbUi = (e) => !!(e.target && e.target.closest && e.target.closest('#swb-toolbar, #swb-dlg, #swb-toast, #plCtxBar'));
    let rPanMoved = false, rDownPos = null, lastWorldPt = null;
    stageEl.addEventListener('pointerdown', (e) => {
      if (!active || isSwbUi(e)) return;
      if (bridge.isPenOnly?.() && e.pointerType === 'touch') return;
      if (e.button === 2) {
        rPanMoved = false;
        rDownPos = { x: e.clientX, y: e.clientY };
        return; // allow right-drag pan if user drags
      }
      if (e.button !== 0) return;
      e.stopImmediatePropagation(); e.preventDefault();
      vp.syncScale();
      const w = bridge.toMM(e);
      lastWorldPt = w;
      tools[activeToolName]?.onDown?.(e, w);
    }, true);
    stageEl.addEventListener('pointermove', (e) => {
      if (!active || isSwbUi(e)) return;
      if (bridge.isPenOnly?.() && e.pointerType === 'touch') return;
      if (rDownPos && Math.hypot(e.clientX - rDownPos.x, e.clientY - rDownPos.y) > 4) rPanMoved = true;
      if (!rDownPos && e.buttons === 0) e.stopImmediatePropagation();
      vp.syncScale();
      const w = bridge.toMM(e);
      lastWorldPt = w; vp._lw = w;
      tools[activeToolName]?.onMove?.(e, w);
    }, true);
    stageEl.addEventListener('pointerup', (e) => {
      if (!active || isSwbUi(e)) return;
      if (bridge.isPenOnly?.() && e.pointerType === 'touch') return;
      if (e.button === 2) {
        const wasClick = rDownPos && !rPanMoved;
        rDownPos = null;
        if (wasClick) {
          e.preventDefault();
          e.stopImmediatePropagation();
          if (activeToolName === 'polyline' && tools.polyline.lastPt) { tools.polyline.onKey({ key: 'Escape' }); bridge.syncCtxBar?.(); }
          else if (activeToolName === 'dimension' && tools.dimension.picks.length) tools.dimension.onKey({ key: 'Escape' });
          else if (activeToolName !== 'select') {
            tools[activeToolName]?.onKey?.({ key: 'Escape' });
            setSwbTool('select');
          } else {
            // In Select mode: right-click on a Joint Point opens Delete Joint menu!
            vp.syncScale();
            const w = bridge.toMM(e);
            const ptEl = e.target.closest('[data-pt-geo]');
            const hitPt = ptEl
              ? { geoId: Number(ptEl.getAttribute('data-pt-geo')), pos: ptEl.getAttribute('data-pt-pos') }
              : global.SketchOps.findPointAt?.(model, w.x, w.y, 8 / Math.max(0.5, vp.scale));
            if (hitPt && hitPt.geoId > 0) {
              const gid = hitPt.geoId, pos = hitPt.pos;
              if (gid > 0) {
                ctxMenu.innerHTML = `<button type="button" id="swb-del-joint"><span>✕ Delete Joint (nối 2 đầu)</span><kbd>Del</kbd></button>`;
                ctxMenu.style.left = `${e.clientX + 4}px`;
                ctxMenu.style.top = `${e.clientY + 4}px`;
                ctxMenu.style.display = 'block';
                document.getElementById('swb-del-joint').onclick = () => {
                  ctxMenu.style.display = 'none';
                  model.pushHistory();
                  const r = global.SketchOps.removeJointPoint(model, gid, pos);
                  if (r.ok) { vp.clearSelection(); solve(); vp.render(); updateUI(); }
                  else notify(r.msg, 'warn');
                };
              }
            }
          }
        }
        return;
      }
      if (e.button !== 0) return;
      e.stopPropagation();
      tools[activeToolName]?.onUp?.(e, bridge.toMM(e));
    }, true);
  }

  function exitSketch() {   // bỏ hết nét vẽ, thoát, bo giữ nguyên
    const dlg = document.getElementById('swb-dlg'); if (dlg) dlg.style.display = 'none';
    const out = document.getElementById('swb-dlg-out'); if (out) out.style.display = 'none';
    model.clear();
    vp.clearSelection(); vp.clearPreview(); vp.render();
    closePlugin();
    bridge.setTool('sel');
  }

  function finishToPcb(e) {
    const rect = e.target.getBoundingClientRect();
    openValuePopupImpl(rect.left - 180, rect.top - 10);
  }

  function openValuePopupImpl(cx, cy) {
    const dlg = document.getElementById('swb-dlg');
    document.getElementById('swb-dlg-hd').textContent = 'Trace width';
    document.getElementById('swb-dlg-lbl').textContent = 'Width:';
    document.getElementById('swb-dlg-unit').textContent = 'mm';
    document.getElementById('swb-dlg-slider-row').style.display = 'flex';
    document.getElementById('swb-dlg-rng').value = '0.8';
    document.getElementById('swb-dlg-chk').parentElement.style.display = 'none';
    const outRow = document.getElementById('swb-dlg-out'), solidChk = document.getElementById('swb-dlg-solid');
    outRow.style.display = 'flex';
    outRow.querySelector('input[name="swb-out"][value="cu"]').checked = true; solidChk.checked = false;   // mỗi lần mở: mặc định Dây đồng
    const outMode = () => (outRow.querySelector('input[name="swb-out"]:checked') || {}).value || 'cu';
    const cancelBtn = document.getElementById('swb-dlg-cancel');
    const wRows = [document.getElementById('swb-dlg-slider-row'), document.getElementById('swb-dlg-lbl').parentElement];
    const syncOut = () => {
      const m = outMode(); solidChk.disabled = m !== 'paint'; if (solidChk.disabled) solidChk.checked = false;
      wRows.forEach((r) => { r.style.display = m === 'saw' ? 'none' : 'flex'; });   // Saw: không có độ rộng
      document.getElementById('swb-dlg-hd').textContent = m === 'saw' ? 'Saw board' : 'Trace width';
    };
    outRow.querySelectorAll('input[name="swb-out"]').forEach((r) => { r.onchange = syncOut; });
    syncOut();
    cancelBtn.textContent = 'Back'; cancelBtn.title = 'Quay lại vẽ tiếp';
    const closeFinish = () => { dlg.style.display = 'none'; outRow.style.display = 'none'; cancelBtn.textContent = 'Cancel'; cancelBtn.title = ''; wRows.forEach((r) => { r.style.display = 'flex'; }); };
    const inp = document.getElementById('swb-dlg-inp');
    inp.value = '0.80';
    dlg.style.left = `${Math.max(8, Math.min(window.innerWidth - 240, cx - 60))}px`;
    dlg.style.top = `${Math.max(8, Math.min(window.innerHeight - 150, cy - 30))}px`;
    dlg.style.display = 'block'; inp.focus(); inp.select();

    const commit = () => {
      const w = Math.max(0.2, Number(inp.value) || 0.8);
      const toSaw = outMode() === 'saw' && !!bridge.saw, sawQ = [];
      const toPaint = outMode() === 'paint' && !!bridge.addArt, solid = toPaint && solidChk.checked;
      closeFinish();
      const emit = (pts, net) => {
        if (toSaw) return sawQ.push(pts);
        if (!toPaint) return bridge.addTrace(pts, w, net);
        const closed = pts.length > 2 && nearPt(pts[0], pts[pts.length - 1]);
        bridge.addArt(closed ? pts.slice(0, -1) : pts, w, closed, solid && closed);
      };
      solveFn?.();
      const nearPt = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.05;
      const toPts = (gg) => {
        if (gg.type === 'line') return [[gg.x1, gg.y1], [gg.x2, gg.y2]];
        if (gg.type === 'arc' || gg.type === 'circle') {
          const sa = gg.type === 'circle' ? 0 : gg.startAngle;
          const ea = gg.type === 'circle' ? Math.PI * 2 : gg.endAngle;
          let sp = (ea - sa) % (Math.PI * 2); if (sp <= 0) sp += Math.PI * 2;
          const steps = gg.type === 'circle' ? 24 : 16, pts = [];
          for (let i = 0; i <= steps; i++) {
            const a = sa + (sp * i) / steps;
            pts.push([gg.cx + gg.r * Math.cos(a), gg.cy + gg.r * Math.sin(a)]);
          }
          return pts;
        }
        return null;
      };

      const visited = new Set();
      let chainSeq = 1;
      for (const g of model.geometries) {
        if (g.construction || g.type === 'point' || visited.has(g.id)) continue;
        const chainIds = global.SketchOps.getConnectedChain(model, g.id).filter((id) => {
          const gg = model.getGeo(id);
          return gg && !gg.construction && gg.type !== 'point';
        });
        for (const id of chainIds) visited.add(id);

        // Detect net (and auto-reassign module signal pin if routed to another allowed free MCU GPIO)
        const chainTouchPts = [];
        for (const id of chainIds) {
          const gg = model.getGeo(id);
          for (const pt of model.getPointsOfGeo(gg)) chainTouchPts.push(pt);
        }
        let chainNet = bridge.resolveSketchNet ? bridge.resolveSketchNet(chainTouchPts) : null;
        if (!chainNet) {
          for (const pt of chainTouchPts) {
            const n = bridge.findNetAt(pt.x, pt.y);
            if (n) { chainNet = n; break; }
          }
        }
        if (!chainNet) chainNet = 'SWB_' + (chainSeq++);

        // Stitch connected lines/arcs in this chain into continuous routed trace(s)
        const pool = [];
        for (const id of chainIds) {
          const gg = model.getGeo(id);
          const pts = toPts(gg);
          if (!pts || pts.length < 2) continue;
          if (gg.type === 'circle') emit(pts, chainNet);
          else pool.push(pts);
        }
        while (pool.length) {
          const poly = [...pool.shift()];
          let extended = true;
          while (extended) {
            extended = false;
            const tail = poly[poly.length - 1];
            const ti = pool.findIndex((p) => nearPt(p[0], tail) || nearPt(p[p.length - 1], tail));
            if (ti >= 0) {
              const seg = pool.splice(ti, 1)[0];
              const ordered = nearPt(seg[0], tail) ? seg : [...seg].reverse();
              poly.push(...ordered.slice(1));
              extended = true;
              continue;
            }
            const head = poly[0];
            const hi = pool.findIndex((p) => nearPt(p[p.length - 1], head) || nearPt(p[0], head));
            if (hi >= 0) {
              const seg = pool.splice(hi, 1)[0];
              const ordered = nearPt(seg[seg.length - 1], head) ? seg : [...seg].reverse();
              poly.unshift(...ordered.slice(0, -1));
              extended = true;
            }
          }
          emit(poly, chainNet);
        }
      }
      model.clear();
      vp.clearSelection(); vp.clearPreview(); vp.render();
      closePlugin();
      bridge.setTool('sel');
      (async () => { for (const pts of sawQ) await bridge.saw(pts); })();   // cưa lần lượt từng nét
    };
    document.getElementById('swb-dlg-ok').onclick = commit;
    cancelBtn.onclick = closeFinish;
  }

  function openPlugin() {
    buildUI();
    active = true;
    bridge?._ensureOverlay?.();
    bridge?._ensureLeftTabs?.();
    bridge?._setSwbTool?.('polyline');
    bridge?.getStage?.()?.classList.add('swb-active');
    bridge?.getStage?.()?.classList.toggle('swb-select', activeToolName === 'select');
    document.getElementById('swb-toolbar')?.classList.add('open');
  }

  function closePlugin() {
    active = false;
    vp?.clearPreview?.();
    vp?.render?.();
    bridge?.getStage?.()?.classList.remove('swb-active', 'swb-select');
    document.getElementById('swb-toolbar')?.classList.remove('open');
    bridge?._ensureLeftTabs?.();
  }

  global.SketchWBPlugin = {
    registerBridge(b) {
      const prev = bridge;
      bridge = b;
      if (prev && initialized) {
        for (const k of ['_ensureOverlay', '_ensureLeftTabs', '_setSwbTool', '_refreshSwbPreview', '_finishSwbActive', '_cancelSwbActive']) {
          if (prev[k]) bridge[k] = prev[k];
        }
        bridge._ensureOverlay?.();
      } else buildUI();
    },
    onPcbToolChange(t) {
      if (t === 'sk') openPlugin();
      else if (active) closePlugin();
    },
    onPcbRendered() { bridge?._ensureOverlay?.(); if (active && vp) vp.render(); },
    onPcbViewChange() { if (active && vp) vp.render(); },
    onListRendered() { bridge?._ensureLeftTabs?.(); },
  };
})(window);
