/* Màn cảm ứng / màn hẹp: tay nắm "Menu trên" / "Công cụ vẽ" luôn bám đúng mép ngăn kéo khi ngăn đổi chiều cao
   (trước đây chỉ đo 1 lần lúc mở nên có lúc đè lên hàng nút cuối). Chỉ đặt vị trí, không đổi chức năng.
   Thanh công cụ có thể được dựng lại (đổi ngôn ngữ…) nên mỗi lần đều tìm lại phần tử; kiểm tra 4 lần / giây, chỉ ghi khi giá trị đổi. */
(function () {
  function set(el, prop, v) { if (el && el.style[prop] !== v) el.style[prop] = v; }
  function sync() {
    if (innerWidth >= 1100 && innerHeight > 760) return;
    const root = document.querySelector(".pcblab"); if (!root || !root.getClientRects().length) return;
    const bar = root.querySelector("#plBar"), vbar = root.querySelector("#plVbar"), hT = root.querySelector("#plHdlTop"), hB = root.querySelector("#plHdlBottom");
    if (hT && bar && getComputedStyle(hT).display !== "none") set(hT, "top", (root.classList.contains("open-top") ? bar.offsetHeight : 0) + "px");
    if (hB && vbar && getComputedStyle(hB).display !== "none") set(hB, "bottom", (root.classList.contains("open-bottom") ? 54 + vbar.offsetHeight : 54) + "px");
    // Sketch Route trên màn hẹp: tự thu ngăn menu trên (đang che thanh công cụ Sketch), giới hạn chiều cao thanh theo chỗ trống
    // phía trên ngăn công cụ dưới, thanh dài quá thì tự xếp thành 2 cột (không cuộn nên các menu xổ ra bên trái vẫn thấy).
    const sw = document.querySelector("#swb-toolbar");
    if (sw && sw.classList.contains("open") && innerWidth < 1100) {
      if (!sw.__seen) { sw.__seen = true; root.classList.remove("open-top"); }
      const sr2 = root.querySelector(".pl-stage").getBoundingClientRect(); let lim = sr2.bottom;
      if (hB && hB.getClientRects().length) lim = Math.min(lim, hB.getBoundingClientRect().top);
      const mh = Math.max(160, Math.round(lim - sr2.top - 14)) + "px"; if (sw.style.maxHeight !== mh) sw.style.maxHeight = mh;
    } else if (sw) { sw.__seen = false; if (sw.style.maxHeight) sw.style.maxHeight = ""; }
    // điện thoại / máy tính bảng: bảng Route thành dải ngang, đặt ngay trên dòng gợi ý / thanh ngữ cảnh / tay nắm dưới (cái nào cao nhất)
    const st = root.querySelector(".pl-stage");
    if (st && innerWidth < 1100) {
      const sr = st.getBoundingClientRect(); let top = sr.bottom;
      for (const sel of ["#plHint", "#plCtxBar", "#plHdlBottom"]) {
        const e = root.querySelector(sel); if (!e || !e.getClientRects().length || !e.textContent.trim()) continue;
        const r = e.getBoundingClientRect(); if (r.height && r.top > sr.top + sr.height / 2) top = Math.min(top, r.top);
      }
      const v = Math.max(8, Math.round(sr.bottom - top + 6)) + "px"; if (st.style.getPropertyValue("--plFlyB") !== v) st.style.setProperty("--plFlyB", v);
    }
  }
  // Tự chữa: đang ở Sketch Route (tool = sk) mà thanh công cụ Sketch bị mất lớp 'open' hoặc nằm ngoài khung vẽ (kéo ra ngoài, đổi cỡ cửa sổ…)
  // thì mở lại và đặt về mép phải. Thoát Sketch Route đúng cách (Finish, đổi công cụ, Esc 2 lần) đổi tool nên không bị mở lại.
  function heal() {
    const svg = document.querySelector("#plSvg"), sw = document.querySelector("#swb-toolbar"), st = document.querySelector("#plStage");
    if (!svg || !sw || !st || svg.dataset.tool !== "sk" || !st.getClientRects().length) return;
    if (!sw.classList.contains("open")) sw.classList.add("open");
    const r = sw.getBoundingClientRect(), s2 = st.getBoundingClientRect();
    if (r.width && (r.right < s2.left + 20 || r.left > s2.right - 20 || r.bottom < s2.top + 20 || r.top > s2.bottom - 20)) { sw.style.left = ""; sw.style.right = "6px"; sw.style.top = "6px"; }
  }
  setInterval(heal, 500);
  setInterval(sync, 250);
  addEventListener("resize", sync);
})();
