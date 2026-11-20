/* Bộ giải Dim cho PCB (theo cách của SolidCraft: sai số tính bằng mm, Levenberg–Marquardt giảm chấn theo QUÃNG ĐƯỜNG DỜI có trọng số,
   nên thứ gì ràng buộc để tự do thì dời ít nhất; vật "rẻ" chạy trước, vật "nặng" gần như đứng yên).
   Thuần JS, không đụng DOM: chạy được trong trình duyệt lẫn Node (thử bằng script).

   Biến: mỗi biến là một phép tịnh tiến (dx, dy) của một vật, có trọng số w:
     đỉnh đường đồng w≈0.01 (rẻ) · lỗ khoan ≈0.3 · linh kiện 1 (khối cứng: mọi chân, viền thân đi cùng) · vật đang kéo 100 (ràng buộc vẫn thắng: vật kéo chỉ chạy theo bậc tự do còn lại).
     Bo PCB không có biến (khoá).
   Điểm tham chiếu: { v: chỉ số biến hoặc -1 (cố định), x, y } → vị trí = (x, y) + tịnh tiến của biến v.
   Ràng buộc (Dim):
     kind "a" khoảng cách thẳng · "h" khoảng ngang · "v" khoảng dọc (giữ dấu s lúc đặt) · "pe" điểm a tới cạnh b=[p, q] (khoảng vuông góc, giữ dấu s)
     driven:true = Dim tham chiếu (chỉ đo, không ràng buộc).                                                                                     */
(function (G) {
  "use strict";
  const TOL = 1e-5, MAXIT = 120;

  const pt = (r, u) => r.v >= 0 && u && u.length ? [r.x + (u[2 * r.v] || 0), r.y + (u[2 * r.v + 1] || 0)] : [r.x, r.y];

  // giá trị đo hiện tại của một Dim (đã có dấu cho h / v / pe)
  function measure(d, u) {
    const a = pt(d.a, u);
    if (d.kind === "pe") {
      const p = pt(d.b[0], u), q = pt(d.b[1], u), ex = q[0] - p[0], ey = q[1] - p[1], L = Math.hypot(ex, ey) || 1e-9;
      return (ex * (a[1] - p[1]) - ey * (a[0] - p[0])) / L;
    }
    const b = pt(d.b, u);
    if (d.kind === "dir") return (b[0] - a[0]) * d.uy - (b[1] - a[1]) * d.ux;   // giữ hướng đoạn (ràng buộc ngầm): 0 khi song song hướng gốc
    if (d.kind === "h") return b[0] - a[0];
    if (d.kind === "v") return b[1] - a[1];
    return Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  // sai số (mm): 0 khi thoả
  function residual(d, u) {
    const m = measure(d, u);
    if (d.kind === "a") return m - d.val;
    if (d.kind === "dir") return m;
    return (d.s || 1) * m - d.val;
  }
  // dấu để lưu khi đặt Dim h / v / pe (giữ nguyên phía)
  function signOf(d, u) { const m = measure(d, u || []); return m < 0 ? -1 : 1; }

  function resid(dims, u) { return dims.map(d => residual(d, u)); }
  function jac(dims, u, n) {
    const h = 1e-6, J = dims.map(() => new Float64Array(n));
    for (let j = 0; j < n; j++) {
      const s = u[j]; u[j] = s + h; const rp = resid(dims, u); u[j] = s - h; const rm = resid(dims, u); u[j] = s;
      for (let i = 0; i < dims.length; i++) J[i][j] = (rp[i] - rm[i]) / (2 * h);
    }
    return J;
  }
  function linSolve(A, b) {
    const n = b.length, M = A.map((r, i) => [...r, b[i]]);
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      if (Math.abs(M[p][c]) < 1e-14) return null;
      [M[c], M[p]] = [M[p], M[c]];
      for (let r = c + 1; r < n; r++) { const f = M[r][c] / M[c][c]; if (f) for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
    }
    const x = new Array(n).fill(0);
    for (let r = n - 1; r >= 0; r--) { let s = M[r][n]; for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k]; x[r] = s / M[r][r]; }
    return x;
  }
  // hạng của J (khử Gauss có ngưỡng) → bậc tự do còn lại = n - hạng
  function rank(J, n) {
    const M = J.map(r => Array.from(r)); let rk = 0;
    for (let c = 0; c < n && rk < M.length; c++) {
      let p = rk; for (let r = rk + 1; r < M.length; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      if (Math.abs(M[p][c]) < 1e-7) continue;
      [M[rk], M[p]] = [M[p], M[rk]];
      for (let r = rk + 1; r < M.length; r++) { const f = M[r][c] / M[rk][c]; if (f) for (let k = c; k < n; k++) M[r][k] -= f * M[rk][k]; }
      rk++;
    }
    return rk;
  }

  /* solve({ nVars, weights: [w0, w1…] (theo biến), dims, hold: Set chỉ số biến bị giữ })
     → { ok, u: [dx0, dy0, dx1, dy1…], failing: [id…], dof, maxErr }
     Không thoả được (ràng buộc mâu thuẫn) → ok:false, u toàn 0 (không dời gì). */
  function solve(o) {
    const n = 2 * o.nVars, dims = o.dims.filter(d => !d.driven), u = new Array(n).fill(0);
    const W = []; for (let i = 0; i < o.nVars; i++) { const w = o.hold && o.hold.has(i) ? 100 : (o.weights[i] || 1); W.push(w, w); }
    if (!dims.length || !n) return { ok: true, u, failing: [], dof: n, maxErr: 0 };
    let r = resid(dims, u), cost = r.reduce((s, v) => s + v * v, 0), lam = 1e-3;
    for (let it = 0; it < MAXIT && Math.max(...r.map(Math.abs)) > TOL; it++) {
      const J = jac(dims, u, n), A = [], g = new Array(n).fill(0);
      for (let a = 0; a < n; a++) { A.push(new Array(n).fill(0)); for (let i = 0; i < dims.length; i++) g[a] += J[i][a] * r[i]; }
      for (let i = 0; i < dims.length; i++) for (let a = 0; a < n; a++) { const ja = J[i][a]; if (ja) for (let b = 0; b < n; b++) A[a][b] += ja * J[i][b]; }
      let improved = false;
      for (let t = 0; t < 30; t++) {
        const M = A.map((row, a) => row.map((v, b) => a === b ? v + lam * W[a] + 1e-12 : v));
        const st = linSolve(M, g.map(v => -v)); if (!st) { lam *= 4; continue; }
        const u2 = u.map((v, i) => v + st[i]), r2 = resid(dims, u2), c2 = r2.reduce((s, v) => s + v * v, 0);
        if (c2 < cost) { for (let i = 0; i < n; i++) u[i] = u2[i]; r = r2; cost = c2; lam = Math.max(lam / 3, 1e-9); improved = true; break; }
        lam *= 4;
      }
      if (!improved) break;
    }
    const maxErr = Math.max(...r.map(Math.abs)), J = jac(dims, u, n), dof = n - rank(J, n);
    if (maxErr > 1e-4) return { ok: false, u: new Array(n).fill(0), failing: dims.filter((d, i) => Math.abs(r[i]) > 1e-4).map(d => d.id), dof, maxErr };
    return { ok: true, u, failing: [], dof, maxErr };
  }
  // Dim mới có làm thừa ràng buộc không (hạng J không tăng) → nên đặt thành Dim tham chiếu
  function redundant(o, d) {
    const n = 2 * o.nVars, u = new Array(n).fill(0), base = o.dims.filter(x => !x.driven);
    if (!n) return true;
    const r0 = base.length ? rank(jac(base, u, n), n) : 0, r1 = rank(jac([...base, d], u, n), n);
    return r1 === r0;
  }

  G.PCBSolver = { solve, redundant, measure, signOf, residual, pt };
})(typeof window !== "undefined" ? window : globalThis);
