// 저장소: Firebase 설정이 있으면 Firestore, 없으면 localStorage
import { firebaseConfig } from './firebase-config.js?v=202611120723';

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
    async getMeta() { return load().meta; },
    async setMeta(patch) { const db = load(); db.meta = { ...db.meta, ...patch }; persist(db); },
    async createSession(s) { const db = load(); const n = { ...s, id: uid() }; db.sessions.push(n); persist(db); return n; },
    async getSession(id) { return load().sessions.find((s) => s.id === id) || null; },
    async updateSession(id, patch) { const db = load(); const i = db.sessions.findIndex((s) => s.id === id); if (i >= 0) { db.sessions[i] = { ...db.sessions[i], ...patch }; persist(db); } },
    async deleteSession(id) { const db = load(); db.sessions = db.sessions.filter((s) => s.id !== id); persist(db); },
    async listSessions() { return load().sessions.sort((a, b) => b.createdAt - a.createdAt); },
  };
}

// 데이터는 로그인한 계정별로 users/{uid}/players, users/{uid}/sessions 에 따로 저장됩니다.
function firestoreStore() {
  let fs, db, auth, A;
  const col = (name) => fs.collection(db, 'users', s.user.uid, name);
  const ref = (name, id) => fs.doc(db, 'users', s.user.uid, name, id);
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
    onAuth(cb) { A.onAuthStateChanged(auth, (u) => { s.user = u; cb(u); }); },
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
    async renamePlayer(id, name) {
      await fs.updateDoc(ref('players', id), { name });
      // 지난 기록에 표시되는 이름도 함께 변경
      const snap = await fs.getDocs(fs.query(col('sessions'), fs.where('playerIds', 'array-contains', id)));
      await Promise.all(snap.docs.map((d) => fs.updateDoc(d.ref, {
        players: d.data().players.map((p) => (p.id === id ? { ...p, name } : p)),
      })));
    },
    async getMeta() { const d = await fs.getDoc(ref('meta', 'settings')); return d.exists() ? d.data() : {}; },
    async setMeta(patch) { await fs.setDoc(ref('meta', 'settings'), patch, { merge: true }); },
    async createSession(x) {
      const data = { ...x, createdBy: s.user?.uid || null };
      const r = await fs.addDoc(col('sessions'), data);
      return { id: r.id, ...data };
    },
    async getSession(id) { const d = await fs.getDoc(ref('sessions', id)); return d.exists() ? { id: d.id, ...d.data() } : null; },
    async updateSession(id, patch) { await fs.updateDoc(ref('sessions', id), patch); },
    async deleteSession(id) { await fs.deleteDoc(ref('sessions', id)); },
    async listSessions() {
      const snap = await fs.getDocs(fs.query(col('sessions'), fs.orderBy('createdAt', 'desc')));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    },
  };
  return s;
}

export const store = firebaseConfig.apiKey ? firestoreStore() : localStore();
