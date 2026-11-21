/* NSBiz data on SQLite: the shared logic (owner 20 Nov 2026, Stage 2). The same file runs in the browser worker (sqlworker.js,
   SQLite3 Multiple Ciphers WASM over the browser's private file store) and in the Windows program's main process (ns-desktop
   sqlhome.js, better-sqlite3-multiple-ciphers over real files in Documents\NSBiz\Data). Only the "adapter" differs:
     A.open(name) -> h with h.exec(sql), h.run(sql, binds), h.col(sql, binds) (first column of every row), h.val(sql, binds),
                     h.rows(sql, binds) (rows as arrays), h.many(sql, listOfBinds) (one statement, many rows), h.close()
     A.names()    -> every database file that exists, as '/Common.sqlite', '/NSBiz01/2026-27.sqlite' ...
   Files, like Tally / Evershine company folders:
     /Common.sqlite              businesses, parties, items, settings (meta), recycle bin, edit history, earlier versions,
                                 the business codes (NSBiz01, NSBiz02 …), where each document lives, users and roles (Stage 2)
     /NSBiz01/2026-27.sqlite     the documents (vouchers) of business NSBiz01 dated in 2026-27; one file per business per year
     /NSBiz00/<year>.sqlite      documents whose business is not known */
(function (root) {
  'use strict';
  var COMMON = ['biz', 'party', 'item', 'meta', 'bin', 'log', 'ver'];
  var YEARFILE = /^\/NSBiz\d+\/[\d-]+\.sqlite$/;
  var DATAFILE = /^\/(Users|Common)\.sqlite$|^\/NSBiz\d+\/[\d-]+\.sqlite$/;   /* the files a backup holds (Stage 4) */

  function makeCore(A) {
    var DBS = new Map(), BIZ = null;
    function open(name) {
      var db = DBS.get(name);
      if (db) return db;
      db = A.open(name);
      if (name === '/Common.sqlite') {
        db.exec(COMMON.map(function (s) { return 'CREATE TABLE IF NOT EXISTS "' + s + '"(id TEXT PRIMARY KEY, upd INTEGER, json TEXT NOT NULL);'; }).join('') +
          'CREATE TABLE IF NOT EXISTS docloc(id TEXT PRIMARY KEY, file TEXT NOT NULL);' +
          'CREATE INDEX IF NOT EXISTS docloc_f ON docloc(file);' +
          'CREATE TABLE IF NOT EXISTS codes(biz TEXT PRIMARY KEY, code TEXT UNIQUE NOT NULL, made INTEGER);' +
          'CREATE TABLE IF NOT EXISTS info(k TEXT PRIMARY KEY, v TEXT);');
      } else {
        db.exec('CREATE TABLE IF NOT EXISTS doc(id TEXT PRIMARY KEY, type TEXT, kind TEXT, date TEXT, no TEXT, party TEXT, total REAL, upd INTEGER, json TEXT NOT NULL);' +
          'CREATE INDEX IF NOT EXISTS doc_td ON doc(type, date); CREATE INDEX IF NOT EXISTS doc_no ON doc(no); CREATE INDEX IF NOT EXISTS doc_p ON doc(party, date);');
      }
      DBS.set(name, db);
      return db;
    }
    function C() { return open('/Common.sqlite'); }
    function tx(db, fn) { db.exec('BEGIN'); try { var r = fn(); db.exec('COMMIT'); return r; } catch (e) { try { db.exec('ROLLBACK'); } catch (x) {} throw e; } }

    /* ---------- which file a document belongs in ---------- */
    function fyOf(d) {
      var s = String(d && (d.date || d.vdate || d.from || '') || '');
      if (!/^\d{4}-\d{2}/.test(s)) { var t = d && (d.created || d.updated) || Date.now(); s = new Date(t).toISOString().slice(0, 10); }
      var y = +s.slice(0, 4), m = +s.slice(5, 7), st = m >= 4 ? y : y - 1;
      return st + '-' + String((st + 1) % 100).padStart(2, '0');
    }
    function bizList() {
      if (!BIZ) BIZ = C().col('SELECT json FROM biz').map(function (j) { try { var b = JSON.parse(j); return { id: b.id, name: String(b.name || '').trim().toLowerCase() }; } catch (e) { return null; } }).filter(Boolean);
      return BIZ;
    }
    function bizOf(d) {
      if (!d) return '';
      if (typeof d.biz === 'string' && d.biz) return d.biz;
      if (typeof d.bizId === 'string' && d.bizId) return d.bizId;
      var w = d.seller || null;   /* NSBiz keeps the own business as "seller" on every document, purchase bills too (the supplier is the "buyer") */
      var L = bizList();
      if (w && w.id && L.some(function (b) { return b.id === w.id; })) return w.id;
      var nm = String(w && w.name || '').trim().toLowerCase();
      var hit = nm && L.filter(function (b) { return b.name === nm; })[0];
      if (hit) return hit.id;
      return L.length === 1 ? L[0].id : '';
    }
    function codeOf(biz) {
      if (!biz) return 'NSBiz00';
      var db = C(), have = db.val('SELECT code FROM codes WHERE biz=?', [biz]);
      if (have) return have;
      var n = (db.val('SELECT max(CAST(substr(code,6) AS INTEGER)) FROM codes') || 0) + 1;   /* numbers are never reused */
      var code = 'NSBiz' + String(n).padStart(2, '0');
      db.run('INSERT INTO codes VALUES(?,?,?)', [biz, code, Date.now()]);
      return code;
    }
    function fileFor(d) { return '/' + codeOf(bizOf(d)) + '/' + fyOf(d) + '.sqlite'; }
    function docFiles() { return C().col('SELECT DISTINCT file FROM docloc ORDER BY file'); }
    function party(d) { var p = d.buyer; return String(d.party || p && p.name || d.payee || d.name || ''); }
    var J = function (s) { return JSON.parse(s); };

    /* ---------- the store commands (the same the data home always had) ---------- */
    function list(store) {
      if (store !== 'doc') return C().col('SELECT json FROM "' + store + '"').map(J);
      var out = [];
      docFiles().forEach(function (f) { open(f).col('SELECT json FROM doc').forEach(function (j) { out.push(J(j)); }); });
      return out;
    }
    function get(store, id) {
      if (store !== 'doc') { var j = C().val('SELECT json FROM "' + store + '" WHERE id=?', [String(id)]); return j ? J(j) : undefined; }
      var f = C().val('SELECT file FROM docloc WHERE id=?', [String(id)]);
      var k = f && open(f).val('SELECT json FROM doc WHERE id=?', [String(id)]);
      return k ? J(k) : undefined;
    }
    function put(store, rows) {
      rows = (rows || []).filter(function (r) { return r && r.id != null; });
      if (store !== 'doc') {
        tx(C(), function () { C().many('INSERT OR REPLACE INTO "' + store + '" VALUES(?,?,?)', rows.map(function (r) { return [String(r.id), r.updated || 0, JSON.stringify(r)]; })); });
        if (store === 'biz') BIZ = null;
        return rows.length;
      }
      /* documents: each into its business-and-year file; one that moved (date or business changed) leaves its old file */
      var by = new Map(), c = C(), moves = [];
      rows.forEach(function (r) {
        var f = fileFor(r), was = c.val('SELECT file FROM docloc WHERE id=?', [String(r.id)]);
        if (was && was !== f) moves.push([was, String(r.id)]);
        if (!by.has(f)) by.set(f, []);
        by.get(f).push(r);
      });
      by.forEach(function (l, f) {
        var db = open(f);
        tx(db, function () { db.many('INSERT OR REPLACE INTO doc VALUES(?,?,?,?,?,?,?,?,?)', l.map(function (r) { return [String(r.id), String(r.type || ''), String(r.kind || ''), String(r.date || ''), String(r.no || ''), party(r), +r.total || 0, r.updated || 0, JSON.stringify(r)]; })); });
      });
      tx(c, function () { var all = []; by.forEach(function (l, f) { l.forEach(function (r) { all.push([String(r.id), f]); }); }); c.many('INSERT OR REPLACE INTO docloc VALUES(?,?)', all); });
      moves.forEach(function (m) { open(m[0]).run('DELETE FROM doc WHERE id=?', [m[1]]); });
      return rows.length;
    }
    function del(store, id) {
      id = String(id);
      if (store !== 'doc') { C().run('DELETE FROM "' + store + '" WHERE id=?', [id]); if (store === 'biz') BIZ = null; return; }
      var f = C().val('SELECT file FROM docloc WHERE id=?', [id]);
      if (f) open(f).run('DELETE FROM doc WHERE id=?', [id]);
      C().run('DELETE FROM docloc WHERE id=?', [id]);
    }
    function clear(store) {
      if (store !== 'doc') { C().exec('DELETE FROM "' + store + '"'); if (store === 'biz') BIZ = null; return; }
      docFiles().forEach(function (f) { open(f).exec('DELETE FROM doc'); });
      C().exec('DELETE FROM docloc');
    }
    function count(store) { return store !== 'doc' ? C().val('SELECT count(*) FROM "' + store + '"') : C().val('SELECT count(*) FROM docloc'); }
    /* documents of one business and year, optionally of some types, newest first (Stage 3 screens) */
    function docsOf(a) {
      var f = '/' + (a.code || codeOf(a.biz)) + '/' + a.fy + '.sqlite';
      if (docFiles().indexOf(f) < 0) return [];
      var sql = 'SELECT json FROM doc', b;
      if (a.types && a.types.length) { sql += ' WHERE type IN (' + a.types.map(function () { return '?'; }).join(',') + ')'; b = a.types.slice(); }
      return open(f).col(sql + ' ORDER BY date DESC, no DESC', b).map(J);
    }
    /* Stage 3: the App reads only the open years. closed = { '<business id>': ['2024-25', ...] }; for each business the years
       from its first year file up to the last closed one in an unbroken run are left out, and their fingerprint (count of
       documents and sum of save times) is sent instead, so the App knows when its carried balances must be worked out again.
       Returns { docs, cut: { '<business id>': { fy: '2025-26', sig: 'n:sum' } } } */
    function docsFrom(a) {
      var closed = a.closed || {}, cut = {}, skip = {}, c = C();
      Object.keys(closed).forEach(function (biz) {
        var code = c.val('SELECT code FROM codes WHERE biz=?', [biz]); if (!code) return;
        var shut = {}; (closed[biz] || []).forEach(function (f) { shut[f] = 1; });
        var yrs = docFiles().filter(function (f) { return f.indexOf('/' + code + '/') === 0; }).map(function (f) { return f.slice(code.length + 2, -7); }).sort();
        var last = '';
        for (var i = 0; i < yrs.length && shut[yrs[i]]; i++) last = yrs[i];
        if (!last) return;
        var n = 0, sum = 0;
        yrs.forEach(function (y) { if (y > last) return; var f = '/' + code + '/' + y + '.sqlite'; skip[f] = 1; var r = open(f).rows('SELECT count(*), coalesce(sum(upd % 1000000007), 0) FROM doc')[0]; n += Number(r[0]); sum = (sum + Number(r[1])) % 1e15;   /* kept small: the browser build hands back big sums as BigInt */ });
        cut[biz] = { fy: last, first: yrs[0], sig: n + ':' + sum };
      });
      var out = [];
      docFiles().forEach(function (f) { if (!skip[f]) open(f).col('SELECT json FROM doc').forEach(function (j) { out.push(J(j)); }); });
      return { docs: out, cut: cut };
    }
    /* how many documents and the oldest save time (the backup reminder), without reading them */
    function docStat() {
      var n = Number(C().val('SELECT count(*) FROM docloc') || 0), old = 0, sum = 0;
      docFiles().forEach(function (f) {
        var r = open(f).rows('SELECT min(CASE WHEN upd > 0 THEN upd END), coalesce(sum(upd % 1000000007), 0), count(*) FROM doc')[0], v = Number(r[0] || 0);
        if (v && (!old || v < old)) old = v; sum = (sum + Number(r[1]) * 31 + Number(r[2])) % 1e15;
      });
      return { n: n, oldest: old, stamp: n + ':' + sum };   /* stamp: changes with any save, delete or move of a document */
    }
    /* documents with no business id (the App links them once at start): only those are read */
    function noBiz() {
      var out = [];
      docFiles().forEach(function (f) { open(f).col("SELECT json FROM doc WHERE json_extract(json, '$.bizId') IS NULL OR json_extract(json, '$.bizId') = ''").forEach(function (j) { out.push(J(j)); }); });
      return out;
    }
    function files() {
      var c = C();
      return { names: A.names(), codes: c.rows('SELECT code, biz FROM codes ORDER BY code'), docs: c.rows('SELECT file, count(*) FROM docloc GROUP BY file ORDER BY file'), where: A.where || '' };
    }
    /* the old store (or a backup) taken in as it is: the append-only rules were applied when it was saved */
    function importRaw(a) {
      var c = C();
      if (!a.force && c.val("SELECT v FROM info WHERE k='migrated'")) return { skipped: true };
      COMMON.forEach(function (s) { c.exec('DELETE FROM "' + s + '"'); });
      A.names().forEach(function (f) { if (YEARFILE.test(f)) open(f).exec('DELETE FROM doc'); });
      c.exec('DELETE FROM docloc');
      var n = 0;
      COMMON.forEach(function (s) { if (Array.isArray(a.data[s])) n += put(s, a.data[s]); });
      if (Array.isArray(a.data.doc)) n += put('doc', a.data.doc);
      c.run("INSERT OR REPLACE INTO info VALUES('migrated', ?)", [JSON.stringify({ at: Date.now(), rows: n })]);
      return { rows: n };
    }
    function info(a) { var v = C().val('SELECT v FROM info WHERE k=?', [a.k]); return v == null ? null : J(v); }
    function setInfo(a) { C().run('INSERT OR REPLACE INTO info VALUES(?,?)', [a.k, JSON.stringify(a.v)]); return 1; }
    /* a document saved into a new file is removed from the old file after the new one is written; if the program stopped in
       between, the old copy is removed here, at the next start */
    function repair() {
      var map = new Map(C().rows('SELECT id, file FROM docloc'));
      A.names().forEach(function (f) {
        if (!YEARFILE.test(f)) return;
        var db = open(f), stale = db.col('SELECT id FROM doc').filter(function (id) { return map.get(id) !== f; });
        if (stale.length) tx(db, function () { db.many('DELETE FROM doc WHERE id=?', stale.map(function (id) { return [id]; })); });
      });
    }
    /* ---------- Stage 4: copies of the data files (Backup\Mon..Sun, like Tally and Evershine) ----------
       The files exactly as they lie on disk: once logins are on they stay locked in the copy. A year file gets a fingerprint
       (count, save times, size of its documents) so the next copy of the same day skips the files that did not change (closed
       years never change); Common.sqlite and Users.sqlite are always copied (small). A.read(name) gives the file's bytes. */
    function fileStamps() {
      var out = {};
      A.names().forEach(function (f) {
        if (!YEARFILE.test(f)) return;
        var r = open(f).rows('SELECT count(*), coalesce(sum(upd % 1000000007), 0), coalesce(sum(length(json)), 0) FROM doc')[0];
        out[f] = r.map(Number).join(':');
      });
      return out;
    }
    /* have = { name: stamp } of a copy already made; those files come back as { same: 1 } without their bytes.
       tag = how the files are locked (sqlauth gives it): when logins and the lock come on, the same documents are new bytes */
    function snapshot(a) {
      var have = a.have || {}, st = fileStamps(), out = [], tag = a.tag || 'p';
      A.names().forEach(function (f) {
        if (!DATAFILE.test(f)) return;
        var s = st[f] ? tag + '|' + st[f] : '';
        if (s && have[f] === s) { out.push({ name: f, stamp: s, same: 1 }); return; }
        var b = A.read(f);
        out.push({ name: f, stamp: s, size: b.length, bytes: b });
      });
      return { at: Date.now(), files: out };
    }
    /* a set of files that may replace the data: only data file names, Common.sqlite in it, whole database pages */
    function checkSet(files) {
      if (!Array.isArray(files) || !files.length) throw new Error('This backup holds no data files.');
      var seen = {};
      files.forEach(function (f) {
        if (!f || !DATAFILE.test(f.name) || seen[f.name]) throw new Error('This backup has a file NSBiz does not know: ' + (f && f.name));
        seen[f.name] = 1;
        var n = f.bytes && f.bytes.length || 0;
        if (n < 512 || n % 512) throw new Error('This backup is damaged: ' + f.name + ' is not a whole database.');
      });
      if (!seen['/Common.sqlite']) throw new Error('This backup has no Common.sqlite (businesses, parties, settings).');
      return true;
    }
    function closeAll() { DBS.forEach(function (db) { try { db.close(); } catch (e) {} }); DBS.clear(); BIZ = null; }
    /* the files are first opened by the first command, not here: once logins are on they are encrypted and need the key first */
    var booted = false;
    function boot(fn) { return function (a) { if (!booted) { C(); repair(); booted = true; } return fn(a || {}); }; }
    return {
      ops: { list: boot(function (a) { return list(a.store); }), get: boot(function (a) { return get(a.store, a.id); }), put: boot(function (a) { return put(a.store, a.rows); }),
        del: boot(function (a) { return del(a.store, a.id); }), clear: boot(function (a) { return clear(a.store); }), count: boot(function (a) { return count(a.store); }),
        docsOf: boot(docsOf), docsFrom: boot(docsFrom), docStat: boot(docStat), noBiz: boot(noBiz), files: boot(files), importRaw: boot(importRaw), info: boot(info), setInfo: boot(setInfo),
        snapshot: boot(snapshot) },
      common: C, open: open, tx: tx, closeAll: closeAll, checkSet: checkSet, DATAFILE: DATAFILE
    };
  }
  root.NSSqlCore = makeCore;
  if (typeof module !== 'undefined' && module.exports) module.exports = makeCore;
})(typeof globalThis !== 'undefined' ? globalThis : this);
