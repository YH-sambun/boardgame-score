// 저장소: Firebase 설정이 있으면 Firestore, 없으면 localStorage
import { firebaseConfig } from './firebase-config.js';

const FB = 'https://www.gstatic.com/firebasejs/10.12.2';
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

function localStore() {
  const KEY = 'bgscore:v1';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || { players: [], sessions: [] }; } catch { return { players: [], sessions: [] }; } };
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
    async createSession(s) { const db = load(); const n = { ...s, id: uid() }; db.sessions.push(n); persist(db); return n; },
    async getSession(id) { return load().sessions.find((s) => s.id === id) || null; },
    async updateSession(id, patch) { const db = load(); const i = db.sessions.findIndex((s) => s.id === id); if (i >= 0) { db.sessions[i] = { ...db.sessions[i], ...patch }; persist(db); } },
    async deleteSession(id) { const db = load(); db.sessions = db.sessions.filter((s) => s.id !== id); persist(db); },
    async listSessions() { return load().sessions.sort((a, b) => b.createdAt - a.createdAt); },
  };
}

function firestoreStore() {
  let fs, db, auth, A;
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
      const snap = await fs.getDocs(fs.collection(db, 'players'));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    },
    async addPlayer(name) {
      const p = { name, createdAt: Date.now() };
      const ref = await fs.addDoc(fs.collection(db, 'players'), p);
      return { id: ref.id, ...p };
    },
    async deletePlayer(id) { await fs.deleteDoc(fs.doc(db, 'players', id)); },
    async createSession(x) {
      const data = { ...x, createdBy: s.user?.uid || null };
      const ref = await fs.addDoc(fs.collection(db, 'sessions'), data);
      return { id: ref.id, ...data };
    },
    async getSession(id) { const d = await fs.getDoc(fs.doc(db, 'sessions', id)); return d.exists() ? { id: d.id, ...d.data() } : null; },
    async updateSession(id, patch) { await fs.updateDoc(fs.doc(db, 'sessions', id), patch); },
    async deleteSession(id) { await fs.deleteDoc(fs.doc(db, 'sessions', id)); },
    async listSessions() {
      const snap = await fs.getDocs(fs.query(fs.collection(db, 'sessions'), fs.orderBy('createdAt', 'desc')));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    },
  };
  return s;
}

export const store = firebaseConfig.apiKey ? firestoreStore() : localStore();
