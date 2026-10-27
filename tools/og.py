# Ảnh xem trước khi chia sẻ link (1200×630) cho trang chủ và từng board: python tools/og.py
# Dùng ảnh board thật (sch/*-board.jpg) nếu có, không thì vẽ khối chữ viết tắt.
import json, os, re, subprocess
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
boards = json.loads(subprocess.check_output(["node", "-e",
    "global.window={};require('./js/boards.js');console.log(JSON.stringify(window.BOARDS.map(b=>({id:b.id,name:b.name,chip:b.chip,tag:b.tag,photo:b.photo&&b.photo.src}))))"],
    cwd=ROOT, encoding="utf-8"))
F = "C:/Windows/Fonts/"
font = lambda n, s: ImageFont.truetype(F + n, s)
BG, CARD, ACC, YEL, FG = "#0b2a33", "#123a46", "#e8672a", "#f5d63d", "#e9f6f1"
os.makedirs(os.path.join(ROOT, "og"), exist_ok=True)

def make(name, title, sub, tag, photo):
    im = Image.new("RGB", (1200, 630), BG); d = ImageDraw.Draw(im)
    for x in range(0, 1200, 24): d.line([(x, 0), (x, 630)], fill="#0e313b")
    d.rectangle([0, 0, 1200, 70], fill="#0f4a59"); d.text((48, 18), "PINDEX", font=font("consolab.ttf", 34), fill=YEL)
    d.text((240, 24), "pindexio.com", font=font("consola.ttf", 24), fill="#8fb7bb")
    y = 150
    for line in re.findall(r".{1,22}(?:\s|$)", title):
        d.text((60, y), line.strip(), font=font("segoeuib.ttf", 64), fill=FG); y += 78
    d.text((60, y + 10), sub, font=font("segoeui.ttf", 32), fill="#8fb7bb")
    d.rectangle([60, 540, 420, 588], fill=ACC); d.text((78, 545), "PINOUT · DATASHEET", font=font("consolab.ttf", 28), fill="#fff6dc")
    box = (800, 100, 1150, 600)
    if photo:
        p = Image.open(os.path.join(ROOT, photo)).convert("RGB"); p.thumbnail((box[2] - box[0], box[3] - box[1]))
        x, yy = box[0] + (box[2] - box[0] - p.width) // 2, box[1] + (box[3] - box[1] - p.height) // 2
        d.rectangle([x - 10, yy - 10, x + p.width + 10, yy + p.height + 10], fill=CARD); im.paste(p, (x, yy))
    else:
        d.rectangle([860, 200, 1110, 450], fill=CARD, outline=YEL, width=6)
        f = font("consolab.ttf", 110 if len(tag) < 3 else 80); w = d.textlength(tag, font=f)
        d.text((985 - w / 2, 255), tag, font=f, fill=YEL)
    im.save(os.path.join(ROOT, "og", name + ".png"), optimize=True)

make("home", "Sơ đồ chân vi điều khiển", "ESP32 · Pico · Arduino · Raspberry Pi", "PIN", "sch/pico-2-w-board.jpg")
for b in boards: make(b["id"], b["name"], b["chip"], b.get("tag") or "PIN", b.get("photo"))
print("og:", len(boards) + 1)
