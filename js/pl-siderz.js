/* Kéo mép bảng Properties (.pl-side, mép trái) và cột Linh kiện (.pl-list, mép phải) để co / giãn bề rộng.
   Nhớ bề rộng trong localStorage "pl-side-w" / "pl-list-w". Đúp vào thanh kéo: về mặc định. Chỉ màn ≥ 1100px. */
(function () {
  const KS = "pl-side-w", KL = "pl-list-w", LIM = { side: [200, 560], list: [170, 520] };
  const rd = k => { try { return +localStorage.getItem(k) || 0; } catch (e) { return 0; } };
  const W = { side: rd(KS), list: rd(KL) };
  function cols(root) {   // vị trí các cột theo grid-template-areas hiện tại
    root.style.gridTemplateColumns = "";
    const cs = getComputedStyle(root), row = (cs.gridTemplateAreas.match(/"([^"]+)"/g) || [])[1];
    if (!row) return null;
    const a = row.replace(/"/g, "").trim().split(/\s+/), c = cs.gridTemplateColumns.split(/\s+/);
    return { a, c, si: a.indexOf("side"), li: a.indexOf("list"), st: a.indexOf("stage") };
  }
  function apply(root) {
    if (innerWidth < 1100 || (!W.side && !W.list)) { root.style.gridTemplateColumns = ""; return; }
    const k = cols(root); if (!k) return;
    const c = k.c.slice();
    if (W.side && k.si >= 0) c[k.si] = W.side + "px";
    if (W.list && k.li >= 0) c[k.li] = W.list + "px";
    if (k.st >= 0) c[k.st] = "minmax(0, 1fr)";
    root.style.gridTemplateColumns = c.join(" ");
  }
  function place(root, el, h, which) {
    if (innerWidth < 1100 || !el.getClientRects().length) { h.style.display = "none"; return; }
    const flip = root.classList.contains("lay-flip");
    const atLeft = which === "side" ? !flip : flip;   // thanh kéo nằm ở mép trái của phần tử?
    h.style.display = ""; h.style.top = el.offsetTop + "px"; h.style.height = el.offsetHeight + "px";
    h.style.left = (atLeft ? el.offsetLeft - 5 : el.offsetLeft + el.offsetWidth - 3) + "px";
  }
  function init() {
    const root = document.querySelector(".pcblab"), side = root && root.querySelector(".pl-side"), list = root && root.querySelector(".pl-list");
    if (!side || !list) return setTimeout(init, 500);
    if (getComputedStyle(root).position === "static") root.style.position = "relative";
    const items = [["side", side, KS], ["list", list, KL]], hs = [];
    const re = () => { apply(root); hs.forEach(x => place(root, x.el, x.h, x.which)); };
    for (const [which, el, key] of items) {
      const h = document.createElement("div"); h.className = "pl-side-rz"; h.title = "Kéo để co / giãn (đúp: mặc định)"; root.appendChild(h);
      hs.push({ which, el, h });
      new ResizeObserver(() => place(root, el, h, which)).observe(el);
      h.onpointerdown = e => {
        e.preventDefault(); try { h.setPointerCapture(e.pointerId); } catch (_) { } h.classList.add("on");
        const x0 = e.clientX, w0 = el.offsetWidth, flip = root.classList.contains("lay-flip"), dir = (which === "side") !== flip ? -1 : 1;
        h.onpointermove = ev => { W[which] = Math.round(Math.max(LIM[which][0], Math.min(LIM[which][1], w0 + dir * (ev.clientX - x0)))); re(); };
        h.onpointerup = () => { h.onpointermove = h.onpointerup = null; h.classList.remove("on"); try { localStorage.setItem(key, W[which]); } catch (e) { } dispatchEvent(new Event("resize")); };
      };
      h.ondblclick = () => { W[which] = 0; try { localStorage.removeItem(key); } catch (e) { } re(); dispatchEvent(new Event("resize")); };
    }
    new MutationObserver(re).observe(root, { attributes: true, attributeFilter: ["class"] });
    addEventListener("resize", re);
    re();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
