// 저장소: Firebase 설정이 있으면 Firestore, 없으면 localStorage
import { firebaseConfig } from './firebase-config.js?v=202611120753';

const FB = 'https://www.gstatic.com/firebasejs/10.12.2';
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

function localStore() {
  const KEY = 'bgscore:v1';
  const load = () => { let d; try { d = JSON.parse(localStorage.getItem(KEY)); } catch {} d = d || {}; return { players: [], sessions: [], meta: {}, ...d }; };
  const persist = (db) => localStorage.setItem(KEY, JSON.stringify(db));
  return {
    mode: 'local',
    user: { displayName: '이 기기' },
    async init() {},
    onAuth(cb) { cb(this.user); },
    async signIn() {}, async signOut() {},
    async listPlayers() { return load().players.sort((a, b) => a.name.localeCompare(b.name, 'ko')); },
    async addPlayer(name) { const db = load(); const p = { id: uid(), name, createdAt: Date.now() }; db.players.push(p); persist(db); return p; },
    async deletePlayer(id) { const db = load(); db.players = db.players.filter((p) => p.id !== id); persist(db); },
    async renamePlayer(id, name) {
      const db = load();
      db.players.forEach((p) => { if (p.id === id) p.name = name; });
      db.sessions.forEach((s) => s.players.forEach((p) => { if (p.id === id) p.name = name; }));
      persist(db);
    },
    async setPlayerEmail(id, email) { const db = load(); db.players.forEach((p) => { if (p.id === id) p.email = email; }); persist(db); },
    async getMeta() { return load().meta; },
    async setMeta(patch) { const db = load(); db.meta = { ...db.meta, ...patch }; persist(db); },
    async createSession(s) { const db = load(); const n = { ...s, id: uid() }; db.sessions.push(n); persist(db); return n; },
    async getSession(id) { return load().sessions.find((s) => s.id === id) || null; },
    async updateSession(id, patch) { const db = load(); const i = db.sessions.findIndex((s) => s.id === id); if (i >= 0) { db.sessions[i] = { ...db.sessions[i], ...patch }; persist(db); } },
    async deleteSession(id) { const db = load(); db.sessions = db.sessions.filter((s) => s.id !== id); persist(db); },
    async listSessions() { return load().sessions.sort((a, b) => b.createdAt - a.createdAt); },
  };
}

// Firestore 구조
//  users/{uid}/players, users/{uid}/meta : 내 계정 전용
//  sessions/{id} : 게임 기록. ownerUid(만든 사람) + viewerEmails(참가자에 연결된 이메일)
//    → 참가자에 이메일을 연결하면 그 계정에서도 해당 게임을 보고 점수를 입력할 수 있음 (삭제는 만든 사람만)
const normEmail = (e) => String(e || '').trim().toLowerCase();
const viewerEmailsOf = (players) => [...new Set(players.map((p) => normEmail(p.email)).filter(Boolean))];

function firestoreStore() {
  let fs, db, auth, A;
  const col = (name) => fs.collection(db, 'users', s.user.uid, name);
  const ref = (name, id) => fs.doc(db, 'users', s.user.uid, name, id);
  const sref = (id) => fs.doc(db, 'sessions', id);
  const withFlags = (d) => ({ id: d.id, ...d.data(), shared: d.data().ownerUid !== s.user.uid });
  const ownSessions = async () => (await fs.getDocs(fs.query(fs.collection(db, 'sessions'), fs.where('ownerUid', '==', s.user.uid)))).docs;

  // 예전 위치(users/{uid}/sessions)의 기록을 공유 가능한 위치로 한 번 옮김
  async function migrate() {
    const old = await fs.getDocs(col('sessions'));
    if (old.empty) return;
    const players = await s.listPlayers();
    const emailOf = new Map(players.map((p) => [p.id, p.email || null]));
    for (const d of old.docs) {
      const x = d.data();
      const ps = x.players.map((p) => ({ ...p, email: emailOf.get(p.id) || null }));
      await fs.setDoc(sref(d.id), { ...x, players: ps, ownerUid: s.user.uid, ownerName: s.user.displayName || '', viewerEmails: viewerEmailsOf(ps) });
      await fs.deleteDoc(d.ref);
    }
  }

  const s = {
    mode: 'firebase',
    user: null,
    async init() {
      const [{ initializeApp }, F, AU] = await Promise.all([
        import(`${FB}/firebase-app.js`), import(`${FB}/firebase-firestore.js`), import(`${FB}/firebase-auth.js`)]);
      fs = F; A = AU;
      const app = initializeApp(firebaseConfig);
      db = F.initializeFirestore(app, { localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }) });
      auth = AU.getAuth(app);
    },
    onAuth(cb) {
      A.onAuthStateChanged(auth, async (u) => {
        s.user = u;
        if (u) { try { await migrate(); } catch (e) { console.error('migrate', e); } }
        cb(u);
      });
    },
    async signIn() { await A.signInWithPopup(auth, new A.GoogleAuthProvider()); },
    async signOut() { await A.signOut(auth); },
    async listPlayers() {
      const snap = await fs.getDocs(col('players'));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    },
    async addPlayer(name) {
      const p = { name, createdAt: Date.now() };
      const r = await fs.addDoc(col('players'), p);
      return { id: r.id, ...p };
    },
    async deletePlayer(id) { await fs.deleteDoc(ref('players', id)); },
    // 내가 만든 게임 중 이 참가자가 들어간 기록의 players / viewerEmails 갱신
    async _patchOwnSessions(id, fn) {
      const docs = (await ownSessions()).filter((d) => (d.data().playerIds || []).includes(id));
      await Promise.all(docs.map((d) => {
        const ps = d.data().players.map((p) => (p.id === id ? fn(p) : p));
        return fs.updateDoc(d.ref, { players: ps, viewerEmails: viewerEmailsOf(ps) });
      }));
    },
    async renamePlayer(id, name) {
      await fs.updateDoc(ref('players', id), { name });
      await s._patchOwnSessions(id, (p) => ({ ...p, name }));
    },
    async setPlayerEmail(id, email) {
      email = normEmail(email) || null;
      await fs.updateDoc(ref('players', id), { email });
      await s._patchOwnSessions(id, (p) => ({ ...p, email }));
    },
    async getMeta() { const d = await fs.getDoc(ref('meta', 'settings')); return d.exists() ? d.data() : {}; },
    async setMeta(patch) { await fs.setDoc(ref('meta', 'settings'), patch, { merge: true }); },
    async createSession(x) {
      const data = { ...x, ownerUid: s.user.uid, ownerName: s.user.displayName || '', viewerEmails: viewerEmailsOf(x.players) };
      const r = await fs.addDoc(fs.collection(db, 'sessions'), data);
      return { id: r.id, ...data, shared: false };
    },
    async getSession(id) {
      try { const d = await fs.getDoc(sref(id)); return d.exists() ? withFlags(d) : null; }
      catch (e) { if (e.code === 'permission-denied') return null; throw e; }
    },
    async updateSession(id, patch) { await fs.updateDoc(sref(id), patch); },
    async deleteSession(id) { await fs.deleteDoc(sref(id)); },
    async listSessions() {
      const email = normEmail(s.user.email);
      const [own, shared] = await Promise.all([
        ownSessions(),
        email ? fs.getDocs(fs.query(fs.collection(db, 'sessions'), fs.where('viewerEmails', 'array-contains', email))).then((x) => x.docs) : [],
      ]);
      const map = new Map();
      [...own, ...shared].forEach((d) => map.set(d.id, withFlags(d)));
      return [...map.values()].sort((a, b) => b.createdAt - a.createdAt);
    },
  };
  return s;
}

// 게스트 모드: 로그인하지 않으면 이 기기(localStorage)에만 저장. 로그인하면 Firestore.
const GUEST_KEY = 'bgscore:guest';
const getGuest = () => { try { return localStorage.getItem(GUEST_KEY) === '1'; } catch { return false; } };
const setGuest = (v) => { try { v ? localStorage.setItem(GUEST_KEY, '1') : localStorage.removeItem(GUEST_KEY); } catch {} };

function hybridStore() {
  const fb = firestoreStore();
  const lc = localStore();
  let guest = getGuest();
  let authCb = () => {};
  let fbUser = null;
  const active = () => (guest ? lc : fb);
  const h = {
    get mode() { return guest ? 'local' : 'firebase'; },
    get guest() { return guest; },
    get user() { return guest ? { displayName: '게스트' } : fb.user; },
    async init() { await fb.init(); },
    onAuth(cb) {
      authCb = cb;
      fb.onAuth((u) => {
        fbUser = u;
        if (u) { guest = false; setGuest(false); cb(u); } else cb(guest ? h.user : null);
      });
    },
    async signIn() { await fb.signIn(); },
    async signOut() {
      if (guest) { guest = false; setGuest(false); authCb(null); return; }
      await fb.signOut();
    },
    enterGuest() { guest = true; setGuest(true); authCb(h.user); },
    // 이 기기에 남은 게스트 기록 수
    async guestDataCount() {
      const [ss, ps] = await Promise.all([lc.listSessions(), lc.listPlayers()]);
      return { sessions: ss.length, players: ps.length };
    },
    // 게스트 기록을 로그인한 계정으로 옮기고 이 기기에서는 지움
    async importGuestData() {
      const [lPlayers, lSessions, mine] = await Promise.all([lc.listPlayers(), lc.listSessions(), fb.listPlayers()]);
      const idMap = new Map();
      for (const p of lPlayers) {
        const same = mine.find((m) => m.name === p.name);
        idMap.set(p.id, same ? same.id : (await fb.addPlayer(p.name)).id);
      }
      for (const s of lSessions.slice().reverse()) {
        const { id, shared, ...rest } = s;
        const players = s.players.map((p) => ({ ...p, id: idMap.get(p.id) || p.id }));
        await fb.createSession({ ...rest, players, playerIds: players.map((p) => p.id) });
      }
      for (const s of lSessions) await lc.deleteSession(s.id);
      for (const p of lPlayers) await lc.deletePlayer(p.id);
      return lSessions.length;
    },
  };
  for (const k of ['listPlayers', 'addPlayer', 'deletePlayer', 'renamePlayer', 'setPlayerEmail', 'getMeta', 'setMeta',
    'createSession', 'getSession', 'updateSession', 'deleteSession', 'listSessions']) {
    h[k] = (...a) => active()[k](...a);
  }
  return h;
}

export const store = firebaseConfig.apiKey ? hybridStore() : localStore();
