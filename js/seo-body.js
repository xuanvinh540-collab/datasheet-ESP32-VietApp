/* Khối nội dung chữ dưới cùng trang "Sơ đồ chân" (bảng chân + tài liệu hãng + danh sách board).
   Dùng chung cho 2 nơi, nên chỉ sửa ở đây:
   - tools/build-seo.js sinh sẵn vào trang tĩnh để Google đọc được (truyền T = hàm dịch, base = đường dẫn gốc)
   - js/app.js vẽ lại khi người dùng đổi board (i18n.js tự dịch phần chữ sau đó)
   opts: { en, base, T, cat, pins } – T và cat không truyền thì giữ nguyên tiếng Việt / nhãn mặc định. */
(function () {
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  window.seoBody = function (board, opts) {
    const o = opts || {}, en = !!o.en, base = o.base || "";
    const T = o.T || (s => s);
    const BOARDS = window.BOARDS, CATS = window.CATS;
    const catLabel = o.cat || (p => CATS[p.cat].label);

    const links = BOARDS.map(x => {
      const href = base + (en ? "en/" : "") + x.id + "/", cur = board && x.id === board.id;
      return `<li><a href="${href}"${cur ? ' aria-current="page"' : ""}>${esc(T(x.name))}</a> <span class="muted small">${esc(x.chip)}</span></li>`;
    }).join("");
    const nav = `<h3>${en ? "All boards" : "Tất cả board"}</h3><ul class="seo-links">${links}</ul>`;

    // Trang chủ, hoặc trang linh kiện (không có bảng chân tĩnh)
    if (!board || board.mod) {
      if (board) return `<h2>${esc(T(board.name))}</h2><p class="muted">${esc(T(board.summary))}</p>${nav}`;
      const mods = (window.MOD_CATS || []).map(([n, , keys]) =>
        `<li><b>${esc(T(n))}:</b> ${keys.map(k => esc(((window.MODULES || {})[k] || {}).short || k)).join(", ")}</li>`).join("");
      return `<h2>${en ? "Pinout reference for microcontroller boards" : "Tra cứu sơ đồ chân vi điều khiển"}</h2>
<p class="muted">${en ? "Pin functions, warnings, electrical specs and companion parts taken from the manufacturers' datasheets, for ESP32, Raspberry Pi Pico, Raspberry Pi and Arduino boards." : "Chức năng từng chân, cảnh báo, thông số điện và linh kiện đi kèm, lấy từ datasheet của hãng, cho các board ESP32, Raspberry Pi Pico, Raspberry Pi và Arduino."}</p>
${nav}${mods ? `<h3>${en ? "Component pinouts" : "Sơ đồ chân linh kiện"}</h3><ul class="seo-links">${mods}</ul>` : ""}`;
    }

    const pins = o.pins || board.headers.flatMap(h => h.pins.map((p, i) => ({ ...p, hdr: h.sch || h.id, pn: p.pn || i + 1 })));
    const rows = pins.map(p => `<tr><td><b>${esc(p.name)}</b></td><td>${esc(p.hdr)}-${p.pn}</td><td>${p.gpio != null ? p.gpio : "–"}</td><td>${esc(catLabel(p))}</td><td>${esc(p.fn.map(f => T(f)).join(", "))}</td><td>${esc(p.warn ? T(p.warn) : "")}</td></tr>`).join("");
    const facts = board.facts.map(([k, v]) => `<dt>${esc(T(k))}</dt><dd>${esc(T(v))}</dd>`).join("");
    const docs = board.docs.map(([, l, u]) => `<li><a href="${esc(u)}" rel="noopener" target="_blank">${esc(T(l))}</a></li>`).join("");
    const head = en ? `${esc(board.name)} pinout table` : `Bảng chân ${esc(board.name)}`;
    return `<h2>${head}</h2>
<p class="muted">${esc(T(board.summary))}</p><dl class="facts">${facts}</dl>
<div class="tw"><table><thead><tr><th>${en ? "Pin" : "Chân"}</th><th>${en ? "Header" : "Vị trí"}</th><th>GPIO</th><th>${en ? "Type" : "Loại"}</th><th>${en ? "Functions" : "Chức năng"}</th><th>${en ? "Notes" : "Lưu ý"}</th></tr></thead><tbody>${rows}</tbody></table></div>
${docs ? `<h3>${en ? "Manufacturer documents" : "Tài liệu hãng"}</h3><ul class="seo-links">${docs}</ul>` : ""}${nav}`;
  };
})();
