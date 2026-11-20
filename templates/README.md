# Template cộng đồng (Pindexio)

Mỗi template là một file `.pdi` trong thư mục này + một mục trong `index.json`. App đọc `templates/index.json` khi mở **File ▸ Chọn template…**.

## Thêm template (qua GitHub)
1. Trong PCB Studio vẽ mạch, **File ▸ Lưu bo thành template…** → tải về file `.pdi`.
2. Đặt file vào `templates/`.
3. Thêm một mục vào `index.json`:
```json
{ "id": "ten-ngan", "file": "ten-ngan.pdi",
  "title": "Tên tiếng Việt", "title_en": "English name",
  "desc": "Mô tả 1–2 câu.", "desc_en": "1–2 sentence description.",
  "tags": ["SMD", "breakout"], "size": "30×26 mm",
  "author": "tên bạn", "license": "CC0", "verified": false }
```
4. Gửi Pull Request. Người duyệt kiểm: mở được, 0 lỗi khoảng cách, kích thước pad đúng datasheet, giấy phép rõ ràng.

## Quy tắc
- `id` chỉ gồm chữ thường, số, gạch ngang; trùng tên file.
- Linh kiện Fritzing đi kèm phải giữ nguồn và giấy phép (CC BY-SA 3.0) trong trường `credits` của file.
- Để `verified: false` cho tới khi có người đối chiếu datasheet / đã làm thử bo thật.
- File dưới 200 KB.

## Mẫu hiện có
`soic8-breakout`, `led-0603`, `adapter-254-127` (sinh bằng script, xem lịch sử repo).
