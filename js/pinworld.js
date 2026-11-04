/* Pinworld: duyệt kho linh kiện Fritzing (fritzing/fritzing-parts, CC BY-SA 3.0) ngay trong Pindexio.
   Dữ liệu: data/fritzing-parts.json (tạo bằng tools/build-fritzing-parts.py). Hình và file .fzp tải khi cần từ jsDelivr; Pindexio không lưu bản sao.
   "Thêm vào linh kiện của tôi": đọc tên chân + vị trí chân từ .fzp / SVG PCB, cho xem trước kèm cảnh báo, rồi lưu trong trình duyệt của người dùng
   (localStorage "pindexio-myparts"). PCB Maker đọc danh sách này. Chân tự đoán vai trò chỉ khi tin cậy ≥ 50%; chưa bao giờ coi là đã kiểm. */
(function () {
  "use strict";
  const ROOT = document.getElementById("pinworld"); if (!ROOT || window.PINWORLD) return;
  const EN = () => document.documentElement.lang === "en", L = (vi, en) => EN() ? en : vi;
  const KEY = "pindexio-myparts", PAGE = 96, LIC = "CC BY-SA 3.0";
  const css = `
  #pinworld { color: var(--fg); display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 12px; align-items: start; }
  #pinworld .pw-bar { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  #pinworld h2 { margin: 0 8px 0 0; font-size: 18px; } #pinworld h2 small { font-weight: 500; color: var(--muted); font-size: 12.5px; margin-left: 6px; }
  #pinworld input[type=search] { flex: 1 1 220px; min-width: 160px; padding: 8px 11px; border: 1px solid var(--line); border-radius: 9px; background: var(--surface); color: var(--fg); font: 14px inherit; }
  #pinworld select { padding: 7px 9px; border: 1px solid var(--line); border-radius: 9px; background: var(--surface); color: var(--fg); font: 13px inherit; }
  #pinworld .pw-seg { display: inline-flex; border: 1px solid var(--line); border-radius: 9px; overflow: hidden; }
  #pinworld .pw-seg button { padding: 7px 11px; border: 0; background: var(--surface); color: var(--muted); font: 600 13px inherit; cursor: pointer; }
  #pinworld .pw-seg button[aria-pressed=true] { background: var(--accent); color: var(--accent-fg, #fff); }
  #pinworld .pw-count { color: var(--muted); font-size: 12.5px; margin-left: auto; }
  #pinworld .pw-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(128px, 1fr)); gap: 8px; }
  #pinworld .pw-card { display: grid; grid-template-rows: 96px auto; gap: 4px; padding: 6px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); color: var(--fg); text-align: center; cursor: pointer; font: 11.5px/1.25 inherit; position: relative; }
  #pinworld .pw-card:hover, #pinworld .pw-card[aria-pressed=true] { border-color: var(--accent); }
  #pinworld .pw-card .im { display: grid; place-items: center; background: #fff; border-radius: 7px; overflow: hidden; }
  #pinworld .pw-card img { max-width: 100%; max-height: 96px; object-fit: contain; }
  #pinworld .pw-card span { overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; word-break: break-word; }
  #pinworld .pw-card i { position: absolute; top: 8px; left: 8px; padding: 1px 5px; border-radius: 5px; background: rgba(0,0,0,.55); color: #fff; font: 700 10px inherit; font-style: normal; }
  #pinworld .pw-more { grid-column: 1 / -1; padding: 9px; border: 1px dashed var(--line); border-radius: 10px; background: none; color: var(--fg); font-weight: 600; cursor: pointer; }
  #pinworld .pw-side { position: sticky; top: 8px; padding: 12px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface); display: grid; gap: 8px; max-height: calc(100vh - 20px); overflow: auto; }
  #pinworld .pw-pv { display: grid; place-items: center; min-height: 200px; background: #fff; border-radius: 8px; padding: 8px; color: #222; } #pinworld .pw-pv img, #pinworld .pw-pv svg { max-width: 100%; max-height: 280px; }
  #pinworld .pw-two { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; } #pinworld .pw-two .pw-pv { min-height: 110px; } #pinworld .pw-two img { max-height: 120px; }
  #pinworld .pw-side h3 { margin: 0; font-size: 14.5px; word-break: break-word; } #pinworld .mut { color: var(--muted); font-size: 12px; word-break: break-word; }
  #pinworld .pw-act { display: flex; flex-wrap: wrap; gap: 6px; } #pinworld .pw-act button, #pinworld .pw-act a { padding: 6px 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface2, var(--surface)); color: var(--fg); font: 600 12.5px inherit; cursor: pointer; text-decoration: none; }
  #pinworld .pw-act .pri { background: var(--accent); color: var(--accent-fg, #fff); border-color: var(--accent); } #pinworld .pw-act button:disabled { opacity: .45; cursor: default; }
  #pinworld .pw-warn { padding: 7px 9px; border-radius: 8px; background: rgba(255,170,0,.14); border: 1px solid rgba(255,170,0,.55); font-size: 12px; line-height: 1.45; } #pinworld .pw-bad { background: rgba(255,60,60,.14); border-color: rgba(255,60,60,.6); }
  #pinworld table { width: 100%; border-collapse: collapse; font-size: 12px; } #pinworld td, #pinworld th { padding: 2px 5px; border-bottom: 1px solid var(--line); text-align: left; } #pinworld td.c { text-align: right; color: var(--muted); }
  #pinworld .pw-foot { grid-column: 1 / -1; color: var(--muted); font-size: 12px; line-height: 1.5; }
  @media (max-width: 900px) { #pinworld { grid-template-columns: 1fr; } #pinworld .pw-side { position: static; max-height: none; } }`;
  const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  const S = { parts: null, mode: "store", view: "breadboard", mount: "tht", src: "", q: "", shown: PAGE, sel: null, prev: null, busy: false };
  const enc = p => p.split("/").map(encodeURIComponent).join("/");
  const BASE = "https://cdn.jsdelivr.net/gh/fritzing/fritzing-parts@develop/";
  const imgUrl = (p, view) => BASE + "svg/" + p[1] + "/" + enc(view === "pcb" ? p[3] : p[4]);
  const ghUrl = p => "https://github.com/fritzing/fritzing-parts/blob/develop/" + enc(p[1] + "/" + p[2]);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "part";
  const hash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h.toString(36).slice(0, 6); };

  /* ---------- kho "Linh kiện của tôi" (trong trình duyệt) ---------- */
  const mine = {
    get() { try { const o = JSON.parse(localStorage.getItem(KEY) || "null"); return o && o.parts ? o : { version: 1, parts: {} }; } catch (e) { return { version: 1, parts: {} }; } },
    put(o) { try { localStorage.setItem(KEY, JSON.stringify(o)); return true; } catch (e) { return false; } },
    count() { return Object.keys(this.get().parts).length; }
  };

  /* ---------- đọc linh kiện Fritzing: .fzp + SVG PCB ---------- */
  function sanitize(root) {   // SVG của người khác: bỏ script, foreignObject, sự kiện, liên kết ra ngoài
    root.querySelectorAll("script,foreignObject,iframe,object,embed,audio,video").forEach(e => e.remove());
    root.querySelectorAll("*").forEach(e => { for (const a of [...e.attributes]) { const n = a.name.toLowerCase(), v = a.value.trim().toLowerCase(); if (n.startsWith("on") || ((n === "href" || n === "xlink:href") && !v.startsWith("#") && !v.startsWith("data:image/"))) e.removeAttribute(a.name); } });
  }
  function mm(v, dpi) {
    const m = String(v || "").match(/^([\d.]+)\s*([a-z%]*)$/i); if (!m) return null; const n = +m[1];
    switch (m[2].toLowerCase()) { case "in": return n * 25.4; case "mm": return n; case "cm": return n * 10; case "pt": return n * 25.4 / 72; case "pc": return n * 25.4 / 6; case "": case "px": return n / dpi * 25.4; default: return null; }
  }
  // đoán vai trò chân theo tên: [vai trò, độ tin cậy]. Vai trò theo PCB Maker: g GND, d SDA, c SCL, k SCK, m MOSI, s tín hiệu GPIO, n không tự nối. VCC/VDD không tự nối (3,3 V hay 5 V chưa biết)
  function guess(name, desc) {
    const n = name.trim().toUpperCase().replace(/[^A-Z0-9]/g, ""), d = (desc || "").trim().toLowerCase();
    if (/^(GND|AGND|DGND|PGND|VSS|GROUND|0V|COM)$/.test(n) || d === "ground") return ["g", .95];
    if (/^(SDA|I2CSDA)$/.test(n)) return ["d", .85];
    if (/^(SCL|I2CSCL)$/.test(n)) return ["c", .85];
    if (/^(SCK|SCLK|CLK)$/.test(n)) return ["k", .6];
    if (/^(MOSI|DIN)$/.test(n)) return ["m", .6];
    if (/^(DATA|SIG|SIGNAL|OUT|PWM|INT|TRIG|TRIGGER|CS|EN)$/.test(n)) return ["s", .55];
    if (/^(VCC|VDD|VIN|V|5V|3V3|33V|VBAT|VPLUS)$/.test(n)) return ["n", .3];
    return ["n", 0];
  }
  async function build(p) {
    const txt = async u => { const r = await fetch(u); if (!r.ok) throw new Error(u.split("/").pop() + " (" + r.status + ")"); return r.text(); };
    const [fzpT, pcbT, bbT] = await Promise.all([txt(BASE + enc(p[1] + "/" + p[2])), txt(BASE + "svg/" + p[1] + "/" + enc(p[3])), txt(BASE + "svg/" + p[1] + "/" + enc(p[4])).catch(() => "")]);
    const fz = new DOMParser().parseFromString(fzpT, "application/xml");
    if (fz.querySelector("parsererror")) throw new Error(L("File .fzp không đọc được.", "The .fzp file cannot be read."));
    const conns = [...fz.querySelectorAll("connectors > connector")].map(c => {
      const ps = [...c.querySelectorAll("views > pcbView > p")], p0 = ps.find(q => q.getAttribute("layer") === "copper0") || ps[0];
      return { id: c.getAttribute("id") || "", name: (c.getAttribute("name") || c.getAttribute("id") || "?").replace(/[\u0000-\u001f]/g, "").slice(0, 16), desc: (c.querySelector("description") || {}).textContent || "", svgId: p0 ? p0.getAttribute("svgId") : null, bbId: (c.querySelector("views > breadboardView > p") || { getAttribute: () => null }).getAttribute("svgId"), tht: ps.some(q => q.getAttribute("layer") === "copper0") };
    }).sort((a, b) => (parseInt(a.id.replace(/\D/g, "")) || 0) - (parseInt(b.id.replace(/\D/g, "")) || 0));
    const doc = new DOMParser().parseFromString(pcbT, "image/svg+xml"), root = doc.documentElement;
    if (root.nodeName.toLowerCase() !== "svg" || doc.querySelector("parsererror")) throw new Error(L("SVG PCB không đọc được.", "The PCB SVG cannot be read."));
    sanitize(root);
    const dpi = /Adobe Illustrator/i.test(pcbT) ? 72 : 90, vb = (root.getAttribute("viewBox") || "").trim().split(/[\s,]+/).map(Number);
    let W = mm(root.getAttribute("width"), dpi), H = mm(root.getAttribute("height"), dpi);
    if (!(W > 0 && H > 0)) { if (vb.length === 4 && vb[2] > 0 && vb[3] > 0) { W = vb[2] / dpi * 25.4; H = vb[3] / dpi * 25.4; } else throw new Error(L("SVG PCB không có kích thước.", "The PCB SVG has no size.")); }
    root.setAttribute("width", W + "mm"); root.setAttribute("height", H + "mm");
    // đo vị trí chân bằng cách dựng SVG ẩn trong trang (xử lý luôn viewBox và phép biến đổi)
    const host = document.createElement("div"); host.style.cssText = "position:fixed;left:-99999px;top:0;visibility:hidden;pointer-events:none"; host.appendChild(document.importNode(root, true)); document.body.appendChild(host);
    const svg = host.firstElementChild, base = svg.getBoundingClientRect(), k = 96 / 25.4, byId = {}; svg.querySelectorAll("[id]").forEach(e => { byId[e.id] = e; });
    const pads = [], missing = [];
    for (const c of conns) {
      const e = c.svgId && byId[c.svgId]; if (!e) { missing.push(c.name); continue; }
      const r = e.getBoundingClientRect(); pads.push({ name: c.name, desc: c.desc, x: (r.left + r.width / 2 - base.left) / k, y: (r.top + r.height / 2 - base.top) / k, dia: Math.min(r.width, r.height) / k, tht: c.tht });
    }
    // hình ký hiệu (silkscreen) làm hình thân trên bo
    let art = ""; const clone = svg.cloneNode(true); let kept = 0;
    [...clone.children].forEach(ch => { const t = ch.tagName.toLowerCase(); if (t === "defs" || t === "style" || t === "title") return; if ((ch.id || "").startsWith("silkscreen") || ch.querySelector('[id^="silkscreen"]')) kept++; else ch.remove(); });
    if (kept) { clone.setAttribute("xmlns", "http://www.w3.org/2000/svg"); const s = new XMLSerializer().serializeToString(clone); if (s.length < 60000) art = "data:image/svg+xml;utf8," + encodeURIComponent(s); }
    host.remove();
    // khớp hình breadboard (có màu) với chân PCB: chỉ dùng khi sai lệch mọi chân < 0,6 mm
    let bbFit = null, bbm = null;
    if (bbT) try {
      const bd = new DOMParser().parseFromString(bbT, "image/svg+xml"), br = bd.documentElement;
      if (br.nodeName.toLowerCase() === "svg" && !bd.querySelector("parsererror")) {
        sanitize(br); const bdpi = /Adobe Illustrator/i.test(bbT) ? 72 : 90, bvb = (br.getAttribute("viewBox") || "").trim().split(/[\s,]+/).map(Number);
        let BW = mm(br.getAttribute("width"), bdpi), BH = mm(br.getAttribute("height"), bdpi);
        if (!(BW > 0 && BH > 0) && bvb.length === 4) { BW = bvb[2] / bdpi * 25.4; BH = bvb[3] / bdpi * 25.4; }
        if (BW > 0 && BH > 0) {
          br.setAttribute("width", BW + "mm"); br.setAttribute("height", BH + "mm");
          const h2 = document.createElement("div"); h2.style.cssText = host.style.cssText; h2.appendChild(document.importNode(br, true)); document.body.appendChild(h2);
          const s2 = h2.firstElementChild, b2 = s2.getBoundingClientRect(), ids = {}; s2.querySelectorAll("[id]").forEach(e => { ids[e.id] = e; });
          const pairs = [];
          for (const c of conns) { const pp = pads.find(q => q.name === c.name), e = c.bbId && ids[c.bbId]; if (!pp || !e) continue; const r = e.getBoundingClientRect(); pairs.push([(r.left + r.width / 2 - b2.left) / k, (r.top + r.height / 2 - b2.top) / k, pp.x, pp.y]); }
          if (bvb.length === 4 && bvb.every(Number.isFinite) && bvb[2] > 0 && bvb[3] > 0) {   // vị trí MỌI chân trên hình breadboard, theo đơn vị viewBox
            const bp = []; for (const c of conns) { const e = c.bbId && ids[c.bbId]; if (!e) continue; const rr = e.getBoundingClientRect(); bp.push([c.name, Math.round((bvb[0] + (rr.left + rr.width / 2 - b2.left) / k / BW * bvb[2]) * 100) / 100, Math.round((bvb[1] + (rr.top + rr.height / 2 - b2.top) / k / BH * bvb[3]) * 100) / 100]); }
            if (bp.length >= 2 && bp.length <= 300) bbm = { vb: bvb.map(v => Math.round(v * 100) / 100), w: Math.round(BW * 100) / 100, h: Math.round(BH * 100) / 100, pins: bp };
          }
          h2.remove();
          if (pairs.length >= 2 && pairs.length >= pads.length * .8) {
            for (const rot of [0, 90, 180, 270]) {
              const cs = Math.round(Math.cos(rot * Math.PI / 180)), sn = Math.round(Math.sin(rot * Math.PI / 180));
              const V = pairs.map(([u, v, x, y]) => [u * cs - v * sn, u * sn + v * cs, x, y]), n = V.length;
              const mv = [V.reduce((a, q) => a + q[0], 0) / n, V.reduce((a, q) => a + q[1], 0) / n], mp = [V.reduce((a, q) => a + q[2], 0) / n, V.reduce((a, q) => a + q[3], 0) / n];
              let num = 0, den = 0; for (const q of V) { const ax = q[0] - mv[0], ay = q[1] - mv[1]; num += ax * (q[2] - mp[0]) + ay * (q[3] - mp[1]); den += ax * ax + ay * ay; }
              if (!(den > 0)) continue; const sc = num / den; if (!(sc > .5 && sc < 2)) continue;
              const tx = mp[0] - sc * mv[0], ty = mp[1] - sc * mv[1], err = Math.max(...V.map(q => Math.hypot(sc * q[0] + tx - q[2], sc * q[1] + ty - q[3])));
              if (err < .6 && (!bbFit || err < bbFit.err)) bbFit = { err, rot, s: sc, tx, ty, w: BW, h: BH };
            }
          }
        }
      }
    } catch (e) { bbFit = null; }
    let icon = ""; if (bbT) { try { const bd = new DOMParser().parseFromString(bbT, "image/svg+xml"); if (bd.documentElement.nodeName.toLowerCase() === "svg") { sanitize(bd.documentElement); const s = new XMLSerializer().serializeToString(bd.documentElement); if (s.length < 60000) icon = "data:image/svg+xml;utf8," + encodeURIComponent(s); } } catch (e) { } }
    if (!icon) icon = imgUrl(p, "breadboard");
    if (pads.length < 2) throw new Error(L("Không tìm thấy vị trí chân trong SVG PCB.", "Pin positions were not found in the PCB SVG."));
    const x0 = pads[0].x, y0 = pads[0].y, r2 = v => Math.round(v * 100) / 100, warn = [];
    // cảnh báo
    const smd = pads.filter(q => !q.tht).length, small = pads.filter(q => q.dia < 1.6).length;
    let minD = 1e9; for (let i = 0; i < pads.length; i++) for (let j = i + 1; j < pads.length; j++) minD = Math.min(minD, Math.hypot(pads[i].x - pads[j].x, pads[i].y - pads[j].y));
    if (smd) warn.push(L(`${smd} chân là kiểu dán (SMD), PCB Maker chỉ làm chân xuyên lỗ.`, `${smd} pins are SMD; PCB Maker only supports through-hole pins.`));
    if (small) warn.push(L(`${small} chân có pad gốc nhỏ hơn 1,6 mm; PCB Maker dùng pad chuẩn Ø2 mm.`, `${small} pins have an original pad under 1.6 mm; PCB Maker uses the standard Ø2 mm pad.`));
    if (minD < 2.5) warn.push(L(`Hai chân gần nhau nhất cách ${minD.toFixed(2)} mm: dưới 2,5 mm thì pad Ø2 sẽ sát hoặc chạm nhau và khó đi dây giữa các chân.`, `The two closest pins are ${minD.toFixed(2)} mm apart: under 2.5 mm the Ø2 pads touch or nearly touch and routing between pins is hard.`));
    if (missing.length) warn.push(L(`Không tìm thấy vị trí của ${missing.length} chân (${missing.slice(0, 4).join(", ")}…): chân đó bị bỏ.`, `Could not locate ${missing.length} pins (${missing.slice(0, 4).join(", ")}…): they were skipped.`));
    if (W > 150 || H > 150) warn.push(L(`Kích thước bất thường (${W.toFixed(0)} × ${H.toFixed(0)} mm): có thể sai đơn vị trong SVG.`, `Unusual size (${W.toFixed(0)} × ${H.toFixed(0)} mm): the SVG units may be wrong.`));
    if (p[6] === "?") warn.push(L("Chưa xác định được đây là linh kiện xuyên lỗ hay dán.", "Could not tell whether this part is through-hole or SMD."));
    const part = {
      id: slug(p[0]) + "-" + hash(p[1] + "/" + p[2]), title: p[0], src: p[1], fzp: p[2], family: p[7] || "", license: LIC, url: ghUrl(p), verified: false, added: new Date().toISOString(),
      pads: pads.map(q => { const [role, conf] = guess(q.name, q.desc); return { name: q.name, x: r2(q.x - x0), y: r2(q.y - y0), role, conf }; }),
      body: { x: r2(-x0), y: r2(-y0), w: r2(W), h: r2(H) }, art, icon,
      bbm,
      bb: bbFit ? { rot: bbFit.rot, s: Math.round(bbFit.s * 1e4) / 1e4, x: r2(bbFit.tx - x0), y: r2(bbFit.ty - y0), w: r2(bbFit.w), h: r2(bbFit.h) } : null
    };
    return { part, warn, blocked: smd > pads.length / 2 };
  }
  const roleName = r => ({ g: "GND", d: "SDA", c: "SCL", k: "SCK", m: "MOSI", s: L("GPIO trống", "free GPIO"), n: "—" }[r] || "—");
  function previewSvg(pt) {
    const b = pt.body, pad = 4, w = b.w + 2 * pad, h = b.h + 2 * pad;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${b.x - pad} ${b.y - pad} ${w} ${h}" width="100%" style="background:#1e5a3c;border-radius:6px"><rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="none" stroke="#ffd400" stroke-width=".25"/>${pt.art ? `<image href="${pt.art}" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}"/>` : ""}${pt.pads.map((q, i) => `<circle cx="${q.x}" cy="${q.y}" r="1" fill="#d9a84a"${i === 0 ? ' stroke="#fff" stroke-width=".25"' : ""}/><circle cx="${q.x}" cy="${q.y}" r=".5" fill="#232b3a"/><text x="${q.x}" y="${q.y - 1.5}" font-size="1.3" font-weight="700" fill="#fff" text-anchor="middle" font-family="sans-serif">${esc(q.name)}</text>`).join("")}</svg>`;
  }

  /* ---------- giao diện ---------- */
  const filtered = () => {
    const q = S.q.trim().toLowerCase();
    return S.parts.filter(p => (S.mount === "all" || p[6] === S.mount) && (!S.src || p[1] === S.src) && (!q || p[0].toLowerCase().includes(q) || (p[7] || "").toLowerCase().includes(q)));
  };
  function draw() {
    const n = mine.count();
    ROOT.innerHTML = `<div class="pw-bar"><h2>Pinworld<small>${L("kho linh kiện Fritzing (bản thử)", "Fritzing parts library (preview)")}</small></h2>
      <div class="pw-seg" role="group"><button type="button" data-m="store" aria-pressed="${S.mode === "store"}">${L("Kho Fritzing", "Fritzing store")}</button><button type="button" data-m="mine" aria-pressed="${S.mode === "mine"}">${L("Linh kiện của tôi", "My parts")} (${n})</button></div>
      ${S.mode === "store" ? `<input type="search" id="pwQ" placeholder="${L("Tìm linh kiện… (vd: servo, DHT22, LM34)", "Search parts… (e.g. servo, DHT22, LM34)")}" value="${esc(S.q)}">
      <div class="pw-seg" role="group"><button type="button" data-v="breadboard" aria-pressed="${S.view === "breadboard"}">Breadboard</button><button type="button" data-v="pcb" aria-pressed="${S.view === "pcb"}">PCB</button></div>
      <select id="pwMount"><option value="tht"${S.mount === "tht" ? " selected" : ""}>${L("Xuyên lỗ (dùng được cho PCB Maker)", "Through-hole (works in PCB Maker)")}</option><option value="smd"${S.mount === "smd" ? " selected" : ""}>${L("Dán SMD", "SMD")}</option><option value="all"${S.mount === "all" ? " selected" : ""}>${L("Tất cả", "All")}</option></select>
      <select id="pwSrc"><option value="">${L("Chính thức + cộng đồng", "Core + community")}</option><option value="core"${S.src === "core" ? " selected" : ""}>core</option><option value="contrib"${S.src === "contrib" ? " selected" : ""}>contrib</option></select>` : ""}
      <span class="pw-count" id="pwCount"></span></div>
      <div class="pw-grid" id="pwGrid"></div><aside class="pw-side" id="pwSide"></aside>
      <p class="pw-foot">${L("Hình và dữ liệu linh kiện thuộc dự án", "Part graphics and data belong to the")} <a href="https://fritzing.org" target="_blank" rel="noopener">Fritzing</a> (<a href="https://github.com/fritzing/fritzing-parts" target="_blank" rel="noopener">fritzing/fritzing-parts</a>), ${L("theo giấy phép", "licensed under")} <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noopener">CC BY-SA 3.0</a>: ${L("khi dùng lại phải ghi nguồn Fritzing và chia sẻ tác phẩm của bạn theo cùng giấy phép. Một số linh kiện do cộng đồng đóng góp có thể có điều kiện riêng, hãy kiểm tra trên kho gốc. Hình tải trực tiếp từ jsDelivr khi bạn xem; Pindexio không lưu bản sao. Linh kiện bạn thêm chỉ lưu trong trình duyệt này.", "when you reuse them, credit Fritzing and share your work under the same license. Some community-contributed parts may carry their own terms, check the original repository. Images load directly from jsDelivr when you view them; Pindexio keeps no copy. Parts you add are stored only in this browser.")}</p>`;
    ROOT.querySelectorAll("[data-m]").forEach(b => b.onclick = () => { S.mode = b.dataset.m; S.sel = null; S.prev = null; S.shown = PAGE; draw(); });
    if (S.mode === "store") {
      const q = ROOT.querySelector("#pwQ"); q.oninput = () => { S.q = q.value; S.shown = PAGE; const pos = q.selectionStart; grid(); q.focus(); q.setSelectionRange(pos, pos); };
      ROOT.querySelectorAll("[data-v]").forEach(b => b.onclick = () => { S.view = b.dataset.v; draw(); });
      ROOT.querySelector("#pwMount").onchange = e => { S.mount = e.target.value; S.shown = PAGE; draw(); };
      ROOT.querySelector("#pwSrc").onchange = e => { S.src = e.target.value; S.shown = PAGE; draw(); };
    }
    grid(); side();
  }
  function grid() {
    const g = ROOT.querySelector("#pwGrid"), cnt = ROOT.querySelector("#pwCount");
    if (S.mode === "mine") {
      const ps = Object.values(mine.get().parts); cnt.textContent = ps.length + " " + L("linh kiện", "parts");
      g.innerHTML = ps.length ? ps.map(p => `<button type="button" class="pw-card" data-id="${esc(p.id)}" aria-pressed="${!!S.sel && S.sel.id === p.id}" title="${esc(p.title)}"><div class="im"><img alt="" src="${esc(p.icon)}"></div><span>${esc(p.title)}</span>${p.verified ? "" : `<i>${L("chưa kiểm", "unchecked")}</i>`}</button>`).join("")
        : `<p class="mut" style="grid-column:1/-1">${L("Chưa có linh kiện nào. Sang tab Kho Fritzing, chọn một linh kiện xuyên lỗ rồi bấm Xem chân và thêm.", "No parts yet. Go to the Fritzing store, pick a through-hole part and click Check pins and add.")}</p>`;
      g.querySelectorAll(".pw-card").forEach(b => b.onclick = () => { S.sel = mine.get().parts[b.dataset.id]; S.prev = null; grid(); side(); });
      return;
    }
    const list = filtered(); cnt.textContent = list.length + " " + L("kết quả", "results");
    g.innerHTML = list.slice(0, S.shown).map((p, i) => `<button type="button" class="pw-card" data-i="${i}" aria-pressed="${S.sel === p}" title="${esc(p[0])}"><div class="im"><img decoding="async" alt="" src="${imgUrl(p, S.view)}"></div><span>${esc(p[0])}</span>${p[6] === "smd" ? "<i>SMD</i>" : ""}</button>`).join("")
      + (list.length > S.shown ? `<button type="button" class="pw-more" id="pwMore">${L("Xem thêm", "Show more")} (${list.length - S.shown})</button>` : "");
    g.querySelectorAll(".pw-card").forEach(b => b.onclick = () => { S.sel = list[+b.dataset.i]; S.prev = null; grid(); side(); });
    const more = g.querySelector("#pwMore"); if (more) more.onclick = () => { S.shown += PAGE; grid(); };
  }
  function side() {
    const box = ROOT.querySelector("#pwSide"), it = S.sel;
    if (!it) { box.innerHTML = `<p class="mut">${L("Bấm một linh kiện để xem lớn, xem chân và thêm vào linh kiện của bạn.", "Click a part to enlarge it, check its pins and add it to your parts.")}</p>`; return; }
    if (S.mode === "mine") return sideMine(box, it);
    const p = it, can = p[6] !== "smd";
    box.innerHTML = `<div class="pw-two"><div class="pw-pv"><img alt="" src="${imgUrl(p, "breadboard")}"></div><div class="pw-pv"><img alt="" src="${imgUrl(p, "pcb")}"></div></div>
      <h3>${esc(p[0])}</h3><div class="mut">${p[1]} · ${p[5]} ${L("chân", "pins")} · ${p[6] === "tht" ? L("xuyên lỗ", "through-hole") : p[6] === "smd" ? "SMD" : "?"}${p[7] ? " · " + esc(p[7]) : ""}</div>
      ${can ? "" : `<div class="pw-warn pw-bad">${L("Linh kiện dán (SMD): PCB Maker chỉ làm chân xuyên lỗ nên không thêm được.", "SMD part: PCB Maker only supports through-hole pins, so it cannot be added.")}</div>`}
      <div class="pw-act"><button type="button" class="pri" id="pwPrev"${can ? "" : " disabled"}>${L("Xem chân và thêm…", "Check pins and add…")}</button><a href="${ghUrl(p)}" target="_blank" rel="noopener">GitHub</a></div><div id="pwPv"></div>`;
    const pv = box.querySelector("#pwPv");
    box.querySelector("#pwPrev").onclick = async () => {
      if (S.busy) return; S.busy = true; pv.innerHTML = `<p class="mut">${L("Đang đọc linh kiện…", "Reading the part…")}</p>`;
      try { S.prev = await build(p); showPrev(pv); } catch (e) { pv.innerHTML = `<div class="pw-warn pw-bad">${esc(e.message)}</div>`; } finally { S.busy = false; }
    };
    if (S.prev && S.prev.part.fzp === p[2]) showPrev(pv);
  }
  function showPrev(pv) {
    const { part, warn, blocked } = S.prev, auto = part.pads.filter(q => q.conf >= .5 && q.role !== "n").length, saved = !!mine.get().parts[part.id];
    pv.innerHTML = `<div class="pw-pv">${previewSvg(part)}</div>
      ${warn.map(w => `<div class="pw-warn">⚠ ${esc(w)}</div>`).join("")}
      <p class="mut">${L(`Chân tự đoán vai trò (tin cậy từ 50%): ${auto}/${part.pads.length}. Những chân này sẽ được tô màu và hỏi xác nhận trong PCB Maker. Chân nguồn VCC không tự nối.`, `Pins with a guessed role (50%+ confidence): ${auto}/${part.pads.length}. They will be highlighted and need your confirmation in PCB Maker. VCC power pins are never auto-wired.`)}</p>
      <table><tr><th>${L("Chân", "Pin")}</th><th>${L("Đoán là", "Guess")}</th><th class="c">%</th></tr>${part.pads.map(q => `<tr><td>${esc(q.name)}</td><td>${roleName(q.role)}</td><td class="c">${q.role === "n" ? "" : Math.round(q.conf * 100)}</td></tr>`).join("")}</table>
      <div class="pw-act"><button type="button" class="pri" id="pwSave"${blocked ? " disabled" : ""}>${saved ? L("Lưu lại (đã có)", "Save again (exists)") : L("Thêm vào linh kiện của tôi", "Add to my parts")}</button></div><div id="pwOk"></div>`;
    pv.querySelector("#pwSave").onclick = () => {
      const o = mine.get(); if (Object.keys(o.parts).length >= 60 && !o.parts[part.id]) { pv.querySelector("#pwOk").innerHTML = `<div class="pw-warn pw-bad">${L("Tối đa 60 linh kiện. Xoá bớt ở tab Linh kiện của tôi.", "Up to 60 parts. Remove some in My parts.")}</div>`; return; }
      const prev = o.parts[part.id]; o.parts[part.id] = { ...part, verified: prev ? prev.verified : false };
      if (mine.put(o) && window.APP && APP.regMine) APP.regMine();
      else if (!mine.put(o)) { pv.querySelector("#pwOk").innerHTML = `<div class="pw-warn pw-bad">${L("Không lưu được (bộ nhớ trình duyệt đầy hoặc bị chặn).", "Could not save (browser storage full or blocked).")}</div>`; return; }
      pv.querySelector("#pwOk").innerHTML = `<div class="pw-warn">✓ ${L("Đã lưu. Mở PCB Maker, mục Linh kiện của tôi, để đặt vào bo. Linh kiện đang ở trạng thái chưa kiểm: hãy đối chiếu với datasheet và đo lại bằng Thước.", "Saved. Open PCB Maker, section My parts, to place it. The part is marked unchecked: compare it with the datasheet and re-measure with the Ruler.")}</div>`;
      ROOT.querySelector(".pw-seg [data-m=mine]").textContent = L("Linh kiện của tôi", "My parts") + " (" + mine.count() + ")";
    };
  }
  function sideMine(box, p) {
    box.innerHTML = `<div class="pw-pv">${previewSvg(p)}</div><h3>${esc(p.title)}</h3><div class="mut">${p.src} · ${p.pads.length} ${L("chân", "pins")} · ${p.license} · <a href="${esc(p.url)}" target="_blank" rel="noopener">${L("nguồn", "source")}</a></div>
      <div class="pw-warn">${p.verified ? "✓ " + L("Bạn đã đánh dấu là đã kiểm.", "You marked this part as checked.") : "⚠ " + L("Chưa kiểm: đối chiếu chân với datasheet và đo lại bằng Thước trong PCB Maker.", "Unchecked: compare the pins with the datasheet and re-measure with the Ruler in PCB Maker.")}</div>
      <div class="pw-act"><button type="button" id="pwVer">${p.verified ? L("Bỏ đánh dấu đã kiểm", "Unmark as checked") : L("Đánh dấu đã kiểm", "Mark as checked")}</button><button type="button" id="pwDel">${L("Xoá khỏi danh sách", "Remove")}</button></div>`;
    box.querySelector("#pwVer").onclick = () => { const o = mine.get(); if (o.parts[p.id]) { o.parts[p.id].verified = !o.parts[p.id].verified; mine.put(o); S.sel = o.parts[p.id]; draw(); } };
    box.querySelector("#pwDel").onclick = () => { const o = mine.get(); delete o.parts[p.id]; mine.put(o); S.sel = null; draw(); };
  }

  window.PINWORLD = {
    guess, build, mine,
    async open() {
      if (S.parts) return draw();
      ROOT.innerHTML = `<p>${L("Đang tải danh sách linh kiện…", "Loading the parts list…")}</p>`;
      try { S.parts = (await (await fetch("data/fritzing-parts.json")).json()).parts; draw(); }
      catch (e) { ROOT.innerHTML = `<p>${L("Không tải được danh sách linh kiện. Thử tải lại trang.", "Could not load the parts list. Try reloading the page.")}</p>`; }
    }
  };
})();
