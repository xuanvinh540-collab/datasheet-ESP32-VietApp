# Pindex – hướng dẫn cho agent

Tài liệu này giúp agent (Claude Code, Codex, Cursor…) hiểu nhanh dự án trước khi sửa. Đọc hết, rồi chỉ mở file liên quan nhiệm vụ.

## 1. Dự án là gì
**Pindex** (pindex.pages.dev): web tra cứu sơ đồ chân vi điều khiển bằng **tiếng Việt + tiếng Anh**, dữ liệu lấy từ **datasheet của hãng**. Chạm một chân → chức năng, cảnh báo (strapping/USB/JTAG/ADC2…), thông số điện, linh kiện đi kèm, nguồn trích dẫn. Tối ưu điện thoại/iPad, cài được như app (PWA).

- Người dùng chính: dân làm mạch/IoT Việt Nam.
- Repo: `github.com/xuanvinh540-collab/datasheet-ESP32-VietApp` (nhánh `main`). Thư mục máy: `W:\AI\datasheet-ESP32-VietApp`.
- Triển khai: **Cloudflare Pages** `pindex` (`pindex.pages.dev`), tự build khi push `main`. Còn Worker cũ `pin-explorer-vn.xuanvinh540.workers.dev` (bản cũ, không tự cập nhật) và GitHub Pages (bản cũ).
- **Web tĩnh thuần**: HTML + CSS + JS không build, không framework, không server. Không thêm bundler/npm trừ khi người dùng yêu cầu.

## 2. Board hiện có (8)
| id | Họ | Hình PCB | Schematic hãng |
|---|---|---|---|
| `esp32-c3-devkitm-1` | ESP32 | SVG tự vẽ | có (2 trang) |
| `esp32-c3-supermini` | ESP32 | SVG tự vẽ (theo ảnh nhà bán) | không (hàng bên thứ ba) |
| `esp32-s3-devkitc-1` | ESP32 | SVG tự vẽ theo ảnh Espressif | có |
| `lilygo-t-display-s3` | ESP32 | ảnh thật cắt khớp chân | không |
| `pico-2-w` | RP2 | ảnh thật cắt khớp chân | có |
| `pico-2` | RP2 | SVG tự vẽ | không |
| `raspberry-pi-40pin` | Raspberry Pi | SVG | có (Pi 4 rút gọn) |
| `arduino-uno-r3` | AVR | ảnh thật cắt khớp chân | có |

Đã bỏ M5Stack AtomS3 (hình sai). Link cũ chuyển hướng qua `_redirects`.

## 3. Tính năng
1. **Sơ đồ chân** có 3 kiểu xem: *PCB* (toạ độ mm thật), *Kiến trúc* (sơ đồ khối module, bấm phóng to), *Schematic hãng* (ảnh từ PDF gốc, bấm mở popup zoom). Tìm chân, lọc ADC/PWM/I2C/SPI/UART/Touch/USB/Strapping/JTAG/LED; bấm bộ lọc → panel kiến thức (định nghĩa, nguyên lý, ưu/nhược, ví dụ nối dây) từ `js/learn.js`.
2. **Panel chi tiết chân**: trạng thái, cảnh báo, ghi chú, chức năng (kèm nhãn Arduino SDA/SCL/MOSI/MISO/SCK/SS theo `pins_arduino.h` của arduino-esp32), thông số điện, linh kiện đi kèm (nhãn nguồn HDG / Datasheet / Thông lệ).
3. **Thông số chip** (8 tab) + bảng **linh kiện khi tự làm mạch** cho ESP32-S3 và ESP32-C3 (`js/specs.js`).
4. **Tab Tính toán**: điện trở LED, phân áp ADC, pull-up I2C, mạch RC.
5. **Tab Tài liệu**: link datasheet/schematic gốc của hãng.
6. **⚡ Tab Connect** (trước gọi là Build; mã vẫn dùng id `build`, `js/build.js` tải khi bấm lần đầu): ghép 14 module (vẽ bằng `svg/*.svg`) vào board; kéo node, kéo dây từ socket tới pad (pad xanh = an toàn, cam = có lưu ý), dây đi vòng ngoài board, màu theo tín hiệu, kéo thân dây theo trục, nắm đầu dây đổi/thả ra để gỡ; tab Code sinh **chỉ `#define` chân + dòng khởi tạo bus** (không viết cả chương trình); export PNG / JSON / link `#build=`. Hỗ trợ ESP32, Pico, Uno; Raspberry Pi chưa. Nút 🧲 Sắp xếp (3 bố cục) và 🔀 Đi dây (4 kiểu), tên đang dùng hiện ở góc phải dưới khung vẽ; chọn linh kiện/dây rồi Delete, hoặc chuột phải để xoá.
7b. **Sơ đồ chân linh kiện**: dưới danh sách board có mục 🧩 Linh kiện (thu gọn 3 hàng / mở rộng theo nhóm `MOD_CATS`), mỗi module thành "board" giả `mod-<mã>` (`modBoard()` trong `app.js`), URL `/#mod-<mã>/<chân>`, không có trang SEO riêng. `js/modules.js` giờ tải sẵn trong `index.html`.
7. **Song ngữ**: nút cờ VN/EN. **4 giao diện** (ô chọn góc phải): *Pindex* (mặc định, lá ô liu + dark), *8-bit* (tông đại dương retro), *Hổ phách*, *Simple*; nút ☀/☾ sáng/tối.
8. **Chia sẻ** board/chân (Web Share API hoặc copy link).

## 4. Cấu trúc thư mục
```
index.html              Khuôn trang (KHÔNG sửa trong <!--SEO--> và <!--SEOBODY--> bằng tay: bị ghi đè)
js/boards.js            DỮ LIỆU board (nguồn sự thật): chân, vị trí mm, linh kiện, docs, oem, arch
js/app.js               Vẽ SVG (PCB/kiến trúc), panel chân, bộ lọc, popup zoom, chia sẻ, tab, router
js/seo-body.js          Khối chữ cuối trang Sơ đồ chân (bảng chân + tài liệu + danh sách board) – DÙNG CHUNG
                        cho app.js (vẽ lại khi đổi board) và tools/build-seo.js (trang tĩnh). Chỉ sửa ở đây.
js/build.js, modules.js Tab Build + thư viện module
js/specs.js             Thông số chip theo board id (HTML chuỗi)
js/learn.js             Bài giải thích ADC/PWM/I2C/SPI/UART/Touch/USB/Strapping/JTAG/LED
js/i18n.js, i18n-data.js Dịch EN: từ điển {câu tiếng Việt → tiếng Anh}
css/app.css             Nền Simple + layout; retro.css / pinout.css / amber.css: các giao diện
sch/                    Ảnh schematic hãng (PNG từ PDF) + ảnh board cắt khớp chân
og/                     Ảnh chia sẻ 1200×630 (tools/og.py sinh)
<board-id>/index.html, en/<board-id>/index.html   Trang tĩnh SEO (tools/build-seo.js sinh)
sitemap.xml, robots.txt, 404.html, _redirects, manifest.webmanifest, sw.js, icon-*.png
tools/build-seo.js, og.py   Công cụ sinh
```

## 5. Mô hình dữ liệu board (`js/boards.js`)
Mỗi board là object: `id, tag, name, vendor, chip, family (ESP32|RP2|AVR|Raspberry Pi), summary, w, h (mm), pcb (màu), logic, facts[], elec[], docs[[loại,tên,url]], src, note, parts[], headers[], arch{core,blocks[]}, oem{by,file,url,pages[]}, photo{src,box,credit}`.
- `headers[].pins[]`: `{name, gpio, cat, fn[], flags[], warn, notes[], parts[[tên,giá trị,nguồn]], x, y (mm), pn}`. `cat` ∈ power|gnd|gpio|adc|comm|usb|strap|ban|ctl|nc. `flags` dùng cho bộ lọc và chấm điểm chân ở Build (`strap, usb, uart, jtag, adc, spi, i2c, led`).
- Hàm dựng chân dùng chung: `s3(n)` (S3), `c3(n, sm)` (C3, `sm` = Super Mini), `rp(n)` (Pico), `D(n)`/`A(n)` (Uno), `g(n)` (Pi), `pin/pw/gnd/ctl` helper.
- `parts[]` có `t`: module, chip, usb, jack, btn, led, ant, shield, dip, hole, text → vẽ bởi `drawPart` trong `app.js`.
- Thêm board mới: tạo object, đặt vào `window.BOARDS`, thêm `tag`; rồi chạy lại công cụ (mục 8).

## 6. Quy tắc nội dung (quan trọng)
- **Dữ liệu kỹ thuật phải có nguồn** (datasheet/HDG/TRM/pins_arduino.h). Chưa chắc thì ghi "Thông lệ" hoặc không ghi; **không bịa** số liệu. Datasheet đã đối chiếu: ESP32-S3 v2.2, ESP32-C3 v2.4, RP2350, Pico 2/2 W, Uno R3.
- Khi sửa nội dung tiếng Việt, **thêm bản dịch EN** vào `js/i18n-data.js` (khoá = nguyên văn tiếng Việt). Câu thiếu bản dịch sẽ hiện tiếng Việt khi bật EN. Có thể trích câu chưa dịch bằng cách duyệt `BOARDS`/`LEARN`/`SPECS`.
- Tên riêng: **Pindex**; dòng phụ "Thông tin chân & datasheet board" / "Pin info & board datasheets". Không dùng logo thật của hãng; icon board vẽ tự động từ dữ liệu PCB.
- Hình: ưu tiên **SVG tự vẽ theo ảnh pinout chính thức** (đo vị trí linh kiện ~px/mm); ảnh chụp chỉ dùng khi đã cắt khớp chân, và ghi nguồn (`photo.credit`). Super Mini là hàng bên thứ ba: ghi rõ không có datasheet chính thức. Schematic: chỉ dùng bản hãng công bố, ghi nguồn + giấy phép (Arduino: CC BY-SA 4.0).
- Build: gợi ý chân dựa `score()` trong `build.js` (trừ điểm strapping/USB/UART0/JTAG/LED; RP2/AVR bắt buộc đúng chân bus phần cứng). Cảnh báo 5 V↔3.3 V, I2S của Pico (LRCLK = BCLK+1). Không viết nguyên chương trình trong tab Code.

## 7. Quy ước mã
- JS thuần ES2020, IIFE, không module. Biến toàn cục: `BOARDS, CATS, FLAGS, SPECS, LEARN, MODULES, EN_DATA, APP, BUILD`.
- CSS dùng biến (`--bg --fg --accent --c-*`); giao diện ghi đè bằng file riêng, bật/tắt bằng `disabled` trên thẻ `<link>`.
- Cache: **không sửa tay `?v=`**. `node tools/build-seo.js` tự tăng một số phiên bản duy nhất rồi ghi vào `index.html`, `js/app.js` và `sw.js`. Cứ chạy nó sau khi sửa file tĩnh.
- Hash/URL: `/<board-id>/#<chân>` (EN: `/en/<board-id>/`); link cũ `#<board>/<chân>` vẫn chạy; `#build=<base64>` mở Build.
- Giữ code gọn, comment tiếng Việt ngắn; không thêm thư viện ngoài (chỉ Google Fonts đã có).

## 8. Quy trình làm việc / triển khai
```bash
# chạy thử cục bộ (cần server vì dùng fetch/WebGL/SW)
cd W:\AI\datasheet-ESP32-VietApp && python -m http.server 8765      # http://127.0.0.1:8765/

# sau khi sửa boards.js / specs.js / i18n-data.js
python -I tools/og.py            # ảnh chia sẻ og/*.png
node tools/build-seo.js          # sinh trang <board>/ và en/<board>/, sitemap.xml, robots.txt

git add -A && git commit -m "..." && git push origin main       # Cloudflare tự deploy (~1 phút)
```
- Kiểm tra: `node --check js/*.js`; mở trang cục bộ, thử mobile (375 px), iPad, dark/light, EN. Đừng khẳng định đã thử cảm ứng thật nếu chỉ thử bằng chuột.
- Commit: có dòng `Co-Authored-By` theo hướng dẫn phiên làm việc. Chỉ commit file thuộc nhiệm vụ.
- Không xoá/ghi đè ảnh trong `sch/` ngoài yêu cầu; không đổi URL đã công khai mà không thêm `_redirects` (đã gửi Google Search Console, tệp xác minh `googledf1f5070b8a18bb4.html` phải giữ).
- Cloudflare Pages không cho tạo dự án bằng `wrangler pages` trên tài khoản này (lỗi 500); dự án `pindex` tạo tay trên dashboard và nối GitHub.

## 9. SEO & phân phối
- Mỗi board có 2 trang tĩnh (VI + `/en/`) với `<title>`, description, canonical, hreflang, Open Graph + Twitter card, JSON-LD (TechArticle/WebSite + BreadcrumbList, trang chủ thêm ItemList), **bảng chân viết sẵn trong HTML**; `renderSeoTable()` trong app.js vẽ lại đúng cấu trúc đó khi đổi board.
- Mục "Tất cả board" ở cuối trang là **link nội bộ** tới trang board (để Google đi tiếp), kèm link "Mua" Shopee riêng mang `rel="noopener sponsored nofollow"`. Đừng biến link nội bộ thành link Shopee.
- Trang chủ còn liệt kê "Sơ đồ chân linh kiện" theo `MOD_CATS`; linh kiện chỉ có URL hash `#mod-<mã>`, không có trang tĩnh riêng.
- Song ngữ: chạy `node tools/check-i18n.js` (hoặc script tương đương) sau khi thêm chữ tiếng Việt; hiện **0 câu chưa dịch**.
- Android: chưa lên Play Store (người dùng chưa có phí 25 USD). Dùng PWA; có thể đóng gói APK bằng PWABuilder. iOS cần tài khoản Apple Developer + máy Mac.
- Bài PR soạn sẵn: `W:\AI\Pindex-bai-dang-PR.md`. Video quảng bá: `W:\AI\pindex-video\` (dự án HyperFrames riêng, không nằm trong repo này).

## 10. Việc đang dở / ý tưởng tiếp
- Gắn 2 SVG người dùng cung cấp (`C:\Users\PC29\Downloads\svg\st7789.txt`, `hc-sr04.svg`) làm hình thân module trong Build; chốt tên chân ST7789 (file: GND, VCC, SCL, SDA, RES, DC, BLK; app hiện: SCK, MOSI, CS, DC, RST, BL).
- Build giai đoạn 2: nhiều module cùng loại, sơ đồ nguồn, zoom bằng 2 ngón, thử cảm ứng thật; xuất ảnh PNG chưa có ảnh board thật cho board dùng ảnh chụp.
- Nút "Cài app" trong giao diện; thêm board (ESP32-P4, LilyGO T-Beam…, M5Stack nếu có ảnh pinout chính thức); thông số chip cho Pico/Uno; dịch nốt câu cảnh báo ghép tên chân và kết quả bộ tính toán.
