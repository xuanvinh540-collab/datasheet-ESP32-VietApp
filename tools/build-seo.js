/* Sinh trang tĩnh chuẩn SEO cho từng board (tiếng Việt + tiếng Anh), sitemap.xml, robots.txt.
   Chạy lại mỗi khi sửa dữ liệu board:  node tools/build-seo.js
   index.html là khuôn: phần giữa <!--SEO-->…<!--/SEO--> (head) và <!--SEOBODY-->…<!--/SEOBODY--> (nội dung tĩnh) được thay. */
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, ".."), SITE = "https://pindex.pages.dev/";
global.window = {};
for (const f of ["boards", "i18n-data"]) require(path.join(ROOT, "js", f + ".js"));
const { BOARDS, CATS, EN_DATA } = window;
const CAT_EN = { power: "Power", gnd: "GND", gpio: "GPIO", adc: "Analog", comm: "UART/I2C", usb: "USB", strap: "Strapping ⚠", ban: "Reserved", ctl: "Control", nc: "NC" };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const T = (s, en) => en ? (EN_DATA[s] || s) : s;
const tpl = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const today = new Date().toISOString().slice(0, 10);

function head({ title, desc, url, en, viUrl, enUrl, base, board, img }) {
  const ld = {
    "@context": "https://schema.org", "@type": board ? "TechArticle" : "WebSite",
    headline: title, name: title, description: desc, url, inLanguage: en ? "en" : "vi", image: SITE + img,
    publisher: { "@type": "Organization", name: "Pindex" }, dateModified: today,
    ...(board ? { about: { "@type": "Product", name: board.name, brand: { "@type": "Brand", name: board.vendor }, description: T(board.summary, en) } } : {})
  };
  return `<!--SEO--><title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
${base ? `<base href="${base}">\n` : ""}<link rel="canonical" href="${url}">
<link rel="alternate" hreflang="vi" href="${viUrl}"><link rel="alternate" hreflang="en" href="${enUrl}"><link rel="alternate" hreflang="x-default" href="${viUrl}">
<meta property="og:type" content="${board ? "article" : "website"}"><meta property="og:site_name" content="Pindex">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}"><meta property="og:image" content="${SITE + img}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:locale" content="${en ? "en_US" : "vi_VN"}"><meta name="twitter:card" content="summary_large_image">
<meta name="robots" content="index,follow,max-image-preview:large">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
<script>window.PAGE_BOARD=${JSON.stringify(board ? board.id : null)};window.PAGE_LANG=${JSON.stringify(en ? "en" : "vi")};</script><!--/SEO-->`;
}

function body(board, en, base) {
  const links = BOARDS.map(b => `<li><a href="${en ? "en/" : ""}${b.id}/">${esc(T(b.name, en))}</a> <span class="muted small">${esc(b.chip)}</span></li>`).join("");
  const nav = `<h3>${en ? "All boards" : "Tất cả board"}</h3><ul class="seo-links">${links}</ul>`;
  if (!board) return `<!--SEOBODY--><section class="card spec seo"><h2>${en ? "Pinout reference for microcontroller boards" : "Tra cứu sơ đồ chân vi điều khiển"}</h2>
<p class="muted">${en ? "Pin functions, warnings, electrical specs and companion parts taken from the manufacturers' datasheets, for ESP32, Raspberry Pi Pico, Raspberry Pi and Arduino boards." : "Chức năng từng chân, cảnh báo, thông số điện và linh kiện đi kèm, lấy từ datasheet của hãng, cho các board ESP32, Raspberry Pi Pico, Raspberry Pi và Arduino."}</p>${nav}</section><!--/SEOBODY-->`;
  const pins = board.headers.flatMap(h => h.pins.map((p, i) => ({ ...p, hdr: h.sch || h.id, pn: p.pn || i + 1 })));
  const rows = pins.map(p => `<tr><td><b>${esc(p.name)}</b></td><td>${esc(p.hdr)}-${p.pn}</td><td>${p.gpio != null ? p.gpio : "–"}</td><td>${esc(en ? CAT_EN[p.cat] : CATS[p.cat].label)}</td><td>${esc(p.fn.map(f => T(f, en)).join(", "))}</td><td>${esc(p.warn ? T(p.warn, en) : "")}</td></tr>`).join("");
  const facts = board.facts.map(([k, v]) => `<dt>${esc(T(k, en))}</dt><dd>${esc(T(v, en))}</dd>`).join("");
  const docs = board.docs.map(([, l, u]) => `<li><a href="${esc(u)}" rel="noopener" target="_blank">${esc(T(l, en))}</a></li>`).join("");
  return `<!--SEOBODY--><section class="card spec seo"><h2>${en ? `${esc(board.name)} pinout table` : `Bảng chân ${esc(board.name)}`}</h2>
<p class="muted">${esc(T(board.summary, en))}</p><dl class="facts">${facts}</dl>
<div class="tw"><table><thead><tr><th>${en ? "Pin" : "Chân"}</th><th>${en ? "Header" : "Vị trí"}</th><th>GPIO</th><th>${en ? "Type" : "Loại"}</th><th>${en ? "Functions" : "Chức năng"}</th><th>${en ? "Notes" : "Lưu ý"}</th></tr></thead><tbody>${rows}</tbody></table></div>
<h3>${en ? "Manufacturer documents" : "Tài liệu hãng"}</h3><ul class="seo-links">${docs}</ul>${nav}</section><!--/SEOBODY-->`;
}

function page({ board, en }) {
  const id = board ? board.id + "/" : "";
  const viUrl = SITE + id, enUrl = SITE + "en/" + id, url = en ? enUrl : viUrl;
  const base = (en ? "../" : "") + (board ? "../" : "") || "";
  const name = board ? board.name : "";
  const title = board
    ? (en ? `${name} Pinout – GPIO, ADC, I2C, SPI reference | Pindex` : `Sơ đồ chân ${name} (Pinout) – GPIO, ADC, I2C, SPI | Pindex`)
    : (en ? "Pindex – Microcontroller pinout reference (ESP32, Pico, Arduino, Raspberry Pi)" : "Pindex – Tra cứu sơ đồ chân ESP32, Pico, Arduino, Raspberry Pi");
  const desc = board
    ? (en ? `${name} pinout: every pin's functions, boot/strapping warnings, electrical limits and companion parts from the ${board.vendor} datasheet. ${T(board.summary, true)}`
          : `Sơ đồ chân ${name}: chức năng từng chân, cảnh báo strapping, giới hạn điện và linh kiện đi kèm theo datasheet ${board.vendor}. ${board.summary}`)
    : (en ? "Interactive pinout reference built from manufacturer datasheets: ESP32-C3, ESP32-S3, LilyGO, M5Stack, Raspberry Pi Pico 2 W, Raspberry Pi, Arduino Uno."
          : "Tra cứu sơ đồ chân tương tác theo datasheet hãng: ESP32-C3, ESP32-S3, LilyGO, M5Stack, Raspberry Pi Pico 2 W, Raspberry Pi, Arduino Uno.");
  let html = tpl.replace(/<!--SEO-->[\s\S]*?<!--\/SEO-->/, head({ title, desc: desc.slice(0, 300), url, en, viUrl, enUrl, base, board, img: `og/${board ? board.id : "home"}.png` }))
    .replace(/<!--SEOBODY-->[\s\S]*?<!--\/SEOBODY-->/, body(board, en, base))
    .replace(/<html lang="[a-z]+"/, `<html lang="${en ? "en" : "vi"}"`);
  if (board) html = html.replace('<h1 id="bTitle"></h1>', `<h1 id="bTitle">${esc(name)}</h1>`);
  const out = path.join(ROOT, en ? "en" : "", board ? board.id : "", "index.html");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html);
  return url;
}

const urls = [];
for (const en of [false, true]) { urls.push(page({ board: null, en })); for (const b of BOARDS) urls.push(page({ board: b, en })); }
fs.writeFileSync(path.join(ROOT, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.map(u => { const vi = u.replace(SITE + "en/", SITE), en = vi.replace(SITE, SITE + "en/");
  return `<url><loc>${u}</loc><lastmod>${today}</lastmod><xhtml:link rel="alternate" hreflang="vi" href="${vi}"/><xhtml:link rel="alternate" hreflang="en" href="${en}"/></url>`; }).join("\n")}
</urlset>
`);
fs.writeFileSync(path.join(ROOT, "robots.txt"), `User-agent: *\nAllow: /\nDisallow: /tools/\nSitemap: ${SITE}sitemap.xml\n`);
console.log("Đã sinh", urls.length, "trang + sitemap.xml + robots.txt");
