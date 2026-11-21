/* NSBiz user logins, rights and encryption (owner 20 Nov 2026, SQLite Stage 2). Shared by the browser worker and the Windows
   program, like sqlcore.js; it wraps the store commands, so the rules are checked where the data is, not only on screens.
   /Users.sqlite (the one file that stays readable before a login, like Tally's security file) holds:
     users(id, name, role, salt, iter, hash, wrap, active, made, upd)   password = PBKDF2-SHA256 (210,000 rounds) of it;
                                                                         wrap = the data key sealed with a key made from it
     roles(id, name, rights JSON)                                        own roles may be added; owner can't be changed
     keyinfo(k, v)                                                       recovery-code seal of the data key, cipher on/off
     sessions(tok_hash, user, wrap, made, seen)                          a login; wrap = the data key sealed with the token,
                                                                         so another tab's worker can open the files again
   Once the owner turns logins on, every other file is encrypted with a random data key (ChaCha20, SQLite3 Multiple Ciphers).
   Lose every password and the recovery code and the data cannot be opened by anyone: the screens say so.
   Rights: per area, view / add / edit / del / print / export, plus limits: backDays (no entry dated earlier than N days back)
   and seeCost / maxDisc (checked by the screens). */
(function (root) {
  'use strict';
  var AREAS = ['sales', 'purchase', 'money', 'stock', 'masters', 'reports', 'gst', 'settings', 'users'];
  var ACTS = ['view', 'add', 'edit', 'del', 'print', 'export'];
  function all(v) { var o = {}; AREAS.forEach(function (a) { o[a] = {}; ACTS.forEach(function (x) { o[a][x] = v; }); }); return o; }
  function only(base, set) { var o = all(false); Object.keys(set).forEach(function (a) { set[a].forEach(function (x) { o[a][x] = true; }); }); return o; }
  var VPE = ['view', 'print', 'export'], FULL = ACTS;
  var ROLES = [
    { id: 'owner', name: 'Owner', fixed: 1, rights: all(true), limits: { backDays: 0, seeCost: true, maxDisc: 0 } },
    { id: 'accountant', name: 'Accountant', rights: only(0, { sales: FULL, purchase: FULL, money: FULL, stock: FULL, masters: FULL, reports: VPE, gst: FULL, settings: ['view'] }), limits: { backDays: 0, seeCost: true, maxDisc: 0 } },
    { id: 'billing', name: 'Billing staff', rights: only(0, { sales: ['view', 'add', 'edit', 'print'], money: ['view', 'add', 'print'], masters: ['view', 'add'], stock: ['view'] }), limits: { backDays: 3, seeCost: false, maxDisc: 10 } },
    { id: 'store', name: 'Store keeper', rights: only(0, { stock: FULL, sales: ['view', 'print'], purchase: ['view', 'print'], masters: ['view', 'add'] }), limits: { backDays: 7, seeCost: false, maxDisc: 0 } },
    { id: 'viewer', name: 'Viewer', rights: only(0, { sales: ['view', 'print'], purchase: ['view', 'print'], money: ['view', 'print'], stock: ['view', 'print'], masters: ['view'], reports: ['view', 'print'], gst: ['view', 'print'] }), limits: { backDays: 0, seeCost: false, maxDisc: 0 } }
  ];
  /* which area a document is in, by its type */
  var DOCAREA = { invoice: 'sales', cashmemo: 'sales', quote: 'sales', proforma: 'sales', so: 'sales', challan: 'sales', expinv: 'sales', pos: 'sales', pharma: 'sales', resto: 'sales', lr: 'sales', job: 'sales', rabill: 'sales', fee: 'sales', hotel: 'sales', rent: 'sales',
    pbill: 'purchase', po: 'purchase', self: 'purchase', grn: 'purchase',
    stk: 'stock', make: 'stock', jobout: 'stock', jobin: 'stock' };
  function docArea(d) { if (!d) return 'money'; if (d.type === 'note') return d.side === 'purchase' ? 'purchase' : 'sales'; return DOCAREA[d.type] || 'money'; }
  /* settings records only those with the settings right may change; the rest (backups, preferences, notes) every user writes */
  var GUARDED_META = { settings: 1, groups: 1, units: 1, heads: 1, staff: 1, fields: 1, banks: 1, payroll: 1, pin: 1, packs: 1, sfcfg: 1, bankrules: 1, dispatch: 1 };
  function storeArea(store, row) { if (store === 'doc') return docArea(row); if (store === 'party' || store === 'item') return 'masters'; if (store === 'biz') return 'settings'; if (store === 'meta') return row && GUARDED_META[row.id] ? 'settings' : ''; return ''; }
  function err(msg) { var e = new Error('NSAUTH: ' + msg); e.auth = true; return e; }

  function makeAuth(core, A) {
    var U = A.open('/Users.sqlite');
    U.exec('CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, name TEXT UNIQUE NOT NULL, role TEXT NOT NULL, salt TEXT, iter INTEGER, hash TEXT, wrap TEXT, active INTEGER DEFAULT 1, made INTEGER, upd INTEGER);' +
      'CREATE TABLE IF NOT EXISTS roles(id TEXT PRIMARY KEY, name TEXT NOT NULL, json TEXT NOT NULL);' +
      'CREATE TABLE IF NOT EXISTS keyinfo(k TEXT PRIMARY KEY, v TEXT);' +
      'CREATE TABLE IF NOT EXISTS sessions(tok TEXT PRIMARY KEY, user TEXT, wrap TEXT, made INTEGER, seen INTEGER);');
    var ITER = 210000, SESS = new Map();   /* token -> { user, at } (memory), backed by the sessions table */
    function kv(k) { var v = U.val('SELECT v FROM keyinfo WHERE k=?', [k]); return v == null ? null : JSON.parse(v); }
    function setKv(k, v) { if (v == null) U.run('DELETE FROM keyinfo WHERE k=?', [k]); else U.run('INSERT OR REPLACE INTO keyinfo VALUES(?,?)', [k, JSON.stringify(v)]); }
    function on() { return !!U.val('SELECT count(*) FROM users WHERE active=1'); }
    function roleOf(id) {
      var j = U.val('SELECT json FROM roles WHERE id=?', [id]);
      if (j) return JSON.parse(j);
      return ROLES.filter(function (r) { return r.id === id; })[0] || ROLES[ROLES.length - 1];
    }
    function userRow(id) { var r = U.rows('SELECT id, name, role, salt, iter, hash, wrap, active FROM users WHERE id=?', [id])[0]; return r && { id: r[0], name: r[1], role: r[2], salt: r[3], iter: r[4], hash: r[5], wrap: r[6], active: r[7] }; }
    function byName(n) { var id = U.val('SELECT id FROM users WHERE lower(name)=lower(?)', [String(n || '').trim()]); return id ? userRow(id) : null; }
    function pub(u) { if (!u) return null; var r = roleOf(u.role); return { id: u.id, name: u.name, role: u.role, roleName: r.name, rights: r.rights, limits: r.limits || {}, active: !!u.active }; }
    function hashOf(pw, salt, iter) { return A.pbkdf2(String(pw), salt, iter); }   /* hex; the first half checks the password, the second half seals the key */
    /* a login token is 64 random bytes: the first half seals the data key and is never stored; the second half names the login */
    function tokHash(t) { return String(t || '').slice(64); }
    function sess(tok) {
      if (!tok) return null;
      var s = SESS.get(tok);
      if (!s) {
        var r = U.rows('SELECT user, wrap FROM sessions WHERE tok=?', [tokHash(tok)])[0];
        if (!r) return null;
        s = { user: r[0], wrap: r[1] }; SESS.set(tok, s);
      }
      var u = userRow(s.user);
      if (!u || !u.active) return null;
      s.u = u;
      return s;
    }
    /* encryption: open the files with the data key the session carries (another tab's worker may not have it yet) */
    function unlockWith(s, tok) {
      if (A.hasKey() || !kv('cipher')) return Promise.resolve();
      return A.unseal(tok.slice(0, 64), s.wrap).then(function (dk) { A.setKey(dk); core.closeAll(); });
    }
    function check(a, store, row, act) {
      if (!on()) return Promise.resolve(null);
      var s = sess(a.tok);
      if (!s) return Promise.reject(err('login'));
      return unlockWith(s, a.tok).then(function () {
        var p = pub(s.u), area = store ? storeArea(store, row) : '';
        if (area && act && !(p.rights[area] && p.rights[area][act])) throw err('no right: ' + area + ' ' + act);
        if (act && (act === 'add' || act === 'edit') && store === 'doc' && row && row.date && p.limits && p.limits.backDays > 0) {
          var lim = new Date(Date.now() - p.limits.backDays * 864e5).toISOString().slice(0, 10);
          if (String(row.date) < lim) throw err('back date: entries older than ' + p.limits.backDays + ' days need the owner');
        }
        return p;
      });
    }
    var O = core.ops, W = {};
    /* reads: in documents, areas the user can't view are left out */
    W.list = function (a) {
      return check(a).then(function (p) {
        var l = O.list(a);
        if (!p || a.store !== 'doc') return l;
        return l.filter(function (d) { var ar = docArea(d); return p.rights[ar] && p.rights[ar].view; });
      });
    };
    W.get = function (a) { return check(a).then(function (p) { var r = O.get(a); if (p && a.store === 'doc' && r) { var ar = docArea(r); if (!(p.rights[ar] && p.rights[ar].view)) return undefined; } return r; }); };
    W.docsOf = function (a) { return check(a).then(function () { return O.docsOf(a); }); };
    W.docsFrom = function (a) {
      return check(a).then(function (p) {
        var r = O.docsFrom(a);
        if (p) r.docs = r.docs.filter(function (d) { var ar = docArea(d); return p.rights[ar] && p.rights[ar].view; });
        return r;
      });
    };
    W.docStat = function (a) { return check(a).then(function () { return O.docStat(a); }); };
    W.noBiz = function (a) { return check(a).then(function (p) { var l = O.noBiz(a); return p ? l.filter(function (d) { var ar = docArea(d); return p.rights[ar] && p.rights[ar].view; }) : l; }); };
    W.count = function (a) { return check(a).then(function () { return O.count(a); }); };
    W.files = function (a) { return check(a).then(function () { return O.files(a); }); };
    W.info = function (a) { return check(a).then(function () { return O.info(a); }); };
    W.setInfo = function (a) { return check(a).then(function () { return O.setInfo(a); }); };
    W.put = function (a) {
      var rows = a.rows || [];
      return rows.reduce(function (p, r) {
        return p.then(function () {
          var exists = a.store === 'log' || a.store === 'ver' || a.store === 'bin' ? false : O.get({ store: a.store, id: r && r.id }) !== undefined;
          return check(a, a.store, r, exists ? 'edit' : 'add');
        });
      }, check(a)).then(function () { return O.put(a); });
    };
    W.del = function (a) { var r = O.get({ store: a.store, id: a.id }) || { id: a.id }; return check(a, a.store, r, 'del').then(function () { return O.del(a); }); };
    W.clear = function (a) { return check(a, 'biz', { id: 'all' }, 'del').then(function (p) { if (p && p.role !== 'owner') throw err('only the owner'); return O.clear(a); }); };
    /* Stage 4: copies of the data files. Any logged-in user may copy (the files stay locked); only the owner brings one back */
    W.snapshot = function (a) { return check(a).then(function () { var r = O.snapshot({ have: a.have, tag: W._tag() }); r.logins = on(); r.cipher = !!kv('cipher'); return r; }); };
    W._tag = function () { var c = kv('cipher'); return c ? 'c' + (c.at || 1) : 'p'; };   /* changes when the files get locked (setupOwner) */
    /* after a backup came back: logins made before it are forgotten, everyone logs in again */
    W._forget = function () { U.run('DELETE FROM sessions'); SESS.clear(); };
    W.canRestore = function (a) { return check(a).then(function (p) { if (p && p.role !== 'owner') throw err('only the owner can bring back a backup'); return true; }); };
    W.importRaw = function (a) { return check(a).then(function (p) { if (p && p.role !== 'owner') throw err('only the owner'); return O.importRaw(a); }); };

    /* ---------- the login commands ---------- */
    W.authStatus = function (a) {
      var s = on() && sess(a.tok);
      return { on: on(), cipher: !!kv('cipher'), users: U.rows('SELECT id, name FROM users WHERE active=1 ORDER BY name').map(function (r) { return { id: r[0], name: r[1] }; }), me: s ? pub(s.u) : null, roles: rolesList() };
    };
    function rolesList() {
      var own = U.rows('SELECT json FROM roles').map(function (r) { return JSON.parse(r[0]); });
      var ids = {}; own.forEach(function (r) { ids[r.id] = 1; });
      return ROLES.filter(function (r) { return !ids[r.id]; }).concat(own);
    }
    function newSession(u, dk) {
      var tok = A.rand(32) + A.rand(32);   /* 64 bytes: the first half seals the data key for this login */
      return (dk ? A.seal(tok.slice(0, 64), dk) : Promise.resolve('')).then(function (wrap) {
        U.run('INSERT INTO sessions VALUES(?,?,?,?,?)', [tokHash(tok), u.id, wrap, Date.now(), Date.now()]);
        U.run('DELETE FROM sessions WHERE made < ?', [Date.now() - 30 * 864e5]);   /* logins older than 30 days are forgotten */
        SESS.set(tok, { user: u.id, wrap: wrap });
        return tok;
      });
    }
    function sealFor(pw, salt, dk) {
      return hashOf(pw, salt, ITER).then(function (h) {
        var x = { hash: h.slice(0, 64), wrap: '' };
        return dk ? A.seal(h.slice(64), dk).then(function (w) { x.wrap = w; return x; }) : x;
      });
    }
    /* first owner: turns logins on; returns the recovery code (shown once, to print) */
    W.setupOwner = function (a) {
      if (on()) return Promise.reject(err('logins are already on'));
      if (!a.name || String(a.pw || '').length < 6) return Promise.reject(err('name and a password of 6 letters or more'));
      var dk = A.rand(32), rc = A.rand(10).toUpperCase().match(/.{4}/g).join('-'), salt = A.rand(16), id = 'u' + A.rand(6), rs = A.rand(16), enc = a.encrypt !== false;
      var seal = null, rec = null;
      /* everything is worked out first; the files are locked next; only then the owner is saved, so a failure leaves logins off */
      return sealFor(a.pw, salt, enc ? dk : '').then(function (x) { seal = x; return hashOf(rc.replace(/-/g, ''), rs, ITER); })
        .then(function (h) { return A.seal(h.slice(64), dk).then(function (w) { rec = { salt: rs, hash: h.slice(0, 64), wrap: w }; }); })
        .then(function () { if (!enc) return; core.closeAll(); return Promise.resolve(A.encryptAll(dk)).then(function () { core.closeAll(); }); })
        .then(function () {
          if (enc) setKv('cipher', { on: true, at: Date.now() });
          setKv('recovery', rec);
          U.run('INSERT INTO users VALUES(?,?,?,?,?,?,?,1,?,?)', [id, String(a.name).trim(), 'owner', salt, ITER, seal.hash, seal.wrap, Date.now(), Date.now()]);
          return newSession(userRow(id), enc ? dk : '');
        }).then(function (tok) { return { tok: tok, recovery: rc, me: pub(userRow(id)) }; });
    };
    W.login = function (a) {
      var u = byName(a.name);
      if (!u || !u.active) return Promise.reject(err('wrong name or password'));
      return hashOf(a.pw, u.salt, u.iter).then(function (h) {
        if (h.slice(0, 64) !== u.hash) throw err('wrong name or password');
        if (!kv('cipher') || !u.wrap) return newSession(u, '');
        return A.unseal(h.slice(64), u.wrap).then(function (dk) { if (!A.hasKey()) { A.setKey(dk); core.closeAll(); } return newSession(u, dk); });
      }).then(function (tok) { return { tok: tok, me: pub(u) }; });
    };
    W.logout = function (a) { if (a.tok) { U.run('DELETE FROM sessions WHERE tok=?', [tokHash(a.tok)]); SESS.delete(a.tok); } return true; };
    /* forgot the owner password: the recovery code opens the data key and sets a new password */
    W.recover = function (a) {
      var rec = kv('recovery'), u = byName(a.name);
      if (!rec || !u || u.role !== 'owner') return Promise.reject(err('only the owner can use the recovery code'));
      return hashOf(String(a.code || '').replace(/[^0-9A-Fa-f]/g, '').toUpperCase(), rec.salt, ITER).then(function (h) {
        if (h.slice(0, 64) !== rec.hash) throw err('wrong recovery code');
        return A.unseal(h.slice(64), rec.wrap);
      }).then(function (dk) { return setPw(u, a.pw, dk); }).then(function () { return W.login({ name: u.name, pw: a.pw }); });
    };
    function setPw(u, pw, dk) {
      if (String(pw || '').length < 6) return Promise.reject(err('a password of 6 letters or more'));
      var salt = A.rand(16);
      return sealFor(pw, salt, kv('cipher') ? dk : '').then(function (x) {
        U.run('UPDATE users SET salt=?, iter=?, hash=?, wrap=?, upd=? WHERE id=?', [salt, ITER, x.hash, x.wrap, Date.now(), u.id]);
      });
    }
    /* the data key of a logged-in session (to seal it for a new or changed user) */
    function dkOf(a) { var s = sess(a.tok); if (!s || !kv('cipher')) return Promise.resolve(''); return A.unseal(a.tok.slice(0, 64), s.wrap); }
    function needUsers(a) { return check(a, '', null, null).then(function (p) { if (!p) throw err('login'); if (!(p.rights.users && p.rights.users.edit)) throw err('no right: users'); return p; }); }
    W.users = function (a) { return needUsers(a).then(function () { return U.rows('SELECT id FROM users ORDER BY name').map(function (r) { return pub(userRow(r[0])); }); }); };
    W.addUser = function (a) {
      return needUsers(a).then(function () {
        if (!a.name || byName(a.name)) throw err('give a new name');
        if (a.role === 'owner') throw err('there is one owner');
        if (String(a.pw || '').length < 6) throw err('a password of 6 letters or more');
        return dkOf(a).then(function (dk) {
          var salt = A.rand(16), id = 'u' + A.rand(6);
          return sealFor(a.pw, salt, dk).then(function (x) { U.run('INSERT INTO users VALUES(?,?,?,?,?,?,?,1,?,?)', [id, String(a.name).trim(), a.role || 'viewer', salt, ITER, x.hash, x.wrap, Date.now(), Date.now()]); return pub(userRow(id)); });
        });
      });
    };
    W.setUser = function (a) {
      return needUsers(a).then(function () {
        var u = userRow(a.id); if (!u) throw err('no such user');
        if (u.role === 'owner' && (a.role && a.role !== 'owner' || a.active === false)) throw err('the owner stays the owner');
        if (a.role) U.run('UPDATE users SET role=?, upd=? WHERE id=?', [a.role === 'owner' ? u.role : a.role, Date.now(), u.id]);
        if (a.active != null) { U.run('UPDATE users SET active=?, upd=? WHERE id=?', [a.active ? 1 : 0, Date.now(), u.id]); if (!a.active) U.run('DELETE FROM sessions WHERE user=?', [u.id]); }
        if (a.pw) return dkOf(a).then(function (dk) { return setPw(u, a.pw, dk); });
      }).then(function () { return pub(userRow(a.id)); });
    };
    /* everyone may change their own password (old one needed) */
    W.changePw = function (a) {
      var s = sess(a.tok); if (!s) return Promise.reject(err('login'));
      return hashOf(a.old, s.u.salt, s.u.iter).then(function (h) { if (h.slice(0, 64) !== s.u.hash) throw err('the old password is wrong'); return dkOf(a); }).then(function (dk) { return setPw(s.u, a.pw, dk); }).then(function () { return true; });
    };
    W.setRole = function (a) {
      return needUsers(a).then(function () {
        var r = a.role || {}; if (!r.id || r.id === 'owner') throw err('the owner role is fixed');
        U.run('INSERT OR REPLACE INTO roles VALUES(?,?,?)', [r.id, String(r.name || r.id), JSON.stringify({ id: r.id, name: r.name || r.id, rights: r.rights || all(false), limits: r.limits || {} })]);
        return rolesList();
      });
    };
    /* may this user do this to this record? (screens and store.js ask before a delete writes its recycle-bin copy) */
    W.can = function (a) { var r = a.store === 'doc' ? (O.get({ store: 'doc', id: a.id }) || a.row || {}) : (a.row || { id: a.id }); return check(a, a.store, r, a.act).then(function () { return true; }, function (e) { if (/NSAUTH: no right|back date/.test(e.message)) return false; throw e; }); };
    /* logins off again (the owner's choice): the owner's password once more; every data file is unlocked first (a failure leaves
       logins on), then the users, roles, logins and the recovery seal are removed */
    W.loginsOff = function (a) {
      return check(a).then(function (p) {
        if (!p) return true;
        if (p.role !== 'owner') throw err('only the owner');
        var u = userRow(sess(a.tok).user);
        return hashOf(a.pw, u.salt, u.iter).then(function (h) {
          if (h.slice(0, 64) !== u.hash) throw err('wrong name or password');
          if (!kv('cipher')) return;
          core.closeAll();
          return Promise.resolve(A.decryptAll()).then(function () { core.closeAll(); });
        }).then(function () {
          U.exec('DELETE FROM sessions; DELETE FROM users; DELETE FROM roles; DELETE FROM keyinfo;');
          SESS.clear();
          return true;
        });
      });
    };
    W.hello = function () { return { on: on() }; };
    W._close = function () { try { U.close(); } catch (e) {} };
    return W;
  }
  makeAuth.ROLES = ROLES; makeAuth.AREAS = AREAS; makeAuth.ACTS = ACTS; makeAuth.docArea = docArea;
  root.NSSqlAuth = makeAuth;
  if (typeof module !== 'undefined' && module.exports) module.exports = makeAuth;
})(typeof globalThis !== 'undefined' ? globalThis : this);
