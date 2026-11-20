/**
 * Cloudflare Pages Function: /api/telemetry
 * Nhận feedback, lượt truy cập (visit) và click affiliate (buy_click),
 * tự gắn mã quốc gia từ request.cf.country rồi chuyển tiếp sang Google Apps Script.
 * Yêu cầu biến môi trường trên Cloudflare Pages: GSHEET_WEBHOOK_URL
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  const webhook = env && env.GSHEET_WEBHOOK_URL;
  if (!webhook) {
    return new Response(JSON.stringify({ ok: false, error: 'missing_webhook' }), {
      status: 503,
      headers: { 'content-type': 'application/json' }
    });
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: 'invalid_json' }), {
      status: 400,
      headers: { 'content-type': 'application/json' }
    });
  }

  const kind = body && body.kind;
  if (!['feedback', 'visit', 'buy_click'].includes(kind)) {
    return new Response(JSON.stringify({ ok: false, error: 'invalid_kind' }), {
      status: 400,
      headers: { 'content-type': 'application/json' }
    });
  }
  if (kind === 'feedback' && (!body.message || !String(body.message).trim())) {
    return new Response(JSON.stringify({ ok: false, error: 'empty_message' }), {
      status: 400,
      headers: { 'content-type': 'application/json' }
    });
  }

  const cf = request.cf || {};
  const payload = {
    kind,
    country: cf.country || 'XX',
    lang: body.lang || 'vi',
    context: body.context || '',
    device: body.device || '',
    detail: body.detail || '',
    type: body.type || '',
    message: body.message || '',
    contact: body.contact || ''
  };

  try {
    const r = await fetch(webhook, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return new Response(JSON.stringify({ ok: r.ok }), {
      status: r.ok ? 200 : 502,
      headers: { 'content-type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: 'upstream_failed' }), {
      status: 502,
      headers: { 'content-type': 'application/json' }
    });
  }
}

export async function onRequestGet(context) {
  const { env } = context;
  const webhook = env && env.GSHEET_WEBHOOK_URL;
  if (!webhook) {
    return new Response(JSON.stringify({ ok: false, error: 'missing_webhook' }), {
      status: 503,
      headers: { 'content-type': 'application/json' }
    });
  }
  try {
    const r = await fetch(webhook, { method: 'GET' });
    const text = await r.text();
    return new Response(text, {
      status: r.ok ? 200 : 502,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: 'upstream_failed' }), {
      status: 502,
      headers: { 'content-type': 'application/json' }
    });
  }
}
