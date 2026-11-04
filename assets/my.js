/* my.niveshsahayak.in: see, edit and delete everything the document tools saved on this device */
(function () {
  'use strict';
  var $ = NS.$, $$ = NS.$$, esc = NS.esc;
  var FIELDS = {
    biz: [['name', 'Business name'], ['addr', 'Address'], ['state', 'State code'], ['gstin', 'GSTIN'], ['phone', 'Phone'], ['email', 'Email'], ['bankName', 'Bank'], ['bankAcc', 'Account no.'], ['bankIfsc', 'IFSC'], ['upi', 'UPI ID']],
    party: [['name', 'Name'], ['addr', 'Address'], ['state', 'State code'], ['gstin', 'GSTIN'], ['phone', 'Phone']],
    item: [['desc', 'Description'], ['hsn', 'HSN/SAC'], ['unit', 'Unit'], ['rate', 'Rate'], ['gst', 'GST %']]
  };
  var cur = 'biz', q = '';

  function title(s, r) {
    if (s === 'doc') return (r.type || 'document').replace(/^./, function (c) { return c.toUpperCase(); }) + ' ' + (r.no || '');
    return r.name || r.desc || '(no name)';
  }
  function sub(s, r) {
    if (s === 'doc') return NS.fmtDate(r.date) + ' · ' + esc(r.buyer && r.buyer.name || 'No customer') + ' · ' + NS.money(r.total || 0) + ' · ' + esc(r.seller && r.seller.name || '');
    if (s === 'item') return [r.hsn && 'HSN ' + esc(r.hsn), r.rate !== '' && r.rate != null && NS.money(NS.num(r.rate)) + (r.unit ? ' / ' + esc(r.unit) : ''), r.gst !== '' && r.gst != null && 'GST ' + esc(r.gst) + '%'].filter(Boolean).join(' · ');
    return [r.gstin && esc(r.gstin), r.state && esc(NS.stateName(r.state)), r.phone && esc(r.phone)].filter(Boolean).join(' · ');
  }
  function counts() {
    return Promise.all(['biz', 'party', 'item', 'doc'].map(function (s) { return NSStore.list(s); })).then(function (r) {
      $('[data-counts]').innerHTML = '<div><b>' + r[0].length + '</b> business' + (r[0].length === 1 ? '' : 'es') + '</div><div><b>' + r[1].length + '</b> customers and suppliers</div><div><b>' + r[2].length + '</b> items and services</div><div><b>' + r[3].length + '</b> documents</div>';
      $('[data-mode]').textContent = NSStore.mode() === 'vault' ? 'Shared by every Nivesh Sahayak document tool in this browser.' : 'Kept in this browser.';
    });
  }
  function render() {
    var list = $('[data-list]');
    NSStore.list(cur).then(function (rows) {
      rows = rows.filter(function (r) { return !q || JSON.stringify([title(cur, r), r.gstin, r.hsn, r.phone, r.buyer && r.buyer.name]).toLowerCase().indexOf(q) >= 0; });
      rows.sort(function (a, b) { return cur === 'doc' ? (b.date || '').localeCompare(a.date || '') : title(cur, a).localeCompare(title(cur, b)); });
      list.innerHTML = rows.length ? rows.map(function (r) {
        return '<li data-id="' + esc(r.id) + '"><div class="hd2"><div><b>' + esc(title(cur, r)) + '</b><div class="sub">' + sub(cur, r) + '</div></div><div class="row">' +
          (cur === 'doc' ? '' : '<button type="button" class="btn sm" data-edit>Edit</button>') + '<button type="button" class="btn sm danger" data-del>Delete</button></div></div></li>';
      }).join('') : '<li class="empty">' + (q ? 'Nothing matches your search.' : 'Nothing saved here yet. It fills up as you use the document tools.') + '</li>';
    });
  }
  function edit(li) {
    var id = li.getAttribute('data-id');
    if ($('form', li)) { $('form', li).remove(); return; }
    NSStore.get(cur, id).then(function (r) {
      var f = NS.el('form');
      f.innerHTML = FIELDS[cur].map(function (x) { return '<label>' + x[1] + '<input name="' + x[0] + '" value="' + esc(r[x[0]] == null ? '' : r[x[0]]) + '"></label>'; }).join('') +
        '<div class="row"><button class="btn sm primary">Save changes</button><button type="button" class="btn sm" data-cancel>Cancel</button></div>';
      li.appendChild(f);
      f.addEventListener('submit', function (e) {
        e.preventDefault();
        FIELDS[cur].forEach(function (x) { r[x[0]] = f.elements[x[0]].value.trim(); });
        if (r.gstin && !NS.gstinCheck(r.gstin).ok) { NS.toast(NS.gstinCheck(r.gstin).msg, 'bad'); return; }
        NSStore.put(cur, r).then(function () { NS.toast('Saved.'); render(); });
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
      if (e.target.closest('[data-del]') && confirm('Delete "' + li.querySelector('b').textContent + '"? This cannot be undone without a backup file.')) {
        NSStore.del(cur, li.getAttribute('data-id')).then(function () { NS.toast('Deleted.'); counts(); render(); });
      }
    });
    $('[data-wipe]').addEventListener('click', function () {
      if (!confirm('Delete ALL saved businesses, customers, items and documents on this device? Save a backup file first if you may need them.')) return;
      if (prompt('Type DELETE to confirm.') !== 'DELETE') return;
      Promise.all(['biz', 'party', 'item', 'doc'].map(function (s) {
        return NSStore.list(s).then(function (rows) { return Promise.all(rows.map(function (r) { return NSStore.del(s, r.id); })); });
      })).then(function () { NS.toast('Everything was deleted from this device.'); counts(); render(); });
    });
    NS.onRestore = function () { counts(); render(); };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
