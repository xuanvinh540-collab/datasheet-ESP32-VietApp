/* Popup BOM List dạng thẻ có ảnh SVG ở giữa màn hình (giống thẻ Mua board) */
(() => {
  'use strict';

  const isEN = () => (document.documentElement.lang || 'vi') === 'en';
  const L = (vi, en) => (isEN() ? en : vi);

  function getRegion() {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    if (/Ho_Chi_Minh|Saigon|Bangkok|Asia\/Phnom_Penh/i.test(tz) || (navigator.language || '').startsWith('vi')) return 'vn';
    return 'intl';
  }

  function makeBuyUrl(query, boardId, x) {
    if (window.affUrl) return window.affUrl({ name: (x && x.name) || query, query, id: x && x.id, boardId }, getRegion()).url;   // js/aff.js: thiếu link riêng thì dùng link nhóm
    const reg = getRegion();
    const aff = (window.AFFILIATE && window.AFFILIATE[reg]) || {};
    if (boardId && aff.links && aff.links[boardId]) return aff.links[boardId];
    const q = encodeURIComponent(query);
    return reg === 'vn'
      ? `https://shopee.vn/search?keyword=${q}`
      : `https://www.aliexpress.com/wholesale?SearchText=${q}`;
  }

  function itemPic(item) {
    if (item.boardId) {
      const ph = window.BOARD_PHOTOS && window.BOARD_PHOTOS[item.boardId];
      if (ph) return `<img src="${ph}" alt="" loading="lazy">`;
    }
    const id = (item.id || '').replace(/^MY:/, '');
    const m = window.MODULES && (window.MODULES[item.id] || window.MODULES[id]);
    if (m && (m.svg || m.icon)) return `<img src="${m.svg || m.icon}" alt="" loading="lazy">`;
    if (item.icon) return item.icon;
    // Fallback icon SVG cho board / linh kiện chung
    return `<svg viewBox="0 0 36 36" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="6" y="6" width="24" height="24" rx="4" fill="rgba(0,174,239,.12)" stroke="#00AEEF"/><circle cx="12" cy="12" r="1.5" fill="#00AEEF"/><circle cx="24" cy="12" r="1.5" fill="#00AEEF"/><circle cx="12" cy="24" r="1.5" fill="#00AEEF"/><circle cx="24" cy="24" r="1.5" fill="#00AEEF"/><rect x="13" y="13" width="10" height="10" rx="1.5" stroke="#eab308"/></svg>`;
  }

  const ICONS = {
    bb: '<svg viewBox="0 0 36 36" fill="none"><rect x="4" y="8" width="28" height="20" rx="2.5" fill="#f1f5f9" stroke="#94a3b8" stroke-width="1.5"/><path d="M7 12h22M7 24h22" stroke="#ef4444" stroke-width="1.2"/><path d="M7 14h22M7 22h22" stroke="#3b82f6" stroke-width="1.2"/><path d="M8 17h20M8 19h20" stroke="#334155" stroke-width="1.5" stroke-dasharray="1.5 2"/></svg>',
    wire: '<svg viewBox="0 0 36 36" fill="none" stroke-width="2" stroke-linecap="round"><path d="M6 26C10 10 18 26 30 10" stroke="#f59e0b"/><path d="M6 20C14 8 22 28 30 16" stroke="#22c55e"/><path d="M6 14C16 26 20 8 30 22" stroke="#38bdf8"/></svg>',
    fr4: '<svg viewBox="0 0 36 36" fill="none"><rect x="5" y="7" width="26" height="22" rx="2" fill="#d97706" stroke="#fbbf24" stroke-width="1.5"/><rect x="8" y="10" width="20" height="16" rx="1" fill="#b45309" opacity=".55"/></svg>',
    solder: '<svg viewBox="0 0 36 36" fill="none"><circle cx="18" cy="18" r="10" stroke="#94a3b8" stroke-width="4"/><circle cx="18" cy="18" r="5" fill="#1e293b" stroke="#64748b" stroke-width="1.2"/><path d="M26 24l5 5" stroke="#cbd5e1" stroke-width="2.2" stroke-linecap="round"/></svg>',
    acid: '<svg viewBox="0 0 36 36" fill="none"><path d="M14 6h8v5l5 13a3 3 0 0 1-2.8 4H11.8A3 3 0 0 1 9 24l5-13V6z" fill="rgba(234,179,8,.2)" stroke="#eab308" stroke-width="1.6"/><path d="M12 20h12" stroke="#eab308" stroke-width="1.5"/></svg>'
  };

  function injectStyle() {
    if (document.getElementById('bomStyle')) return;
    const st = document.createElement('style');
    st.id = 'bomStyle';
    st.textContent = `
      #bomPop{position:fixed;inset:0;z-index:9995;background:rgba(0,0,0,.58);display:flex;align-items:center;justify-content:center;padding:16px;animation:bomFade .15s ease-out}
      @keyframes bomFade{from{opacity:0}to{opacity:1}}
      .bom-box{width:min(720px,100%);max-height:84vh;display:flex;flex-direction:column;background:var(--surface,#1b222c);color:var(--fg,#f1f5f9);border:1px solid var(--line,rgba(148,163,184,.3));border-radius:14px;box-shadow:0 20px 50px rgba(0,0,0,.55);font-family:var(--sans,system-ui,sans-serif)}
      .bom-hd{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--line,rgba(148,163,184,.2))}
      .bom-hd b{font-size:15px}
      .bom-x{background:none;border:none;color:inherit;font-size:18px;cursor:pointer;opacity:.75;padding:2px 8px}
      .bom-x:hover{opacity:1}
      .bom-grid{overflow:auto;padding:14px 16px;display:grid;grid-template-columns:repeat(auto-fill,minmax(148px,1fr));gap:10px}
      .bom-card{display:flex;flex-direction:column;align-items:center;text-align:center;gap:6px;padding:10px 8px;border-radius:10px;border:1px solid var(--line,rgba(148,163,184,.24));background:var(--bg,rgba(15,23,42,.55));color:inherit;text-decoration:none;transition:border-color .15s,transform .12s}
      .bom-card:hover{border-color:var(--accent,#00AEEF);transform:translateY(-2px)}
      .bom-pic{width:56px;height:56px;display:flex;align-items:center;justify-content:center;border-radius:8px;background:rgba(255,255,255,.04);padding:4px;overflow:hidden}
      .bom-pic img,.bom-pic svg{max-width:100%;max-height:100%;object-fit:contain;display:block}
      .bom-name{font-size:12px;font-weight:600;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:31px}
      .bom-q{opacity:.7;font-weight:400;margin-left:3px}
      .bom-go{font-size:11px;font-weight:700;color:var(--accent,#00AEEF);margin-top:auto}
      .bom-ft{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 16px;border-top:1px solid var(--line,rgba(148,163,184,.2));font-size:11.5px}
      .bom-cp{padding:6px 12px;border-radius:7px;border:1px solid var(--line,rgba(148,163,184,.35));background:transparent;color:inherit;cursor:pointer;font-size:12px;font-weight:600}
      .bom-cp:hover{border-color:var(--accent,#00AEEF);color:var(--accent,#00AEEF)}
      .bom-note{opacity:.68}
    `;
    document.head.appendChild(st);
  }

  window.showBomPopup = function ({ mode = 'wiring', boardId = '', items = [] } = {}) {
    injectStyle();
    const old = document.getElementById('bomPop');
    if (old) old.remove();

    const map = new Map();
    const add = (name, query, qty = 1, bId = '', id = '', icon = '') => {
      if (!name) return;
      const key = name.trim();
      const cur = map.get(key);
      if (cur) cur.qty += qty;
      else map.set(key, { name: key, query: query || key, qty, boardId: bId, id, icon });
    };

    if (boardId) {
      const bObj = (window.BOARDS || []).find(x => x.id === boardId);
      add((bObj && bObj.name) || boardId, (bObj && bObj.name) || boardId, 1, boardId, boardId);
    }
    (items || []).forEach(it => {
      if (typeof it === 'string') add(it, it, 1);
      else if (it && it.name) add(it.name, it.query || it.name, it.qty || 1, '', it.id || '');
    });

    if (mode === 'pcblab') {
      add(L('Phíp đồng 1 mặt FR4 / Bakelite', 'Single-sided copper clad board'), 'phip dong 1 mat', 1, '', '', ICONS.fr4);
      add(L('Chì hàn thiếc 60/40 (0.8mm)', 'Solder wire 60/40'), 'chi han thiec', 1, '', '', ICONS.solder);
      add(L('Muối ăn mòn mạch (FeCl3 / Na2S2O8)', 'Ferric chloride PCB etchant'), 'muoi an mon mach', 1, '', '', ICONS.acid);
    } else {
      add(L('Breadboard 830 lỗ', 'Breadboard 830 points'), 'breadboard 830', 1, '', '', ICONS.bb);
      add(L('Dây cắm test (Jumper wires)', 'Dupont jumper wires'), 'day cam test dupont', 1, '', '', ICONS.wire);
    }

    const list = [...map.values()];
    const reg = getRegion();
    const shop = reg === 'vn' ? 'Shopee' : 'AliExpress';

    const pop = document.createElement('div');
    pop.id = 'bomPop';
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-modal', 'true');
    pop.innerHTML = `
      <div class="bom-box">
        <div class="bom-hd">
          <b>📦 ${L('Vật tư gợi ý cho mạch này', 'Suggested BOM for this circuit')}</b>
          <button type="button" class="bom-x" aria-label="Close">✕</button>
        </div>
        <div class="bom-grid">
          ${list.map(x => `
            <a class="bom-card" href="${makeBuyUrl(x.query, x.boardId, x)}" target="_blank" rel="noopener sponsored nofollow" title="${x.name}">
              <div class="bom-pic">${itemPic(x)}</div>
              <div class="bom-name">${x.name}<span class="bom-q">×${x.qty}</span></div>
              <div class="bom-go">${L('Mua trên ', 'Buy on ')}${shop} ↗</div>
            </a>
          `).join('')}
        </div>
        <div class="bom-ft">
          <span class="bom-note">${L('Link tiếp thị hỗ trợ Pindexio', 'Affiliate links')}</span>
          <button type="button" class="bom-cp">📋 ${L('Copy BOM', 'Copy BOM')}</button>
        </div>
      </div>
    `;
    const close = () => pop.remove();
    pop.querySelector('.bom-x').onclick = close;
    pop.onclick = e => { if (e.target === pop) close(); };
    pop.querySelector('.bom-cp').onclick = async e => {
      const txt = list.map(x => `- ${x.name} x${x.qty}`).join('\n');
      try {
        await navigator.clipboard.writeText(txt);
        e.target.textContent = '✓ ' + L('Đã copy', 'Copied');
      } catch (err) { }
    };
    document.body.appendChild(pop);
  };
})();
