/* Đếm lượt truy cập theo nước: không lưu IP, chỉ cộng 1 vào mã nước (Cloudflare tự cung cấp request.cf.country).
   Một khoá KV duy nhất "c" = { VN: 12, US: 3, _t: 15 } để mỗi lượt chỉ tốn 1 lần ghi (gói miễn phí 1000 lần ghi/ngày). */
const BOT = /bot|crawl|spider|slurp|preview|lighthouse|headless|facebookexternalhit|curl|wget|python|node/i;
export async function onRequestPost({ request, env }) {
  const done = new Response(null, { status: 204 });
  try {
    const host = new URL(request.headers.get("origin") || "http://x").hostname;
    if (!env.STATS || !/(^|\.)(pindexio\.com|pindex\.pages\.dev)$/.test(host) || BOT.test(request.headers.get("user-agent") || "")) return done;
    const c = (request.cf && request.cf.country) || "";
    if (!/^[A-Z]{2}$/.test(c) || c === "XX" || c === "T1") return done;
    const d = (await env.STATS.get("c", "json")) || {};
    d[c] = (d[c] || 0) + 1; d._t = (d._t || 0) + 1;
    await env.STATS.put("c", JSON.stringify(d));
  } catch (e) { /* hết hạn mức ghi hoặc lỗi KV: bỏ qua, không ảnh hưởng trang */ }
  return done;
}
