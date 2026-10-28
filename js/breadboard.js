/* Chế độ BREADBOARD cho tab Wiring.
   Board cắm vắt qua rãnh giữa, linh kiện cắm 1 hàng chân, dây jumper nối theo đúng dải nối ngầm của breadboard.
   Dữ liệu nối (chân linh kiện → chân board) vẫn là m.pins / B.bus của build.js; ở đây chỉ lo vị trí cắm và vẽ.
   Vị trí: B.bb.board = {bi,c,r}, m.bb = {bi,c,r}  (bi = breadboard thứ mấy, c = cột 0..62, r = chỉ số hàng trong ROWS). */
(function () {
  const X = window.BUILD_API, { B, M, A, el, COLOR } = X, P = 2.54, COLS = 63, BBW = 67 * P, BBH = 20 * P, BBS = BBH + .5;   // các tấm xếp dọc sát nhau, chỉ hở 1 vạch nhỏ
  const ROWS = [{ y: 1, rail: "T+" }, { y: 2, rail: "T-" },
    ..."abcde".split("").map((n, i) => ({ y: 4 + i, half: "T", n })), ..."fghij".split("").map((n, i) => ({ y: 11 + i, half: "B", n })),
    { y: 17, rail: "B+" }, { y: 18, rail: "B-" }];
  const TERM = ROWS.map((r, i) => r.half ? i : -1).filter(i => i >= 0);
  const hx = (bi, c) => (c + 2) * P, hy = (bi, ri) => bi * BBS + ROWS[ri].y * P, chan = bi => bi * BBS + 9.5 * P;
  const railHole = c => c >= 1 && c <= 61 && c % 6 !== 0;
  const hasHole = (bi, c, ri) => bi >= 0 && bi < B.bb.n && c >= 0 && c < COLS && ri >= 0 && ri < ROWS.length && (!ROWS[ri].rail || railHole(c));
  const netOf = (bi, c, ri) => ROWS[ri].rail ? `${bi}:${ROWS[ri].rail}` : `${bi}:${c}:${ROWS[ri].half}`;
  const rowAtY = y => ROWS.findIndex(r => Math.abs(r.y - y) < .01);
  const isPwr = r => r === "gnd" || /^pwr/.test(r);
  const board = () => A.state.b;
  const ok = () => ["ESP32", "RP2"].includes(board().family);
  // nhiều board: host 0 = board chính, host k = B.bb.extra[k-1]
  const HB = h => X.hostBoard(h), HS = () => X.hosts();
  const plOf = h => h ? (B.bb.extra[h - 1] || {}).bb : B.bb.board;
  const setPl = (h, q) => { if (h) B.bb.extra[h - 1].bb = q; else B.bb.board = q; };
  const isMcu = w => typeof w === "string" && w.startsWith("mcu");
  const mcuH = w => +w.slice(3) || 0;

  /* ---------- Board: xoay 90° để 2 hàng chân nằm ngang, vắt qua rãnh ---------- */
  function boardGeom(h = 0) {
    const b = HB(h), pads = [];
    for (const h of b.headers) if (h.side === "L" || h.side === "R") for (const p of h.pins) pads.push({ p, x: b.h - p.y, y: p.x });
    const ref = pads.reduce((a, q) => q.y < a.y - .1 || (Math.abs(q.y - a.y) < .1 && q.x < a.x) ? q : a);
    for (const q of pads) { q.dc = Math.round((q.x - ref.x) / P); q.dy = Math.round((q.y - ref.y) / P); }
    return { b, pads, ref };
  }
  function boardHoles(pl, G = boardGeom()) {
    const out = [];
    for (const q of G.pads) { const ri = rowAtY(ROWS[pl.r].y + q.dy); out.push({ bi: pl.bi, c: pl.c + q.dc, ri, name: q.p.name, q }); }
    return out;
  }
  function boardFoot(pl, G = boardGeom()) {
    const tx = hx(pl.bi, pl.c) - G.ref.x, c0 = Math.floor(tx / P - 2 + .3), c1 = Math.ceil((tx + G.b.h) / P - 2 - .3), f = [];
    for (let c = c0; c <= c1; c++) for (const h of ["T", "B"]) f.push(`${pl.bi}:${h}:${c}`);
    return f;
  }

  /* ---------- Linh kiện: 1 hàng chân, ảnh nằm phía ngoài (xa rãnh) ---------- */
  const ROT = { L: "T", T: "R", R: "B", B: "L" };
  function modGeom(d) {
    let w, h, pins;
    if (d.svg) {
      const [vx, vy, vw, vh] = d.vb.length === 4 ? d.vb : [0, 0, d.vb[0], d.vb[1]]; w = d.w; h = d.h;
      pins = d.pins.map((p, k) => ({ k, x: (p[3] - vx) / vw * w, y: (p[4] - vy) / vh * h, dir: p[5] || d.pinDir || "T" }));
    } else {
      w = Math.max(d.pins.length * P + 2, 12); h = 7;
      pins = d.pins.map((p, k) => ({ k, x: (w - (d.pins.length - 1) * P) / 2 + k * P, y: h, dir: "B" }));
    }
    // chỉ xoay 90° khi chân nằm cạnh trái/phải, không bao giờ lật ngược ảnh
    let dir = pins[0].dir, s = dir === "L" || dir === "R" ? 1 : 0; if (s) dir = ROT[dir];
    const r = s * 90, W = r % 180 ? h : w, H = r % 180 ? w : h;
    const rp = (x, y) => r === 90 ? [h - y, x] : r === 180 ? [w - x, h - y] : r === 270 ? [y, w - x] : [x, y];
    const tf = r === 90 ? `translate(${h} 0) rotate(90)` : r === 180 ? `translate(${w} ${h}) rotate(180)` : r === 270 ? `translate(0 ${w}) rotate(270)` : "";
    const rpins = pins.map(p => { const [x, y] = rp(p.x, p.y); return { k: p.k, x, y }; });
    [...rpins].sort((a, b) => a.x - b.x).forEach((p, i) => p.col = i);
    return { w, h, W, H, tf, pins: rpins, face: dir };
  }
  function modPlace(m, pl) {
    const d = M[m.type], half = ROWS[pl.r].half, g = modGeom(d), y = hy(pl.bi, pl.r);
    const holes = g.pins.map(p => ({ bi: pl.bi, c: pl.c + p.col, ri: pl.r, k: p.k }));
    const mx = holes.reduce((a, h) => a + hx(h.bi, h.c), 0) / holes.length, px = g.pins.reduce((a, p) => a + p.x, 0) / g.pins.length;
    const ox = mx - px, oy = g.face === "B" ? y - Math.max(...g.pins.map(p => p.y)) - 1.2 : y - Math.min(...g.pins.map(p => p.y)) + 1.2;
    const c0 = Math.floor(ox / P - 2 + .3), c1 = Math.ceil((ox + g.W) / P - 2 - .3), foot = [];
    for (let c = c0; c <= c1; c++) foot.push(`${pl.bi}:${half}:${c}`);
    return { g, holes, ox, oy, foot };
  }

  /* ---------- Kiểm tra vị trí cắm: không lệch lỗ, không chập dải với linh kiện khác ---------- */
  function occupancy(skip) {
    const nets = new Map(), foot = new Set();
    for (const k of HS()) { const pl = plOf(k), G = boardGeom(k); if (skip === "mcu" + k || !pl) continue; for (const h of boardHoles(pl, G)) if (h.ri >= 0) nets.set(netOf(h.bi, h.c, h.ri), "mcu" + k); boardFoot(pl, G).forEach(f => foot.add(f)); }
    B.mods.forEach((m, i) => { if (i === skip || !m.bb) return; const P2 = modPlace(m, m.bb); for (const h of P2.holes) nets.set(netOf(h.bi, h.c, h.ri), i); P2.foot.forEach(f => foot.add(f)); });
    return { nets, foot };
  }
  function valid(holes, foot, occ) {
    const mine = new Set();
    for (const h of holes) {
      if (h.ri < 0 || !hasHole(h.bi, h.c, h.ri) || ROWS[h.ri].rail) return false;
      const n = netOf(h.bi, h.c, h.ri); if (mine.has(n) || occ.nets.has(n)) return false; mine.add(n);
    }
    return !foot.some(f => occ.foot.has(f));
  }
  const tryBoard = (pl, occ, h = 0) => { const G = boardGeom(h); return valid(boardHoles(pl, G), boardFoot(pl, G), occ); };
  const tryMod = (m, pl, occ) => { const q = modPlace(m, pl); return valid(q.holes, q.foot, occ); };
  // vị trí hợp lệ gần nhất quanh (bi,c,r) – dùng khi người dùng thả sai chân
  function nearest(test, pl) {
    let best = null, bd = 1e9;
    for (let bi = 0; bi < B.bb.n; bi++) for (const r of TERM) for (let c = 0; c < COLS; c++) {
      const d = Math.hypot(hx(bi, c) - hx(pl.bi, pl.c), (hy(bi, r) - hy(pl.bi, pl.r)) * 1.4); if (d >= bd) continue;
      const q = { bi, c, r }; if (test(q)) { bd = d; best = q; }
    }
    return best;
  }
  function autoPlace() {
    for (const k of HS()) { const pl = plOf(k), occ = occupancy("mcu" + k); if (!pl || pl.bi >= B.bb.n || !tryBoard(pl, occ, k)) setPl(k, nearest(q => tryBoard(q, occ, k), { bi: Math.min(k, B.bb.n - 1), c: k ? 34 : 1, r: TERM[0] })); }
    B.mods.forEach((m, i) => {
      if (m.bb && m.bb.bi < B.bb.n && tryMod(m, m.bb, occupancy(i))) return;
      const occ = occupancy(i); let best = null;
      for (let bi = 0; bi < B.bb.n && !best; bi++) for (const r of modGeom(M[m.type]).face === "B" ? [TERM[0], TERM[9]] : [TERM[9], TERM[0]]) for (let c = 0; c < COLS; c++) { const q = { bi, c, r }; if (tryMod(m, q, occ)) { if (!best || c < best.c) best = q; break; } }
      m.bb = best || nearest(q => tryMod(m, q, occ), { bi: 0, c: 30, r: TERM[0] });
      if (!m.bb && B.bb.n < 3) { B.bb.n++; B.cam = null; return autoPlace(); }   // hết chỗ: tự thêm 1 tấm breadboard
      if (m.bb && m.fresh) { X.autoAssign(m); delete m.fresh; }
    });
  }

  /* ---------- Dây jumper: dải chân → dải chân qua làn trong rãnh giữa, nguồn/GND đi thẳng ra thanh nguồn ---------- */
  function jumpers(ghostMi) {
    const out = [], used = new Set(), occ = occupancy(), key = (bi, c, ri) => `${bi}:${c}:${ri}`;
    const mark = (bi, c, ri) => used.add(key(bi, c, ri));
    const BH = HS().map(k => plOf(k) ? boardHoles(plOf(k), boardGeom(k)) : []);
    BH.forEach(L => L.forEach(h => h.ri >= 0 && mark(h.bi, h.c, h.ri)));
    B.mods.forEach(m => m.bb && modPlace(m, m.bb).holes.forEach(h => mark(h.bi, h.c, h.ri)));
    const free = (bi, c, ri, prefer, force) => {
      if (force != null && ROWS[force] && ROWS[force].half === ROWS[ri].half && !used.has(key(bi, c, force))) { mark(bi, c, force); return { x: hx(bi, c), y: hy(bi, force), bi, ri: force }; }     // lỗ trống trong cùng dải; prefer = "chan" (gần rãnh) | "T" | "B" (gần thanh nguồn)
      const half = ROWS[ri].half, rows = TERM.filter(r => ROWS[r].half === half);
      rows.sort((a, b) => prefer === "chan" ? (half === "T" ? b - a : a - b) : prefer === "T" ? a - b : b - a);
      for (const r of rows) if (!used.has(key(bi, c, r))) { mark(bi, c, r); return { x: hx(bi, c), y: hy(bi, r), bi, ri: r }; }
      return { x: hx(bi, c), y: hy(bi, ri), bi, ri };
    };
    // mỗi thanh + chọn điện áp theo linh kiện cắm ở nửa đó, để dây nguồn không băng qua cả mạch
    const need = { T: new Set(), B: new Set() };
    B.mods.forEach(m => m.bb && M[m.type].pins.forEach(([l, r]) => { if (/^pwr/.test(r) && X.getPin(m, l)) need[ROWS[m.bb.r].half].add(r === "pwr.5v" ? "5V" : "3V3"); }));
    const railV = {}; for (const h of ["T", "B"]) railV[h + "+"] = need[h].size === 1 ? [...need[h]][0] : need[h].size === 2 ? (h === "T" ? "3V3" : "5V") : "3V3";
    const railFor = (role, half) => { if (role === "gnd") return half + "-"; const v = role === "pwr.5v" ? "5V" : "3V3"; return railV[half + "+"] === v ? half + "+" : (half === "T" ? "B+" : "T+"); };
    const railRow = rl => ROWS.findIndex(r => r.rail === rl);
    const ov = (m, l) => (m && m.bbw && m.bbw[l]) || {};
    const toRail = (bi, c, ri, rl, color, tag) => {
      const o = ov(B.mods[tag.mi], tag.label), rr = railRow(rl), a = free(bi, c, ri, rl[0], o.ra); let rc = c; for (let k = 0; !railHole(rc) && k < 3; k++) rc = c + (k % 2 ? -1 : 1) * Math.ceil((k + 1) / 2);
      if (o.rc != null && o.rr === rl && railHole(o.rc) && !used.has(key(bi, o.rc, rr))) rc = o.rc; mark(bi, rc, rr);
      const r = { x: hx(bi, rc), y: hy(bi, rr) }, my = (a.y + r.y) / 2;
      out.push({ pts: a.x === r.x ? [[a.x, a.y], [r.x, r.y]] : [[a.x, a.y], [a.x, my], [r.x, my], [r.x, r.y]], color, ...tag, power: true, ea: { bi, c, ri: a.ri, key: "ra" }, eb: { bi, c: rc, ri: rr, key: "rc", rail: rl } });
    };
    const rails = new Set(), sig = [], bh = BH[0] || [], byName = (n, k) => (BH[k] || []).find(h => h.name === n && h.ri >= 0);
    B.mods.forEach((m, mi) => {
      if (!m.bb) return;
      const d = M[m.type], pl = modPlace(m, m.bb), half = ROWS[m.bb.r].half;
      for (const h of pl.holes) {
        const [label, role] = d.pins[h.k], n = X.getPin(m, label), color = COLOR[role] || d.color, tag = { mi, label, ghost: mi === ghostMi };
        if (!n) continue;
        if (isPwr(role)) { const rl = railFor(role, half); rails.add(rl); toRail(h.bi, h.c, h.ri, rl, color, tag); continue; }
        const t = byName(n, X.hostOf(m)); if (!t) continue;
        const o = ov(m, label);
        sig.push({ a: free(h.bi, h.c, h.ri, "chan", o.ra), b: free(t.bi, t.c, t.ri, "chan", o.rb), ac: h.c, bc: t.c, color, ...tag, fix: o.ly });
      }
    });
    // board cấp nguồn cho thanh nguồn đang dùng; nhiều breadboard thì bắc cầu thanh nguồn sang tấm kế bên
    const VRE = { "3V3": /^(3V3|3.3V)$/, "5V": /^(5V|VBUS)$/ }, feed = { "T+": VRE[railV["T+"]], "B+": VRE[railV["B+"]], "T-": /^GND$/, "B-": /^GND$/ };
    // board phụ: nối GND chung xuống thanh − gần nhất (nguồn riêng qua USB của nó)
    for (const k of HS().slice(1)) { const g = (BH[k] || []).find(h => h.ri >= 0 && /^GND$/.test(h.name)); if (!g) continue; const rl = ROWS[g.ri].half + "-"; rails.add(rl); toRail(g.bi, g.c, g.ri, rl, COLOR.gnd, { feed: true }); }
    for (const rl of rails) {
      const cand = bh.filter(h => h.ri >= 0 && feed[rl].test(h.name)), h = cand.find(x => ROWS[x.ri].half === rl[0]) || cand[0]; if (!h) continue;
      toRail(h.bi, h.c, h.ri, rl, rl[1] === "-" ? COLOR.gnd : railV[rl] === "5V" ? COLOR["pwr.5v"] : COLOR["pwr.3v3"], { feed: true });
      const xl = -1.6 - ["T+", "T-", "B+", "B-"].indexOf(rl) * .9;   // bắc cầu thanh nguồn sang tấm dưới, đi vòng mép trái
      for (let bi = 0; bi < B.bb.n - 1; bi++) { const y1 = hy(bi, railRow(rl)), y2 = hy(bi + 1, railRow(rl)); out.push({ pts: [[hx(bi, 1), y1], [xl, y1], [xl, y2], [hx(bi, 1), y2]], color: rl[1] === "-" ? COLOR.gnd : railV[rl] === "5V" ? COLOR["pwr.5v"] : COLOR["pwr.3v3"], feed: true }); }
    }
    // làn ngang trong rãnh: chia làn kiểu tô màu khoảng, dây không chồng nhau
    sig.sort((u, v) => Math.min(u.a.x, u.b.x) - Math.min(v.a.x, v.b.x));
    const lanes = [];
    for (const s of sig) { const x0 = Math.min(s.a.x, s.b.x), x1 = Math.max(s.a.x, s.b.x); let i = lanes.findIndex(e => e < x0 - .8); if (i < 0) { i = lanes.length; lanes.push(0); } lanes[i] = x1; s.lane = i; }
    const gap = Math.min(.62, 5.2 / Math.max(1, lanes.length)) * 1.4 * Math.pow((B.spread || 1.1) / 1.1, 1.6);   // dãn dây mạnh: tối đa ~6 lần
    for (const s of sig) {
      const ly = s.fix != null ? s.fix : chan(s.a.bi) + (s.lane - (lanes.length - 1) / 2) * gap;
      out.push({ pts: Math.abs(s.a.x - s.b.x) < .01 ? [[s.a.x, s.a.y], [s.b.x, s.b.y]] : [[s.a.x, s.a.y], [s.a.x, ly], [s.b.x, ly], [s.b.x, s.b.y]], color: s.color, mi: s.mi, label: s.label, ghost: s.ghost, ly, ea: { bi: s.a.bi, c: s.ac, ri: s.a.ri, key: "ra" }, eb: { bi: s.b.bi, c: s.bc, ri: s.b.ri, key: "rb" } });
    }
    lastUsed = used;
    return out;
  }
  // kiểu dây theo nút Đi dây: 0/1 vuông góc bo góc, 2 cong mềm, 3 vát 45°
  function path(pts) {
    const st = B.style || 0;
    if (st === 2 && pts.length > 2) { const a = pts[0], z = pts[pts.length - 1], m1 = pts[1], m2 = pts[pts.length - 2]; return `M${a[0]} ${a[1]} C${m1[0]} ${m1[1]} ${m2[0]} ${m2[1]} ${z[0]} ${z[1]}`; }
    if (st === 3) return pathR(pts, 1.6, true);
    return pathR(pts, st === 1 ? 1.6 : 1);
  }
  function pathR(pts, r = 1, chamfer) {   // vuông góc, bo nhẹ (hoặc vát) ở góc cua
    let d = `M${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], [x2, y2] = pts[i + 1], l1 = Math.hypot(x1 - x0, y1 - y0) || 1, l2 = Math.hypot(x2 - x1, y2 - y1) || 1;
      const k1 = Math.min(r, l1 / 2) / l1, k2 = Math.min(r, l2 / 2) / l2;
      d += ` L${x1 - (x1 - x0) * k1} ${y1 - (y1 - y0) * k1} ${chamfer ? "L" : `Q${x1} ${y1}`} ${x1 + (x2 - x1) * k2} ${y1 + (y2 - y1) * k2}`;
    }
    const z = pts[pts.length - 1]; return d + ` L${z[0]} ${z[1]}`;
  }

  /* ---------- Vẽ ---------- */
  let drag = null, hlNet = null, lastUsed = new Set();
  function drawBB(parent, bi) {
    const g = el("g", { class: "bbd" }, parent), x0 = 0, y0 = bi * BBS;
    el("rect", { x: x0 + .4, y: y0, width: BBW - .8, height: BBH, rx: 1.6, class: "bb-body" + (B.bb.sel === bi && B.bb.n > 1 ? " sel" : ""), "data-bb": bi }, g).addEventListener("pointerdown", () => { B.bb.sel = bi; B.selX = { t: "bb", i: bi }; B.selM = B.selW = null; draw(); });
    // tay nắm bên phải: kéo lên/xuống để đổi chỗ tấm breadboard
    if (B.bb.n > 1) {
      const gr = el("g", { class: "bb-grip" }, g); el("rect", { x: BBW + .6, y: y0 + 1, width: 3, height: BBH - 2, rx: 1 }, gr);
      for (let k = 0; k < 6; k++) el("circle", { cx: BBW + 2.1, cy: y0 + BBH / 2 + (k - 2.5) * 1.6, r: .35 }, gr);
      el("title", {}, gr, "Kéo để đổi chỗ breadboard");
      gr.addEventListener("pointerdown", e => { if (e.button !== 2) dragBB(e, bi, g); });
    }
    el("rect", { x: x0 + 1.5, y: y0 + (8.5 + .9) * P, width: BBW - 3, height: .2 * P, class: "bb-chan" }, g);
    for (const [y, cl] of [[.45, "p"], [2.55, "n"], [16.45, "p"], [18.55, "n"]]) el("line", { x1: x0 + 3 * P, x2: x0 + 64 * P, y1: y0 + y * P, y2: y0 + y * P, class: "bb-rail " + cl }, g);
    for (const [t, y] of [["+", 1], ["−", 2], ["+", 17], ["−", 18]]) el("text", { x: x0 + 1.1 * P, y: y0 + y * P, class: "bb-lab", "dominant-baseline": "central" }, g, t);
    ROWS.forEach((r, ri) => { if (r.n) { el("text", { x: x0 + 1.2 * P, y: hy(bi, ri), class: "bb-lab", "dominant-baseline": "central" }, g, r.n); el("text", { x: x0 + 65.8 * P, y: hy(bi, ri), class: "bb-lab", "dominant-baseline": "central" }, g, r.n); } });
    for (let c = 0; c < COLS; c++) {
      if (c % 5 === 0 || c === 0) for (const y of [3.2, 15.8]) el("text", { x: hx(bi, c), y: y0 + y * P, class: "bb-lab", "text-anchor": "middle", "dominant-baseline": "central" }, g, c + 1);
      ROWS.forEach((r, ri) => { if (hasHole(bi, c, ri)) el("rect", { x: hx(bi, c) - .45, y: hy(bi, ri) - .45, width: .9, height: .9, rx: .15, class: "bb-hole" }, g); });
    }
  }
  function uniqIds(g, sfx) {
    const ids = [...g.querySelectorAll("[id]")].map(n => { const o = n.id; n.id = o + sfx; return o; });
    g.querySelectorAll("*").forEach(x => { for (const at of [...x.attributes]) for (const o of ids) {
      if (at.value.includes("#" + o + ")")) x.setAttribute(at.name, at.value.split("#" + o + ")").join("#" + o + sfx + ")"));
      else if (at.value === "#" + o) x.setAttribute(at.name, "#" + o + sfx);
    } });
  }
  function draw() {
    const s = X.svg(); s.innerHTML = "";
    autoPlace();
    const root = el("g", {}, s);
    for (let bi = 0; bi < B.bb.n; bi++) drawBB(root, bi);
    el("g", { id: "bbhl" }, root);
    // board
    for (const k of HS()) {
      const pl = plOf(k); if (!pl) continue;
      const G = boardGeom(k), tx = hx(pl.bi, pl.c) - G.ref.x, ty = hy(pl.bi, pl.r) - G.ref.y, multi = HS().length > 1;
      const bg = el("g", { class: "bbmcu" + (drag && drag.mcu === k + 1 ? " dragging" : "") + (multi && (B.bb.cur || 0) === k ? " cur" : ""), "data-h": k, transform: `translate(${tx} ${ty}) translate(${G.b.h} 0) rotate(90)`, opacity: B.bb.op ?? .5 }, root);
      const keep = A.state.b; A.state.b = G.b; try { A.drawPCB(bg, true); } finally { A.state.b = keep; } bg.removeAttribute("viewBox");
      if (k) uniqIds(bg, "_h" + k);   // id riêng cho board phụ (gradient/clip không đè nhau)
      if (multi) el("text", { x: tx + G.b.h / 2, y: ty - 1.2, "text-anchor": "middle", "font-size": 1.6, class: "bb-bname" + ((B.bb.cur || 0) === k ? " cur" : "") }, root, (k ? "U" + (k + 1) + " · " : "U1 · ") + G.b.name);
      bg.addEventListener("pointerdown", e => { if (e.button !== 2) { B.bb.cur = k; B.selX = { t: "board", k }; B.selM = B.selW = null; startDrag(e, "mcu" + k); } });
    }
    // dây
    const wg = el("g", { id: "wires", opacity: Math.max(.25, B.bb.op ?? .5) }, root), endsG = [];
    for (const j of jumpers(drag && drag.ghostMi)) {
      const d = path(j.pts), tag = j.mi != null && !j.ghost ? { "data-wm": j.mi, "data-wl": j.label } : {}, sel = B.selW && B.selW.m === j.mi && B.selW.label === j.label;
      el("path", { d, class: "bb-jo" + (j.ghost ? " ghost" : "") }, wg);
      el("path", { d, stroke: j.color, class: "bb-j" + (j.ghost ? " ghost" : "") + (sel ? " sel" : ""), ...tag }, wg);
      if (!j.ghost) [[j.pts[0], j.ea], [j.pts[j.pts.length - 1], j.eb]].forEach(([[x, y], e]) => {
        if (e && j.mi != null) endsG.push([x, y, j, e]); else el("circle", { cx: x, cy: y, r: .5, fill: j.color, class: "bb-end" }, wg);
      });
      if (j.ly != null && !j.ghost) { const mx = (j.pts[1][0] + j.pts[2][0]) / 2; el("text", { x: mx, y: j.ly - .35, "text-anchor": "middle", "font-size": .9, class: "wlabel", ...tag }, wg, j.label); }
      if (tag["data-wm"] != null) el("path", { d, class: "whit", ...tag }, wg).addEventListener("pointerdown", e => { if (e.button !== 2) dragBody(e, j); });
    }
    // linh kiện
    const mods = el("g", {}, root);
    B.mods.forEach((m, mi) => {
      if (!m.bb) return;
      const d = M[m.type], q = modPlace(m, m.bb), g = el("g", { class: "bnode bbmod" + (drag && drag.mi === mi ? " dragging" : ""), "data-m": mi }, mods);
      const ig = el("g", { transform: `translate(${q.ox} ${q.oy}) ${q.g.tf}`, opacity: B.bb.op ?? .5 }, g);
      if (d.svg) el("image", { href: d.svgData || d.svg, x: 0, y: 0, width: q.g.w, height: q.g.h, preserveAspectRatio: "none" }, ig);
      else { el("rect", { x: 0, y: 0, width: q.g.w, height: q.g.h, rx: .8, fill: d.color, class: "bb-box" }, ig); el("text", { x: q.g.w / 2, y: q.g.h / 2 - .6, "text-anchor": "middle", "dominant-baseline": "central", "font-size": 1.6, class: "modt" }, ig, d.short); }
      q.g.pins.forEach(p => { const h = q.holes.find(x => x.k === p.k); el("path", { d: `M${q.ox + p.x} ${q.oy + p.y} L${hx(h.bi, h.c)} ${hy(h.bi, h.ri)}`, class: "bb-leg" }, g); el("circle", { cx: hx(h.bi, h.c), cy: hy(h.bi, h.ri), r: .55, class: "bb-pin" }, g); });
      if (B.selM === mi) el("rect", { x: Math.min(q.ox, ...q.holes.map(h => hx(h.bi, h.c))) - 1, y: Math.min(q.oy, hy(m.bb.bi, m.bb.r)) - 1, width: Math.max(q.g.W, (q.holes.length - 1) * P) + 2, height: q.g.H + 3.4, rx: 1, class: "bsel" }, g);
      g.addEventListener("pointerdown", e => { if (e.button !== 2) startDrag(e, mi); });
    });
    // đầu dây kéo được: vẽ trên cùng (không bị ảnh linh kiện che), vùng bấm rộng
    const eg = el("g", { class: "bb-ends" }, root);
    for (const [x, y, j, e] of endsG) { const c = el("circle", { cx: x, cy: y, r: .62, fill: j.color, class: "bb-end grab" }, eg); const hit = el("circle", { cx: x, cy: y, r: 1.3, class: "bb-endhit" }, eg); el("title", {}, hit, `Kéo để đổi lỗ · ${j.label}`); for (const n of [c, hit]) n.addEventListener("pointerdown", ev => { if (ev.button !== 2) dragEnd(ev, j, e); }); }
    // khung nhìn
    let x0 = -6, y0 = -4, x1 = BBW + 5, y1 = (B.bb.n - 1) * BBS + BBH + 4;
    B.mods.forEach(m => { if (!m.bb) return; const q = modPlace(m, m.bb); x0 = Math.min(x0, q.ox - 3); y0 = Math.min(y0, q.oy - 3); x1 = Math.max(x1, q.ox + q.g.W + 3); y1 = Math.max(y1, q.oy + q.g.H + 3); });
    for (const k of HS()) { const pl = plOf(k); if (!pl) continue; const G = boardGeom(k), ty = hy(pl.bi, pl.r) - G.ref.y; y0 = Math.min(y0, ty - 4); y1 = Math.max(y1, ty + G.b.w + 3); }
    if (!B.cam) B.cam = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    s.setAttribute("viewBox", `${B.cam.x} ${B.cam.y} ${B.cam.w} ${B.cam.h}`);
    hlNet = null;
  }

  /* ---------- Rê chuột: sáng dải nối ngầm dưới con trỏ ---------- */
  function holeAt(pt) {
    const bi = Math.round((pt.y - BBH / 2) / BBS), c = Math.round(pt.x / P - 2); let ri = -1, bd = .9 * P;
    ROWS.forEach((r, i) => { const d = Math.abs(hy(bi, i) - pt.y); if (d < bd) { bd = d; ri = i; } });
    return ri >= 0 && hasHole(bi, c, ri) && Math.abs(hx(bi, c) - pt.x) < .9 * P ? { bi, c, ri } : null;
  }
  function hover(pt) {
    const g = document.getElementById("bbhl"); if (!g) return;
    const h = holeAt(pt), n = h && netOf(h.bi, h.c, h.ri);
    if (n === hlNet) return; hlNet = n; g.innerHTML = ""; if (!h) return;
    const col = `hsl(${Math.random() * 360 | 0} 85% 60%)`, op = (.18 + Math.random() * .14).toFixed(2), r = ROWS[h.ri];
    if (r.rail) el("rect", { x: hx(h.bi, 1) - .9, y: hy(h.bi, h.ri) - .9, width: hx(h.bi, 61) - hx(h.bi, 1) + 1.8, height: 1.8, rx: .9, fill: col, "fill-opacity": op, stroke: col, "stroke-opacity": .7, "stroke-width": .25, class: "bb-hl" }, g);
    else { const rows = TERM.filter(i => ROWS[i].half === r.half); el("rect", { x: hx(h.bi, h.c) - .9, y: hy(h.bi, rows[0]) - .9, width: 1.8, height: hy(h.bi, rows[4]) - hy(h.bi, rows[0]) + 1.8, rx: .9, fill: col, "fill-opacity": op, stroke: col, "stroke-opacity": .7, "stroke-width": .25, class: "bb-hl" }, g); }
  }

  /* ---------- Kéo board / linh kiện: bám lỗ, sai thì tự nhảy sang chỗ hợp lệ gần nhất, thả ra hỏi nối dây ---------- */
  function startDrag(e, who) {
    e.stopPropagation(); e.preventDefault(); X.closeMenu && X.closeMenu();
    const s = X.svg(), isM = !isMcu(who), mh = isM ? 0 : mcuH(who), m = isM && B.mods[who], pl0 = { ...(isM ? m.bb : plOf(mh)) }, p0 = X.toSvg(e);
    const ax = hx(pl0.bi, pl0.c), ay = hy(pl0.bi, pl0.r), occ = occupancy(isM ? who : who);
    const test = q => isM ? tryMod(m, q, occ) : tryBoard(q, occ, mh);
    let snap = null, moved = false, saved = null;
    if (isM) { B.selM = who; B.selW = null; B.selX = null; saved = { pins: { ...m.pins }, bus: { ...B.bus } }; }
    drag = { mcu: isM ? 0 : mh + 1, mi: isM ? who : null, ghostMi: isM ? who : null };
    const mv = ev => {
      const pt = X.toSvg(ev), tx = ax + pt.x - p0.x, ty = ay + pt.y - p0.y; if (Math.hypot(pt.x - p0.x, pt.y - p0.y) > .6) moved = true; if (!moved) return;
      const bi = Math.max(0, Math.min(B.bb.n - 1, Math.round((ty - BBH / 2) / BBS))), c = Math.round(tx / P - 2);
      let r = TERM[0], bd = 1e9; for (const i of TERM) { const d = Math.abs(hy(bi, i) - ty); if (d < bd) { bd = d; r = i; } }
      const want = { bi, c: Math.max(0, Math.min(COLS - 1, c)), r }, q = test(want) ? want : nearest(test, want);
      if (!q || (snap && q.bi === snap.bi && q.c === snap.c && q.r === snap.r)) return;
      snap = q;
      if (isM) { m.bb = q; m.pins = { ...saved.pins }; B.bus = { ...saved.bus }; X.autoAssign(m); } else setPl(mh, q);   // nét mờ: dây dự tính
      draw();
    };
    const up = ev => {
      s.removeEventListener("pointermove", mv); s.removeEventListener("pointerup", up);
      drag = null;
      if (isM) { m.pins = saved.pins; B.bus = saved.bus; }
      if (!moved || !snap) { X.save(); return draw(); }
      X.save(); draw();
      if (isM) ask(ev, m, who);
    };
    s.addEventListener("pointermove", mv); s.addEventListener("pointerup", up);
  }
  /* ---------- Nắm kéo dây: thân dây chạy làn tuỳ ý, đầu dây trượt sang lỗ khác trong CÙNG dải (vẫn đúng mạch) ---------- */
  function dragBody(e, j) {
    e.stopPropagation(); e.preventDefault(); X.selectWire(j.mi, j.label, true);
    if (j.ly == null) return draw();
    const s = X.svg(), m = B.mods[j.mi];
    const mv = ev => { const y = Math.round(X.toSvg(ev).y * 4) / 4; m.bbw = m.bbw || {}; m.bbw[j.label] = { ...(m.bbw[j.label] || {}), ly: y }; draw(); };
    const up = () => { s.removeEventListener("pointermove", mv); s.removeEventListener("pointerup", up); X.save(); };
    s.addEventListener("pointermove", mv); s.addEventListener("pointerup", up); draw();
  }
  // lỗ hợp lệ cho đầu dây: lỗ trống trong CÙNG dải (đầu chân) hoặc bất kỳ lỗ trống trên CÙNG thanh nguồn (đầu nguồn)
  function endTargets(end) {
    const out = [], k = (c, r) => `${end.bi}:${c}:${r}`, mine = k(end.c, end.ri);
    if (end.rail) { for (let c = 0; c < COLS; c++) if (railHole(c) && (!lastUsed.has(k(c, end.ri)) || k(c, end.ri) === mine)) out.push({ c, r: end.ri }); }
    else for (const r of TERM) if (ROWS[r].half === ROWS[end.ri].half && (!lastUsed.has(k(end.c, r)) || k(end.c, r) === mine)) out.push({ c: end.c, r });
    return out;
  }
  function glowTargets(end, T) {
    const g = document.getElementById("bbhl"); if (!g) return; g.innerHTML = "";
    for (const t of T) el("circle", { cx: hx(end.bi, t.c), cy: hy(end.bi, t.r), r: 1.05, class: "glow ok" }, g);
  }
  function dragEnd(e, j, end) {
    e.stopPropagation(); e.preventDefault(); X.selectWire(j.mi, j.label, true);
    const s = X.svg(), m = B.mods[j.mi], T = endTargets(end), o0 = { ...((m.bbw || {})[j.label] || {}) };
    let okDrop = true;
    draw(); glowTargets(end, T);
    const mv = ev => {
      const pt = X.toSvg(ev); let best = null, bd = 1.4 * P;
      for (const t of T) { const d = Math.hypot(hx(end.bi, t.c) - pt.x, hy(end.bi, t.r) - pt.y); if (d < bd) { bd = d; best = t; } }
      okDrop = !!best; if (!best) return;
      const o = (m.bbw = m.bbw || {})[j.label] = { ...(m.bbw[j.label] || {}) };
      if (end.rail) { if (o.rc === best.c && o.rr === end.rail) return; o.rc = best.c; o.rr = end.rail; } else { if (o[end.key] === best.r) return; o[end.key] = best.r; }
      draw(); glowTargets(end, T);
    };
    const up = () => {
      s.removeEventListener("pointermove", mv); s.removeEventListener("pointerup", up);
      if (!okDrop) { (m.bbw = m.bbw || {})[j.label] = o0; A.toast(end.rail ? "Đầu nguồn phải cắm trên cùng thanh nguồn." : "Lỗ này không cùng dải nối – giữ chỗ cũ."); }
      X.save(); draw();
    };
    s.addEventListener("pointermove", mv); s.addEventListener("pointerup", up);
  }
  // kéo tấm breadboard lên/xuống: thả ra thì đổi thứ tự, board + linh kiện đi theo tấm, dây tự đi lại
  function dragBB(e, bi, g) {
    e.stopPropagation(); e.preventDefault();
    const s = X.svg(), y0 = X.toSvg(e).y; let to = bi;
    const items = [...s.querySelectorAll(".bbmcu, .bbmod")].filter(n => n.classList.contains("bbmcu") ? (plOf(+n.dataset.h) || {}).bi === bi : B.mods[+n.dataset.m] && B.mods[+n.dataset.m].bb && B.mods[+n.dataset.m].bb.bi === bi);
    const mv = ev => {
      const dy = X.toSvg(ev).y - y0; g.setAttribute("transform", `translate(0 ${dy})`); g.classList.add("dragging");
      items.forEach(n => n.style.transform = `translate(0px, ${dy}px)`);
      to = Math.max(0, Math.min(B.bb.n - 1, Math.round(bi + dy / BBS)));
    };
    const up = () => {
      s.removeEventListener("pointermove", mv); s.removeEventListener("pointerup", up);
      if (to !== bi) {
        const order = [...Array(B.bb.n).keys()]; order.splice(bi, 1); order.splice(to, 0, bi);
        const map = {}; order.forEach((old, i) => map[old] = i);
        for (const k of HS()) { const pl = plOf(k); if (pl) pl.bi = map[pl.bi]; }
        B.mods.forEach(m => { if (m.bb) m.bb.bi = map[m.bb.bi]; });
        B.bb.sel = to; X.save();
      }
      draw();
    };
    s.addEventListener("pointermove", mv); s.addEventListener("pointerup", up);
  }
  function ask(ev, m, mi) {
    document.querySelectorAll(".bbask").forEach(x => x.remove());
    const st = X.svg().parentElement, r = st.getBoundingClientRect(), box = document.createElement("div");
    box.className = "bmenu bbask"; box.innerHTML = `<div class="bbask-t">Nối dây ${X.esc(M[m.type].short)}?</div><div class="bbask-b"><button type="button" data-a="ok">✓ OK</button><button type="button" data-a="no">✕ Không</button></div>`;
    st.appendChild(box);
    box.style.left = Math.max(8, Math.min(ev.clientX - r.left + 10, r.width - box.offsetWidth - 8)) + "px"; box.style.top = Math.max(8, Math.min(ev.clientY - r.top + 10, r.height - box.offsetHeight - 8)) + "px";
    box.querySelector("[data-a=ok]").onclick = () => { box.remove(); X.autoAssign(m); X.save(); X.refresh(); };
    box.querySelector("[data-a=no]").onclick = () => { box.remove(); X.unwireMod(mi, true); X.save(); X.refresh(); };
    box.querySelector("button").focus();
  }

  // xoá tấm đang chọn: linh kiện trên tấm đó cắm lại chỗ trống, tấm bên dưới dồn lên
  function removeBB() {
    if (B.bb.n <= 1) return A.toast("Cần giữ ít nhất 1 breadboard.");
    const i = Math.min(B.bb.sel || 0, B.bb.n - 1), fix = pl => pl && (pl.bi === i ? null : pl.bi > i ? { ...pl, bi: pl.bi - 1 } : pl);
    for (const k of HS()) setPl(k, fix(plOf(k))); B.mods.forEach(m => { m.bb = fix(m.bb); if (!m.bb) delete m.bb; });
    B.bb.n--; B.bb.sel = Math.min(i, B.bb.n - 1); B.cam = null;
  }
  const bbAt = pt => Math.max(0, Math.min(B.bb.n - 1, Math.round((pt.y - BBH / 2) / BBS)));
  window.BBOARD = { ok, draw, removeBB, bbAt, resetAll() { B.bb.n = 1; B.bb.sel = 0; B.bb.board = null; B.bb.extra = []; B.bb.cur = 0; B.mods.forEach(m => { delete m.bb; delete m.bbw; }); B.cam = null; }, hover: pt => !drag && hover(pt), reset() { B.bb.board = null; B.mods.forEach(m => delete m.bb); } };
})();
