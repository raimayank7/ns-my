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
  var LOCAL = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  var BILLING = LOCAL ? 'http://localhost:8861/' : 'https://billing.niveshsahayak.in/';
  /* every document tool [site, host, name key, line key, local port] (build.py TOOLS); which site makes which document type */
  var TOOLS = (window.NS_CFG && NS_CFG.tools) || [['billing', 'billing.niveshsahayak.in', 'nav.billing', 'hub.billing', 8861]];
  var SITEOF = { invoice: 'billing', quote: 'quotation', proforma: 'proforma', so: 'sales-order', challan: 'challan', po: 'purchase-order', self: 'self-invoice', note: 'credit-note', cashmemo: 'cash-memo',
    receipt: 'receipt', voucher: 'voucher', rent: 'rent-receipt', salary: 'salary-slip', petty: 'petty-cash' };
  function toolUrl(site) { if (site === 'app') return APP; var x = TOOLS.filter(function (x) { return x[0] === site; })[0] || TOOLS[0]; return LOCAL ? 'http://localhost:' + x[4] + '/' : 'https://' + x[1] + '/'; }
  /* records made in the Nivesh Sahayak App (purchase bills, expenses, opening balances) open there */
  var APP = LOCAL ? 'http://localhost:8880/' : 'https://app.niveshsahayak.in/';
  var APPDOC = { pbill: ['Purchase bill', '#buy'], exp: ['Expense', '#buy'], ob: ['Opening balance', '#money'] };
  /* number prefixes of the other documents (Settings); quotation and credit note have two series each */
  var PREFIXES = [['quote', 'quote', 'QT', 'k.quote'], ['quote', 'estimate', 'EST', 'k.estimate'], ['proforma', '', 'PI', 'Doc.proforma'], ['so', '', 'SO', 'Doc.so'], ['challan', '', 'DC', 'Doc.challan'],
    ['po', '', 'PO', 'Doc.po'], ['self', '', 'SI', 'Doc.self'], ['note', 'credit', 'CN', 'k.credit'], ['note', 'debit', 'DN', 'k.debit'], ['cashmemo', '', 'CM', 'Doc.cashmemo'], ['receipt', '', 'RCT', 'Doc.receipt'],
    ['voucher', '', 'PV', 'Doc.voucher'], ['rent', '', 'RR', 'Doc.rent'], ['salary', '', 'SAL', 'Doc.salary'], ['petty', '', 'PCB', 'Doc.petty']];

  /* field: [key, label key, kind, extra]; kinds: text, area, state, gstin, sel, num, img, unit, gst, ltr */
  var FORM = {
    biz: [
      ['name', 'l.bname', 'text', { req: 1, wide: 1 }], ['addr', 'l.addr', 'area', { wide: 1 }], ['city', 'l.city', 'text'], ['pin', 'l.pin', 'ltr', { mode: 'numeric', max: 6 }], ['state', 'l.state', 'state'], ['gstin', 'l.gstin', 'gstin'],
      ['reg', 'hub.reg', 'sel', { opts: [['regular', 'hub.rg.regular'], ['comp', 'hub.rg.comp'], ['unreg', 'hub.rg.unreg'], ['sez', 'hub.rg.sez']] }],
      ['aato', 'ei.aato', 'sel', { opts: [['', 'ei.a.none'], ['lt5', 'ei.a.lt5'], ['5to10', 'ei.a.5to10'], ['10p', 'ei.a.10p']] }],
      ['phone', 'l.phone', 'ltr', { mode: 'tel' }], ['email', 'l.email', 'ltr', { type: 'email' }],
      ['bankName', 'l.bank', 'text'], ['bankAcc', 'l.acc', 'ltr', { mode: 'numeric' }], ['bankIfsc', 'l.ifsc', 'ltr', { max: 11, upper: 1 }], ['bankBranch', 'l.branch', 'text'],
      ['upi', 'l.upi', 'ltr', { wide: 1, ph: 'name@bank' }], ['logo', 'l.logo', 'img', { max: 360 }], ['sign', 'l.sign', 'img', { max: 420 }]
    ],
    party: [
      ['role', 'hub.role', 'sel', { opts: [['customer', 'hub.r.customer'], ['supplier', 'hub.r.supplier'], ['both', 'hub.r.both']] }],
      ['name', 'my.f.name', 'text', { req: 1 }], ['phone', 'l.phone', 'ltr', { mode: 'tel' }], ['email', 'l.email', 'ltr', { type: 'email' }],
      ['gstin', 'l.cgstin', 'gstin'], ['state', 'l.state', 'state'], ['addr', 'l.addr', 'area', { wide: 1 }], ['city', 'l.city', 'text'], ['pin', 'l.pin', 'ltr', { mode: 'numeric', max: 6 }],
      ['ship.addr', 'l.shaddr', 'area', { wide: 1, hint: 'hub.h.ship' }], ['ship.state', 'l.shstate', 'state'],
      /* Batch 1: price type and credit terms */
      ['ptype', 'b1.ptype', 'sel', { opts: [['retail', 'b1.pt_retail'], ['wholesale', 'b1.pt_whole']], hint: 'b1.h_ptype' }],
      ['climit', 'b1.climit', 'num', { hint: 'b1.h_climit' }], ['cdays', 'b1.cdays', 'num', { hint: 'b1.h_cdays' }]
    ],
    item: [
      ['desc', 'hub.f.iname', 'text', { req: 1, wide: 1 }], ['kind', 'l.type', 'sel', { opts: [['goods', 'hub.k.goods'], ['service', 'hub.k.service']] }],
      ['cat', 'b1.cat', 'cat', { hint: 'b1.h_cat' }],
      ['code', 'hub.f.code', 'ltr'], ['hsn', 'l.hsn', 'ltr', { mode: 'numeric', max: 8 }], ['unit', 'l.unit', 'unit'],
      ['rate', 'b1.retail', 'num', { hint: 'b1.h_retail' }], ['wrate', 'b1.whole', 'num'], ['mrp', 'b1.mrp', 'num'], ['prate', 'b1.prate', 'num'], ['gst', 'l.gst', 'gst']
    ]
  };
  /* CSV columns (English headers, so a file works in any language) */
  var CSV = {
    biz: [['name', 'Name'], ['addr', 'Address'], ['city', 'City'], ['pin', 'PIN code'], ['state', 'State code'], ['gstin', 'GSTIN'], ['phone', 'Phone'], ['email', 'Email'], ['bankName', 'Bank'], ['bankAcc', 'Account no'], ['bankIfsc', 'IFSC'], ['bankBranch', 'Branch'], ['upi', 'UPI ID'], ['gst.legal', 'Legal name'], ['gst.trade', 'Trade name']],
    party: [['role', 'Type'], ['name', 'Name'], ['phone', 'Phone'], ['email', 'Email'], ['addr', 'Address'], ['city', 'City'], ['pin', 'PIN code'], ['state', 'State code'], ['gstin', 'GSTIN'], ['ship.addr', 'Ship-to address'], ['ship.state', 'Ship-to state code'], ['gst.legal', 'Legal name'], ['gst.trade', 'Trade name'],
      ['ptype', 'Price type'], ['climit', 'Credit limit'], ['cdays', 'Credit days']],
    item: [['desc', 'Name'], ['kind', 'Type'], ['cat', 'Category'], ['code', 'Item code'], ['hsn', 'HSN/SAC'], ['unit', 'Unit'], ['rate', 'Rate'], ['wrate', 'Wholesale rate'], ['mrp', 'MRP'], ['prate', 'Purchase price'], ['gst', 'GST %']]
  };
  var NAMEKEY = { biz: 'name', party: 'name', item: 'desc' };
  var SECS = ['home', 'biz', 'party', 'item', 'doc', 'settings', 'backup', 'bin', 'log'];
  var NUMS = { rate: 1, wrate: 1, mrp: 1, prate: 1, climit: 1, cdays: 1 };
  var cur = 'home', q = '', cat = '', S = {}, cache = {};

  function key(s) { return String(s || '').trim().toLowerCase(); }
  function get(o, k) { return k.split('.').reduce(function (a, p) { return a == null ? a : a[p]; }, o); }
  function set(o, k, v) { var p = k.split('.'), last = p.pop(); p.forEach(function (x) { o = o[x] = o[x] && typeof o[x] === 'object' ? o[x] : {}; }); o[last] = v; }
  function load() {
    return Promise.all(['biz', 'party', 'item', 'doc', 'bin', 'log'].map(function (s) { return NSStore.list(s); }).concat([NSStore.meta('settings'), NSStore.meta('lastBackup'), NSStore.meta('who'), NSStore.meta('pin')])).then(function (r) {
      cache = { biz: r[0], party: r[1], item: r[2], doc: r[3], bin: r[4], log: r[5] }; S = r[6] || {}; S._last = r[7] || 0; S._who = r[8] || ''; S._pin = r[9] || null;
      return cache;
    });
  }
  function title(s, r) {
    if (s === 'doc' && APPDOC[r.type]) return (r.type === 'pbill' && r.kind === 'return' ? 'Purchase return' : APPDOC[r.type][0]) + ' ' + (r.no || '');
    if (s === 'doc') return t(r.kind === 'estimate' ? 'doc.estimate' : r.type === 'note' ? 'k.' + r.kind : 'doc.' + (r.type || 'invoice')).replace(/^./, function (c) { return c.toUpperCase(); }) + ' ' + (r.no || '');
    return r[NAMEKEY[s]] || t('my.noname');
  }
  function sub(s, r) {
    if (s === 'doc') return NS.fmtDate(r.date) + ' · ' + esc(r.buyer && r.buyer.name || t('h.nocust')) + ' · <b>' + NS.money(r.total || 0) + '</b> · ' + esc(r.seller && r.seller.name || '') +
      (!r.type || r.type === 'invoice' || r.type === 'cashmemo' ? ' <span class="pill' + (r.status === 'paid' ? ' ok' : '') + '">' + esc(t(r.status === 'paid' ? 'h.paidp' : 'h.unpaidp')) + '</span>'
        : r.status ? ' <span class="pill' + (/^(acc|inv|sdone|prec|nadj|nref)$/.test(r.status) ? ' ok' : '') + '">' + esc(t('qs.' + r.status)) + '</span>' : '') +
      (APPDOC[r.type] ? ' <a href="' + APP + APPDOC[r.type][1] + '" target="_blank" rel="noopener">Nivesh Sahayak App ›</a>' :
      ' <a href="' + toolUrl(SITEOF[r.type || 'invoice']) + '" target="_blank" rel="noopener">' + esc(t(TOOLS.filter(function (x) { return x[0] === SITEOF[r.type || 'invoice']; }).map(function (x) { return x[2]; })[0] || 'nav.billing')) + ' ›</a>');
    if (s === 'item') return [r.cat && '<span class="pill">' + esc(r.cat) + '</span>', r.code && esc(r.code), r.hsn && 'HSN ' + esc(r.hsn), r.rate !== '' && r.rate != null && NS.money(NS.num(r.rate)) + (r.unit ? ' / ' + esc(r.unit) : ''),
      NS.num(r.wrate) && esc(t('b1.whole')) + ' ' + NS.money(NS.num(r.wrate)), NS.num(r.mrp) && 'MRP ' + NS.money(NS.num(r.mrp)), r.gst !== '' && r.gst != null && 'GST ' + esc(r.gst) + '%', r.kind === 'service' && esc(t('hub.k.service')), r.sample && '<span class="b1-pill">' + esc(t('b1.sample')) + '</span>'].filter(Boolean).join(' · ');
    var bits = [r.gstin && '<span class="mono">' + esc(r.gstin) + '</span>', r.state && esc(NS.stateName(r.state)), r.phone && esc(r.phone)];
    if (s === 'party' && r.role && r.role !== 'customer') bits.unshift(esc(t('hub.r.' + r.role)));
    if (r.gst && r.gst.legal && key(r.gst.legal) !== key(r.name)) bits.push(esc(t('gf.legal')) + ': ' + esc(r.gst.legal));
    if (s === 'party' && r.ptype === 'wholesale') bits.push(esc(t('b1.pt_whole')));
    if (s === 'party' && NS.num(r.climit)) bits.push(esc(t('b1.climit')) + ' ' + NS.money(NS.num(r.climit)));
    if (s === 'party' && NS.num(r.cdays)) bits.push(esc(t('b1.ndays', { n: NS.num(r.cdays) })));
    if (r.sample) bits.push('<span class="b1-pill">' + esc(t('b1.sample')) + '</span>');
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
      pane.innerHTML = (NS.sample.has(cache) ? NS.sample.note() : '') + (sec === 'home' ? homeHtml() : sec === 'settings' ? settingsHtml() : sec === 'backup' ? backupHtml() : sec === 'bin' ? binHtml() : sec === 'log' ? logHtml() : listHtml(sec));
      if (sec === 'home' && !cache.biz.length) wireWizard(pane);
      if (sec === 'settings') { wireSettings(pane); wirePin(pane); }
      if (sec === 'backup') wireBackup(pane);
      if (FORM[sec] || sec === 'doc') renderList();
      if (focus) { var h = $('h2', pane); if (h) { h.tabIndex = -1; h.focus(); } }
    });
  }
  function counts() {
    var n = { biz: cache.biz.length, party: cache.party.length, item: cache.item.length, doc: cache.doc.length, bin: cache.bin.length || '' };
    $$('[data-sec]').forEach(function (b) { var c = $('.n', b), s = b.getAttribute('data-sec'); if (c) c.textContent = n[s] != null ? n[s] : ''; });
    var m = $('[data-mode]'); if (m) m.textContent = t(NSStore.mode() === 'vault' ? 'my.vault' : 'my.local');
  }
  function homeHtml() {
    var c = cache, steps = [
      ['biz', c.biz.length > 0, 'hub.s1', '#biz'], ['party', c.party.length > 0, 'hub.s2', '#party'], ['item', c.item.length > 0, 'hub.s3', '#item'],
      ['settings', !!(S.invoice || S.defBiz), 'hub.s4', '#settings'], ['doc', c.doc.length > 0, 'hub.s5', BILLING], ['backup', !!S._last, 'hub.s6', '#backup']
    ];
    var done = steps.filter(function (s) { return s[1]; }).length;
    return '<h2>' + esc(t('hub.home')) + '</h2>' + (c.biz.length ? '' : wizardHtml()) +
      '<div class="tiles">' + ['biz', 'party', 'item', 'doc'].map(function (s) {
        return '<a href="#' + s + '" class="tile"><b>' + c[s].length + '</b><span>' + esc(t('my.t.' + s)) + '</span></a>';
      }).join('') + '</div>' +
      '<div class="card"><h3>' + esc(t('hub.start')) + ' <small class="soft">' + done + ' / ' + steps.length + '</small></h3><ol class="steps">' + steps.map(function (s) {
        var ext = /^http/.test(s[3]);
        return '<li class="' + (s[1] ? 'ok' : '') + '"><span class="tick" aria-hidden="true">' + (s[1] ? '✓' : '') + '</span><a href="' + s[3] + '"' + (ext ? ' target="_blank" rel="noopener"' : '') + '>' + esc(t(s[2])) + '</a>' +
          (s[1] ? '<span class="sr">' + esc(t('hub.done')) + '</span>' : '') + '</li>';
      }).join('') + '</ol></div>' +
      '<div class="card"><h3>' + esc(t('hub.tools')) + '</h3><div class="cards">' + '<a href="' + APP + '" target="_blank" rel="noopener"><b>' + esc(t('nav.app')) + '</b><span>' + esc(t('hub.app')) + '</span></a>' + TOOLS.map(function (x) {
        return '<a href="' + toolUrl(x[0]) + '" target="_blank" rel="noopener"><b>' + esc(t(x[2])) + '</b><span>' + esc(t(x[3])) + '</span></a>'; }).join('') + '</div>' +
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
      (s === 'doc' ? '<button type="button" class="btn sm" data-xl>' + esc(t('b1.xl_reg')) + '</button>' : s === 'item' ? '<button type="button" class="btn sm" data-xl>' + esc(t('b1.xl_items')) + '</button>' : '') +
      (s === 'doc' ? '' : '<button type="button" class="link" data-tpl>' + esc(t('hub.tpl')) + '</button>') + '</div>' +
      (s === 'item' ? catChips() : '') +
      '<ul class="my-list" data-list></ul>';
  }
  function renderList() {
    var list = $('[data-list]'); if (!list) return;
    var s = cur, rows = (cache[s] || []).filter(function (r) {
      return !q || JSON.stringify([title(s, r), r.gstin, r.hsn, r.code, r.cat, r.phone, r.buyer && r.buyer.name, r.seller && r.seller.name]).toLowerCase().indexOf(q) >= 0;
    }).filter(function (r) { return s !== 'item' || !cat || (cat === '-' ? !r.cat : key(r.cat) === cat); });
    rows.sort(function (a, b) { return s === 'doc' ? (b.date || '').localeCompare(a.date || '') || (b.no || '').localeCompare(a.no || '') : title(s, a).localeCompare(title(s, b)); });
    list.innerHTML = rows.length ? rows.map(function (r) {
      var def = s === 'biz' && S.defBiz === r.id;
      return '<li data-id="' + esc(r.id) + '"><div class="hd2"><div class="who">' + (s === 'biz' && r.logo ? '<img src="' + esc(r.logo) + '" alt="">' : '') +
        '<div><b class="ttl">' + esc(title(s, r)) + '</b>' + (def ? ' <span class="pill ok">' + esc(t('hub.default')) + '</span>' : '') + '<div class="sub">' + sub(s, r) + (s === 'doc' && r.sample ? ' <span class="b1-pill">' + esc(t('b1.sample')) + '</span>' : '') + (s === 'doc' && r.rec && r.rec.every ? ' <span class="pill">' + esc(t(r.rec.every === 'quarter' ? 'b1.rep_q' : 'b1.rep_m')) + '</span>' : '') + '</div></div></div><div class="row">' +
        (s === 'biz' && !def ? '<button type="button" class="btn sm" data-def>' + esc(t('hub.makedef')) + '</button>' : '') +
        (s === 'doc' ? '' : '<button type="button" class="btn sm" data-edit>' + esc(t('my.edit')) + '</button>') +
        '<button type="button" class="btn sm" data-log>' + esc(t('b1.changes')) + '</button>' +
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
      if (kind === 'cat') attrs += ' list="hub-cats"';
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
      hubExt('form', s, r) +   /* sections added by other files (hubmore.js: stock tracking) */
      '<datalist id="hub-units">' + UNITS.map(function (u) { return '<option value="' + u + '">'; }).join('') + '</datalist>' +
      '<datalist id="hub-cats">' + cats().map(function (u) { return '<option value="' + esc(u) + '">'; }).join('') + '</datalist>' +
      '<div class="dlg-foot"><button type="submit" class="btn primary">' + esc(t(id ? 'my.savech' : 'hub.save')) + '</button>' +
      (id ? '' : '<button type="submit" class="btn" data-again>' + esc(t('hub.saveadd')) + '</button>') +
      '<button type="button" class="btn" data-close>' + esc(t('my.cancel')) + '</button></div>';
    if (r.gst && r.gst.legal && key(r.gst.legal) !== key(r.name) && $('[name=name]', f)) {
      var lh = document.createElement('small'); lh.className = 'hint'; lh.textContent = t('gf.legal') + ': ' + r.gst.legal;
      $('[name=name]', f).parentNode.appendChild(lh);
    }
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
    if (g && NS.gstFetchButton) NS.gstFetchButton(g, function (d) {
      ['name', 'addr', 'city', 'pin', 'state'].forEach(function (k) { var el = f.elements[k]; if (el && d[k]) el.value = d[k]; });
      if (s === 'biz' && d.reg && f.elements.reg) f.elements.reg.value = d.reg;
      if (s === 'party' && d.reg) r.reg = d.reg;
      r.gst = { legal: d.legal || '', trade: d.trade || '', status: d.status || '', type: d.type || '', since: d.since || '', checked: d.checked };
      gstHint();
      if (f.requestSubmit) f.requestSubmit(); else $('[type=submit]', f).click();
    });
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
      if (s === 'item') { if (r.gst !== '') r.gst = +r.gst; }
      Object.keys(NUMS).forEach(function (k) { if (r[k] != null && r[k] !== '') r[k] = NS.num(r[k]); });
      hubExt('read', s, r, f);
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

  /* ---------- Batch 1: getting started, categories, recycle bin, edit history, Excel ---------- */
  function wizardHtml() {
    return '<div class="card b1-wiz"><h3>' + esc(t('b1.wiz')) + '</h3><p class="soft">' + esc(t('b1.wizp')) + '</p><form data-wiz novalidate><div class="fg">' +
      '<div class="f wide"><label for="wz-name">' + esc(t('l.bname')) + ' *</label><input id="wz-name" name="name" dir="auto" required></div>' +
      '<div class="f"><label for="wz-state">' + esc(t('l.state')) + '</label><select id="wz-state" name="state"><option value="">—</option>' + NS.STATES.map(function (x) { return '<option value="' + x[0] + '">' + x[0] + ' · ' + esc(x[1]) + '</option>'; }).join('') + '</select></div>' +
      '<div class="f"><label for="wz-gstin">' + esc(t('l.gstin')) + '</label><input id="wz-gstin" name="gstin" dir="ltr" maxlength="15" autocapitalize="characters" spellcheck="false"><small class="hint">' + esc(t('b1.wiz_gst')) + '</small></div>' +
      '<div class="f"><label for="wz-phone">' + esc(t('l.phone')) + '</label><input id="wz-phone" name="phone" dir="ltr" inputmode="tel"></div>' +
      '<div class="f"><label for="wz-gst">' + esc(t('hub.defgst')) + '</label><select id="wz-gst" name="gst">' + RATES.map(function (g) { return '<option value="' + g + '"' + (g === 18 ? ' selected' : '') + '>' + g + '%</option>'; }).join('') + '</select></div>' +
      '<div class="f"><label for="wz-pre">' + esc(t('hub.prefix')) + '</label><input id="wz-pre" name="prefix" dir="ltr" maxlength="8" value="INV" autocapitalize="characters"></div>' +
      '</div><div class="btns"><button type="submit" class="btn primary">' + esc(t('b1.wiz_go')) + '</button><a class="btn" href="' + APP + '">' + esc(t('b1.samp_try')) + '</a></div>' +
      '<p class="soft">' + esc(t('b1.samp_h')) + '</p></form></div>';
  }
  function wireWizard(pane) {
    var f = $('[data-wiz]', pane); if (!f) return;
    f.elements.gstin.addEventListener('input', function () {
      var g = f.elements.gstin; g.value = g.value.toUpperCase().replace(/\s/g, '');
      var c = NS.gstinCheck(g.value); if (c.ok && c.state && !f.elements.state.value) f.elements.state.value = c.state;
    });
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var E = f.elements, name = E.name.value.trim(), g = E.gstin.value.trim();
      if (!name) { NS.toast(t('hub.v.name'), 'bad'); E.name.focus(); return; }
      if (g && !NS.gstinCheck(g).ok) { NS.toast(NS.gstinCheck(g).msg, 'bad'); E.gstin.focus(); return; }
      NSStore.put('biz', { name: name, state: E.state.value, gstin: g, phone: E.phone.value.trim(), reg: g ? 'regular' : 'unreg' }).then(function (b) {
        S.defBiz = b.id;
        S.invoice = Object.assign(S.invoice || {}, { prefix: E.prefix.value.trim().toUpperCase().replace(/[^A-Z0-9\/\-]/g, ''), gst: +E.gst.value });
        return saveSettings();
      }).then(function () { NS.toast(t('b1.wiz_done')); show('home'); }, function (err) { NS.toast(t('nosave', { e: err.message }), 'bad'); });
    });
  }
  function cats() {
    var seen = {}, out = [];
    cache.item.forEach(function (i) { var c = String(i.cat || '').trim(); if (c && !seen[key(c)]) { seen[key(c)] = 1; out.push(c); } });
    return out.sort(function (a, b) { return a.localeCompare(b); });
  }
  function catChips() {
    var list = cats(); if (!list.length) return '';
    return '<div class="seg cats" role="group" aria-label="' + esc(t('b1.cat')) + '">' + [['', t('b1.cat_all')]].concat(list.map(function (c) { return [key(c), c]; }), [['-', t('b1.cat_none')]]).map(function (c) {
      return '<button type="button" class="btn sm" data-cat="' + esc(c[0]) + '" aria-pressed="' + (cat === c[0]) + '">' + esc(c[1]) + '</button>'; }).join('') + '</div>';
  }
  function binHtml() {
    var rows = cache.bin.slice().sort(function (a, b) { return b.at - a.at; });
    return '<div class="pane-hd"><h2>' + esc(t('b1.bin')) + '</h2>' + (rows.length ? '<button type="button" class="btn sm danger" data-binempty>' + esc(t('b1.binempty')) + '</button>' : '') + '</div>' +
      '<p class="soft">' + esc(t('b1.binp', { n: NSStore.binDays })) + '</p><ul class="my-list">' + (rows.length ? rows.map(function (b) {
        var left = Math.max(0, NSStore.binDays - Math.floor((Date.now() - b.at) / 864e5));
        return '<li data-id="' + esc(b.id) + '"><div class="hd2"><div class="who"><div><b class="ttl">' + esc(title(b.store, b.rec || {})) + '</b><div class="sub">' + esc(t('my.t.' + b.store)) + ' · ' +
          esc(t('b1.delon', { d: NS.when(b.at) })) + (b.who ? ' · ' + esc(b.who) : '') + ' · ' + esc(t('b1.daysleft', { n: left })) + '</div></div></div><div class="row">' +
          '<button type="button" class="btn sm primary" data-restore>' + esc(t('b1.restore')) + '</button></div></div></li>';
      }).join('') : '<li class="empty">' + esc(t('b1.binnone')) + '</li>') + '</ul>';
  }
  function logHtml() {
    var rows = cache.log.slice().sort(function (a, b) { return b.at - a.at; });
    return '<div class="pane-hd"><h2>' + esc(t('b1.hist')) + '</h2>' + (rows.length ? '<button type="button" class="btn sm" data-xllog>' + esc(t('b1.xl')) + '</button>' : '') + '</div>' +
      '<p class="soft">' + esc(t('b1.logp')) + '</p><p class="soft">' + esc(t('b1.logrule')) + '</p>' + NS.logHtml(rows.slice(0, 300), true) +
      (rows.length > 300 ? '<p class="soft">' + esc(t('b1.logmore', { n: rows.length })) + '</p>' : '');
  }
  function excel(s) {
    if (s === 'item') return NS.xlsx('items-and-prices-' + NS.today() + '.xlsx', [NS.reports.items(cache.item)]);
    var D = cache.doc, biz = (cache.biz.filter(function (b) { return b.id === S.defBiz; })[0] || cache.biz[0] || {}).name || '';
    NS.xlsx('registers-' + NS.today() + '.xlsx', [NS.reports.sales(D), NS.reports.purchases(D), NS.reports.dues(D, biz, cache.party, NS.today(), 'recv'), NS.reports.dues(D, biz, cache.party, NS.today(), 'pay')]);
  }

  /* ---------- settings ---------- */
  function saveSettings() {
    var o = JSON.parse(JSON.stringify(S)); delete o._last;
    /* years closed in the App (Batch 2) are changed there only: keep the newest list */
    return NSStore.meta('settings').then(function (fresh) { if (fresh && fresh.closed) o.closed = S.closed = fresh.closed; return NSStore.meta('settings', o); });
  }
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
      '<fieldset class="card"><legend>' + esc(t('hub.g.pre')) + '</legend><p class="hint">' + esc(t('hub.h.pre')) + '</p><div class="fg">' + PREFIXES.map(function (x) {
        var c2 = S[x[0]] || {}, v = x[1] ? (c2.prefixes || {})[x[1]] : c2.prefix, id = 'st-p-' + x[0] + (x[1] ? '-' + x[1] : '');
        return '<div class="f"><label for="' + id + '">' + esc(t(x[3])) + '</label><input id="' + id + '" data-pre="' + x[0] + '|' + x[1] + '" dir="ltr" maxlength="8" autocapitalize="characters" value="' + esc(v != null ? v : x[2]) + '"></div>'; }).join('') +
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
      '<fieldset class="card"><legend>' + esc(t('b1.g_safe')) + '</legend><div class="fg">' +
        '<div class="f"><label for="st-who">' + esc(t('b1.who')) + '</label><input id="st-who" name="who" dir="auto" maxlength="40" value="' + esc(S._who) + '"><small class="hint">' + esc(t('b1.h_who')) + '</small></div>' +
        '<div class="f"><label for="st-lock">' + esc(t('b1.lock')) + '</label><input id="st-lock" name="lockBefore" type="date" value="' + esc(S.lockBefore || '') + '"><small class="hint">' + esc(t('b1.h_lock')) + '</small></div>' +
      '</div></fieldset>' +
      '<div class="btns sticky-save"><button type="submit" class="btn primary">' + esc(t('hub.saveset')) + '</button><button type="button" class="btn" data-reset>' + esc(t('hub.reset')) + '</button></div></form>' + pinHtml() +
      hubExt('settings', S);
  }
  /* other files add sections to the item form and Settings: NS.hubExt.push({ form(s, r), read(s, r, f), settings(S), wireSettings(pane, S, save) }) */
  function hubExt(hook) {
    var a = [].slice.call(arguments, 1);
    return (NS.hubExt || []).map(function (x) { try { return x[hook] ? x[hook].apply(null, a) || '' : ''; } catch (e) { console.error(e); return ''; } }).join('');
  }
  function pinHtml() {
    var on = !!S._pin, mins = on ? S._pin.mins || 15 : 15;
    var pinIn = function (id, lbl) { return '<div class="f"><label for="' + id + '">' + esc(lbl) + '</label><input id="' + id + '" name="' + id + '" type="password" inputmode="numeric" maxlength="8" autocomplete="new-password" dir="ltr"></div>'; };
    return '<form class="card" data-pin novalidate><h3>' + esc(t('b1.pin_t')) + ' <span class="pill' + (on ? ' ok' : '') + '">' + esc(t(on ? 'b1.pin_on' : 'b1.pin_off')) + '</span></h3><p class="soft">' + esc(t('b1.pin_p')) + '</p><div class="fg">' +
      (on ? pinIn('pin-cur', t('b1.pin_cur')) : '') + pinIn('pin-new', t(on ? 'b1.pin_new2' : 'b1.pin_new')) + pinIn('pin-rep', t('b1.pin_rep')) +
      '<div class="f"><label for="pin-mins">' + esc(t('b1.pin_after')) + '</label><select id="pin-mins" name="pin-mins">' + [5, 15, 30, 60].map(function (m) { return '<option value="' + m + '"' + (m === mins ? ' selected' : '') + '>' + esc(t('b1.mins', { n: m })) + '</option>'; }).join('') + '</select></div>' +
      '</div><div class="btns"><button type="submit" class="btn primary">' + esc(t(on ? 'b1.pin_change' : 'b1.pin_set')) + '</button>' +
      (on ? '<button type="button" class="btn" data-pin-lock>' + esc(t('b1.pin_lock')) + '</button><button type="button" class="btn danger" data-pin-off>' + esc(t('b1.pin_rm')) + '</button>' : '') + '</div></form>';
  }
  function wirePin(pane) {
    var f = $('[data-pin]', pane); if (!f) return;
    var E = f.elements, on = !!S._pin;
    function cur() { return on ? NS.pin.check(E['pin-cur'].value) : Promise.resolve(true); }
    function done(k) { NS.toast(t(k)); show('settings'); }
    E['pin-mins'].addEventListener('change', function () { if (on) NS.pin.mins(E['pin-mins'].value).then(function () { NS.toast(t('hub.setsaved')); }); });
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var a = E['pin-new'].value, b = E['pin-rep'].value;
      if (!/^\d{4,8}$/.test(a)) { NS.toast(t('b1.pin_v'), 'bad'); E['pin-new'].focus(); return; }
      if (a !== b) { NS.toast(t('b1.pin_v2'), 'bad'); E['pin-rep'].focus(); return; }
      cur().then(function (ok) {
        if (!ok) { NS.toast(t('b1.pin_wrong'), 'bad'); E['pin-cur'].focus(); return; }
        return NS.pin.set(a, E['pin-mins'].value).then(function () { done('b1.pin_saved'); });
      });
    });
    var off = $('[data-pin-off]', f), lk = $('[data-pin-lock]', f);
    if (off) off.addEventListener('click', function () {
      cur().then(function (ok) { if (!ok) { NS.toast(t('b1.pin_wrong'), 'bad'); E['pin-cur'].focus(); return; } return NS.pin.remove().then(function () { done('b1.pin_gone'); }); });
    });
    if (lk) lk.addEventListener('click', function () { NS.pin.lock(); });
  }


  function wireSettings(pane) {
    hubExt('wireSettings', pane, S, saveSettings);
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
      if (E.lockBefore.value !== (S.lockBefore || '') && !confirm(E.lockBefore.value ? t('b1.lockc', { d: NS.fmtDate(E.lockBefore.value) }) : t('b1.unlockc'))) return;
      S.lockBefore = E.lockBefore.value || '';
      NSStore.meta('who', E.who.value.trim());
      S.invoice = { prefix: E.prefix.value.trim(), digits: +E.digits.value, fy: E.fy.checked, kind: E.kind.value, gst: +E.gst.value, unit: E.unit.value.trim() || 'Nos',
        round: E.round.checked, accent: acc, notes: E.notes.value.trim(), terms: E.terms.value.trim() };
      $$('[data-pre]', f).forEach(function (inp) {
        var k = inp.getAttribute('data-pre').split('|'), v = inp.value.trim().toUpperCase().replace(/[^A-Z0-9\/\-]/g, ''), c2 = S[k[0]] = S[k[0]] || {};
        if (k[1]) { c2.prefixes = c2.prefixes || {}; c2.prefixes[k[1]] = v; } else c2.prefix = v;
      });
      saveSettings().then(function () { NS.toast(t('hub.setsaved')); counts(); });
    });
    $('[data-reset]', f).addEventListener('click', function () {
      if (!confirm(t('hub.c.reset'))) return;
      delete S.invoice; PREFIXES.forEach(function (x) { delete S[x[0]]; }); S.remindDays = 7;
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
      '<div data-backup-ext></div>' +
      '<div class="card danger-zone"><h3>' + esc(t('my.wipe.t')) + '</h3><p class="soft">' + esc(t('my.wipe.p')) + '</p>' +
      '<button type="button" class="btn danger" data-wipe>' + esc(t('my.wipe.b')) + '</button></div>';
  }
  function wireBackup(pane) {
    NSStore.estimate().then(function (e) {
      if (e && e.usage != null) $('[data-store-info]', pane).textContent = t('hub.used', { mb: (e.usage / 1048576).toFixed(1) });
    }).catch(function () {});
    (NS.hubBackupExt || []).forEach(function (f) { try { f(pane); } catch (e) {} });   /* locked backup, Drive sync, send to accountant (safe.js) */
    $('[data-wipe]', pane).addEventListener('click', function () {
      if (!confirm(t('my.wipe.c1'))) return;
      if (prompt(t('my.wipe.c2')) !== 'DELETE') return;
      Promise.all(['biz', 'party', 'item', 'doc'].map(function (s) {
        return NSStore.list(s).then(function (rows) { return Promise.all(rows.map(function (r) { return NSStore.del(s, r.id, { hard: true }); })); });
      })).then(function () { return NSStore.list('bin'); }).then(function (rows) { return Promise.all(rows.map(function (r) { return NSStore.del('bin', r.id); })); })
        .then(function () { NS.toast(t('my.wiped')); show('backup'); }, function (err) { NS.toast(err.message, 'bad'); });
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
        return [d.type, d.no, d.date, d.buyer && d.buyer.name, d.buyer && d.buyer.gstin, d.seller && d.seller.name, NS.r2(d.total || 0), d.type === 'quote' ? { open: 'Waiting for reply', acc: 'Accepted', dec: 'Not accepted', inv: 'Invoice made' }[d.status] || '' : d.status === 'paid' ? 'Paid' : 'Not paid'];
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
        Object.keys(NUMS).forEach(function (k) { if (r[k] != null) r[k] = NS.num(r[k]); });
        if (r.ptype) r.ptype = /whole/i.test(r.ptype) ? 'wholesale' : 'retail';
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
      if (e.target.closest('[data-xl]')) return excel(cur);
      if (e.target.closest('[data-xllog]')) return NS.xlsx('edit-history-' + NS.today() + '.xlsx', [NS.reports.log(cache.log)]);
      if (e.target.closest('[data-binempty]')) { if (confirm(t('b1.binemptyc'))) Promise.all(cache.bin.map(function (b) { return NSStore.del('bin', b.id); })).then(function () { show('bin'); }); return; }
      var cb = e.target.closest('[data-cat]'); if (cb) { cat = cb.getAttribute('data-cat'); $$('[data-cat]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === cb)); }); renderList(); return; }
      var li = e.target.closest('li[data-id]'); if (!li) return;
      var id = li.getAttribute('data-id');
      if (e.target.closest('[data-edit]')) openForm(cur, id);
      else if (e.target.closest('[data-def]')) { S.defBiz = id; saveSettings().then(function () { NS.toast(t('hub.setsaved')); show('biz'); }); }
      else if (e.target.closest('[data-log]')) NS.showLog(id, t('b1.changesof', { no: $('.ttl', li).textContent }));
      else if (e.target.closest('[data-restore]')) NSStore.restore(id).then(function () { NS.toast(t('b1.restored')); show('bin'); }, function (err) { NS.toast(err.message, 'bad'); });
      else if (e.target.closest('[data-del]') && confirm(t('b1.cdel', { x: $('.ttl', li).textContent }))) {
        NSStore.del(cur, id).then(function () {
          if (cur === 'biz' && S.defBiz === id) { S.defBiz = ''; return saveSettings(); }
        }).then(function () { NS.toast(t('b1.binned')); show(cur); }, function (err) { NS.toast(err.message, 'bad'); });
      }
    });
    pane.addEventListener('input', function (e) { if (e.target.id === 'my-q') { q = e.target.value.trim().toLowerCase(); renderList(); } });
    pane.addEventListener('change', function (e) { if (e.target.hasAttribute('data-imp') && e.target.files[0]) { importCsv(cur, e.target.files[0]); e.target.value = ''; } });
    NS.onRestore = function () { show(cur); };
    document.addEventListener('ns-data', function () { show(cur); });
    document.addEventListener('ns-lang', function () { show(cur); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
