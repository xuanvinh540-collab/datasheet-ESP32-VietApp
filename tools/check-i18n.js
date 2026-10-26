/* Kiểm tra song ngữ: liệt kê câu tiếng Việt chưa có bản dịch EN trong js/i18n-data.js.
   Chạy:  node tools/check-i18n.js        (thoát mã 1 nếu còn câu chưa dịch) */
const path = require("path");
const ROOT = path.join(__dirname, "..");
global.window = global;
for (const f of ["boards", "i18n-data", "modules", "learn", "specs"]) require(path.join(ROOT, "js", f + ".js"));
const EN = window.EN_DATA || {};
const out = new Set();
const VI = /[ăâđêôơưàáạảãằắặẳẵầấậẩẫèéẹẻẽềếệểễìíịỉĩòóọỏõồốộổỗờớợởỡùúụủũừứựửữỳýỵỷỹĂÂĐÊÔƠƯ]/;
const add = (s, where) => {
  if (typeof s !== "string") return;
  const k = s.trim();
  if (!k || !VI.test(k) || EN[k]) return;
  out.add(where + " :: " + k);
};
for (const b of window.BOARDS) {
  add(b.summary, "board." + b.id); add(b.note, "board." + b.id); add(b.src, "board." + b.id);
  (b.facts || []).forEach(([k, v]) => { add(k, "fact"); add(v, "fact"); });
  (b.elec || []).forEach(([k, v]) => { add(k, "elec"); if (typeof v === "string") add(v, "elec"); });
  (b.docs || []).forEach(([, l]) => add(l, "doc"));
  for (const h of b.headers) for (const p of h.pins) {
    add(p.warn, "pin." + b.id + "." + p.name);
    (p.fn || []).forEach(f => add(f, "fn." + b.id + "." + p.name));
    (p.notes || []).forEach(n => add(n, "note." + b.id + "." + p.name));
    (p.parts || []).forEach(([k, v]) => { add(k, "part"); add(v, "part"); });
  }
}
for (const [k, d] of Object.entries(window.MODULES || {})) {
  add(d.name, "mod." + k); add(d.short, "mod." + k); add(d.note, "mod." + k); add(d.lib, "mod." + k); add(d.iface, "mod." + k);
}
for (const [k, v] of Object.entries(window.PIN_DOC || {})) { add(v[0], "pindoc." + k); add(v[1], "pindoc." + k); }
for (const [k, L] of Object.entries(window.LEARN || {})) {
  ["title", "def", "how", "ex"].forEach(f => add(L[f], "learn." + k + "." + f));
  ["use", "pro", "con"].forEach(f => (L[f] || []).forEach(x => add(x, "learn." + k + "." + f)));
}
(window.MOD_CATS || []).forEach(([n]) => add(n, "modcat"));
const list = [...out].sort();
console.log(list.length + " câu chưa dịch");
if (process.argv[2]) require("fs").writeFileSync(process.argv[2], list.join("\n"), "utf8");
else list.forEach(x => console.log(x));
process.exit(list.length ? 1 : 0);
