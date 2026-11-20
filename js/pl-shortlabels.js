/* Nhãn ngắn dưới icon cho thanh công cụ ngang (chỉ ngoại hình; không đổi chức năng).
   Bỏ dòng <script> trong index.html để về như cũ. */
(function () {
  const M = {
    plUndo: ["Hoàn", "Undo"], plRedo: ["Làm lại", "Redo"], plFlip: ["Lật", "Flip"], plRats: ["Dây bay", "Ratsnest"], plRatEdit: ["Edit", "Edit"],
    plSnap: ["Snap", "Snap"], plWidth: ["Rộng", "Width"], plZin: ["Phóng", "Zoom +"], plZout: ["Thu", "Zoom −"], plFit: ["Vừa", "Fit"],
    plArr: ["Xếp", "Arrange"], plFitBoard: ["Co bo", "Fit bd"], plReset: ["Mới", "Reset"], plTms: ["Thước", "Ruler"], plTcs: ["Dim", "Dim"],
    plCheck: ["Kiểm", "Check"], plFull: ["Tràn", "Full"], plLay: ["Bố cục", "Layout"], plLayFlip: ["Đổi bên", "Swap"]
  };
  function run() {
    const bar = document.querySelector(".pl-bar"); if (!bar) return;
    const en = document.documentElement.lang === "en";
    for (const id in M) {
      const b = bar.querySelector("#" + id); if (!b) continue;
      let s = b.querySelector(":scope > span.sl"); const t = M[id][en ? 1 : 0];
      if (!s) { s = document.createElement("span"); s.className = "sl"; b.appendChild(s); }
      if (s.textContent !== t) s.textContent = t;
    }
  }
  function init() {
    const bar = document.querySelector(".pl-bar"); if (!bar) return setTimeout(init, 500);
    run(); new MutationObserver(run).observe(bar, { childList: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
