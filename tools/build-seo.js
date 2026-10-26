/* Sinh trang tĩnh chuẩn SEO cho từng board (tiếng Việt + tiếng Anh), sitemap.xml, robots.txt.
   Chạy lại mỗi khi sửa dữ liệu board:  node tools/build-seo.js
   index.html là khuôn: phần giữa <!--SEO-->…<!--/SEO--> (head) và <!--SEOBODY-->…<!--/SEOBODY--> (nội dung tĩnh) được thay. */
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, ".."), SITE = "https://pindex.pages.dev/";
global.window = {};
for (const f of ["boards", "i18n-data", "modules", "seo-body"]) require(path.join(ROOT, "js", f + ".js"));
const { BOARDS, CATS, EN_DATA } = window;
const CAT_EN = { power: "Power", gnd: "GND", gpio: "GPIO", adc: "Analog", comm: "UART/I2C", usb: "USB", strap: "Strapping ⚠", ban: "Reserved", ctl: "Control", nc: "NC" };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const T = (s, en) => en ? (EN_DATA[s] || s) : s;
// Một số phiên bản cache duy nhất cho mọi file tĩnh: tăng 1 mỗi lần chạy, rồi ghi vào
// index.html (?v=), js/app.js (script tải động) và sw.js (tên cache). Không sửa tay ?v= nữa.
function bumpVersion() {
  const idx = path.join(ROOT, "index.html");
  let html = fs.readFileSync(idx, "utf8");
  const cur = Math.max(0, ...[...html.matchAll(/\?v=(\d+)/g)].map(m => +m[1]));
  const v = cur + 1;
  const sub = (file, re) => {
    const f = path.join(ROOT, file);
    fs.writeFileSync(f, fs.readFileSync(f, "utf8").replace(re, (m, a) => a + v));
  };
  sub("index.html", /((?:css|js)\/[a-z0-9-]+\.(?:css|js)\?v=)\d+/g);
  sub("js/app.js", /(js\/[a-z0-9-]+\.js\?v=)\d+/g);
  sub("sw.js", /(pindex-v)\d+/g);
  console.log("Phiên bản cache →", v);
  return v;
}
bumpVersion();
const tpl = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const today = new Date().toISOString().slice(0, 10);

function head({ title, desc, url, en, viUrl, enUrl, base, board, img }) {
  const ld = {
    "@context": "https://schema.org", "@type": board ? "TechArticle" : "WebSite",
    headline: title, name: title, description: desc, url, inLanguage: en ? "en" : "vi", image: SITE + img,
    publisher: { "@type": "Organization", name: "Pindex" }, dateModified: today,
    ...(board ? { about: { "@type": "Product", name: board.name, brand: { "@type": "Brand", name: board.vendor }, description: T(board.summary, en) } } : {})
  };
  const crumbs = {
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: [{ "@type": "ListItem", position: 1, name: "Pindex", item: SITE + (en ? "en/" : "") },
      ...(board ? [{ "@type": "ListItem", position: 2, name: board.name, item: url }] : [])]
  };
  const list = board ? null : {
    "@context": "https://schema.org", "@type": "ItemList", name: title,
    itemListElement: BOARDS.map((b, i) => ({ "@type": "ListItem", position: i + 1, name: b.name, url: SITE + (en ? "en/" : "") + b.id + "/" }))
  };
  return `<!--SEO--><title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
${base ? `<base href="${base}">\n` : ""}<link rel="canonical" href="${url}">
<link rel="alternate" hreflang="vi" href="${viUrl}"><link rel="alternate" hreflang="en" href="${enUrl}"><link rel="alternate" hreflang="x-default" href="${viUrl}">
<meta property="og:type" content="${board ? "article" : "website"}"><meta property="og:site_name" content="Pindex">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}"><meta property="og:image" content="${SITE + img}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(title)}">
<meta property="og:locale" content="${en ? "en_US" : "vi_VN"}"><meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${SITE + img}">
<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
<script type="application/ld+json">${JSON.stringify(crumbs)}</script>
${list ? `<script type="application/ld+json">${JSON.stringify(list)}</script>\n` : ""}
<script>window.PAGE_BOARD=${JSON.stringify(board ? board.id : null)};window.PAGE_LANG=${JSON.stringify(en ? "en" : "vi")};</script><!--/SEO-->`;
}

function body(board, en, base) {
  // Nội dung do js/seo-body.js dựng – app.js vẽ lại đúng khối này khi đổi board
  const html = window.seoBody(board, {
    en, base: base || "", T: s => T(s, en),
    cat: p => (en ? CAT_EN[p.cat] : CATS[p.cat].label)
  });
  return `<!--SEOBODY--><section class="card spec seo">${html}</section><!--/SEOBODY-->`;
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
    : (en ? "Interactive pinout reference built from manufacturer datasheets: ESP32-C3 DevKitM-1, ESP32-C3 Super Mini, ESP32-S3, LilyGO, Raspberry Pi Pico 2 W, Raspberry Pi, Arduino Uno."
          : "Tra cứu sơ đồ chân tương tác theo datasheet hãng: ESP32-C3 DevKitM-1, ESP32-C3 Super Mini, ESP32-S3, LilyGO, Raspberry Pi Pico 2 W, Raspberry Pi, Arduino Uno.");
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
  const home = u === SITE || u === SITE + "en/";
  return `<url><loc>${u}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>${home ? "1.0" : "0.8"}</priority><xhtml:link rel="alternate" hreflang="vi" href="${vi}"/><xhtml:link rel="alternate" hreflang="en" href="${en}"/></url>`; }).join("\n")}
</urlset>
`);
fs.writeFileSync(path.join(ROOT, "robots.txt"), `User-agent: *\nAllow: /\nDisallow: /tools/\nSitemap: ${SITE}sitemap.xml\n`);
console.log("Đã sinh", urls.length, "trang + sitemap.xml + robots.txt");
