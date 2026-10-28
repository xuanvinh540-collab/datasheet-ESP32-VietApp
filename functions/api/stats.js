/* Trả top 3 nước có nhiều lượt truy cập nhất: { total, top: [["VN", 12], ...] } */
export async function onRequestGet({ env }) {
  let d = {};
  try { d = (env.STATS && (await env.STATS.get("c", "json"))) || {}; } catch (e) { }
  const top = Object.entries(d).filter(([k]) => k !== "_t").sort((a, b) => b[1] - a[1]).slice(0, 3);
  return new Response(JSON.stringify({ total: d._t || 0, top }), { headers: { "content-type": "application/json", "cache-control": "public, max-age=300" } });
}
