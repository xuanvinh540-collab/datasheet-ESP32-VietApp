/* Trang chủ Pindexio: giới thiệu dự án + tab Tin tức / Hướng dẫn. Mở khi bấm logo (chưa phải trang mặc định).
   Bài viết nằm trong js/posts.js, sửa bằng trang admin. */
(function () {
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const en = () => document.documentElement.lang === "en";
  let tab = "news";

  // Markdown rút gọn, luôn thoát HTML trước nên nội dung bài không chèn được mã lạ
  function md(src, resolve) {
    const safeUrl = u => /^(https?:\/\/|#|\/)/i.test(u) || /^[\w.-][\w./%-]*$/.test(u) ? u : "#";   // chặn javascript: và các scheme lạ
    const img = u => esc(resolve ? resolve(u) : u);
    const inline = t => esc(t)
      .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (m, a, u) => `<img src="${img(safeUrl(u.replace(/&amp;/g, "&")))}" alt="${a}" loading="lazy">`)
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, a, u) => { const h = safeUrl(u.replace(/&amp;/g, "&")); return `<a href="${esc(h)}"${h.startsWith("#") ? "" : ' target="_blank" rel="noopener"'}>${a}</a>`; })
      .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
      .replace(/(^|[\s(])_([^_]+)_(?=[\s.,;:)!?]|$)/g, "$1<i>$2</i>")
      .replace(/`([^`]+)`/g, "<code>$1</code>");
    const out = [], lines = String(src || "").replace(/\r/g, "").split("\n");
    let para = [], list = null;
    const flush = () => { if (para.length) { out.push("<p>" + inline(para.join(" ")) + "</p>"); para = []; } if (list) { out.push(`<${list.t}>` + list.items.map(x => "<li>" + x + "</li>").join("") + `</${list.t}>`); list = null; } };
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i], t = l.trim();
      if (t.startsWith("```")) { flush(); const code = []; while (++i < lines.length && !lines[i].trim().startsWith("```")) code.push(lines[i]); out.push("<pre class=\"code\">" + esc(code.join("\n")) + "</pre>"); continue; }
      if (!t) { flush(); continue; }
      const hm = t.match(/^(#{1,3})\s+(.*)$/); if (hm) { flush(); const n = hm[1].length + 1; out.push(`<h${n}>${inline(hm[2])}</h${n}>`); continue; }
      const ul = l.match(/^(\s*)[-*]\s+(.*)$/), ol = l.match(/^(\s*)\d+\.\s+(.*)$/);
      if (ul || ol) {
        const kind = ol ? "ol" : "ul", m = ul || ol, nested = m[1].length >= 2 && list;
        if (para.length) { out.push("<p>" + inline(para.join(" ")) + "</p>"); para = []; }
        if (nested) {   // mục con (thụt 2 dấu cách trở lên) gắn vào mục ngay trên, gộp các mục con liền nhau
          const last = list.items.length - 1;
          list.items[last] = (list.items[last] + `<ul><li>${inline(m[2])}</li></ul>`).replace("</ul><ul>", "");
          continue;
        }
        if (!list || list.t !== kind) { flush(); list = { t: kind, items: [] }; }
        list.items.push(inline(m[2])); continue;
      }
      if (list && /^\s{2,}/.test(l)) { list.items[list.items.length - 1] += " " + inline(t); continue; }
      if (list) flush();
      para.push(t);
    }
    flush();
    return out.join("\n");
  }

  const fmtDate = d => { const m = String(d || "").match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? (en() ? `${m[1]}-${m[2]}-${m[3]}` : `${m[3]}/${m[2]}/${m[1]}`) : esc(d || ""); };
  const posts = () => (window.POSTS || []).slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const TYPE = { news: ["Tin tức", "News"], guide: ["Hướng dẫn", "Guides"] };

  function setUrl(id) {
    const want = location.pathname + location.search + "#home" + (id ? "/" + encodeURIComponent(id) : "");
    if (location.pathname + location.search + location.hash !== want) history.replaceState(null, "", want);
  }

  function render(postId) {
    const box = document.getElementById("home"), E = en(); if (!box) return;
    const p = postId && (window.POSTS || []).find(x => x.id === postId);
    setUrl(p ? p.id : null);
    if (p) {
      box.innerHTML = `<article class="card post-view"><button class="post-back" data-back>← ${E ? "Home" : "Trang chủ"}</button>
        <div class="post-meta">${esc(TYPE[p.type] ? TYPE[p.type][E ? 1 : 0] : p.type)} · ${fmtDate(p.date)}</div>
        <h1>${esc(p.title)}</h1>${p.summary ? `<p class="post-lead">${esc(p.summary)}</p>` : ""}<div class="post-body">${md(p.body)}</div></article>`;
      scrollTo(0, 0); return;
    }
    const nB = (window.BOARDS || []).length, nM = Object.keys(window.MODULES || {}).length;
    const feats = [
      ["📌", E ? "Pin by pin" : "Từng chân một", E ? `${nB} boards: functions, warnings, electrical limits and companion parts for every pin.` : `${nB} board: chức năng, cảnh báo, giới hạn điện và linh kiện đi kèm cho từng chân.`],
      ["🧩", E ? "Component pinouts" : "Sơ đồ chân linh kiện", E ? `${nM} common modules with each pin explained.` : `${nM} module phổ biến, có giải thích từng chân.`],
      ["⚡", "Wiring", E ? "Drop parts onto a board, auto-pick safe pins, get the #define lines." : "Thả linh kiện lên board, tự chọn chân an toàn, lấy sẵn các dòng #define."],
      ["🧮", E ? "Calculators" : "Tính toán", E ? "LED resistor, ADC divider, I2C pull-up, RC timing." : "Điện trở LED, phân áp ADC, pull-up I2C, mạch RC."],
      ["📄", E ? "Official sources" : "Theo datasheet hãng", E ? "Every number links back to the manufacturer document." : "Số liệu dẫn nguồn về tài liệu gốc của hãng."],
      ["🌏", E ? "Vietnamese & English" : "Việt & Anh", E ? "Light and dark modes, installs like an app." : "Chế độ sáng tối, cài như ứng dụng trên điện thoại."]
    ];
    const list = posts().filter(x => x.type === tab);
    box.innerHTML = `<div class="home-wrap">
      <section class="card home-hero"><img src="icon.svg?v=2" alt="" width="96" height="96">
        <div><h1 class="home-wm"><span class="wm-n">PIN</span><span class="wm-c">DEX</span><span class="wm-n">IO</span></h1>
        <p class="home-lead">${E ? "Microcontroller pinouts explained pin by pin, straight from the manufacturers' datasheets." : "Tra cứu sơ đồ chân vi điều khiển bằng tiếng Việt, từng chân một, theo đúng datasheet của hãng."}</p>
        <div class="home-btns"><button class="home-go primary" data-go="pins">${E ? "Open pinouts" : "Mở sơ đồ chân"}</button><button class="home-go" data-go="wiring">⚡ ${E ? "Try Wiring" : "Thử Wiring"}</button></div></div></section>
      <section class="home-feats">${feats.map(([i, t, d]) => `<div class="card home-feat"><span aria-hidden="true">${i}</span><b>${esc(t)}</b><p>${esc(d)}</p></div>`).join("")}</section>
      <section class="card home-posts"><div class="home-ptabs" role="tablist">${Object.entries(TYPE).map(([k, v]) => `<button role="tab" data-pt="${k}" aria-selected="${k === tab}">${v[E ? 1 : 0]}</button>`).join("")}</div>
        <div class="home-plist">${list.length ? list.map(x => `<a class="home-pcard" href="#home/${encodeURIComponent(x.id)}"><span class="post-meta">${fmtDate(x.date)}</span><b>${esc(x.title)}</b><span>${esc(x.summary || "")}</span><span class="home-more">${E ? "Read" : "Đọc tiếp"} →</span></a>`).join("")
          : `<p class="muted">${E ? "No posts yet." : "Chưa có bài viết."}</p>`}</div></section><p class="home-stat" id="homeStat" hidden></p></div>`;
    homeStats(E);
  }

  // top 3 nước có nhiều lượt truy cập: một dòng nhỏ cuối trang chủ, lỗi mạng thì không hiện gì
  let statCache = null;
  async function homeStats(E) {
    const el = document.getElementById("homeStat"); if (!el) return;
    try {
      statCache = statCache || await (await fetch("/api/stats")).json();
      if (!statCache.top || !statCache.top.length) return;
      const lang = E ? "en" : "vi", nm = new Intl.DisplayNames([lang], { type: "region" }), nf = new Intl.NumberFormat(lang);
      el.textContent = (E ? "Visits" : "Lượt truy cập") + " · " + statCache.top.map(([c, n]) => nm.of(c) + " " + nf.format(n)).join(" · ");
      el.hidden = false;
    } catch (e) { }
  }

  document.addEventListener("click", e => {
    const box = document.getElementById("home"); if (!box || !box.contains(e.target)) return;
    const pt = e.target.closest("[data-pt]"); if (pt) { tab = pt.dataset.pt; render(); return; }
    if (e.target.closest("[data-back]")) { render(); return; }
    const go = e.target.closest("[data-go]");
    if (go) { if (go.dataset.go === "wiring") APP.openBuild(); else APP.setTab("pins"); }
  });

  window.mdToHtml = md;
  window.HOME = { render, md };
})();
