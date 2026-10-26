/* Trang admin Pindexio – chỉ tải khi bạn mở nó (Ctrl+Shift+E hoặc thêm ?edit vào URL), khách thường không tải file này.
   Không có máy chủ: mọi chỉnh sửa được GHI THẲNG vào thư mục dự án trên máy bạn (File System Access API, cần Chrome/Edge).
   Sau khi lưu phải commit + push thì trang thật mới đổi. Khách truy cập không thể ghi gì vào trang thật.

   Ghi ra 4 file, mỗi file một việc:
     js/affiliates.js   link tiếp thị liên kết theo vùng
     css/custom.css     màu ngày/đêm, font, cỡ chữ, và chỉnh từng phần tử (JSON trong dòng đầu giúp mở lại để sửa tiếp)
     js/images.js       ảnh thay thế (thumbnail "Mua board"), ảnh mới nằm trong img/uploads/
     js/admin-auth.js   mật khẩu đã băm PBKDF2 (không lưu mật khẩu thật) */
(function () {
  if (window.__pindexAdmin) return; window.__pindexAdmin = true;

  const SKIN = ':root[data-skin="pinout"]';
  const HEX = /^#[0-9a-f]{6}$/i;
  const SELOK = /^[\w#.\-:() >]+$/;
  const PBK_ITER = 250000;
  const TOK = [["--bg", "Nền trang"], ["--surface", "Khung / thẻ"], ["--surface2", "Khung phụ"], ["--fg", "Chữ"], ["--muted", "Chữ phụ"],
    ["--line", "Đường kẻ"], ["--accent", "Màu nhấn (nút, đang chọn)"], ["--navy", "Navy (nút chọn, tiêu đề bảng)"], ["--cyan", "Cyan"]];
  // [khoá, tên hiển thị, font-family, tham số Google Fonts (nếu chưa có sẵn trong trang)]
  const FONTS = [
    ["ubuntu", "Ubuntu", '"Ubuntu", system-ui, sans-serif'],
    ["ubuntu-mono", "Ubuntu Mono", '"Ubuntu Mono", ui-monospace, monospace'],
    ["plex-sans", "IBM Plex Sans", '"IBM Plex Sans", system-ui, sans-serif'],
    ["plex-mono", "IBM Plex Mono", '"IBM Plex Mono", ui-monospace, monospace'],
    ["vt323", "VT323 (pixel)", '"VT323", monospace'],
    ["system", "Chữ hệ thống", 'system-ui, -apple-system, "Segoe UI", sans-serif'],
    ["georgia", "Georgia (có chân)", 'Georgia, "Times New Roman", serif'],
    ["bevn", "Be Vietnam Pro", '"Be Vietnam Pro", system-ui, sans-serif', "Be+Vietnam+Pro:wght@400;500;600;700;800"],
    ["inter", "Inter", '"Inter", system-ui, sans-serif', "Inter:wght@400;500;600;700;800"],
    ["montserrat", "Montserrat", '"Montserrat", system-ui, sans-serif', "Montserrat:wght@400;500;600;700;800"],
    ["roboto", "Roboto", '"Roboto", system-ui, sans-serif', "Roboto:wght@400;500;700"],
    ["nunito", "Nunito", '"Nunito", system-ui, sans-serif', "Nunito:wght@400;600;700;800"],
    ["jbmono", "JetBrains Mono", '"JetBrains Mono", ui-monospace, monospace', "JetBrains+Mono:wght@400;500;700"]
  ];
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const $ = s => document.querySelector(s);
  const norm = v => { const c = document.createElement("canvas").getContext("2d"); c.fillStyle = "#000"; c.fillStyle = String(v).trim(); return c.fillStyle; };
  const hexOr = (v, fb) => { const n = norm(v); return HEX.test(n) ? n : fb; };
  const scopeNow = () => document.documentElement.dataset.theme === "dark" ? "night" : "day";

  /* ---------- trạng thái ---------- */
  let S = fresh(), AFF = {}, IMGPATH = {}, pendingUp = {}, tok = null;
  let rootDir = null, panel = null, liveOn = false, tab = "link", dirty = { aff: false, css: false, img: false, auth: null };
  function fresh() { return { v: 1, day: {}, night: {}, font: {}, rules: { all: {}, day: {}, night: {} } }; }

  /* ---------- băm mật khẩu (PBKDF2, chậm có chủ ý để khó dò) ---------- */
  const hex = u => [...u].map(b => b.toString(16).padStart(2, "0")).join("");
  const unhex = h => new Uint8Array(h.match(/../g).map(x => parseInt(x, 16)));
  async function pbk(pw, saltHex, iter) {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveBits"]);
    return hex(new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: unhex(saltHex), iterations: iter }, key, 256)));
  }
  async function makeAuth(pw) { const salt = hex(crypto.getRandomValues(new Uint8Array(16))); return { salt, iter: PBK_ITER, hash: await pbk(pw, salt, PBK_ITER) }; }

  /* ---------- giao diện của chính admin ---------- */
  const style = document.createElement("style");
  style.textContent = `
.adm-ui, .adm-ui * { box-sizing: border-box; }
.adm { position: fixed; inset: 0; z-index: 90; display: flex; flex-direction: column; background: var(--surface); color: var(--fg); font: 14px var(--sans); }
.adm-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 10px; padding: 10px max(16px, env(safe-area-inset-left, 0px)); border-bottom: 1px solid var(--line); background: var(--surface2); }
.adm-bar b { flex: none; } .adm-st { flex: 1; min-width: 120px; color: var(--muted); font: 12px var(--mono); }
.adm button, .adm-modal button, .adm-menu button, .adm-lbar button { padding: 7px 13px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface2); color: var(--fg); font: 600 13px var(--sans); cursor: pointer; }
.adm button:hover, .adm-menu button:hover { border-color: var(--accent); }
.adm .adm-primary, .adm-modal .adm-primary, .adm-lbar .adm-primary { background: var(--accent); border-color: var(--accent); color: var(--accent-fg); }
.adm-tabs { display: flex; gap: 6px; padding: 8px max(16px, env(safe-area-inset-left, 0px)) 0; background: var(--surface2); }
.adm-tabs button { border-radius: 8px 8px 0 0; border-bottom: 0; }
.adm-tabs button[aria-selected="true"] { background: var(--surface); border-color: var(--line); color: var(--fg); }
.adm-body { flex: 1; overflow: auto; padding: 14px max(16px, env(safe-area-inset-left, 0px)) 28px; }
.adm-in { max-width: 920px; margin: 0 auto; display: grid; gap: 18px; }
.adm h3 { margin: 0 0 8px; font-size: 15px; display: flex; align-items: center; gap: 10px; }
.adm input[type=text], .adm input[type=number], .adm select, .adm-menu input[type=text], .adm-menu select, .adm-modal input { padding: 6px 9px; border: 1px solid var(--line); border-radius: 7px; background: var(--surface2); color: var(--fg); font: 12.5px var(--mono); }
.adm-row { display: grid; grid-template-columns: 190px minmax(0, 1fr) auto; gap: 8px; align-items: center; padding: 3px 0; }
.adm-row span { font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.adm-row input { width: 100%; } .adm-row a { text-decoration: none; }
.adm-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 8px 16px; }
.adm-c { display: grid; grid-template-columns: minmax(0, 1fr) 44px 84px; gap: 8px; align-items: center; font-size: 13px; }
.adm-c input[type=color], .adm-menu input[type=color] { width: 44px; height: 30px; padding: 0; border: 1px solid var(--line); border-radius: 6px; background: none; cursor: pointer; }
.adm-hex { width: 84px; }
.adm-note { color: var(--muted); font-size: 13px; margin: 0; }
.adm-fr { display: flex; flex-wrap: wrap; gap: 14px; align-items: center; }
.adm-fr label { display: grid; gap: 4px; font-size: 13px; }
.adm-modal { position: fixed; inset: 0; z-index: 99; display: grid; place-items: center; background: rgba(0,0,0,.55); }
.adm-card { display: grid; gap: 10px; width: min(92vw, 380px); padding: 18px; border-radius: 12px; background: var(--surface); color: var(--fg); border: 1px solid var(--line); font: 14px var(--sans); }
.adm-card input { width: 100%; } .adm-err { color: var(--ban); font-size: 13px; min-height: 1em; }
.adm-btns { display: flex; justify-content: flex-end; gap: 8px; }
.adm-lbar { position: fixed; left: 50%; bottom: max(14px, env(safe-area-inset-bottom, 0px)); transform: translateX(-50%); z-index: 92; display: flex; flex-wrap: wrap; align-items: center; gap: 8px 10px; max-width: 94vw; padding: 9px 14px; border-radius: 12px; background: var(--surface); color: var(--fg); border: 2px solid var(--accent); box-shadow: 0 8px 30px rgba(0,0,0,.35); font: 13px var(--sans); }
.adm-lbar .adm-st { flex: none; max-width: 40vw; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.adm-hl { position: fixed; z-index: 91; pointer-events: none; outline: 2px dashed #00AEEF; outline-offset: 1px; background: rgba(0,174,239,.10); border-radius: 3px; }
.adm-menu { position: fixed; z-index: 95; display: grid; gap: 3px; width: 268px; max-width: 94vw; padding: 6px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface); color: var(--fg); box-shadow: 0 10px 34px rgba(0,0,0,.4); font: 13px var(--sans); }
.adm-menu > button { text-align: left; }
.adm-mh { display: grid; gap: 2px; padding: 4px 6px 6px; border-bottom: 1px solid var(--line); margin-bottom: 3px; }
.adm-mh code { font: 11.5px var(--mono); color: var(--label, var(--accent)); overflow-wrap: anywhere; } .adm-mh span { color: var(--muted); font-size: 11.5px; }
.adm-sub { display: grid; gap: 8px; padding: 4px 6px 6px; } .adm-sub label { display: grid; grid-template-columns: 70px 1fr; gap: 8px; align-items: center; font-size: 12.5px; }
.adm-sub input[type=range] { width: 100%; } .adm-sub .adm-btns { justify-content: space-between; }
@media (max-width: 620px) { .adm-row { grid-template-columns: 1fr auto; } .adm-row span { grid-column: 1 / -1; } .adm-c { grid-template-columns: minmax(0, 1fr) 44px 76px; } }`;
  document.head.appendChild(style);

  /* ---------- tiện ích ghi file vào thư mục dự án ---------- */
  async function ensureRoot() {
    while (true) {
      if (!rootDir) rootDir = await showDirectoryPicker({ mode: "readwrite", id: "pindex" });
      try { await (await rootDir.getDirectoryHandle("js")).getFileHandle("affiliates.js"); return rootDir; }
      catch { rootDir = null; if (!confirm("Thư mục vừa chọn không phải thư mục dự án Pindexio.\nChọn lại?")) throw new DOMException("huỷ", "AbortError"); }
    }
  }
  async function writeFile(path, data) {
    const parts = path.split("/"), name = parts.pop(); let dir = rootDir;
    for (const p of parts) dir = await dir.getDirectoryHandle(p, { create: true });
    const w = await (await dir.getFileHandle(name, { create: true })).createWritable();
    await w.write(data); await w.close();
  }
  const loadScript = src => new Promise(ok => { const s = document.createElement("script"); s.src = src; s.onload = s.onerror = () => { s.remove(); ok(); }; document.body.appendChild(s); });

  /* ---------- sinh nội dung các file ---------- */
  function affText() {
    return "/* Link tiếp thị liên kết theo vùng. Sửa bằng trang admin (Ctrl+Shift+E hoặc thêm ?edit vào URL)\n   – admin ghi đè nguyên file này, nên đừng thêm code khác vào đây. */\nwindow.AFFILIATE = " + JSON.stringify(AFF, null, 2) + ";\n";
  }
  function imgText() {
    return '/* Ảnh thay thế do trang admin ghi (nhấp phải vào ảnh Mua board → Thay ảnh). Khoá "buy:<id board>" → đường dẫn ảnh. */\nwindow.IMG_MAP = ' + JSON.stringify(IMGPATH, null, 2) + ";\n";
  }
  function authText(a) {
    return '/* Mật khẩu admin (đã băm PBKDF2-SHA256, không phải mật khẩu thật). Đặt lần đầu khi mở trang admin; đổi bằng nút "Đổi mật khẩu". */\nwindow.ADMIN_AUTH = ' + JSON.stringify(a) + ";\n";
  }
  const fontOf = k => FONTS.find(f => f[0] === k);
  const fontUrl = f => "https://fonts.googleapis.com/css2?family=" + f[3] + "&display=swap";
  // Mỗi thuộc tính chỉ nhận giá trị hợp lệ → file css luôn an toàn dù JSON bị sửa
  const SAFE = {
    "color": v => HEX.test(v) && v,
    "background-color": v => (HEX.test(v) || v === "transparent") && v,
    "font-family": v => fontOf(v) && fontOf(v)[2],
    "font-size": v => /^\d{1,2}(\.\d)?px$/.test(v) && v,
    "font-weight": v => /^[4-8]00$/.test(v) && v,
    "width": v => (/^\d{1,4}px$/.test(v) || v === "auto") && v,
    "height": v => (/^\d{1,4}px$/.test(v) || v === "auto") && v,
    "object-fit": v => /^(contain|cover)$/.test(v) && v
  };
  function cssText() {
    const imp = new Set(), blocks = [];
    const fam = k => { const f = fontOf(k); if (!f) return null; if (f[3]) imp.add(fontUrl(f)); return f[2]; };
    const toks = (sel, o) => { const d = Object.entries(o || {}).filter(([k, v]) => TOK.some(t => t[0] === k) && HEX.test(v)).map(([k, v]) => k + ":" + v); return d.length ? sel + "{" + d.join(";") + "}" : ""; };
    blocks.push(toks(SKIN + '[data-theme="light"]', S.day), toks(SKIN + '[data-theme="dark"]', S.night));
    const fv = [];
    if (fam(S.font.sans)) fv.push("--sans:" + fam(S.font.sans));
    if (fam(S.font.mono)) fv.push("--mono:" + fam(S.font.mono));
    if (fv.length) blocks.push(SKIN + "{" + fv.join(";") + "}");
    const pre = { all: SKIN + " ", day: SKIN + '[data-theme="light"] ', night: SKIN + '[data-theme="dark"] ' };
    for (const sc of ["all", "day", "night"]) for (const [sel, props] of Object.entries((S.rules || {})[sc] || {})) {
      if (!SELOK.test(sel)) continue;
      const d = [];
      for (const [p, v] of Object.entries(props)) { const ok = SAFE[p] && SAFE[p](v); if (ok) { d.push(p + ":" + ok + " !important"); if (p === "width") d.push("max-width:none !important"); } }
      if (d.length) blocks.push(pre[sc] + sel + "{" + d.join(";") + "}");
    }
    return "/*CUSTOM " + JSON.stringify(S) + " */\n/* Tự sinh bởi trang admin (Ctrl+Shift+E). Đừng sửa tay: mở admin, chỉnh, lưu lại. Chỉ áp cho giao diện mặc định \"Pindex\". */\n"
      + [...imp].map(u => '@import url("' + u + '");').join("\n") + (imp.size ? "\n" : "") + blocks.filter(Boolean).join("\n") + "\n";
  }
  function applyLive(markDirty) {
    let st = $("#adm-live");
    if (!st) { st = document.createElement("style"); st.id = "adm-live"; document.head.appendChild(st); }
    st.textContent = cssText();
    const c = $("#custom-css"); if (c) c.disabled = true;      // trong lúc sửa chỉ dùng bản đang chỉnh
    if (markDirty) { dirty.css = true; setStatus("chưa lưu"); }
  }
  async function loadState() {
    try {
      const t = await (await fetch("css/custom.css?" + Date.now())).text(), m = t.match(/\/\*CUSTOM (\{[\s\S]*?\}) \*\//);
      if (m) { const j = JSON.parse(m[1]); S = Object.assign(fresh(), j); S.rules = Object.assign({ all: {}, day: {}, night: {} }, j.rules); S.day = j.day || {}; S.night = j.night || {}; S.font = j.font || {}; }
    } catch (e) { }
    AFF = JSON.parse(JSON.stringify(window.AFFILIATE || {}));
    IMGPATH = Object.assign({}, window.IMG_MAP || {});
  }
  function readTokens() {
    const r = document.documentElement, keep = r.dataset.theme, out = { light: {}, dark: {} };
    for (const t of ["light", "dark"]) { r.dataset.theme = t; const cs = getComputedStyle(r); for (const [k] of TOK) out[t][k] = hexOr(cs.getPropertyValue(k), "#000000"); }
    r.dataset.theme = keep; return out;
  }

  /* ---------- hộp nhập mật khẩu ---------- */
  function askPw(title, two) {
    return new Promise(res => {
      const d = document.createElement("div"); d.className = "adm-modal adm-ui";
      d.innerHTML = `<form class="adm-card"><b>${esc(title)}</b><input type="password" autocomplete="${two ? "new-password" : "current-password"}" placeholder="Mật khẩu" required ${two ? 'minlength="10"' : ""}>${two ? '<input type="password" autocomplete="new-password" placeholder="Nhập lại mật khẩu" required minlength="10">' : ""}<div class="adm-err"></div><div class="adm-btns"><button type="button" data-x>Huỷ</button><button class="adm-primary">OK</button></div></form>`;
      document.body.appendChild(d); const [a, b] = d.querySelectorAll("input"); a.focus();
      d.querySelector("form").onsubmit = e => { e.preventDefault(); if (two && a.value !== b.value) { d.querySelector(".adm-err").textContent = "Hai lần nhập chưa giống nhau."; return; } d.remove(); res(a.value); };
      d.querySelector("[data-x]").onclick = () => { d.remove(); res(null); };
    });
  }
  async function login() {
    if (panel || liveOn) return;
    let until = 0; try { until = +sessionStorage.getItem("adm-lock") || 0; } catch (e) { }
    if (Date.now() < until) { alert("Nhập sai nhiều lần. Thử lại sau " + Math.ceil((until - Date.now()) / 1000) + " giây."); return; }
    await loadScript("js/admin-auth.js?" + Date.now());
    const A = window.ADMIN_AUTH;
    if (!A) {
      const pw = await askPw("Lần đầu: đặt mật khẩu admin (từ 10 ký tự)", true); if (pw == null) return;
      dirty.auth = await makeAuth(pw);
    } else {
      let ok = false;
      for (let i = 0; i < 3 && !ok; i++) { const pw = await askPw(i ? "Sai mật khẩu, thử lại" : "Mật khẩu admin", false); if (pw == null) return; ok = await pbk(pw, A.salt, A.iter) === A.hash; }
      if (!ok) { try { sessionStorage.setItem("adm-lock", String(Date.now() + 30000)); } catch (e) { } alert("Sai mật khẩu."); return; }
    }
    await loadState(); applyLive(false); tok = readTokens(); openPanel();
  }

  /* ---------- lưu ---------- */
  let statusEls = [];
  const setStatus = s => statusEls.forEach(e => e.textContent = s);
  async function saveAll() {
    if (!window.showDirectoryPicker) { setStatus("Lưu trực tiếp cần Chrome hoặc Edge."); return; }
    try {
      await ensureRoot(); setStatus("đang lưu…");
      for (const [path, blob] of Object.entries(pendingUp)) await writeFile(path, blob);
      pendingUp = {};
      if (dirty.aff) await writeFile("js/affiliates.js", affText());
      if (dirty.css) await writeFile("css/custom.css", cssText());
      if (dirty.img) await writeFile("js/images.js", imgText());
      if (dirty.auth) { await writeFile("js/admin-auth.js", authText(dirty.auth)); window.ADMIN_AUTH = dirty.auth; }
      window.AFFILIATE = JSON.parse(JSON.stringify(AFF)); window.IMG_MAP = Object.assign({}, IMGPATH);
      dirty = { aff: false, css: false, img: false, auth: null };
      if (window.APP) { APP.redrawBuy(); }
      setStatus("đã lưu — nhớ commit & push để trang thật đổi");
    } catch (e) { setStatus(e && e.name === "AbortError" ? "chưa lưu" : "lỗi: " + (e && e.message || e)); }
  }

  /* ---------- bảng admin ---------- */
  function openPanel() {
    liveOn = false;
    panel = document.createElement("div"); panel.className = "adm adm-ui";
    panel.innerHTML = `<div class="adm-bar"><b>Admin · Pindexio</b><span class="adm-st">${dirty.auth ? "chưa lưu mật khẩu mới" : "chưa sửa"}</span>
        <button data-a="live" class="adm-primary">✎ Sửa trực tiếp trên trang</button><button data-a="pw">Đổi mật khẩu</button><button data-a="save" class="adm-primary">Lưu vào file</button><button data-a="x">Thoát</button></div>
      <div class="adm-tabs" role="tablist"><button data-tab="link" role="tab">Link mua hàng</button><button data-tab="theme" role="tab">Giao diện</button></div>
      <div class="adm-body"><div class="adm-in" id="admTab"></div></div>`;
    document.body.appendChild(panel);
    statusEls = [panel.querySelector(".adm-st")];
    panel.onclick = async e => {
      const a = e.target.dataset.a, t = e.target.dataset.tab;
      if (t) { tab = t; paintTab(); }
      if (a === "save") saveAll();
      if (a === "x") { if ((dirty.aff || dirty.css || dirty.img) && !confirm("Còn chỉnh sửa chưa lưu. Thoát luôn?")) return; location.reload(); }
      if (a === "live") startLive();
      if (a === "pw") { const pw = await askPw("Mật khẩu admin mới (từ 10 ký tự)", true); if (pw != null) { dirty.auth = await makeAuth(pw); setStatus("chưa lưu mật khẩu mới"); } }
    };
    paintTab();
  }
  function paintTab() {
    panel.querySelectorAll("[data-tab]").forEach(b => b.setAttribute("aria-selected", b.dataset.tab === tab));
    const box = $("#admTab");
    if (tab === "link") paintLinks(box); else paintTheme(box);
  }
  function paintLinks(box) {
    box.innerHTML = Object.keys(AFF).map(r => `<section><h3>${esc(AFF[r].label || r)} <input type="text" class="adm-shop" data-r="${r}" value="${esc(AFF[r].shop || "")}" placeholder="Tên sàn" style="width:150px"></h3>
      ${BOARDS.map(b => `<label class="adm-row"><span>${esc(b.name)}</span><input type="text" data-r="${r}" data-b="${b.id}" value="${esc((AFF[r].links || {})[b.id] || "")}" placeholder="https://..."><a href="${esc((AFF[r].links || {})[b.id] || "#")}" target="_blank" rel="noopener nofollow" title="Mở thử">↗</a></label>`).join("")}</section>`).join("")
      + '<p class="adm-note">Dán link rút gọn của chương trình tiếp thị (ví dụ s.shopee.vn/…). Lưu xong vẫn phải commit và push thì trang thật mới đổi.</p>';
    box.oninput = e => {
      const t = e.target;
      if (t.dataset.b) (AFF[t.dataset.r].links = AFF[t.dataset.r].links || {})[t.dataset.b] = t.value.trim();
      else if (t.classList.contains("adm-shop")) AFF[t.dataset.r].shop = t.value.trim(); else return;
      const a = t.parentElement.querySelector("a"); if (a) a.href = t.value.trim() || "#";
      dirty.aff = true; setStatus("chưa lưu");
    };
  }
  function paintTheme(box) {
    const rows = (t, label) => {
      const own = t === "light" ? S.day : S.night;
      return `<section><h3>${label}</h3><div class="adm-grid">${TOK.map(([k, n]) => { const v = own[k] || tok[t][k];
        return `<label class="adm-c"><span>${n}</span><input type="color" data-t="${t}" data-k="${k}" value="${v}"><input type="text" class="adm-hex" data-t="${t}" data-k="${k}" value="${v}" maxlength="7"></label>`; }).join("")}</div></section>`;
    };
    const opt = (sel, mono) => FONTS.map(f => `<option value="${f[0]}"${f[0] === sel ? " selected" : ""}>${esc(f[1])}</option>`).join("");
    const base = Math.round(parseFloat(getComputedStyle(document.body).fontSize)) || 15, cur = (S.rules.all.body || {})["font-size"];
    box.innerHTML = rows("light", "☀ Ban ngày") + rows("dark", "☾ Ban đêm") + `<section><h3>Font chữ</h3><div class="adm-fr">
        <label>Chữ chính<select data-font="sans">${opt(S.font.sans || "ubuntu")}</select></label>
        <label>Chữ mã / số<select data-font="mono">${opt(S.font.mono || "ubuntu-mono")}</select></label>
        <label>Cỡ chữ cơ bản (px)<input type="number" min="12" max="22" step="1" data-base value="${cur ? parseInt(cur) : base}" style="width:90px"></label></div></section>
      <section><button data-reset>Đặt lại mọi chỉnh sửa giao diện</button> <p class="adm-note" style="display:inline">Màu ngày và đêm chỉnh riêng. Muốn chỉnh riêng một khung, một dòng chữ hay một ảnh thì bấm “✎ Sửa trực tiếp trên trang” rồi nhấp phải vào đó.</p></section>`;
    const setTok = (t, k, v) => { (t === "light" ? S.day : S.night)[k] = v; applyLive(true); };
    box.oninput = e => {
      const x = e.target, d = x.dataset;
      if (d.k && x.type === "color") { setTok(d.t, d.k, x.value); box.querySelector(`.adm-hex[data-t="${d.t}"][data-k="${d.k}"]`).value = x.value; }
      if (d.font) { S.font[d.font] = x.value; applyLive(true); }
      if (d.base !== undefined) { const n = Math.max(12, Math.min(22, +x.value || 15)); (S.rules.all.body = S.rules.all.body || {})["font-size"] = n + "px"; applyLive(true); }
    };
    box.onchange = e => {
      const x = e.target, d = x.dataset;
      if (d.k && x.classList.contains("adm-hex")) { let v = x.value.trim(); if (!v.startsWith("#")) v = "#" + v; if (HEX.test(v)) { setTok(d.t, d.k, v.toLowerCase()); box.querySelector(`input[type=color][data-t="${d.t}"][data-k="${d.k}"]`).value = v.toLowerCase(); x.value = v.toLowerCase(); } else x.value = (d.t === "light" ? S.day : S.night)[d.k] || tok[d.t][d.k]; }
    };
    box.onclick = e => { if (e.target.dataset.reset !== undefined && confirm("Xoá toàn bộ chỉnh sửa màu, font, cỡ chữ và các khung đã chỉnh?")) { S = fresh(); applyLive(true); paintTheme(box); } };
  }

  /* ---------- sửa trực tiếp: nhấp phải vào phần tử ---------- */
  let hl = null, menu = null, lbar = null, hovEl = null;
  function startLive() {
    if (liveOn) return; liveOn = true; panel.style.display = "none";
    hl = document.createElement("div"); hl.className = "adm-hl adm-ui"; hl.hidden = true; document.body.appendChild(hl);
    lbar = document.createElement("div"); lbar.className = "adm-lbar adm-ui";
    lbar.innerHTML = '<b>Sửa trực tiếp</b><span class="adm-st">nhấp phải vào chữ, khung hoặc ảnh</span><button data-a="save" class="adm-primary">Lưu</button><button data-a="back">Về bảng admin</button><button data-a="x">Thoát</button>';
    document.body.appendChild(lbar); statusEls = [lbar.querySelector(".adm-st")];
    lbar.onclick = e => {
      const a = e.target.dataset.a;
      if (a === "save") saveAll();
      if (a === "back") stopLive();
      if (a === "x") { if ((dirty.aff || dirty.css || dirty.img) && !confirm("Còn chỉnh sửa chưa lưu. Thoát luôn?")) return; location.reload(); }
    };
    document.addEventListener("contextmenu", onCtx, true);
    document.addEventListener("pointermove", onMove, true);
    document.addEventListener("click", noNav, true);
    document.addEventListener("pointerdown", onDown, true);
  }
  function stopLive() {
    liveOn = false; closeMenu(); hl && hl.remove(); lbar && lbar.remove();
    document.removeEventListener("contextmenu", onCtx, true); document.removeEventListener("pointermove", onMove, true);
    document.removeEventListener("click", noNav, true); document.removeEventListener("pointerdown", onDown, true);
    statusEls = [panel.querySelector(".adm-st")]; panel.style.display = ""; tok = readTokens(); paintTab();
  }
  const inAdm = t => t && t.closest && t.closest(".adm-ui");
  function onMove(e) {
    if (menu || inAdm(e.target)) { if (!menu) hl.hidden = true; return; }
    hovEl = e.target; place(hovEl);
  }
  function place(el) { const r = el.getBoundingClientRect(); Object.assign(hl.style, { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px" }); hl.hidden = false; }
  const noNav = e => { if (!inAdm(e.target) && e.target.closest && e.target.closest("a[href]")) e.preventDefault(); };
  function onDown(e) { if (menu && !menu.contains(e.target)) closeMenu(); }
  function onCtx(e) { if (inAdm(e.target)) return; e.preventDefault(); e.stopImmediatePropagation(); showMenu(e.clientX, e.clientY, e.target); }
  function closeMenu() { if (menu) { menu.remove(); menu = null; } if (hl) hl.hidden = true; }
  addEventListener("keydown", e => { if (e.key === "Escape") closeMenu(); });

  // Chọn bộ chọn CSS: ưu tiên "mọi phần tử cùng loại" (theo class) để chỉnh một lần đổi cả nhóm
  function selectorFor(el) {
    const bad = /^(on|dim|sel|open|armed|gone|active|pressed|hidden)$/;
    const part = e => e.id && /^[A-Za-z][\w-]*$/.test(e.id) ? "#" + e.id
      : e.tagName.toLowerCase() + [...e.classList].filter(c => /^[A-Za-z_][\w-]*$/.test(c) && !bad.test(c) && !/^adm/.test(c)).slice(0, 2).map(c => "." + c).join("");
    const chain = []; for (let e = el; e && e !== document.body && chain.length < 5; e = e.parentElement) chain.push(e);
    for (let k = 1; k <= chain.length; k++) {
      const sel = chain.slice(0, k).reverse().map(part).join(" ");
      if (!/[#.]/.test(sel) || !SELOK.test(sel)) continue;
      let nodes; try { nodes = document.querySelectorAll(sel); } catch (x) { continue; }
      if (nodes.length && nodes.length <= 80 && [...nodes].includes(el)) return sel;
    }
    const path = []; for (let e = el; e && e !== document.body; e = e.parentElement) { path.unshift(e.tagName.toLowerCase() + ":nth-of-type(" + ([...e.parentElement.children].filter(c => c.tagName === e.tagName).indexOf(e) + 1) + ")"); if (e.id) { path[0] = "#" + e.id; break; } }
    return "body > " + path.join(" > ");
  }
  const getRule = (sel, p) => { for (const sc of ["day", "night", "all"]) if (((S.rules[sc] || {})[sel] || {})[p]) return S.rules[sc][sel][p]; return null; };
  function setRule(sel, p, v, sc) {
    // màu thì gắn với chế độ đang xem (ngày/đêm), còn lại áp cho cả hai
    const scope = sc || (p === "color" || p === "background-color" ? scopeNow() : "all");
    (S.rules[scope][sel] = S.rules[scope][sel] || {})[p] = v; applyLive(true);
  }
  function clearRules(sel) { for (const sc of ["all", "day", "night"]) delete S.rules[sc][sel]; applyLive(true); }

  function showMenu(x, y, target) {
    closeMenu();
    const svg = target.closest("svg"), el = svg || target, sel = selectorFor(el), n = document.querySelectorAll(sel).length;
    const isImg = el.tagName === "IMG", buyPic = isImg && el.closest(".buy-pic") && el.closest(".buy-card");
    place(el);
    menu = document.createElement("div"); menu.className = "adm-menu adm-ui";
    const head = `<div class="adm-mh"><code>${esc(sel)}</code><span>Áp dụng cho ${n} phần tử cùng loại${svg ? " · hình vẽ" : ""}</span></div>`;
    const items = [];
    if (!svg) items.push(["🎨 Màu chữ", () => colorForm("color", "Màu chữ", el)], ["🖌 Màu nền / mảng màu", () => colorForm("background-color", "Màu nền", el)],
      ["🔤 Font chữ", () => fontForm(el)], ["🔠 Cỡ chữ & độ đậm", () => textForm(el)]);
    // ảnh nằm trong khung cố định (thumbnail Mua board) thì chỉnh cỡ cái khung, không thì ảnh bị cắt
    const frame = isImg && el.parentElement && el.parentElement.classList.contains("buy-pic") ? el.parentElement : null;
    items.push(["📐 Kích thước" + (frame ? " khung ảnh" : ""), () => frame ? sizeIn(frame) : sizeForm(el, isImg)]);
    if (buyPic) items.push(["🖼 Thay ảnh thumbnail…", () => replaceImg(el)]);
    items.push(["↺ Bỏ chỉnh sửa phần tử này", () => { clearRules(sel); closeMenu(); }]);
    const draw = () => { menu.innerHTML = head; items.forEach(([t, f]) => { const b = document.createElement("button"); b.textContent = t; b.onclick = () => { f(); }; menu.appendChild(b); }); };
    draw(); document.body.appendChild(menu);
    const w = menu.offsetWidth, h = menu.offsetHeight;
    menu.style.left = Math.max(6, Math.min(x, innerWidth - w - 6)) + "px"; menu.style.top = Math.max(6, Math.min(y, innerHeight - h - 6)) + "px";
    const sub = (title, html, bind) => { menu.innerHTML = head + `<div class="adm-sub"><b>${title}</b>${html}<div class="adm-btns"><button data-back>← Quay lại</button><button data-done class="adm-primary">Xong</button></div></div>`;
      menu.querySelector("[data-back]").onclick = () => { draw(); }; menu.querySelector("[data-done]").onclick = closeMenu; bind(menu.querySelector(".adm-sub")); };

    function colorForm(prop, title, node) {
      const cs = getComputedStyle(node), cur = getRule(sel, prop) || hexOr(cs[prop === "color" ? "color" : "backgroundColor"], prop === "color" ? "#000000" : "#ffffff");
      sub(title + (prop === "color" ? "" : " <span style='color:var(--muted);font-weight:400'>(" + (scopeNow() === "night" ? "ban đêm" : "ban ngày") + ")</span>"),
        `<label>Màu<input type="color" value="${cur}"></label><label>Mã<input type="text" value="${cur}" maxlength="7"></label>${prop === "background-color" ? '<button data-clear>Trong suốt</button>' : ""}`, box => {
          const c = box.querySelector("input[type=color]"), t = box.querySelector("input[type=text]");
          c.oninput = () => { t.value = c.value; setRule(sel, prop, c.value); };
          t.onchange = () => { let v = t.value.trim(); if (!v.startsWith("#")) v = "#" + v; if (HEX.test(v)) { c.value = v; setRule(sel, prop, v.toLowerCase()); } };
          const cl = box.querySelector("[data-clear]"); if (cl) cl.onclick = () => setRule(sel, prop, "transparent");
        });
    }
    function fontForm(node) {
      const cur = getRule(sel, "font-family") || "";
      sub("Font chữ", `<select>${'<option value="">(giữ nguyên)</option>' + FONTS.map(f => `<option value="${f[0]}"${f[0] === cur ? " selected" : ""}>${esc(f[1])}</option>`).join("")}</select>`, box => {
        box.querySelector("select").onchange = e => { if (e.target.value) setRule(sel, "font-family", e.target.value); };
      });
    }
    function textForm(node) {
      const sz = parseFloat((getRule(sel, "font-size") || getComputedStyle(node).fontSize)) || 14, wt = getRule(sel, "font-weight") || "";
      sub("Cỡ chữ & độ đậm", `<label>Cỡ <input type="range" min="9" max="48" step="1" value="${Math.round(sz)}"></label><label>Số px<input type="text" value="${Math.round(sz)}" style="width:60px"></label>
        <label>Đậm<select><option value="">(giữ nguyên)</option>${[400, 500, 600, 700, 800].map(w => `<option value="${w}"${String(w) === wt ? " selected" : ""}>${w}</option>`).join("")}</select></label>`, box => {
        const r = box.querySelector("input[type=range]"), t = box.querySelector("input[type=text]");
        r.oninput = () => { t.value = r.value; setRule(sel, "font-size", r.value + "px"); };
        t.onchange = () => { const v = Math.max(9, Math.min(48, parseFloat(t.value) || 14)); r.value = v; setRule(sel, "font-size", v + "px"); };
        box.querySelector("select").onchange = e => { if (e.target.value) setRule(sel, "font-weight", e.target.value); };
      });
    }
    function sizeIn(node) { sizeForm(node, false, selectorFor(node), true); }
    function sizeForm(node, img, selx, square) {
      selx = selx || sel;
      const r = node.getBoundingClientRect(), w = parseInt(getRule(selx, "width")) || Math.round(r.width), h = parseInt(getRule(selx, "height")) || Math.round(r.height);
      sub("Kích thước", `<label>Rộng <input type="range" data-w min="16" max="1200" step="2" value="${Math.min(1200, w)}"></label><label>Số px<input type="text" data-wt value="${w}" style="width:70px"></label>
        <label>Cao <input type="range" data-h min="16" max="1200" step="2" value="${Math.min(1200, h)}"></label><label>Số px<input type="text" data-ht value="${h}" style="width:70px"></label>
        ${img ? '<label>Khung<select data-fit><option value="">(giữ nguyên)</option><option value="contain">Vừa trọn ảnh</option><option value="cover">Phủ kín khung</option></select></label>' : ""}
        <button data-auto>Tự động (theo nội dung)</button>`, box => {
        const q = s => box.querySelector(s), setW = v => { setRule(selx, "width", v + "px"); if (square) setRule(selx, "height", v + "px"); else if (!getRule(selx, "height")) setRule(selx, "height", "auto"); }, setH = v => setRule(selx, "height", v + "px");
        q("[data-w]").oninput = e => { q("[data-wt]").value = e.target.value; setW(e.target.value); };
        q("[data-h]").oninput = e => { q("[data-ht]").value = e.target.value; setH(e.target.value); };
        q("[data-wt]").onchange = e => { const v = Math.max(8, Math.min(2000, parseInt(e.target.value) || w)); q("[data-w]").value = v; setW(v); };
        q("[data-ht]").onchange = e => { const v = Math.max(8, Math.min(2000, parseInt(e.target.value) || h)); q("[data-h]").value = v; setH(v); };
        q("[data-auto]").onclick = () => { setRule(selx, "width", "auto"); setRule(selx, "height", "auto"); };
        const f = q("[data-fit]"); if (f) f.onchange = e => { if (e.target.value) setRule(selx, "object-fit", e.target.value); };
      });
    }
  }

  // Thay ảnh thumbnail của thẻ "Mua board": thu nhỏ còn tối đa 1000px, lưu WebP vào img/uploads/
  async function replaceImg(el) {
    const id = el.closest(".buy-card").dataset.b; closeMenu();
    const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*";
    inp.onchange = async () => {
      const f = inp.files[0]; if (!f) return;
      try {
        let blob = f, ext = (f.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
        if (!/svg/.test(f.type)) {
          const bmp = await createImageBitmap(f), k = Math.min(1, 1000 / Math.max(bmp.width, bmp.height)), c = document.createElement("canvas");
          c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k); c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
          blob = await new Promise(ok => c.toBlob(ok, "image/webp", 0.86)); ext = "webp";
        }
        const path = "img/uploads/buy-" + id + "-" + Date.now().toString(36) + "." + ext;
        pendingUp[path] = blob; IMGPATH["buy:" + id] = path; dirty.img = true;
        window.IMG_MAP = Object.assign({}, window.IMG_MAP || {}, { ["buy:" + id]: URL.createObjectURL(blob) });   // xem thử ngay
        APP.redrawBuy(); setStatus("chưa lưu ảnh mới");
      } catch (e) { setStatus("không đọc được ảnh: " + (e && e.message || e)); }
    };
    inp.click();
  }

  /* ---------- mở admin ---------- */
  window.adminOpen = login;
})();
