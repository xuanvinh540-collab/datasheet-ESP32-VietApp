/* Trang admin: sửa link tiếp thị liên kết ngay trên trang, lưu thẳng vào js/affiliates.js trong
   thư mục dự án. Không cần máy chủ.

   Mở:        thêm ?edit vào cuối đường dẫn, hoặc bấm Ctrl+Shift+E
   Mật khẩu:  mặc định "pindex"
   Đổi mật khẩu: mở Console chạy  await adminHash("mật-khẩu-mới")  rồi dán chuỗi nhận được vào ADMIN_HASH bên dưới
   Lưu:       cần Chrome hoặc Edge (dùng File System Access API). Chọn thư mục datasheet-ESP32-VietApp khi được hỏi.
   Sau khi lưu: commit và push như bình thường thì Cloudflare mới cập nhật trang thật. */
(function () {
  const ADMIN_HASH = "8e1a26a4bfb41c4d539e4ab9ebbb34b0288f08302c820e9ff19092d0da6e6738";
  const FILE = "affiliates.js";
  const sha = async s => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))]
    .map(b => b.toString(16).padStart(2, "0")).join("");
  window.adminHash = sha;

  let rootDir = null, panel = null;

  // Dựng lại nguyên file js/affiliates.js từ dữ liệu đang có trong trang
  function fileText(data) {
    return '/* Link tiếp thị liên kết theo vùng. Sửa bằng trang admin (Ctrl+Shift+E hoặc thêm ?edit vào URL)\n'
      + '   – admin ghi đè nguyên file này, nên đừng thêm code khác vào đây. */\n'
      + "window.AFFILIATE = " + JSON.stringify(data, null, 2) + ";\n";
  }

  async function save(data, status) {
    if (!window.showDirectoryPicker) { status("Lưu trực tiếp cần Chrome hoặc Edge."); return; }
    try {
      let dir = null;
      while (!dir) {
        if (!rootDir) rootDir = await showDirectoryPicker({ mode: "readwrite", id: "pindex" });
        try { dir = await rootDir.getDirectoryHandle("js"); await dir.getFileHandle(FILE); }
        catch {
          rootDir = null; dir = null;
          if (!confirm("Thư mục vừa chọn không có js/" + FILE + ".\nChọn lại thư mục dự án?")) { status("chưa lưu"); return; }
        }
      }
      status("đang lưu…");
      const fh = await dir.getFileHandle(FILE);
      const w = await fh.createWritable();
      await w.write(fileText(data)); await w.close();
      window.AFFILIATE = data;
      if (window.APP) APP.redrawBuy();
      status("đã lưu js/" + FILE + " — nhớ commit & push");
    } catch (e) {
      status(e && e.name === "AbortError" ? "chưa lưu" : "lỗi: " + (e && e.message || e));
    }
  }

  function open() {
    if (panel) return;
    const A = JSON.parse(JSON.stringify(window.AFFILIATE || {}));
    panel = document.createElement("div");
    panel.className = "adm";
    const regions = Object.keys(A);
    panel.innerHTML = `<div class="adm-bar"><b>Admin · link tiếp thị liên kết</b>
        <span class="adm-st">chưa sửa</span>
        <button class="adm-save">Lưu vào file</button><button class="adm-x">Thoát</button></div>
      <div class="adm-body">${regions.map(r => `<section>
        <h3>${esc(A[r].label || r)} <input class="adm-shop" data-r="${r}" value="${esc(A[r].shop || "")}" placeholder="Tên sàn"></h3>
        ${BOARDS.map(b => `<label class="adm-row"><span>${esc(b.name)}</span>
          <input data-r="${r}" data-b="${b.id}" value="${esc((A[r].links || {})[b.id] || "")}" placeholder="https://...">
          <a href="${esc((A[r].links || {})[b.id] || "#")}" target="_blank" rel="noopener nofollow" title="Mở thử">↗</a></label>`).join("")}
      </section>`).join("")}
      <p class="adm-note">Dán link rút gọn của chương trình tiếp thị (ví dụ s.shopee.vn/…). Lưu xong vẫn phải commit và push thì trang thật mới đổi.</p></div>`;
    document.body.appendChild(panel);
    const st = panel.querySelector(".adm-st"), status = s => st.textContent = s;
    panel.addEventListener("input", e => {
      const t = e.target;
      if (t.dataset.b) { (A[t.dataset.r].links = A[t.dataset.r].links || {})[t.dataset.b] = t.value.trim(); }
      else if (t.classList.contains("adm-shop")) A[t.dataset.r].shop = t.value.trim();
      else return;
      const a = t.parentElement.querySelector("a"); if (a) a.href = t.value.trim() || "#";
      status("chưa lưu");
    });
    panel.querySelector(".adm-save").onclick = () => save(A, status);
    panel.querySelector(".adm-x").onclick = () => { panel.remove(); panel = null; };
  }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  async function ask() {
    if (panel) return;
    const pw = prompt("Mật khẩu admin:");
    if (pw == null) return;
    if (await sha(pw) !== ADMIN_HASH) { alert("Sai mật khẩu."); return; }
    open();
  }
  addEventListener("keydown", e => { if (e.ctrlKey && e.shiftKey && (e.key === "E" || e.key === "e")) { e.preventDefault(); ask(); } });
  if (location.search.includes("edit")) ask();
  window.adminOpen = ask;
})();
