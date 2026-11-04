/* my.niveshsahayak.in: the Configuration Hub of the Nivesh Sahayak document tools.
   Masters (businesses, customers and suppliers, items and services) can be added, edited, imported and exported here;
   Settings (default business, numbering, new-document defaults, backup reminder) are saved in the data home as meta 'settings'
   and read by every document tool (docs.js). Everything stays in this browser. */
(function () {
  'use strict';
  var $ = NS.$, $$ = NS.$$, esc = NS.esc, t = NS.t;
  var UNITS = ['Nos', 'Pcs', 'Kg', 'Gm', 'Ltr', 'Ml', 'Mtr', 'Sq ft', 'Box', 'Pack', 'Set', 'Pair', 'Dozen', 'Bag', 'Ton', 'Hrs', 'Days', 'Month', 'Job'];
  var RATES = [0, 0.25, 3, 5, 12, 18, 28, 40];
  var ACCENTS = ['#0B3B5B', '#1D4ED8', '#047857', '#B45309', '#9D174D', '#334155'];
  var BILLING = location.hostname === 'localhost' || location.hostname === '127.0.0.1' ? 'http://localhost:8861/' : 'https://billing.niveshsahayak.in/';

  /* field: [key, label key, kind, extra]; kinds: text, area, state, gstin, sel, num, img, unit, gst, ltr */
  var FORM = {
    biz: [
      ['name', 'l.bname', 'text', { req: 1, wide: 1 }], ['addr', 'l.addr', 'area', { wide: 1 }], ['city', 'l.city', 'text'], ['pin', 'l.pin', 'ltr', { mode: 'numeric', max: 6 }], ['state', 'l.state', 'state'], ['gstin', 'l.gstin', 'gstin'],
      ['phone', 'l.phone', 'ltr', { mode: 'tel' }], ['email', 'l.email', 'ltr', { type: 'email' }],
      ['bankName', 'l.bank', 'text'], ['bankAcc', 'l.acc', 'ltr', { mode: 'numeric' }], ['bankIfsc', 'l.ifsc', 'ltr', { max: 11, upper: 1 }], ['bankBranch', 'l.branch', 'text'],
      ['upi', 'l.upi', 'ltr', { wide: 1, ph: 'name@bank' }], ['logo', 'l.logo', 'img', { max: 360 }], ['sign', 'l.sign', 'img', { max: 420 }]
    ],
    party: [
      ['role', 'hub.role', 'sel', { opts: [['customer', 'hub.r.customer'], ['supplier', 'hub.r.supplier'], ['both', 'hub.r.both']] }],
      ['name', 'my.f.name', 'text', { req: 1 }], ['phone', 'l.phone', 'ltr', { mode: 'tel' }], ['email', 'l.email', 'ltr', { type: 'email' }],
      ['gstin', 'l.cgstin', 'gstin'], ['state', 'l.state', 'state'], ['addr', 'l.addr', 'area', { wide: 1 }], ['city', 'l.city', 'text'], ['pin', 'l.pin', 'ltr', { mode: 'numeric', max: 6 }],
      ['ship.addr', 'l.shaddr', 'area', { wide: 1, hint: 'hub.h.ship' }], ['ship.state', 'l.shstate', 'state']
    ],
    item: [
      ['desc', 'hub.f.iname', 'text', { req: 1, wide: 1 }], ['kind', 'l.type', 'sel', { opts: [['goods', 'hub.k.goods'], ['service', 'hub.k.service']] }],
      ['code', 'hub.f.code', 'ltr'], ['hsn', 'l.hsn', 'ltr', { mode: 'numeric', max: 8 }], ['unit', 'l.unit', 'unit'],
      ['rate', 'l.rate', 'num'], ['gst', 'l.gst', 'gst']
    ]
  };
  /* CSV columns (English headers, so a file works in any language) */
  var CSV = {
    biz: [['name', 'Name'], ['addr', 'Address'], ['city', 'City'], ['pin', 'PIN code'], ['state', 'State code'], ['gstin', 'GSTIN'], ['phone', 'Phone'], ['email', 'Email'], ['bankName', 'Bank'], ['bankAcc', 'Account no'], ['bankIfsc', 'IFSC'], ['bankBranch', 'Branch'], ['upi', 'UPI ID']],
    party: [['role', 'Type'], ['name', 'Name'], ['phone', 'Phone'], ['email', 'Email'], ['addr', 'Address'], ['city', 'City'], ['pin', 'PIN code'], ['state', 'State code'], ['gstin', 'GSTIN'], ['ship.addr', 'Ship-to address'], ['ship.state', 'Ship-to state code']],
    item: [['desc', 'Name'], ['kind', 'Type'], ['code', 'Item code'], ['hsn', 'HSN/SAC'], ['unit', 'Unit'], ['rate', 'Rate'], ['gst', 'GST %']]
  };
  var NAMEKEY = { biz: 'name', party: 'name', item: 'desc' };
  var SECS = ['home', 'biz', 'party', 'item', 'doc', 'settings', 'backup'];
  var cur = 'home', q = '', S = {}, cache = {};

  function key(s) { return String(s || '').trim().toLowerCase(); }
  function get(o, k) { return k.split('.').reduce(function (a, p) { return a == null ? a : a[p]; }, o); }
  function set(o, k, v) { var p = k.split('.'), last = p.pop(); p.forEach(function (x) { o = o[x] = o[x] && typeof o[x] === 'object' ? o[x] : {}; }); o[last] = v; }
  function load() {
    return Promise.all(['biz', 'party', 'item', 'doc'].map(function (s) { return NSStore.list(s); }).concat([NSStore.meta('settings'), NSStore.meta('lastBackup')])).then(function (r) {
      cache = { biz: r[0], party: r[1], item: r[2], doc: r[3] }; S = r[4] || {}; S._last = r[5] || 0;
      return cache;
    });
  }
  function title(s, r) {
    if (s === 'doc') return t('doc.' + (r.type || 'invoice')).replace(/^./, function (c) { return c.toUpperCase(); }) + ' ' + (r.no || '');
    return r[NAMEKEY[s]] || t('my.noname');
  }
  function sub(s, r) {
    if (s === 'doc') return NS.fmtDate(r.date) + ' · ' + esc(r.buyer && r.buyer.name || t('h.nocust')) + ' · <b>' + NS.money(r.total || 0) + '</b> · ' + esc(r.seller && r.seller.name || '') +
      ' <span class="pill' + (r.status === 'paid' ? ' ok' : '') + '">' + esc(t(r.status === 'paid' ? 'h.paidp' : 'h.unpaidp')) + '</span>';
    if (s === 'item') return [r.code && esc(r.code), r.hsn && 'HSN ' + esc(r.hsn), r.rate !== '' && r.rate != null && NS.money(NS.num(r.rate)) + (r.unit ? ' / ' + esc(r.unit) : ''), r.gst !== '' && r.gst != null && 'GST ' + esc(r.gst) + '%', r.kind === 'service' && esc(t('hub.k.service'))].filter(Boolean).join(' · ');
    var bits = [r.gstin && '<span class="mono">' + esc(r.gstin) + '</span>', r.state && esc(NS.stateName(r.state)), r.phone && esc(r.phone)];
    if (s === 'party' && r.role && r.role !== 'customer') bits.unshift(esc(t('hub.r.' + r.role)));
    return bits.filter(Boolean).join(' · ');
  }

  /* ---------- sections ---------- */
  function show(sec, focus) {
    if (SECS.indexOf(sec) < 0) sec = 'home';
    cur = sec; q = '';
    $$('[data-sec]').forEach(function (b) {
      var on = b.getAttribute('data-sec') === sec;
      b.setAttribute('aria-current', on ? 'page' : 'false');
      if (on && b.parentNode.scrollWidth > b.parentNode.clientWidth) b.parentNode.scrollLeft = b.offsetLeft - 40;
    });
    if (location.hash.slice(1) !== sec) history.replaceState(null, '', sec === 'home' ? location.pathname : '#' + sec);
    return load().then(function () {
      counts();
      var pane = $('[data-pane]');
      pane.innerHTML = sec === 'home' ? homeHtml() : sec === 'settings' ? settingsHtml() : sec === 'backup' ? backupHtml() : listHtml(sec);
      if (sec === 'settings') wireSettings(pane);
      if (sec === 'backup') wireBackup(pane);
      if (FORM[sec] || sec === 'doc') renderList();
      if (focus) { var h = $('h2', pane); if (h) { h.tabIndex = -1; h.focus(); } }
    });
  }
  function counts() {
    var n = { biz: cache.biz.length, party: cache.party.length, item: cache.item.length, doc: cache.doc.length };
    $$('[data-sec]').forEach(function (b) { var c = $('.n', b), s = b.getAttribute('data-sec'); if (c) c.textContent = n[s] != null ? n[s] : ''; });
    var m = $('[data-mode]'); if (m) m.textContent = t(NSStore.mode() === 'vault' ? 'my.vault' : 'my.local');
  }
  function homeHtml() {
    var c = cache, steps = [
      ['biz', c.biz.length > 0, 'hub.s1', '#biz'], ['party', c.party.length > 0, 'hub.s2', '#party'], ['item', c.item.length > 0, 'hub.s3', '#item'],
      ['settings', !!(S.invoice || S.defBiz), 'hub.s4', '#settings'], ['doc', c.doc.length > 0, 'hub.s5', BILLING], ['backup', !!S._last, 'hub.s6', '#backup']
    ];
    var done = steps.filter(function (s) { return s[1]; }).length;
    return '<h2>' + esc(t('hub.home')) + '</h2>' +
      '<div class="tiles">' + ['biz', 'party', 'item', 'doc'].map(function (s) {
        return '<a href="#' + s + '" class="tile"><b>' + c[s].length + '</b><span>' + esc(t('my.t.' + s)) + '</span></a>';
      }).join('') + '</div>' +
      '<div class="card"><h3>' + esc(t('hub.start')) + ' <small class="soft">' + done + ' / ' + steps.length + '</small></h3><ol class="steps">' + steps.map(function (s) {
        var ext = /^http/.test(s[3]);
        return '<li class="' + (s[1] ? 'ok' : '') + '"><span class="tick" aria-hidden="true">' + (s[1] ? '✓' : '') + '</span><a href="' + s[3] + '"' + (ext ? ' target="_blank" rel="noopener"' : '') + '>' + esc(t(s[2])) + '</a>' +
          (s[1] ? '<span class="sr">' + esc(t('hub.done')) + '</span>' : '') + '</li>';
      }).join('') + '</ol></div>' +
      '<div class="card"><h3>' + esc(t('hub.tools')) + '</h3><div class="cards"><a href="' + BILLING + '" target="_blank" rel="noopener"><b>' + esc(t('nav.billing')) + '</b><span>' + esc(t('hub.billing')) + '</span></a></div>' +
      '<p class="soft">' + esc(t('hub.toolsp')) + '</p></div>';
  }

  /* ---------- masters list ---------- */
  function listHtml(s) {
    var add = s === 'doc' ? '<a class="btn primary" href="' + BILLING + '" target="_blank" rel="noopener">' + esc(t('hub.newdoc')) + '</a>'
      : '<button type="button" class="btn primary" data-add>+ ' + esc(t('hub.add.' + s)) + '</button>';
    return '<div class="pane-hd"><h2>' + esc(t('my.t.' + s)) + '</h2>' + add + '</div>' +
      '<p class="soft">' + esc(t('hub.p.' + s)) + '</p>' +
      '<div class="tools-row"><label class="sr" for="my-q">' + esc(t('my.search')) + '</label><input id="my-q" type="search" placeholder="' + esc(t('my.ph')) + '">' +
      (s === 'doc' ? '' : '<label class="btn sm">' + esc(t('hub.imp')) + '<input type="file" accept=".csv,text/csv" data-imp hidden></label>') +
      '<button type="button" class="btn sm" data-exp>' + esc(t('hub.exp')) + '</button>' +
      (s === 'doc' ? '' : '<button type="button" class="link" data-tpl>' + esc(t('hub.tpl')) + '</button>') + '</div>' +
      '<ul class="my-list" data-list></ul>';
  }
  function renderList() {
    var list = $('[data-list]'); if (!list) return;
    var s = cur, rows = (cache[s] || []).filter(function (r) {
      return !q || JSON.stringify([title(s, r), r.gstin, r.hsn, r.code, r.phone, r.buyer && r.buyer.name, r.seller && r.seller.name]).toLowerCase().indexOf(q) >= 0;
    });
    rows.sort(function (a, b) { return s === 'doc' ? (b.date || '').localeCompare(a.date || '') || (b.no || '').localeCompare(a.no || '') : title(s, a).localeCompare(title(s, b)); });
    list.innerHTML = rows.length ? rows.map(function (r) {
      var def = s === 'biz' && S.defBiz === r.id;
      return '<li data-id="' + esc(r.id) + '"><div class="hd2"><div class="who">' + (s === 'biz' && r.logo ? '<img src="' + esc(r.logo) + '" alt="">' : '') +
        '<div><b class="ttl">' + esc(title(s, r)) + '</b>' + (def ? ' <span class="pill ok">' + esc(t('hub.default')) + '</span>' : '') + '<div class="sub">' + sub(s, r) + '</div></div></div><div class="row">' +
        (s === 'biz' && !def ? '<button type="button" class="btn sm" data-def>' + esc(t('hub.makedef')) + '</button>' : '') +
        (s === 'doc' ? '' : '<button type="button" class="btn sm" data-edit>' + esc(t('my.edit')) + '</button>') +
        '<button type="button" class="btn sm danger" data-del>' + esc(t('h.del')) + '</button></div></div></li>';
    }).join('') : '<li class="empty">' + esc(t(q ? 'h.nomatch' : 'hub.empty.' + s)) + '</li>';
  }

  /* ---------- add / edit form ---------- */
  function fieldHtml(f, r) {
    var k = f[0], lbl = t(f[1]), kind = f[2], x = f[3] || {}, v = get(r, k), id = 'fm-' + k.replace('.', '-');
    v = v == null ? '' : v;
    var cls = 'f' + (x.wide || kind === 'area' ? ' wide' : ''), req = x.req ? ' required' : '', h;
    if (kind === 'area') h = '<textarea id="' + id + '" name="' + k + '" rows="2" dir="auto">' + esc(v) + '</textarea>';
    else if (kind === 'state') h = '<select id="' + id + '" name="' + k + '"><option value="">—</option>' + NS.STATES.map(function (s) { return '<option value="' + s[0] + '"' + (s[0] === v ? ' selected' : '') + '>' + s[0] + ' · ' + esc(s[1]) + '</option>'; }).join('') + '</select>';
    else if (kind === 'sel') h = '<select id="' + id + '" name="' + k + '">' + x.opts.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === v ? ' selected' : '') + '>' + esc(t(o[1])) + '</option>'; }).join('') + '</select>';
    else if (kind === 'gst') h = '<select id="' + id + '" name="' + k + '"><option value="">—</option>' + RATES.map(function (g) { return '<option value="' + g + '"' + (String(g) === String(v) ? ' selected' : '') + '>' + g + '%</option>'; }).join('') + '</select>';
    else if (kind === 'img') h = '<div class="imgf"><img alt="" data-img="' + k + '"' + (v ? ' src="' + esc(v) + '"' : ' hidden') + '><input id="' + id + '" type="file" accept="image/*" data-imgin="' + k + '" data-max="' + x.max + '">' +
      '<button type="button" class="link" data-imgrm="' + k + '"' + (v ? '' : ' hidden') + '>' + esc(t('hub.rmimg')) + '</button></div>';
    else {
      var attrs = ' id="' + id + '" name="' + k + '" value="' + esc(v) + '"' + req;
      if (kind === 'ltr' || kind === 'gstin' || kind === 'num' || kind === 'unit') attrs += ' dir="ltr"'; else attrs += ' dir="auto"';
      if (x.type) attrs += ' type="' + x.type + '"';
      if (x.mode) attrs += ' inputmode="' + x.mode + '"';
      if (kind === 'num') attrs += ' inputmode="decimal"';
      if (x.max) attrs += ' maxlength="' + x.max + '"';
      if (kind === 'gstin') attrs += ' maxlength="15" autocapitalize="characters" spellcheck="false"';
      if (x.upper) attrs += ' autocapitalize="characters"';
      if (x.ph) attrs += ' placeholder="' + esc(x.ph) + '"';
      if (kind === 'unit') attrs += ' list="hub-units"';
      h = '<input' + attrs + '>';
    }
    var hint = kind === 'gstin' ? '<small class="hint" data-gst-hint aria-live="polite"></small>' : x.hint ? '<small class="hint">' + esc(t(x.hint)) + '</small>' : '';
    return '<div class="' + cls + '"><label for="' + id + '">' + esc(lbl) + (x.req ? ' *' : '') + '</label>' + h + hint + '</div>';
  }
  function openForm(s, id) {
    var dlg = $('#hub-form'), r = id ? JSON.parse(JSON.stringify(cache[s].filter(function (x) { return x.id === id; })[0] || {})) : (s === 'party' ? { role: 'customer' } : s === 'item' ? { kind: 'goods', unit: 'Nos', gst: 18 } : {});
    var imgs = { logo: r.logo || '', sign: r.sign || '' };
    $('[data-form-title]', dlg).textContent = t(id ? 'hub.edit.' + s : 'hub.add.' + s);
    var f = $('form', dlg);
    f.innerHTML = '<div class="fg">' + FORM[s].map(function (x) { return fieldHtml(x, r); }).join('') + '</div>' +
      '<datalist id="hub-units">' + UNITS.map(function (u) { return '<option value="' + u + '">'; }).join('') + '</datalist>' +
      '<div class="dlg-foot"><button type="submit" class="btn primary">' + esc(t(id ? 'my.savech' : 'hub.save')) + '</button>' +
      (id ? '' : '<button type="submit" class="btn" data-again>' + esc(t('hub.saveadd')) + '</button>') +
      '<button type="button" class="btn" data-close>' + esc(t('my.cancel')) + '</button></div>';
    var g = $('[name=gstin]', f);
    function gstHint() {
      if (!g) return;
      g.value = g.value.toUpperCase().replace(/\s/g, '');
      var c = NS.gstinCheck(g.value), h = $('[data-gst-hint]', f), st = $('[name=state]', f);
      if (c.empty) { h.textContent = ''; h.className = 'hint'; return; }
      if (g.value.length < 15) { h.textContent = t('hub.gst.typing', { n: 15 - g.value.length }); h.className = 'hint'; return; }
      h.textContent = c.ok ? t('hub.gst.ok', { state: NS.stateName(c.state) || '—', pan: c.pan }) : c.msg;
      h.className = 'hint ' + (c.ok ? 'good' : 'bad');
      if (c.ok && c.state && st && !st.value) st.value = c.state;
    }
    if (g) { g.addEventListener('input', gstHint); gstHint(); }
    $$('[data-imgin]', f).forEach(function (inp) {
      inp.addEventListener('change', function () {
        var file = inp.files[0], k = inp.getAttribute('data-imgin');
        if (file) shrink(file, +inp.getAttribute('data-max')).then(function (u) { imgs[k] = u; var im = $('[data-img="' + k + '"]', f); im.src = u; im.hidden = !u; $('[data-imgrm="' + k + '"]', f).hidden = !u; });
      });
    });
    $$('[data-imgrm]', f).forEach(function (b) {
      b.addEventListener('click', function () { var k = b.getAttribute('data-imgrm'); imgs[k] = ''; $('[data-img="' + k + '"]', f).hidden = true; b.hidden = true; $('[data-imgin="' + k + '"]', f).value = ''; });
    });
    $('[data-close]', f).addEventListener('click', function () { dlg.close(); });
    var again = false;
    var ag = $('[data-again]', f); if (ag) ag.addEventListener('click', function () { again = true; });
    f.onsubmit = function (e) {
      e.preventDefault();
      FORM[s].forEach(function (x) {
        if (x[2] === 'img') { r[x[0]] = imgs[x[0]]; return; }
        var el = f.elements[x[0]], v = el.value.trim();
        if (x[2] === 'gstin' || (x[3] && x[3].upper)) v = v.toUpperCase().replace(/\s/g, '');
        set(r, x[0], v);
      });
      if (s === 'item') { if (r.rate !== '') r.rate = NS.num(r.rate); if (r.gst !== '') r.gst = +r.gst; }
      if (s === 'party' && r.ship && !r.ship.addr) delete r.ship;
      var nm = key(r[NAMEKEY[s]]);
      if (!nm) { NS.toast(t('hub.v.name'), 'bad'); again = false; return; }
      if (cache[s].some(function (x) { return x.id !== r.id && key(x[NAMEKEY[s]]) === nm; })) { NS.toast(t('hub.v.dup', { name: r[NAMEKEY[s]] }), 'bad'); again = false; return; }
      if (r.gstin && !NS.gstinCheck(r.gstin).ok) { NS.toast(NS.gstinCheck(r.gstin).msg, 'bad'); g.focus(); again = false; return; }
      if (r.bankIfsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(r.bankIfsc)) { NS.toast(t('hub.v.ifsc'), 'bad'); f.elements.bankIfsc.focus(); again = false; return; }
      var first = s === 'biz' && !cache.biz.length && !S.defBiz;
      NSStore.put(s, r).then(function (saved) {
        NS.toast(t('my.saved'));
        if (first) { S.defBiz = saved.id; return saveSettings(); }
      }).then(function () {
        var a = again; again = false;
        return show(s).then(function () { if (a) openForm(s); else dlg.close(); });
      }).catch(function (err) { NS.toast(t('nosave', { e: err.message }), 'bad'); });
    };
    if (!dlg.open) { if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', ''); }
    var firstIn = $('input:not([type=file]),select,textarea', f); if (firstIn && !(s === 'party')) firstIn.focus(); else if ($('[name=name]', f)) $('[name=name]', f).focus();
  }
  function shrink(file, max) {
    return new Promise(function (res) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url); res(c.toDataURL('image/png'));
      };
      img.onerror = function () { NS.toast(t('img.bad'), 'bad'); res(''); };
      img.src = url;
    });
  }

  /* ---------- settings ---------- */
  function saveSettings() { var o = JSON.parse(JSON.stringify(S)); delete o._last; return NSStore.meta('settings', o); }
  function settingsHtml() {
    var c = S.invoice || {}, sel = function (v, w) { return String(v) === String(w) ? ' selected' : ''; };
    var gst = c.gst != null && c.gst !== '' ? c.gst : 18, acc = c.accent || ACCENTS[0];
    return '<h2>' + esc(t('my.t.settings')) + '</h2><p class="soft">' + esc(t('hub.p.settings')) + '</p><form class="set" data-set>' +
      '<fieldset class="card"><legend>' + esc(t('hub.g.gen')) + '</legend><div class="fg">' +
        '<div class="f wide"><label for="st-def">' + esc(t('hub.defbiz')) + '</label><select id="st-def" name="defBiz"><option value="">' + esc(t('hub.nodef')) + '</option>' +
          cache.biz.map(function (b) { return '<option value="' + esc(b.id) + '"' + sel(b.id, S.defBiz) + '>' + esc(b.name) + '</option>'; }).join('') + '</select><small class="hint">' + esc(t('hub.h.defbiz')) + '</small></div>' +
        '<div class="f"><label for="st-rem">' + esc(t('hub.remind')) + '</label><select id="st-rem" name="remindDays">' + [7, 15, 30, 0].map(function (d) {
          return '<option value="' + d + '"' + sel(d, S.remindDays != null ? S.remindDays : 7) + '>' + esc(d ? t('hub.every', { n: d }) : t('hub.never')) + '</option>'; }).join('') + '</select></div>' +
        '<div class="f"><span class="lbl">' + esc(t('lang')) + '</span><small class="hint">' + esc(t('hub.h.lang')) + '</small></div>' +
      '</div></fieldset>' +
      '<fieldset class="card"><legend>' + esc(t('hub.g.num')) + '</legend><div class="fg">' +
        '<div class="f"><label for="st-pre">' + esc(t('hub.prefix')) + '</label><input id="st-pre" name="prefix" dir="ltr" maxlength="8" value="' + esc(c.prefix != null ? c.prefix : 'INV') + '" autocapitalize="characters"></div>' +
        '<div class="f"><label for="st-dig">' + esc(t('hub.digits')) + '</label><select id="st-dig" name="digits">' + [1, 2, 3, 4, 5, 6].map(function (d) { return '<option' + sel(d, c.digits || 3) + '>' + d + '</option>'; }).join('') + '</select></div>' +
        '<div class="f wide"><label class="chk"><input type="checkbox" name="fy"' + (c.fy === false ? '' : ' checked') + '> ' + esc(t('hub.fy')) + '</label></div>' +
        '<div class="f wide"><span class="lbl">' + esc(t('hub.next')) + '</span><b class="mono preview-no" data-no-pv></b><small class="hint">' + esc(t('hub.h.num')) + '</small></div>' +
      '</div></fieldset>' +
      '<fieldset class="card"><legend>' + esc(t('hub.g.new')) + '</legend><div class="fg">' +
        '<div class="f"><label for="st-kind">' + esc(t('l.type')) + '</label><select id="st-kind" name="kind">' + ['tax', 'supply', 'plain'].map(function (k) { return '<option value="' + k + '"' + sel(k, c.kind || 'tax') + '>' + esc(t('k.' + k)) + '</option>'; }).join('') + '</select></div>' +
        '<div class="f"><label for="st-gst">' + esc(t('hub.defgst')) + '</label><select id="st-gst" name="gst">' + RATES.map(function (g) { return '<option value="' + g + '"' + sel(g, gst) + '>' + g + '%</option>'; }).join('') + '</select></div>' +
        '<div class="f"><label for="st-unit">' + esc(t('hub.defunit')) + '</label><input id="st-unit" name="unit" dir="ltr" list="st-units" value="' + esc(c.unit || 'Nos') + '"><datalist id="st-units">' + UNITS.map(function (u) { return '<option value="' + u + '">'; }).join('') + '</datalist></div>' +
        '<div class="f"><label class="chk"><input type="checkbox" name="round"' + (c.round === false ? '' : ' checked') + '> ' + esc(t('l.round')) + '</label></div>' +
        '<div class="f wide"><span class="lbl" id="st-acc-l">' + esc(t('l.colour')) + '</span><div class="swatches" role="radiogroup" aria-labelledby="st-acc-l">' + ACCENTS.map(function (a, i) {
          return '<button type="button" role="radio" aria-checked="' + (a === acc) + '" data-acc="' + a + '" style="background:' + a + '" aria-label="' + esc(t('l.colour')) + ' ' + (i + 1) + '"></button>'; }).join('') + '</div></div>' +
        '<div class="f wide"><label for="st-notes">' + esc(t('l.notes')) + '</label><textarea id="st-notes" name="notes" rows="2" dir="auto" placeholder="' + esc(t('ph.notes')) + '">' + esc(c.notes || '') + '</textarea></div>' +
        '<div class="f wide"><label for="st-terms">' + esc(t('l.terms')) + '</label><textarea id="st-terms" name="terms" rows="3" dir="auto" placeholder="' + esc(t('ph.terms')) + '">' + esc(c.terms || '') + '</textarea><small class="hint">' + esc(t('hub.h.new')) + '</small></div>' +
      '</div></fieldset>' +
      '<div class="btns sticky-save"><button type="submit" class="btn primary">' + esc(t('hub.saveset')) + '</button><button type="button" class="btn" data-reset>' + esc(t('hub.reset')) + '</button></div></form>';
  }
  function wireSettings(pane) {
    var f = $('[data-set]', pane), acc = (S.invoice && S.invoice.accent) || ACCENTS[0];
    function pv() {
      var fy = NS.fy(NS.today()), short = fy.slice(2, 4) + '-' + fy.slice(5), pre = f.elements.prefix.value.trim().toUpperCase().replace(/[^A-Z0-9\/\-]/g, '');
      f.elements.prefix.value = pre;
      $('[data-no-pv]', f).textContent = (pre ? pre + '/' : '') + (f.elements.fy.checked ? short + '/' : '') + String(1).padStart(+f.elements.digits.value, '0');
    }
    ['prefix', 'digits', 'fy'].forEach(function (n) { f.elements[n].addEventListener('input', pv); f.elements[n].addEventListener('change', pv); });
    pv();
    $$('[data-acc]', f).forEach(function (b) {
      b.addEventListener('click', function () { acc = b.getAttribute('data-acc'); $$('[data-acc]', f).forEach(function (x) { x.setAttribute('aria-checked', String(x === b)); }); });
    });
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var E = f.elements;
      S.defBiz = E.defBiz.value || '';
      S.remindDays = +E.remindDays.value;
      S.invoice = { prefix: E.prefix.value.trim(), digits: +E.digits.value, fy: E.fy.checked, kind: E.kind.value, gst: +E.gst.value, unit: E.unit.value.trim() || 'Nos',
        round: E.round.checked, accent: acc, notes: E.notes.value.trim(), terms: E.terms.value.trim() };
      saveSettings().then(function () { NS.toast(t('hub.setsaved')); counts(); });
    });
    $('[data-reset]', f).addEventListener('click', function () {
      if (!confirm(t('hub.c.reset'))) return;
      delete S.invoice; S.remindDays = 7;
      saveSettings().then(function () { NS.toast(t('hub.setsaved')); show('settings'); });
    });
  }

  /* ---------- backup and devices ---------- */
  function backupHtml() {
    return '<h2>' + esc(t('hub.backup')) + '</h2><p class="soft">' + esc(t('hub.p.backup')) + '</p>' +
      '<div class="card"><p>' + esc(t('md.last')) + ' <b>' + (S._last ? new Date(S._last).toLocaleString('en-IN') : esc(t('md.never'))) + '</b></p>' +
      '<div class="btns"><button type="button" class="btn primary" data-act="backup">' + esc(t('md.save')) + '</button>' +
      '<label class="btn"><span>' + esc(t('md.restore')) + '</span><input type="file" accept=".json,application/json" data-act="restore" hidden></label>' +
      '<button type="button" class="btn" data-act="my-data">' + esc(t('my.auto')) + '</button></div>' +
      '<p class="soft" data-store-info></p><p class="soft">' + t('hub.move', { link: '<a href="' + BILLING + 'move-data/" target="_blank" rel="noopener">' + esc(t('nav.move')) + '</a>' }) + '</p></div>' +
      '<div class="card danger-zone"><h3>' + esc(t('my.wipe.t')) + '</h3><p class="soft">' + esc(t('my.wipe.p')) + '</p>' +
      '<button type="button" class="btn danger" data-wipe>' + esc(t('my.wipe.b')) + '</button></div>';
  }
  function wireBackup(pane) {
    NSStore.estimate().then(function (e) {
      if (e && e.usage != null) $('[data-store-info]', pane).textContent = t('hub.used', { mb: (e.usage / 1048576).toFixed(1) });
    }).catch(function () {});
    $('[data-wipe]', pane).addEventListener('click', function () {
      if (!confirm(t('my.wipe.c1'))) return;
      if (prompt(t('my.wipe.c2')) !== 'DELETE') return;
      Promise.all(['biz', 'party', 'item', 'doc'].map(function (s) {
        return NSStore.list(s).then(function (rows) { return Promise.all(rows.map(function (r) { return NSStore.del(s, r.id); })); });
      })).then(function () { NS.toast(t('my.wiped')); show('backup'); });
    });
  }

  /* ---------- CSV import / export ---------- */
  function csvCell(v) { v = v == null ? '' : String(v); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function download(name, text) {
    var a = NS.el('a', { href: URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' })), download: name });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }
  function exportCsv(s, blankOnly) {
    if (s === 'doc') {
      var hd = ['Type', 'Number', 'Date', 'Customer', 'Customer GSTIN', 'Business', 'Total', 'Status'];
      var rows = cache.doc.slice().sort(function (a, b) { return (a.date || '').localeCompare(b.date || ''); }).map(function (d) {
        return [d.type, d.no, d.date, d.buyer && d.buyer.name, d.buyer && d.buyer.gstin, d.seller && d.seller.name, NS.r2(d.total || 0), d.status === 'paid' ? 'Paid' : 'Not paid'];
      });
      return download('documents-' + NS.today() + '.csv', [hd].concat(rows).map(function (r) { return r.map(csvCell).join(','); }).join('\r\n'));
    }
    var cols = CSV[s], lines = [cols.map(function (c) { return c[1]; })];
    if (blankOnly) lines.push(cols.map(function (c) { return { role: 'customer', kind: 'goods', unit: 'Nos', gst: '18', state: '03' }[c[0]] || ''; }));
    else cache[s].forEach(function (r) { lines.push(cols.map(function (c) { return get(r, c[0]); })); });
    download((blankOnly ? 'template-' : '') + { biz: 'businesses', party: 'customers-suppliers', item: 'items-services' }[s] + (blankOnly ? '' : '-' + NS.today()) + '.csv', lines.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n'));
  }
  function parseCsv(txt) {
    txt = txt.replace(/^﻿/, '');
    var rows = [], row = [], cell = '', inq = false, i, c;
    var sep = (txt.split('\n')[0].match(/;/g) || []).length > (txt.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
    for (i = 0; i < txt.length; i++) {
      c = txt[i];
      if (inq) { if (c === '"') { if (txt[i + 1] === '"') { cell += '"'; i++; } else inq = false; } else cell += c; }
      else if (c === '"') inq = true;
      else if (c === sep) { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && txt[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (x) { return x.trim(); }); });
  }
  function stateCode(v) {
    v = String(v || '').trim(); if (!v) return '';
    if (/^\d{1,2}$/.test(v)) { v = v.padStart(2, '0'); return NS.stateName(v) ? v : ''; }
    var hit = NS.STATES.filter(function (s) { return key(s[1]) === key(v); })[0];
    return hit ? hit[0] : '';
  }
  function importCsv(s, file) {
    file.text().then(function (txt) {
      var rows = parseCsv(txt);
      if (rows.length < 2) throw new Error(t('hub.imp.empty'));
      var cols = CSV[s], head = rows[0].map(function (h) { return key(h).replace(/[^a-z0-9%]/g, ''); });
      var idx = cols.map(function (c) { var n = key(c[1]).replace(/[^a-z0-9%]/g, ''), alt = key(c[0]).replace(/[^a-z0-9]/g, ''); var i = head.indexOf(n); return i >= 0 ? i : head.indexOf(alt); });
      var nameCol = cols.map(function (c) { return c[0]; }).indexOf(NAMEKEY[s]);
      if (idx[nameCol] < 0) throw new Error(t('hub.imp.nohead', { col: cols[nameCol][1] }));
      var byName = {}; cache[s].forEach(function (r) { byName[key(r[NAMEKEY[s]])] = r; });
      var add = 0, upd = 0, bad = [], puts = [];
      rows.slice(1).forEach(function (cells, n) {
        var r = {}, line = n + 2;
        cols.forEach(function (c, j) { if (idx[j] >= 0 && cells[idx[j]] != null && String(cells[idx[j]]).trim() !== '') set(r, c[0], String(cells[idx[j]]).trim()); });
        var nm = key(r[NAMEKEY[s]]); if (!nm) return;
        if (r.state) r.state = stateCode(r.state);
        if (r.ship && r.ship.state) r.ship.state = stateCode(r.ship.state);
        if (r.gstin) { r.gstin = r.gstin.toUpperCase().replace(/\s/g, ''); var g = NS.gstinCheck(r.gstin); if (!g.ok) { bad.push(line); return; } if (!r.state && g.state) r.state = g.state; }
        if (r.role) r.role = /supp/i.test(r.role) ? (/both|cust/i.test(r.role) ? 'both' : 'supplier') : /both/i.test(r.role) ? 'both' : 'customer';
        if (r.kind) r.kind = /serv/i.test(r.kind) ? 'service' : 'goods';
        if (r.rate != null) r.rate = NS.num(r.rate);
        if (r.gst != null) r.gst = NS.num(String(r.gst).replace('%', ''));
        var have = byName[nm];
        if (have) { Object.keys(r).forEach(function (k) { if (k === 'ship') have.ship = Object.assign(have.ship || {}, r.ship); else have[k] = r[k]; }); puts.push(have); upd++; }
        else { if (s === 'party' && !r.role) r.role = 'customer'; if (s === 'item' && !r.kind) r.kind = 'goods'; byName[nm] = r; puts.push(r); add++; }
      });
      return puts.reduce(function (p, r) { return p.then(function () { return NSStore.put(s, r); }); }, Promise.resolve()).then(function () {
        NS.toast(t('hub.imp.done', { a: add, u: upd }) + (bad.length ? ' ' + t('hub.imp.bad', { rows: bad.slice(0, 8).join(', ') + (bad.length > 8 ? '…' : '') }) : ''), bad.length ? 'bad' : '');
        return show(s);
      });
    }).catch(function (e) { NS.toast(e.message || t('bk.unread'), 'bad'); });
  }

  /* ---------- start ---------- */
  function init() {
    if (!$('#my-app')) return;
    NSStore.ready().then(function () { return show(location.hash.slice(1) || 'home'); });
    $$('[data-sec]').forEach(function (b) {
      b.addEventListener('click', function (e) { e.preventDefault(); show(b.getAttribute('data-sec'), true); });
    });
    window.addEventListener('hashchange', function () { var h = location.hash.slice(1) || 'home'; if (h !== cur) show(h); });
    var pane = $('[data-pane]');
    pane.addEventListener('click', function (e) {
      var a = e.target.closest('a[href^="#"]');
      if (a && SECS.indexOf(a.getAttribute('href').slice(1)) >= 0) { e.preventDefault(); show(a.getAttribute('href').slice(1), true); return; }
      if (e.target.closest('[data-add]')) return openForm(cur);
      if (e.target.closest('[data-exp]')) return exportCsv(cur);
      if (e.target.closest('[data-tpl]')) return exportCsv(cur, true);
      var li = e.target.closest('li[data-id]'); if (!li) return;
      var id = li.getAttribute('data-id');
      if (e.target.closest('[data-edit]')) openForm(cur, id);
      else if (e.target.closest('[data-def]')) { S.defBiz = id; saveSettings().then(function () { NS.toast(t('hub.setsaved')); show('biz'); }); }
      else if (e.target.closest('[data-del]') && confirm(t('my.c.del', { name: $('.ttl', li).textContent }))) {
        NSStore.del(cur, id).then(function () {
          if (cur === 'biz' && S.defBiz === id) { S.defBiz = ''; return saveSettings(); }
        }).then(function () { NS.toast(t('deleted')); show(cur); });
      }
    });
    pane.addEventListener('input', function (e) { if (e.target.id === 'my-q') { q = e.target.value.trim().toLowerCase(); renderList(); } });
    pane.addEventListener('change', function (e) { if (e.target.hasAttribute('data-imp') && e.target.files[0]) { importCsv(cur, e.target.files[0]); e.target.value = ''; } });
    NS.onRestore = function () { show(cur); };
    document.addEventListener('ns-lang', function () { show(cur); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
