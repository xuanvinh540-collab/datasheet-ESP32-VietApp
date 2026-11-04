# Tạo data/fritzing-parts.json cho tab Pinworld từ các file .fzp của kho fritzing/fritzing-parts (nhánh develop).
# Mỗi linh kiện: tên, nguồn (core / contrib), file fzp, hình PCB, hình Breadboard, số chân, kiểu gắn (tht = xuyên lỗ, smd = dán), họ linh kiện.
# Cách chạy:  python tools/build-fritzing-parts.py     (cần mạng; tải ~2.200 file nhỏ qua jsDelivr, lưu cache ở ../../_cache/fritzing-fzp)
import json, pathlib, sys, urllib.request, urllib.parse, xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor

ROOT = pathlib.Path(__file__).resolve().parent.parent
CACHE = ROOT.parent / "_cache" / "fritzing-fzp"
OUT = ROOT / "data" / "fritzing-parts.json"
CDN = "https://cdn.jsdelivr.net/gh/fritzing/fritzing-parts@develop/"
CACHE.mkdir(parents=True, exist_ok=True)

def get(url, tries=3):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "pindexio-index-builder"}), timeout=30) as r:
                return r.read()
        except Exception as e:
            if i == tries - 1:
                raise
    return b""

tree = json.loads(get("https://api.github.com/repos/fritzing/fritzing-parts/git/trees/develop?recursive=1"))
fzps = [e["path"] for e in tree["tree"] if e["path"].endswith(".fzp") and e["path"].split("/")[0] in ("core", "contrib")]
svgset = {e["path"] for e in tree["tree"] if e["path"].startswith("svg/")}   # chỉ giữ linh kiện có đủ file hình PCB + Breadboard trong kho (nhiều footprint do Fritzing tự sinh khi chạy, không có file)
print(len(fzps), "file fzp,", len(svgset), "file svg")

def fetch(path):
    f = CACHE / (path.replace("/", "__"))
    if not f.exists():
        try:
            f.write_bytes(get(CDN + urllib.parse.quote(path)))
        except Exception as e:
            return path, None
    return path, f.read_bytes()

def img(view):
    if view is None: return ""
    layers = view.find("layers")
    return layers.get("image", "") if layers is not None else ""

parts, bad, nogen = [], 0, 0
with ThreadPoolExecutor(16) as ex:
    for path, data in ex.map(fetch, fzps):
        if not data:
            bad += 1; continue
        try:
            m = ET.fromstring(data)
        except ET.ParseError:
            bad += 1; continue
        title = (m.findtext("title") or path).strip()
        props = {p.get("name", ""): (p.text or "").strip() for p in m.findall("./properties/property")}
        views = m.find("views")
        pcb = views.find("pcbView") if views is not None else None
        bb = views.find("breadboardView") if views is not None else None
        pcb_img, bb_img = img(pcb), img(bb)
        if not pcb_img or not bb_img:
            continue   # thiếu hình PCB hoặc Breadboard: bỏ qua
        conns = m.findall("./connectors/connector")
        tht = smd = 0
        for c in conns:
            layers = {p.get("layer") for p in c.findall("./views/pcbView/p")}
            if "copper0" in layers: tht += 1
            elif "copper1" in layers: smd += 1
        mount = "tht" if tht and tht >= len(conns) * 0.5 else ("smd" if smd else "?")
        src = path.split("/")[0]
        if "svg/%s/%s" % (src, pcb_img) not in svgset or "svg/%s/%s" % (src, bb_img) not in svgset:
            nogen += 1; continue
        parts.append([title, src, path.split("/", 1)[1], pcb_img, bb_img, len(conns), mount, props.get("family", "")])

parts.sort(key=lambda p: p[0].lower())
OUT.parent.mkdir(exist_ok=True)
OUT.write_text(json.dumps({"repo": "fritzing/fritzing-parts", "ref": "develop", "parts": parts}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
n_tht = sum(1 for p in parts if p[6] == "tht")
print(f"{len(parts)} linh kiện ({n_tht} xuyên lỗ, {sum(1 for p in parts if p[6]=='smd')} dán), bỏ qua {bad} file lỗi và {nogen} linh kiện không có file hình, {OUT.stat().st_size // 1024} KB -> {OUT}")
