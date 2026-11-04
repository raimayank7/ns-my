/* my.niveshsahayak.in: see, edit and delete everything the document tools saved on this device */
(function () {
  'use strict';
  var $ = NS.$, $$ = NS.$$, esc = NS.esc, t = NS.t;
  var FIELDS = {
    biz: [['name', 'l.bname'], ['addr', 'my.f.addr'], ['state', 'my.f.state'], ['gstin', 'my.f.gstin'], ['phone', 'my.f.phone'], ['email', 'my.f.email'], ['bankName', 'my.f.bank'], ['bankAcc', 'my.f.acc'], ['bankIfsc', 'my.f.ifsc'], ['upi', 'my.f.upi']],
    party: [['name', 'my.f.name'], ['addr', 'my.f.addr'], ['state', 'my.f.state'], ['gstin', 'my.f.gstin'], ['phone', 'my.f.phone']],
    item: [['desc', 'my.f.desc'], ['hsn', 'my.f.hsn'], ['unit', 'my.f.unit'], ['rate', 'my.f.rate'], ['gst', 'my.f.gst']]
  };
  var cur = 'biz', q = '';

  function title(s, r) {
    if (s === 'doc') return (r.type || 'document').replace(/^./, function (c) { return c.toUpperCase(); }) + ' ' + (r.no || '');
    return r.name || r.desc || t('my.noname');
  }
  function sub(s, r) {
    if (s === 'doc') return NS.fmtDate(r.date) + ' · ' + esc(r.buyer && r.buyer.name || t('h.nocust')) + ' · ' + NS.money(r.total || 0) + ' · ' + esc(r.seller && r.seller.name || '');
    if (s === 'item') return [r.hsn && 'HSN ' + esc(r.hsn), r.rate !== '' && r.rate != null && NS.money(NS.num(r.rate)) + (r.unit ? ' / ' + esc(r.unit) : ''), r.gst !== '' && r.gst != null && 'GST ' + esc(r.gst) + '%'].filter(Boolean).join(' · ');
    return [r.gstin && esc(r.gstin), r.state && esc(NS.stateName(r.state)), r.phone && esc(r.phone)].filter(Boolean).join(' · ');
  }
  function counts() {
    return Promise.all(['biz', 'party', 'item', 'doc'].map(function (s) { return NSStore.list(s); })).then(function (r) {
      $('[data-counts]').innerHTML = '<div><b>' + r[0].length + '</b> ' + esc(t('md.biz')) + '</div><div><b>' + r[1].length + '</b> ' + esc(t('md.party')) + '</div><div><b>' + r[2].length + '</b> ' + esc(t('md.item')) + '</div><div><b>' + r[3].length + '</b> ' + esc(t('md.doc')) + '</div>';
      $('[data-mode]').textContent = t(NSStore.mode() === 'vault' ? 'my.vault' : 'my.local');
    });
  }
  function render() {
    var list = $('[data-list]');
    NSStore.list(cur).then(function (rows) {
      rows = rows.filter(function (r) { return !q || JSON.stringify([title(cur, r), r.gstin, r.hsn, r.phone, r.buyer && r.buyer.name]).toLowerCase().indexOf(q) >= 0; });
      rows.sort(function (a, b) { return cur === 'doc' ? (b.date || '').localeCompare(a.date || '') : title(cur, a).localeCompare(title(cur, b)); });
      list.innerHTML = rows.length ? rows.map(function (r) {
        return '<li data-id="' + esc(r.id) + '"><div class="hd2"><div><b>' + esc(title(cur, r)) + '</b><div class="sub">' + sub(cur, r) + '</div></div><div class="row">' +
          (cur === 'doc' ? '' : '<button type="button" class="btn sm" data-edit>' + esc(t('my.edit')) + '</button>') + '<button type="button" class="btn sm danger" data-del>' + esc(t('h.del')) + '</button></div></div></li>';
      }).join('') : '<li class="empty">' + esc(t(q ? 'h.nomatch' : 'my.empty')) + '</li>';
    });
  }
  function edit(li) {
    var id = li.getAttribute('data-id');
    if ($('form', li)) { $('form', li).remove(); return; }
    NSStore.get(cur, id).then(function (r) {
      var f = NS.el('form');
      f.innerHTML = FIELDS[cur].map(function (x) { return '<label>' + esc(t(x[1])) + '<input name="' + x[0] + '" value="' + esc(r[x[0]] == null ? '' : r[x[0]]) + '"></label>'; }).join('') +
        '<div class="row"><button class="btn sm primary">' + esc(t('my.savech')) + '</button><button type="button" class="btn sm" data-cancel>' + esc(t('my.cancel')) + '</button></div>';
      li.appendChild(f);
      f.addEventListener('submit', function (e) {
        e.preventDefault();
        FIELDS[cur].forEach(function (x) { r[x[0]] = f.elements[x[0]].value.trim(); });
        if (r.gstin && !NS.gstinCheck(r.gstin).ok) { NS.toast(NS.gstinCheck(r.gstin).msg, 'bad'); return; }
        NSStore.put(cur, r).then(function () { NS.toast(t('my.saved')); render(); });
      });
      $('[data-cancel]', f).addEventListener('click', function () { f.remove(); });
    });
  }
  function init() {
    if (!$('#my-app')) return;
    NSStore.ready().then(function () { counts(); render(); });
    $$('[data-store]').forEach(function (b) {
      b.addEventListener('click', function () {
        cur = b.getAttribute('data-store');
        $$('[data-store]').forEach(function (x) { x.setAttribute('aria-selected', String(x === b)); });
        render();
      });
    });
    $('#my-q').addEventListener('input', function (e) { q = e.target.value.trim().toLowerCase(); render(); });
    $('[data-list]').addEventListener('click', function (e) {
      var li = e.target.closest('li[data-id]'); if (!li) return;
      if (e.target.closest('[data-edit]')) edit(li);
      if (e.target.closest('[data-del]') && confirm(t('my.c.del', { name: li.querySelector('b').textContent }))) {
        NSStore.del(cur, li.getAttribute('data-id')).then(function () { NS.toast(t('deleted')); counts(); render(); });
      }
    });
    $('[data-wipe]').addEventListener('click', function () {
      if (!confirm(t('my.wipe.c1'))) return;
      if (prompt(t('my.wipe.c2')) !== 'DELETE') return;
      Promise.all(['biz', 'party', 'item', 'doc'].map(function (s) {
        return NSStore.list(s).then(function (rows) { return Promise.all(rows.map(function (r) { return NSStore.del(s, r.id); })); });
      })).then(function () { NS.toast(t('my.wiped')); counts(); render(); });
    });
    NS.onRestore = function () { counts(); render(); };
    document.addEventListener('ns-lang', function () { counts(); render(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
