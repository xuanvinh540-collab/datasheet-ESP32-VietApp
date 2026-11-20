/* Feedback popup + đếm phiên truy cập & click mua hàng gửi về /api/telemetry */
(() => {
  'use strict';

  const isEN = () => (document.documentElement.lang || 'vi') === 'en';
  const L = (vi, en) => (isEN() ? en : vi);

  function getContext() {
    const activeTab = document.querySelector('.tabbar button.on, .tabbar button[aria-selected="true"]');
    const tabName = activeTab ? activeTab.textContent.trim() : '';
    const board = (window.APP && APP.board && APP.board()) || (location.hash || location.pathname);
    return [board, tabName].filter(Boolean).join(' · ') || '/';
  }

  function getDevice() {
    const w = window.innerWidth || 0;
    return w <= 640 ? 'mobile' : w <= 1024 ? 'tablet' : 'desktop';
  }

  // phân tích hành vi ẩn danh: gom sự kiện, gửi 1 lô mỗi 30 s hoặc khi rời trang; mã phiên ngẫu nhiên, không IP / tên / nội dung mạch
  const SID = (() => { try { let s = sessionStorage.getItem('pindex-sid'); if (!s) { s = Math.random().toString(36).slice(2, 10); sessionStorage.setItem('pindex-sid', s); } return s; } catch (e) { return 'x'; } })();
  const EVQ = []; let evT = null;
  const EV_OFF = /^(127\.0\.0\.1|localhost)$/.test(location.hostname);
  function flushEv() {
    clearTimeout(evT); evT = null; if (!EVQ.length) return;
    const body = JSON.stringify({ kind: 'events', sid: SID, lang: document.documentElement.lang || 'vi', device: getDevice(), events: EVQ.splice(0, 50) });
    try { if (!(navigator.sendBeacon && navigator.sendBeacon('/api/telemetry', body))) fetch('/api/telemetry', { method: 'POST', body, keepalive: true }).catch(() => { }); } catch (e) { }
    if (EVQ.length) evT = setTimeout(flushEv, 1000);
  }
  window.PX_TRACK = (n, d) => {
    if (EV_OFF) return;
    EVQ.push({ n: String(n).slice(0, 40), d: d == null ? '' : String(d).slice(0, 160), t: Date.now() });
    if (EVQ.length >= 40) flushEv(); else if (!evT) evT = setTimeout(flushEv, 30000);
  };
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushEv(); });
  addEventListener('pagehide', flushEv);
  addEventListener('error', e => { const m = (e && e.message) || ''; if (m && !/ResizeObserver|Script error/.test(m)) window.PX_TRACK('js_error', m + ' @' + String(e.filename || '').split('/').pop() + ':' + (e.lineno || '')); });

  async function postTelemetry(payload) {
    const customUrl = (() => {
      try { return localStorage.getItem('pindex-gsheet') || ''; } catch (e) { return ''; }
    })();
    const body = JSON.stringify({
      ...payload,
      lang: document.documentElement.lang || 'vi',
      context: payload.context || getContext(),
      device: getDevice()
    });
    // Khi chạy thực tế trên Cloudflare Pages: gọi /api/telemetry (giữ bí mật webhook & lấy được quốc gia)
    // Khi test local (127.0.0.1 / localhost) có thể dán URL Apps Script vào localStorage["pindex-gsheet"]
    if (customUrl) {
      await fetch(customUrl, { method: 'POST', mode: 'no-cors', body });
      return true;
    }
    const r = await fetch('/api/telemetry', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body
    });
    return r.ok;
  }

  function trackVisitOnce() {
    if (/^(127\.0\.0\.1|localhost)$/.test(location.hostname)) return;
    try {
      if (sessionStorage.getItem('pindex-visit')) return;
      sessionStorage.setItem('pindex-visit', '1');
    } catch (e) { }
    postTelemetry({ kind: 'visit', detail: location.pathname + location.hash }).catch(() => { });
  }

  function injectStyles() {
    if (document.getElementById('fbStyle')) return;
    const st = document.createElement('style');
    st.id = 'fbStyle';
    st.textContent = `
      #fbFab{position:fixed;right:14px;bottom:14px;z-index:900;display:inline-flex;align-items:center;gap:6px;padding:7px 12px;border-radius:999px;border:1px solid var(--line,rgba(148,163,184,.35));background:var(--surface,#1b222c);color:var(--fg,#f1f5f9);font:600 12px/1 var(--sans,system-ui,sans-serif);cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.28);opacity:.88;transition:opacity .15s,transform .15s}
      #fbFab:hover{opacity:1;transform:translateY(-1px)}
      #fbModal{position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:16px}
      #fbModal[hidden]{display:none}
      .fb-box{width:100%;max-width:400px;background:var(--surface,#1b222c);color:var(--fg,#f1f5f9);border:1px solid var(--line,rgba(148,163,184,.3));border-radius:12px;padding:16px 18px;box-shadow:0 16px 40px rgba(0,0,0,.45);font-family:var(--sans,system-ui,sans-serif)}
      .fb-hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
      .fb-hd h3{margin:0;font-size:15px}
      .fb-x{background:none;border:none;color:inherit;font-size:18px;cursor:pointer;padding:2px 6px}
      .fb-box label{display:block;font-size:12px;margin:8px 0 4px;opacity:.85}
      .fb-box select,.fb-box input,.fb-box textarea{width:100%;box-sizing:border-box;padding:7px 9px;border-radius:6px;border:1px solid var(--line,rgba(148,163,184,.35));background:var(--bg,#11161d);color:var(--fg,#f1f5f9);font:inherit;font-size:13px}
      .fb-box textarea{min-height:92px;resize:vertical}
      .fb-ctx{font-size:11px;opacity:.7;margin-top:6px}
      .fb-ft{display:flex;justify-content:flex-end;gap:8px;margin-top:12px}
      .fb-btn{padding:7px 14px;border-radius:6px;border:1px solid var(--line,rgba(148,163,184,.35));background:transparent;color:inherit;cursor:pointer;font-size:13px}
      .fb-btn.pri{background:var(--accent,#00AEEF);color:#041E42;border-color:transparent;font-weight:700}
      .fb-st{font-size:12px;margin-top:8px;min-height:16px}
      @media(max-width:640px){#fbFab{right:10px;bottom:10px;padding:6px 10px;font-size:11px}}
    `;
    document.head.appendChild(st);
  }

  function ensureUI() {
    if (document.getElementById('fbFab')) return;
    injectStyles();

    const fab = document.createElement('button');
    fab.id = 'fbFab';
    fab.type = 'button';
    fab.title = L('Gửi góp ý hoặc báo lỗi dữ liệu', 'Send feedback or report an issue');
    fab.textContent = '💬 ' + L('Góp ý', 'Feedback');

    const modal = document.createElement('div');
    modal.id = 'fbModal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.hidden = true;

    const renderForm = () => {
      fab.textContent = '💬 ' + L('Góp ý', 'Feedback');
      modal.innerHTML = `
        <div class="fb-box">
          <div class="fb-hd">
            <h3>💬 ${L('Góp ý / Báo lỗi Pindexio', 'Pindexio Feedback')}</h3>
            <button type="button" class="fb-x" id="fbClose" aria-label="Close">✕</button>
          </div>
          <label for="fbType">${L('Loại phản hồi', 'Type')}</label>
          <select id="fbType">
            <option value="Báo lỗi">${L('Báo lỗi (giao diện / PCB / Wiring)', 'Bug report (UI / PCB / Wiring)')}</option>
            <option value="Sai dữ liệu chân">${L('Sai thông số chân / datasheet', 'Pin / datasheet correction')}</option>
            <option value="Góp ý tính năng">${L('Góp ý thêm board / tính năng', 'Feature / board request')}</option>
          </select>
          <label for="fbMsg">${L('Nội dung', 'Message')}</label>
          <textarea id="fbMsg" placeholder="${L('Mô tả ngắn vấn đề hoặc góp ý của bạn...', 'Describe the issue or suggestion...')}"></textarea>
          <label for="fbContact">${L('Liên hệ (Email / Zalo, không bắt buộc)', 'Contact (Email / Telegram, optional)')}</label>
          <input id="fbContact" type="text" placeholder="${L('Để trống nếu muốn gửi ẩn danh', 'Leave blank for anonymous')}">
          <div class="fb-ctx" id="fbCtx"></div>
          <div class="fb-ctx">${L('Hoặc gửi email trực tiếp: ', 'Or email directly: ')}<a href="mailto:contact@pindexio.com?subject=Pindexio%20Feedback" style="color:var(--accent,#00AEEF)">contact@pindexio.com</a></div>
          <div class="fb-st" id="fbSt"></div>
          <div class="fb-ft">
            <button type="button" class="fb-btn" id="fbCancel">${L('Huỷ', 'Cancel')}</button>
            <button type="button" class="fb-btn pri" id="fbSend">${L('Gửi góp ý', 'Send')}</button>
          </div>
        </div>
      `;
      const close = () => { modal.hidden = true; };
      modal.querySelector('#fbClose').onclick = close;
      modal.querySelector('#fbCancel').onclick = close;
      modal.onclick = e => { if (e.target === modal) close(); };
      modal.querySelector('#fbSend').onclick = async () => {
        const msgEl = modal.querySelector('#fbMsg');
        const stEl = modal.querySelector('#fbSt');
        const sendBtn = modal.querySelector('#fbSend');
        const message = msgEl.value.trim();
        if (!message) {
          stEl.style.color = '#f59e0b';
          stEl.textContent = L('Vui lòng nhập nội dung trước khi gửi.', 'Please enter a message.');
          msgEl.focus();
          return;
        }
        sendBtn.disabled = true;
        stEl.style.color = 'inherit';
        stEl.textContent = L('Đang gửi...', 'Sending...');
        try {
          const ok = await postTelemetry({
            kind: 'feedback',
            type: modal.querySelector('#fbType').value,
            message,
            contact: modal.querySelector('#fbContact').value.trim()
          });
          if (!ok) throw new Error('status');
          stEl.style.color = '#22c55e';
          stEl.textContent = L('Cảm ơn bạn! Góp ý đã được ghi nhận.', 'Thank you! Feedback saved.');
          msgEl.value = '';
          setTimeout(close, 1100);
        } catch (err) {
          stEl.style.color = '#ef4444';
          stEl.textContent = L('Chưa kết nối được máy chủ nhận góp ý.', 'Could not reach feedback server.');
        } finally {
          sendBtn.disabled = false;
        }
      };
    };

    fab.onclick = () => {
      renderForm();
      modal.querySelector('#fbCtx').textContent = L('Ngữ cảnh: ', 'Context: ') + getContext();
      modal.hidden = false;
      setTimeout(() => modal.querySelector('#fbMsg')?.focus(), 20);
    };

    document.body.appendChild(fab);
    document.body.appendChild(modal);

    // Track affiliate clicks
    document.addEventListener('click', e => {
      const a = e.target && e.target.closest && e.target.closest('a[rel*="sponsored"], #buyBtn');
      if (!a) return;
      if (/^(127\.0\.0\.1|localhost)$/.test(location.hostname)) return;
      postTelemetry({ kind: 'buy_click', detail: a.getAttribute('href') || a.id }).catch(() => { });
    });

    if (typeof window.onLangChange === 'function') {
      const prev = window.onLangChange;
      window.onLangChange = () => { prev(); fab.textContent = '💬 ' + L('Góp ý', 'Feedback'); };
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { ensureUI(); trackVisitOnce(); });
  } else {
    ensureUI();
    trackVisitOnce();
  }
})();
