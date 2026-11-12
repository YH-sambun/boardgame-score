// 저장소: Firebase 설정이 있으면 Firestore, 없으면 localStorage
import { firebaseConfig } from './firebase-config.js?v=202611121512';

const FB = 'https://www.gstatic.com/firebasejs/10.12.2';
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

function localStore() {
  const KEY = 'bgscore:v1';
  const load = () => { let d; try { d = JSON.parse(localStorage.getItem(KEY)); } catch {} d = d || {}; return { players: [], sessions: [], meta: {}, notes: {}, ...d }; };
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
    async deleteSession(id) { const db = load(); db.sessions = db.sessions.filter((s) => s.id !== id); delete db.notes[id]; persist(db); },
    async getNote(sid) { return load().notes[sid] || null; },
    async setNote(sid, note) { const db = load(); db.notes[sid] = note; persist(db); },
    async listSessions() { return load().sessions.sort((a, b) => b.createdAt - a.createdAt); },
    watchSession() { return () => {}; },
  };
}

// Firestore 구조
//  users/{uid}/players, users/{uid}/meta : 내 계정 전용
//  sessions/{id} : 게임 기록. ownerUid(만든 사람) + viewerEmails(참가자에 연결된 이메일)
//  users/{uid}/notes/{sessionId} : 그 게임에서 쓰는 내 개인 노트(클루 추리 노트). 본인만 읽기/쓰기
//    → 참가자에 이메일을 연결하면 그 계정에서도 해당 게임을 보고 점수를 입력할 수 있음 (삭제는 만든 사람만)
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 헷갈리는 0·O·1·I 뺌
const normEmail = (e) => String(e || '').trim().toLowerCase();
const viewerEmailsOf = (players) => [...new Set(players.map((p) => normEmail(p.email)).filter(Boolean))];

function firestoreStore() {
  let fs, db, auth, A;
  const col = (name) => fs.collection(db, 'users', s.user.uid, name);
  const ref = (name, id) => fs.doc(db, 'users', s.user.uid, name, id);
  const sref = (id) => fs.doc(db, 'sessions', id);
  // 개인 노트는 users/{내 uid}/notes/{게임 id} 에 저장 (기존 '내 계정 전용' 규칙으로 본인만 접근)
  const nref = (id) => fs.doc(db, 'users', s.user.uid, 'notes', id);
  // 예전 위치 (sessions/{id}/notes/{uid}): 별도 규칙이 게시돼 있어야 해서 옮김. 읽기만 시도
  const oldNref = (id) => fs.doc(db, 'sessions', id, 'notes', s.user.uid);
  // pending: 이 기기에서 바꿨지만 아직 서버에 올라가지 않은 기록 (오프라인 등) → 다른 기기에서는 아직 안 보임
  const withFlags = (d) => ({ id: d.id, ...d.data(), shared: d.data().ownerUid !== s.user.uid, pending: !!d.metadata?.hasPendingWrites });
  const ownSessions = async () => (await fs.getDocs(fs.query(fs.collection(db, 'sessions'), fs.where('ownerUid', '==', s.user.uid)))).docs;

  // 실시간 동기화: 로그인 후 내 기록·공유받은 기록·참가자를 한 번 받아 두고, 바뀐 것만 계속 받아 옴.
  //  → 메뉴를 옮길 때마다 서버에서 다시 받지 않아 빠르고, 다른 기기에서 바꾼 내용도 바로 반영됨
  let live = null;
  function stopLive() { if (live) { live.unsubs.forEach((u) => u()); live = null; } }
  function startLive() {
    if (live || !s.user) return;
    const uidNow = s.user.uid;
    const email = normEmail(s.user.email);
    const L = { uid: uidNow, own: null, shared: email ? null : new Map(), players: null, meta: null, unsubs: [], failed: false };
    const watch = (q, apply) => new Promise((res) => {
      // includeMetadataChanges: 서버에 올라가는 순간(pending 해제)도 알림 받음
      L.unsubs.push(fs.onSnapshot(q, { includeMetadataChanges: true }, (snap) => { apply(snap); res(); notifySync(); }, (e) => { console.error('live', e); L.failed = true; res(); }));
    });
    const sessCol = fs.collection(db, 'sessions');
    L.ready = Promise.all([
      watch(fs.query(sessCol, fs.where('ownerUid', '==', uidNow)), (snap) => { L.own = new Map(snap.docs.map((d) => [d.id, d])); }),
      email ? watch(fs.query(sessCol, fs.where('viewerEmails', 'array-contains', email)), (snap) => { L.shared = new Map(snap.docs.map((d) => [d.id, d])); }) : null,
      watch(col('players'), (snap) => { L.players = snap.docs.map((d) => ({ id: d.id, ...d.data() })); }),
    ]);
    live = L;
  }
  // 서버 동기화 상태: 아직 서버에 올라가지 않은 내 기록 수
  const syncCbs = new Set();
  function syncState() {
    if (!live || !live.own) return { pending: 0, ready: false };
    let pending = 0;
    for (const m of [live.own, live.shared]) if (m) for (const d of m.values()) if (d.metadata.hasPendingWrites) pending++;
    return { pending, ready: true };
  }
  function notifySync() { const st = syncState(); syncCbs.forEach((cb) => { try { cb(st); } catch {} }); }

  // 실시간 데이터가 준비됐으면 그걸 쓰고, 아니면 null (예전 방식으로 서버에서 받음)
  async function liveData() {
    if (!s.user) return null;
    if (live && live.uid !== s.user.uid) stopLive();
    startLive();
    const L = live;
    await L.ready;
    return L.failed ? null : L;
  }

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
        if (!u || u.uid !== live?.uid) stopLive();
        s.user = u;
        if (u) { try { await migrate(); } catch (e) { console.error('migrate', e); } }
        cb(u);
      });
    },
    async signIn() { await A.signInWithPopup(auth, new A.GoogleAuthProvider()); },
    async signOut() { await A.signOut(auth); },
    async listPlayers() {
      const L = await liveData();
      if (L) return L.players.slice().sort((a, b) => a.name.localeCompare(b.name, 'ko'));
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
    async getMeta() {
      if (live?.meta && live.uid === s.user.uid) return live.meta;
      const d = await fs.getDoc(ref('meta', 'settings'));
      const m = d.exists() ? d.data() : {};
      if (live && live.uid === s.user.uid) live.meta = m;
      return m;
    },
    async setMeta(patch) {
      await fs.setDoc(ref('meta', 'settings'), patch, { merge: true });
      if (live) live.meta = { ...(live.meta || {}), ...patch };
    },
    async createSession(x) {
      const data = { ...x, ownerUid: s.user.uid, ownerName: s.user.displayName || '', viewerEmails: viewerEmailsOf(x.players) };
      const r = await fs.addDoc(fs.collection(db, 'sessions'), data);
      return { id: r.id, ...data, shared: false };
    },
    async getSession(id) {
      const L = await liveData().catch(() => null);
      const hit = L && (L.own.get(id) || L.shared.get(id));
      if (hit) return withFlags(hit);
      try { const d = await fs.getDoc(sref(id)); return d.exists() ? withFlags(d) : null; }
      catch (e) { if (e.code === 'permission-denied') return null; throw e; }
    },
    async updateSession(id, patch) { await fs.updateDoc(sref(id), patch); },
    async deleteSession(id) {
      await fs.deleteDoc(nref(id)).catch(() => {});
      await fs.deleteDoc(oldNref(id)).catch(() => {});
      await fs.deleteDoc(sref(id));
    },
    // 개인 노트: users/{내 uid}/notes/{게임 id} — 본인만 읽고 쓸 수 있음
    async getNote(sid) {
      const d = await fs.getDoc(nref(sid));
      if (d.exists()) return d.data();
      try { const o = await fs.getDoc(oldNref(sid)); return o.exists() ? o.data() : null; } catch { return null; }
    },
    // 게임 문서 실시간 구독 (온라인 체스). 끊는 함수를 돌려줌
    watchSession(id, cb) {
      return fs.onSnapshot(sref(id), (d) => { if (d.exists()) cb(withFlags(d)); }, (e) => console.error('watch', e));
    },
    async setNote(sid, note) { await fs.setDoc(nref(sid), note); },
    syncState,
    // 동기화 상태가 바뀔 때마다 cb 호출. 끊는 함수를 돌려줌
    onSync(cb) { syncCbs.add(cb); cb(syncState()); return () => syncCbs.delete(cb); },
    // 이 기기에서 바꾼 내용이 모두 서버에 올라갈 때까지 기다림
    async flush() { await fs.waitForPendingWrites(db); },
    // ── 친구 ──
    //  friendCodes/{코드}: { uid, name, email } — 로그인한 누구나 코드 하나는 읽을 수 있음(목록은 못 봄)
    //  friendships/{작은uid_큰uid}: { members:[a,b], people:{ uid:{ name, email } } } — 두 사람만 읽기·삭제
    //  dailyScores/{uid}/items/{게임_날짜_단계_참가자}: 오늘의 문제 결과 — 본인과 친구만 읽기
    async myFriendCode({ renew = false } = {}) {
      const meta = await s.getMeta();
      if (meta.friendCode && !renew) return meta.friendCode;
      if (meta.friendCode) await fs.deleteDoc(fs.doc(db, 'friendCodes', meta.friendCode)).catch(() => {});
      for (let i = 0; i < 5; i++) {
        const code = Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => CODE_CHARS[b % CODE_CHARS.length]).join('');
        try {
          // 이미 있는 코드면 규칙상 덮어쓰기가 안 돼 실패 → 다른 코드로 다시
          await fs.setDoc(fs.doc(db, 'friendCodes', code), { uid: s.user.uid, name: s.user.displayName || '', email: normEmail(s.user.email), createdAt: Date.now() });
          await s.setMeta({ friendCode: code });
          return code;
        } catch (e) { if (e.code !== 'permission-denied') throw e; }
      }
      throw new Error('친구 코드를 만들지 못했어요. 잠시 후 다시 해 주세요.');
    },
    async listFriends() {
      const snap = await fs.getDocs(fs.query(fs.collection(db, 'friendships'), fs.where('members', 'array-contains', s.user.uid)));
      return snap.docs.map((d) => {
        const x = d.data();
        const uid = x.members.find((m) => m !== s.user.uid);
        return { uid, ...(x.people?.[uid] || {}), since: x.createdAt };
      }).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'));
    },
    // 친구 코드로 친구 맺기. 결과: { ok, friend } 또는 { error }
    async addFriend(code) {
      code = String(code || '').trim().toUpperCase();
      const c = await fs.getDoc(fs.doc(db, 'friendCodes', code)).catch(() => null);
      if (!c?.exists()) return { error: '없는 친구 코드예요' };
      const f = c.data();
      if (f.uid === s.user.uid) return { error: '내 코드예요' };
      const members = [s.user.uid, f.uid].sort();
      const id = members.join('_');
      if ((await fs.getDoc(fs.doc(db, 'friendships', id)).catch(() => null))?.exists()) return { error: '이미 친구예요', friend: f };
      await fs.setDoc(fs.doc(db, 'friendships', id), {
        members, code, createdAt: Date.now(),
        people: { [s.user.uid]: { name: s.user.displayName || '', email: normEmail(s.user.email) }, [f.uid]: { name: f.name || '', email: f.email || '' } },
      });
      return { ok: true, friend: f };
    },
    async removeFriend(uid) { await fs.deleteDoc(fs.doc(db, 'friendships', [s.user.uid, uid].sort().join('_'))); },
    // 내 오늘의 문제 결과 올리기 (같은 칸은 점수가 더 좋을 때만 덮어씀)
    async publishDaily(items) {
      const ic = fs.collection(db, 'dailyScores', s.user.uid, 'items');
      const dates = [...new Set(items.map((x) => x.daily))];
      const have = new Map();
      for (const d of dates) (await fs.getDocs(fs.query(ic, fs.where('daily', '==', d)))).docs.forEach((x) => have.set(x.id, x.data()));
      const better = (a, b) => !b || a.score > b.score || (a.score === b.score && a.elapsed < b.elapsed);
      await Promise.all(items.filter((x) => better(x, have.get(x.key)))
        .map(({ key, ...x }) => fs.setDoc(fs.doc(ic, key), { ...x, owner: s.user.displayName || '' })));
    },
    // 그 날짜의 나와 친구 결과. 친구 결과를 못 읽으면(규칙 미게시 등) 건너뜀
    async dailyBoard(date, friends) {
      const one = async (uid, who) => {
        try {
          const snap = await fs.getDocs(fs.query(fs.collection(db, 'dailyScores', uid, 'items'), fs.where('daily', '==', date)));
          return snap.docs.map((d) => ({ ...d.data(), uid, who }));
        } catch (e) { console.error('dailyBoard', uid, e); return []; }
      };
      return (await Promise.all([one(s.user.uid, 'me'), ...friends.map((f) => one(f.uid, 'friend'))])).flat();
    },
    async listSessions() {
      const L = await liveData();
      if (L) {
        const map = new Map();
        [...L.own.values(), ...L.shared.values()].forEach((d) => map.set(d.id, withFlags(d)));
        return [...map.values()].sort((a, b) => b.createdAt - a.createdAt);
      }
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
        const created = await fb.createSession({ ...rest, players, playerIds: players.map((p) => p.id) });
        const note = await lc.getNote(id); // 클루 개인 노트도 함께 옮김
        if (note) await fb.setNote(created.id, note);
        // 하나 옮길 때마다 바로 지움 → 중간에 끊겨도 다음에 이어서 옮기고, 같은 기록이 두 번 올라가지 않음
        await lc.deleteSession(id);
      }
      for (const p of lPlayers) await lc.deletePlayer(p.id);
      lc.setMeta({ guestImportDeclinedAt: 0 });
      return lSessions.length;
    },
    // 로그인 직후 "옮길까요?"에 아니오를 눌렀는지 (이 기기 기준). 기록 화면에서 다시 옮길 수 있음
    async guestImportDeclined() { return !!(await lc.getMeta()).guestImportDeclinedAt; },
    async declineGuestImport() { await lc.setMeta({ guestImportDeclinedAt: Date.now() }); },
  };
  for (const k of ['listPlayers', 'addPlayer', 'deletePlayer', 'renamePlayer', 'setPlayerEmail', 'getMeta', 'setMeta',
    'createSession', 'getSession', 'updateSession', 'deleteSession', 'listSessions', 'getNote', 'setNote', 'watchSession']) {
    h[k] = (...a) => active()[k](...a);
  }
  // 친구 기능은 로그인했을 때만 (게스트·이 기기 모드에는 없음)
  for (const k of ['myFriendCode', 'listFriends', 'addFriend', 'removeFriend', 'publishDaily', 'dailyBoard']) {
    h[k] = (...a) => { if (guest) throw new Error('친구 기능은 로그인해야 쓸 수 있어요'); return fb[k](...a); };
  }
  h.canFriends = () => !guest && !!fb.user;
  h.syncState = () => (guest ? { pending: 0, ready: false } : fb.syncState());
  h.onSync = (cb) => (guest ? () => {} : fb.onSync(cb));
  h.flush = () => (guest ? Promise.resolve() : fb.flush());
  return h;
}

export const store = firebaseConfig.apiKey ? hybridStore() : localStore();
