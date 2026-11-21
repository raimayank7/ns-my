/* NSBiz data on SQLite in the browser: the worker of the data home (my.niveshsahayak.in/vault.html).
   Started only by the data-home frame that holds the 'nsbiz-sql' lock; every other tab asks that one (vault.js).
   SQLite3 Multiple Ciphers 2.6.1 (MIT, SQLite 3.54.0) over the browser's private file store (OPFS, "pool" VFS, because
   GitHub Pages cannot send the headers the faster VFS needs). The logic is shared with the Windows program: sqlcore.js
   (the data) and sqlauth.js (user logins, rights, encryption). */
import init from '/assets/vendor/sqlite3mc-2.6.1/sqlite3.mjs';
import '/assets/sqlcore.js';
import '/assets/sqlauth.js';

let S = null, POOL = null, VFS = '', CORE = null, OPS = null, KEY = '';
const hex = (b) => Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, '0')).join('');
const unhex = (h) => new Uint8Array(String(h).match(/../g).map((x) => parseInt(x, 16)));
const aes = (keyHex) => crypto.subtle.importKey('raw', unhex(keyHex), 'AES-GCM', false, ['encrypt', 'decrypt']);

function rawDb(name, key) {
  const db = new S.oo1.DB({ filename: 'file:' + name + '?vfs=' + VFS, flags: 'c' });
  if (key) db.exec("PRAGMA key='" + String(key).replace(/[^0-9a-f]/g, '') + "'");   /* PRAGMA takes no bound values; the key is hex */
  return db;
}
/* the adapter sqlcore.js and sqlauth.js work through (oo1 API of the WASM build + the browser's own crypto) */
function adapter() {
  return {
    where: 'browser',
    names: () => POOL.getFileNames(),
    read: (name) => POOL.exportFile(name),   /* Stage 4: the file as it is stored (still locked once logins are on) */
    open(name) {
      const db = rawDb(name, name === '/Users.sqlite' ? '' : KEY);   /* the users file stays readable: the login is checked there */
      db.exec('PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL;');   /* pool VFS: plain rollback journal; FULL = a power cut never leaves half a save */
      const B = (b) => b && b.length ? b : undefined;
      return {
        exec: (sql) => db.exec(sql),
        run: (sql, b) => db.exec({ sql, bind: B(b) }),
        col: (sql, b) => db.selectValues(sql, B(b)),
        val: (sql, b) => db.selectValue(sql, B(b)),
        rows: (sql, b) => db.selectArrays(sql, B(b)),
        many(sql, list) { if (!list.length) return; const st = db.prepare(sql); try { for (const r of list) st.bind(r).stepReset(); } finally { st.finalize(); } },
        close: () => db.close()
      };
    },
    rand: (n) => hex(crypto.getRandomValues(new Uint8Array(n))),
    async pbkdf2(pw, salt, iter) {
      const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
      return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: unhex(salt), iterations: iter }, k, 512));
    },
    async seal(keyHex, text) {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      return hex(iv) + hex(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aes(keyHex), new TextEncoder().encode(text)));
    },
    async unseal(keyHex, sealed) {
      const b = unhex(sealed);
      return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b.slice(0, 12) }, await aes(keyHex), b.slice(12)));
    },
    hasKey: () => !!KEY,
    setKey(k) { KEY = k; },
    /* every data file (not the users file) is encrypted in place with the new data key */
    encryptAll(dk) {
      for (const n of POOL.getFileNames()) {
        if (!/\.sqlite$/.test(n) || n === '/Users.sqlite') continue;
        const db = rawDb(n, KEY);
        try { db.exec("PRAGMA rekey='" + String(dk).replace(/[^0-9a-f]/g, '') + "'"); } finally { db.close(); }
      }
      KEY = dk;
    }
  };
}

async function start() {
  S = await init();
  POOL = await S.installOpfsSAHPoolVfs({ name: 'nsbiz', directory: '.nsbiz-data', initialCapacity: 16 });
  if (S.capi.sqlite3mc_vfs_create('nsbiz', 0) !== 0) throw new Error('cipher layer');
  VFS = 'multipleciphers-nsbiz';
  boot();
  return S.version.libVersion;
}
function boot() { const A = adapter(); CORE = self.NSSqlCore(A); OPS = self.NSSqlAuth(CORE, A); }
const ready = start();
/* the pool needs free file slots: grow it before it runs out (each open year file takes one, plus its journal) */
async function room() { if (POOL.getCapacity() - POOL.getFileCount() < 6) await POOL.addCapacity(8); }

const EXTRA = {
  /* test helper: forget everything (only the test pages use it) */
  wipe: async () => { CORE.closeAll(); OPS._close(); await POOL.wipeFiles(); KEY = ''; boot(); return 1; },
  pause: () => { CORE.closeAll(); OPS._close(); POOL.pauseVfs(); return 1; },
  /* Stage 4: bring back a backup. The whole set of files replaces the data on this device (files the backup does not have,
     e.g. a year begun after it, go); the files keep their own lock, so the owner logs in again with the backup's passwords.
     Only the owner may do this once logins are on (sqlauth canRestore). The page saved the current data first. */
  restore: async (a) => {
    await OPS.canRestore(a);
    const files = (a.files || []).map((f) => ({ name: f.name, bytes: f.bytes instanceof Uint8Array ? f.bytes : new Uint8Array(f.bytes || 0) }));
    CORE.checkSet(files);
    CORE.closeAll(); OPS._close();
    const keep = new Set(files.map((f) => f.name));
    for (const n of POOL.getFileNames()) if (!keep.has(n)) POOL.unlink(n);
    if (POOL.getCapacity() - POOL.getFileCount() < files.length + 6) await POOL.addCapacity(files.length + 8);
    for (const f of files) POOL.importDb(f.name, f.bytes);
    KEY = ''; boot(); OPS._forget();
    return { n: files.length };
  }
};
onmessage = async (e) => {
  const m = e.data || {};
  let reply;
  try {
    const ver = await ready;
    if (m.op === 'hello') reply = { ok: true, result: { ver } };
    else {
      const fn = EXTRA[m.op] || OPS[m.op]; if (!fn) throw new Error('Unknown operation ' + m.op);
      await room();
      reply = { ok: true, result: await fn(m.args || {}) };
    }
  } catch (err) { reply = { ok: false, result: String(err && err.message || err) }; }
  reply.id = m.id;
  /* file copies (Stage 4) are handed over, not copied again */
  const move = reply.ok && reply.result && Array.isArray(reply.result.files) ? reply.result.files.filter((f) => f.bytes && f.bytes.buffer).map((f) => f.bytes.buffer) : [];
  postMessage(reply, move);
};
