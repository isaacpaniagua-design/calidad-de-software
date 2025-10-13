Repository intelligence for AI coding agents — Calidad de Software

Keep this short. Use it to get productive fast in this repo.

1) Big picture
- Static frontend: plain HTML pages in the repo root (e.g. `index.html`, `paneldocente.html`) plus modular ES modules in `js/`. There is no bundler — pages import Firebase SDK modules directly from Google CDN and local helpers (e.g. `js/firebase.js`, `js/firebase-config.js`).
- Backend: Firebase Cloud Functions live in `functions/` (entry `functions/index.js`). The project uses Node 18 (see `functions/package.json`).
- Security/config: Firestore rules and indexes are under `tools/` (`tools/firestore.rules`, `tools/firestore.indexes.json`). These must be kept consistent with the frontend allowlists.

2) Primary data flows & why things are structured this way
- Auth -> role detection -> Firestore operations: `js/firebase.js` centralizes Firebase initialization and helpers (initFirebase(), getDb(), getAuthInstance()). Most UI modules import from it (examples: `js/actividades.js`, `js/paneldocente-app.js`, `js/forum-init.js`).
- Teacher identity: two sources are combined: a static allowlist in `js/firebase-config.js` (`allowedTeacherEmails`) and a dynamic doc at `config/teacherAllowlist` (path configured in `js/firebase-config.js`). Firestore rules and frontend logic rely on both — keep them synchronized.
- Cloud Function role sync: `functions/index.js` contains an auth.onCreate trigger that sets a custom claim `role: "docente"` for `@potros.itson.edu.mx` emails. This is used by rules and some admin flows.
- Storage is optional: controlled by `useStorage` in `js/firebase-config.js`. Code paths that upload use `getStorageInstance()` and guard via `useStorage`.

3) Key developer workflows (exact, reproducible)
- Run Cloud Functions emulator locally (requires Firebase CLI and login):

```powershell
Set-Location -Path .\functions; npm install; npm run serve
```

- Open frontend locally: static files are plain HTML/JS — either open `index.html` in a browser or serve via a static server (example using Python):

```powershell
Set-Location -Path .; python -m http.server 8000
```

- Deploy functions:

```powershell
Set-Location -Path .\functions; npm run deploy
```

- View function logs:

```powershell
Set-Location -Path .\functions; npm run logs
```

- Seed data (safe note): seeding scripts run in the browser and expect a teacher account. Useful files: `js/seed-students.js`, `js/seed-grades.js`, and `data/students.json`. To run them, open the corresponding HTML/utility page listed in the repo and sign in with an allowed teacher email.

4) Project-specific conventions and patterns
- No bundler: modules import the Firebase web SDK directly from gstatic CDN. Prefer small, focused edits to `js/*` modules and preserve the ESM import style.
- Single shared Firebase orchestration file: `js/firebase.js` implements init, common helpers and higher-level operations (subscribe patterns, saveTodayAttendance, uploadMaterial, forum helpers). When changing Firestore collection shapes, update both rules (`tools/firestore.rules`) and all helpers that read/write those fields.
- Teacher allowlist duplication: `allowedTeacherEmails` (in `js/firebase-config.js`) must match logic used in `tools/firestore.rules` (function `allowedTeacherEmails()` there) — keep them in sync when adding/removing teacher emails.
- Student document IDs: code often uses student matricula/ID as the document id for `grades` and `students`. See `js/seed-grades.js` and `js/seed-students.js` for examples.
- Fallback/testing mode: `js/paneldocente-backend.js` supports a local `student fallback` (local JSON + localStorage) for offline/testing. Use it when Firestore access isn't available.

5) Integration & cross-component notes (what breaks easily)
- Firestore rules vs frontend must match for reads/queries. Example: `tools/firestore.rules` includes `allow list` rules needed by frontend queries (see notes in `docs/firebase-review.md`). Changing a rule that restricts a field used in a query usually causes `permission-denied` in the UI.
- Indexes: queries used by the UI assume indexes in `tools/firestore.indexes.json`. If you add a query with orderBy+where, add an index to that file.
- Drive uploads: Google Drive integration requests an OAuth scope and stores the Drive folder id in `js/firebase-config.js` (`driveFolderId`). To test Drive uploads interactively, use `signInWithGooglePotros()` flow in `js/firebase.js`.

6) Files to read first (fast-path to understanding)
- `js/firebase.js` — central Firebase helpers & data-access functions (init, auth helpers, storage helpers, higher-level domain functions like saveTodayAttendance, subscribeGrades).
- `js/firebase-config.js` — project-specific settings (allowed domain, teacher list, useStorage, driveFolderId).
- `tools/firestore.rules` — security rules that shape permitted queries/updates.
- `functions/index.js` and `functions/package.json` — cloud function behavior and scripts (emulator, deploy).
- `docs/firebase-review.md` — security and data-flow notes that call out important mismatches and areas to be careful with.
- `js/paneldocente-backend.js` — largest admin UI; useful to see grading calculations and fallback behavior.

7) Small reproducible examples to reference in patches
- If you need to add a helper that reads grades, follow `subscribeMyGrades(userUid, callback)` style in `js/firebase.js` (onSnapshot + query + limit(1)).
- To add a new admin-only write, ensure both: (1) `isTeacher()` or `isTeacherEmail()` checks in the frontend call path, and (2) an appropriate `allow write: if isTeacher()` clause in `tools/firestore.rules`.

8) Missing/optional considerations (documented here to avoid guessing)
- CI is not present for syncing teacher lists or auto-deploying rules. Treat `allowedTeacherEmails` and `tools/firestore.rules` as authoritative places that both must be updated manually.
- There are no unit tests in repo — when changing critical data-access code, test against the emulator (`functions` emulator or a local browser pointing at a test Firebase project).

If anything here is unclear or you'd like more detail (examples of queries, a short checklist for adding a new Firestore collection, or a tiny test harness to validate a helper), tell me which section to expand and I'll iterate.

---

Appendix: quick actionable expansions

A) Checklist — adding a new Firestore collection (safe, repeatable)
- 1) Design the document shape and query patterns. List fields, types, and common queries (where/orderBy limits).
- 2) Add indexes if you plan to query by multiple fields. Update `tools/firestore.indexes.json` with the new index. Example: if you will query `where('courseId','==', X).orderBy('createdAt')`, add the appropriate composite index.
- 3) Update `tools/firestore.rules`: add a `match /<collection>/{id}` block with explicit `allow read`/`allow write` rules. Follow existing patterns: protect writes to `isTeacher()` and constrain reads to `isAuthenticated()` or owner checks when needed.
- 4) Add helpers in `js/firebase.js`: init + CRUD wrappers and subscription helpers (subscribe patterns use onSnapshot + query). See example B.
- 5) Update any frontend modules that will import the new helper (add a focused ES module under `js/` and import only the required functions from `js/firebase.js`).
- 6) Add seed scripts if useful: follow `js/seed-students.js` and `js/seed-grades.js` (these are browser-based utilities expecting a teacher login).
- 7) Test locally: run the functions emulator (if your change touches functions) and open the frontend pointing to the development Firebase project. Validate queries and check the browser console for `permission-denied` errors which indicate rule mismatches.

B) Example helper pattern for `js/firebase.js` (follow existing style)
- Contract: input = (db, payload or params), output = promise or unsubscribe function, errors = thrown or returned as friendly Error with code.
- Minimal example (subscribe + fetch one document pattern):

```javascript
// in js/firebase.js
import { collection, doc, onSnapshot, query, where, limit, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js';

export function subscribeMyCollectionByOwner(ownerUid, cb) {
	const db = getDb();
	const q = query(collection(db, 'myCollection'), where('ownerUid', '==', ownerUid), orderBy('createdAt', 'desc'));
	return onSnapshot(q, (snap) => {
		const items = [];
		snap.forEach(d => items.push({ id: d.id, ...d.data() }));
		cb(items);
	}, (err) => { console.error('subscribeMyCollection:error', err); cb([]); });
}

export async function fetchOneById(id) {
	const db = getDb();
	const ref = doc(db, 'myCollection', id);
	const snap = await getDoc(ref);
	if (!snap.exists()) return null;
	return { id: snap.id, ...snap.data() };
}
```

C) Frontend + Emulator quickstart (make the web app point at the emulator)
- Why: using the Firestore/Auth/Functions emulators lets you develop without touching production data.
- Steps (assumes Firebase CLI + local project configured):

1) Start emulators from the `functions` directory (or project root if firebase.json is at repo root):

```powershell
Set-Location -Path .\functions; npm install; npm run serve
```

2) In the browser app (frontend), the repo doesn't include an automatic emulator wiring file. To test locally you can patch `js/firebase.js` temporarily to call `connectFirestoreEmulator`, `connectAuthEmulator`, and `connectFunctionsEmulator` when a dev flag is set. Minimal example to use inside `initFirebase()`:

```javascript
// inside js/firebase.js after getFirestore/getAuth/getFunctions
import { connectFirestoreEmulator } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js';
import { connectAuthEmulator } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js';
import { connectFunctionsEmulator } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-functions.js';

if (window.__USE_EMULATORS__) {
	connectFirestoreEmulator(db, 'localhost', 8080);
	connectAuthEmulator(auth, 'http://localhost:9099');
	connectFunctionsEmulator(/* functions instance */, 'localhost', 5001);
}
```

3) Set the flag and serve the frontend (example using Python server) and open in the browser:

```powershell
# open a powershell where the repo root is available
$env:__USE_EMULATORS__ = '1'
Set-Location -Path .; python -m http.server 8000
# open http://localhost:8000/index.html in browser
```

Notes and safety
- Keep the emulator wiring out of production code. Use a small environment-only guard like `if (location.hostname === 'localhost' || window.__USE_EMULATORS__)`.
- If you add emulator wiring permanently, gate it to prevent accidental deployment.

----

If you'd like, I can:
- Add a tiny patch to `js/firebase.js` that adds optional emulator wiring under a guarded flag and a short `README-emulator.md` with copy-paste instructions.
- Create a small test harness that runs a smoke test (subscribe + write + read) against the emulator automatically.

Tell me which of the two (emulator wiring patch or test harness) you want first and I'll implement it.
