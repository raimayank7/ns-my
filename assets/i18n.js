/* NS i18n: screen text in the user's language. The printed document always stays in English.
   Packs live in /assets/lang/<code>.js and call NS.addLang(code, {key: text}). Missing keys fall back to English.
   Rule (owner): use the words people say at shops and offices today, often the English business word in local script. */
(function () {
  'use strict';
  var NS = window.NS = window.NS || {};

  /* code, name in its own script, English name, Google font family (null = Latin), right-to-left */
  NS.LANGS = [
    ['en', 'English', 'English', null, 0],
    ['hi', 'हिन्दी', 'Hindi', 'Noto Sans Devanagari', 0],
    ['bn', 'বাংলা', 'Bengali', 'Noto Sans Bengali', 0],
    ['mr', 'मराठी', 'Marathi', 'Noto Sans Devanagari', 0],
    ['te', 'తెలుగు', 'Telugu', 'Noto Sans Telugu', 0],
    ['ta', 'தமிழ்', 'Tamil', 'Noto Sans Tamil', 0],
    ['gu', 'ગુજરાતી', 'Gujarati', 'Noto Sans Gujarati', 0],
    ['ur', 'اردو', 'Urdu', 'Noto Nastaliq Urdu', 1],
    ['kn', 'ಕನ್ನಡ', 'Kannada', 'Noto Sans Kannada', 0],
    ['or', 'ଓଡ଼ିଆ', 'Odia', 'Noto Sans Oriya', 0],
    ['ml', 'മലയാളം', 'Malayalam', 'Noto Sans Malayalam', 0],
    ['pa', 'ਪੰਜਾਬੀ', 'Punjabi', 'Noto Sans Gurmukhi', 0],
    ['as', 'অসমীয়া', 'Assamese', 'Noto Sans Bengali', 0],
    ['mai', 'मैथिली', 'Maithili', 'Noto Sans Devanagari', 0],
    ['bho', 'भोजपुरी', 'Bhojpuri', 'Noto Sans Devanagari', 0],
    ['sat', 'ᱥᱟᱱᱛᱟᱲᱤ', 'Santali', 'Noto Sans Ol Chiki', 0],
    ['ks', 'کٲشُر', 'Kashmiri', 'Noto Nastaliq Urdu', 1],
    ['ne', 'नेपाली', 'Nepali', 'Noto Sans Devanagari', 0],
    ['kok', 'कोंकणी', 'Konkani', 'Noto Sans Devanagari', 0],
    ['sd', 'سنڌي', 'Sindhi', 'Noto Naskh Arabic', 1],
    ['doi', 'डोगरी', 'Dogri', 'Noto Sans Devanagari', 0],
    ['mni', 'ꯃꯩꯇꯩꯂꯣꯟ', 'Manipuri', 'Noto Sans Meetei Mayek', 0],
    ['brx', 'बड़ो', 'Bodo', 'Noto Sans Devanagari', 0],
    ['sa', 'संस्कृतम्', 'Sanskrit', 'Noto Sans Devanagari', 0]
  ];

  var EN = {
    'skip': 'Skip to content', 'mydata': 'My data', 'theme': 'Colour theme', 'lang': 'Language', 'close': 'Close', 'rights': 'All rights reserved.', 'later': 'Later', 'sp.label': 'Sponsored',
    'nav.formats': 'Invoice formats', 'nav.rules': 'GST rules', 'nav.billing': 'Billing', 'nav.move': 'Use on another computer',
    'f.make': 'Make a bill', 'f.maker': 'GST invoice maker', 'f.formats': 'Invoice formats by business', 'f.supply': 'Bill of supply', 'f.move': 'Use on another computer',
    'f.guides': 'GST guides', 'f.must': 'What a GST invoice must show', 'f.which': 'CGST, SGST or IGST?', 'f.num': 'Invoice number rules', 'f.hsn': 'HSN and SAC codes', 'f.einv': 'E-invoice and e-way bill', 'f.tools': 'Tools',
    'f.about': 'About', 'f.privacy': 'Privacy policy', 'f.terms': 'Terms of use', 'f.disc': 'Disclaimer', 'f.contact': 'Contact',
    'guide.en': 'This guide is in English for now. The tool itself works in your language.',

    'gst.len': 'A GSTIN has 15 letters and numbers, for example 03ABCDE1234F1Z5.',
    'gst.chk': 'This GSTIN’s last character doesn’t match. Please check it for a typing mistake.',
    'bk.saved': 'Backup file saved. Keep it somewhere safe: a pen drive, Google Drive, or WhatsApp to yourself.',
    'bk.notours': 'This is not a Nivesh Sahayak backup file.',
    'bk.restored': '{n} records brought back. Newer records you already had were kept.',
    'bk.nothing': 'Nothing new in that file: you already have everything in it.',
    'bk.unread': 'That file could not be read.',
    'rm.ago': 'Your last backup was {n} days ago. Save a backup file so your work is safe if this browser is cleared.',
    'rm.none': 'You have {n} saved documents and no backup yet. Save a backup file so your work is safe if this browser is cleared.',
    'af.on': 'Auto-save is on: every save also updates the backup file in “{name}”.', 'af.off': 'Auto-save to folder is off.',
    'md.loading': 'Loading your data…', 'md.biz': 'my businesses', 'md.party': 'customers and suppliers', 'md.item': 'items and services', 'md.doc': 'saved documents',
    'md.shared': 'Your data is kept in this browser on this device, in one place shared by every Nivesh Sahayak document tool. Nothing is sent to us.',
    'md.local': 'Your data is kept in this browser on this device. Nothing is sent to us. The shared data home could not be reached just now, so this site keeps it for now and moves it there automatically.',
    'md.last': 'Last backup:', 'md.never': 'never', 'md.save': 'Save a backup file', 'md.restore': 'Restore from a backup file',
    'md.move': 'To use your data on another computer or phone: save a backup file, copy it to a pen drive (or send it to yourself), then open this site there and press Restore.',
    'md.autot': 'Auto-save to a folder (computer only)',
    'md.auton': 'On: every save updates {file} in the folder {name}.', 'md.autoask': 'The browser needs your OK again after a restart.',
    'md.autooff': 'Pick a folder once (a OneDrive or Google Drive folder is best) and every save keeps a backup file there automatically.',
    'md.allow': 'Allow auto-save again', 'md.turnoff': 'Turn auto-save off', 'md.choose': 'Choose a folder',
    'md.seeall': 'See and edit everything on {link}.', 'md.err': 'Your data could not be opened. Please reload the page.',

    'doc.invoice': 'invoice', 'docs.invoice': 'invoices', 'Doc.invoice': 'Invoice',
    'k.tax': 'Tax invoice', 'k.supply': 'Bill of supply', 'k.plain': 'Invoice (not GST registered)',
    'kh.tax': 'For GST-registered sellers charging GST.', 'kh.supply': 'For composition dealers, or for goods and services exempt from GST. No tax is charged.', 'kh.plain': 'For sellers who are not registered under GST. No tax is charged.',
    'comp': 'I am in the composition scheme (prints the note the rules require)',
    'lg.biz': 'Your business', 'l.bname': 'Business name', 'ph.bname': 'Type your business name', 'h.bname': 'Saved businesses appear as you type.',
    'l.addr': 'Address', 'ph.addr': 'Shop no., street, city, PIN', 'l.state': 'State', 'l.gstin': 'GSTIN', 'ph.gstin': '15 characters', 'l.phone': 'Phone', 'l.email': 'Email',
    'more': 'Logo, signature and bank details', 'l.logo': 'Logo', 'rm.logo': 'Remove logo', 'l.sign': 'Signature or stamp', 'rm.sign': 'Remove signature',
    'l.bank': 'Bank name', 'l.acc': 'Account number', 'l.ifsc': 'IFSC', 'l.branch': 'Branch', 'l.upi': 'UPI ID (for the pay-by-QR code)',
    'lg.details': '{Doc} details', 'l.type': 'Type', 'l.no': '{Doc} number', 'h.no': 'Up to 16 letters, numbers, / or -. A new number is suggested for each bill.',
    'l.date': 'Date', 'l.due': 'Due date', 'l.pos': 'Place of supply', 'h.pos': 'Usually the buyer’s state. It decides CGST + SGST or IGST.', 'same.buyer': 'Same as buyer’s state', 'choose.state': 'Choose state',
    'l.ref': 'Order / PO number', 'l.rc': 'Tax payable on reverse charge',
    'lg.billto': 'Bill to', 'l.cname': 'Customer name', 'ph.cname': 'Type the customer’s name', 'h.cname': 'Saved customers appear as you type.', 'l.cgstin': 'GSTIN (if registered)',
    'l.ship': 'Ship to a different address', 'l.shname': 'Ship to name', 'l.shaddr': 'Ship to address', 'l.shstate': 'Ship to state',
    'lg.items': 'Items', 'it.n': 'Item {n}', 'it.rm': 'Remove', 'l.desc': 'Description', 'ph.desc': 'Item or service', 'l.hsn': 'HSN/SAC', 'l.qty': 'Qty', 'l.unit': 'Unit', 'l.rate': 'Rate (₹)', 'l.disc': 'Disc. %', 'l.gst': 'GST %', 'add.item': '+ Add item',
    'sum.items': '{n} items', 'sum.taxable': 'Taxable {v}', 'sum.gst': 'GST {v}', 'sum.total': 'Total {v}',
    'lg.notes': 'Notes and look', 'l.notes': 'Notes', 'ph.notes': 'For example: Thank you for your business.', 'l.terms': 'Terms and conditions', 'ph.terms': 'For example: Payment within 15 days. Interest at 18% a year after the due date.',
    'l.copy': 'Copy label', 'cp.orig': 'Original for recipient', 'cp.dup': 'Duplicate for transporter', 'cp.trip': 'Triplicate for supplier', 'cp.none': 'No label',
    'l.colour': 'Colour', 'colour.n': 'Colour {n}', 'l.round': 'Round off the total', 'l.pay': 'Payment', 'pay.unpaid': 'Not paid yet', 'pay.paid': 'Paid',
    'print.en': 'The printed {doc} is always in English, so your customer, bank and tax officer can all read it. Names and items print exactly as you type them.',
    'v.bname': 'Type your business name.', 'v.item': 'Add at least one item with a rate.', 'v.no': 'Give this {doc} a number.', 'v.len': 'GST rules allow up to 16 characters in the number.', 'v.chars': 'Use only letters, numbers, / and - in the number.',
    'v.sg': 'Your GSTIN looks wrong.', 'v.bg': 'The customer’s GSTIN looks wrong.', 'v.tax': 'A tax invoice needs your GSTIN. If you are not registered, choose “Invoice (not GST registered)” as the type.',
    'c.dup': 'There is already a saved {doc} {no} for this business in this financial year. GST rules need a different number for every bill. Save anyway?',
    'saved': '{Doc} {no} saved.', 'nosave': 'Could not save: {e}', 'st.edit': 'Editing saved {doc} {no}', 'st.new': 'New {doc} (not saved yet)', 'st.load': 'Loading…',
    'c.new': 'Start a new {doc}? This one is not saved yet.', 'img.bad': 'That picture could not be read.',
    'h.title': 'Saved documents', 'h.search': 'Search by number or name', 'h.open': 'Open', 'h.copy': 'Copy as new', 'h.paid': 'Mark paid', 'h.unpaid': 'Mark not paid', 'h.del': 'Delete',
    'h.paidp': 'Paid', 'h.unpaidp': 'Not paid', 'h.nocust': 'No customer', 'h.none': 'Nothing saved yet. Press Save after making one.', 'h.nomatch': 'Nothing matches your search.',
    'c.del': 'Delete {doc} {no}? This cannot be undone (unless you have a backup file).', 'deleted': 'Deleted.',
    'b.new': 'New {doc}', 'b.hist': 'Saved {docs}', 'b.save': 'Save', 'b.print': 'Print / PDF', 'b.share': 'Share', 'tab.edit': 'Edit', 'tab.preview': 'Preview',

    'my.title': 'My business data', 'my.intro': 'Everything the Nivesh Sahayak document tools have saved on this device: your businesses, customers and suppliers, items and services, and documents. It stays in this browser. Nothing is sent to us.',
    'my.auto': 'Auto-save and storage', 'my.t.biz': 'My businesses', 'my.t.party': 'Customers and suppliers', 'my.t.item': 'Items and services', 'my.t.doc': 'Documents',
    'my.search': 'Search', 'my.ph': 'Type a name, number or code', 'my.edit': 'Edit', 'my.savech': 'Save changes', 'my.cancel': 'Cancel', 'my.noname': '(no name)',
    'my.empty': 'Nothing saved here yet. It fills up as you use the document tools.', 'my.vault': 'Shared by every Nivesh Sahayak document tool in this browser.', 'my.local': 'Kept in this browser.',
    'my.wipe.t': 'Delete everything', 'my.wipe.p': 'Removes all saved businesses, customers, items and documents from this browser. Save a backup file first if you may need them again.',
    'my.wipe.b': 'Delete everything on this device', 'my.wipe.c1': 'Delete ALL saved businesses, customers, items and documents on this device? Save a backup file first if you may need them.',
    'my.wipe.c2': 'Type DELETE to confirm.', 'my.wiped': 'Everything was deleted from this device.', 'my.c.del': 'Delete “{name}”? This cannot be undone without a backup file.', 'my.saved': 'Saved.',
    'my.f.name': 'Name', 'my.f.addr': 'Address', 'my.f.state': 'State code', 'my.f.gstin': 'GSTIN', 'my.f.phone': 'Phone', 'my.f.email': 'Email', 'my.f.bank': 'Bank', 'my.f.acc': 'Account no.', 'my.f.ifsc': 'IFSC', 'my.f.upi': 'UPI ID',
    'my.f.desc': 'Description', 'my.f.hsn': 'HSN/SAC', 'my.f.unit': 'Unit', 'my.f.rate': 'Rate', 'my.f.gst': 'GST %'
  };

  var packs = { en: EN }, cur = 'en';
  NS.addLang = function (code, table) { packs[code] = table; };
  NS.lang = function () { return cur; };
  /* NS.t('saved', {doc:'invoice', no:'INV/1'}) ; {Doc} = doc word with a capital (English only) */
  NS.t = function (key, v) {
    var p = packs[cur] || EN, s = p[key] != null ? p[key] : EN[key] != null ? EN[key] : key;
    if (v) s = s.replace(/\{(\w+)\}/g, function (m, k) { return v[k] != null ? v[k] : m; });
    return s;
  };

  var fontDone = {};
  function font(fam) {
    if (!fam || fontDone[fam]) return;
    fontDone[fam] = true;
    document.head.appendChild(Object.assign(document.createElement('link'), { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=' + fam.replace(/ /g, '+') + ':wght@400;600;700&display=swap' }));
  }
  function load(code) {
    if (packs[code]) return Promise.resolve();
    return new Promise(function (res) {
      var s = document.createElement('script');
      s.src = '/assets/lang/' + code + '.js?v=' + (window.NS_CFG && NS_CFG.langv || '1');
      s.onload = s.onerror = function () { res(); };
      document.head.appendChild(s);
    });
  }
  /* translate the page chrome: data-i18n (text), data-i18n-ph (placeholder), data-i18n-label (aria-label), data-i18n-title */
  NS.applyLang = function (root) {
    root = root || document;
    Array.prototype.forEach.call(root.querySelectorAll('[data-i18n]'), function (e) { e.textContent = NS.t(e.getAttribute('data-i18n')); });
    [['data-i18n-ph', 'placeholder'], ['data-i18n-label', 'aria-label'], ['data-i18n-title', 'title']].forEach(function (a) {
      Array.prototype.forEach.call(root.querySelectorAll('[' + a[0] + ']'), function (e) { e.setAttribute(a[1], NS.t(e.getAttribute(a[0]))); });
    });
  };
  function info(code) { return NS.LANGS.filter(function (l) { return l[0] === code; })[0]; }
  NS.setLang = function (code, quiet) {
    var L = info(code) || NS.LANGS[0];
    code = L[0];
    return load(code).then(function () {
      cur = packs[code] ? code : 'en';
      var root = document.documentElement;
      root.setAttribute('lang', cur === 'en' ? 'en-IN' : cur);
      root.setAttribute('dir', L[4] ? 'rtl' : 'ltr');
      root.style.setProperty('--script', L[3] ? '"' + L[3] + '"' : 'system-ui');
      font(L[3]);
      try { localStorage.setItem('ns-lang', cur); } catch (e) {}
      if (!quiet && window.NSStore) NSStore.meta('lang', cur).catch(function () {});
      NS.applyLang();
      Array.prototype.forEach.call(document.querySelectorAll('[data-lang-pick]'), function (s) { s.value = cur; });
      Array.prototype.forEach.call(document.querySelectorAll('[data-guide-en]'), function (n) { n.hidden = cur === 'en'; });
      document.dispatchEvent(new CustomEvent('ns-lang', { detail: cur }));
    });
  };
  function guess() {
    var ls = (navigator.languages || [navigator.language || 'en']).map(function (x) { return String(x).toLowerCase().split('-')[0]; });
    for (var i = 0; i < ls.length; i++) if (info(ls[i])) return ls[i];
    return 'en';
  }
  NS.initLang = function () {
    Array.prototype.forEach.call(document.querySelectorAll('[data-lang-pick]'), function (s) {
      s.innerHTML = NS.LANGS.map(function (l) { return '<option value="' + l[0] + '" lang="' + l[0] + '" title="' + l[2] + '">' + l[1] + '</option>'; }).join('');
      s.addEventListener('change', function () { NS.setLang(s.value); });
    });
    var saved; try { saved = localStorage.getItem('ns-lang'); } catch (e) {}
    var first = NS.setLang(saved || guess(), true);
    /* the language chosen on any Nivesh Sahayak tool is shared through the data home */
    if (!saved && window.NSStore) NSStore.ready().then(function () { return NSStore.meta('lang'); }).then(function (l) { if (l && l !== cur) NS.setLang(l, true); }).catch(function () {});
    return first;
  };
})();
