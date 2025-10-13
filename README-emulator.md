Frontend emulator quickstart (local development)

Purpose

- Lets you run the web frontend against local Firebase emulators (Auth, Firestore, Functions) so you can develop without touching production projects.

Prerequisites

- Firebase CLI installed and logged in
- Node and npm to run functions emulator (the `functions/` folder contains package.json)
- A browser and a simple static server (Python's http.server is fine)

1. Start the emulators

Open PowerShell in the repo root and run:

```powershell
Set-Location -Path .\functions; npm install; npm run serve
```

This launches the Firebase emulators (Firestore:8080, Auth:9099, Functions:5001) as configured in this repo.

2. Enable the frontend to use emulators

There are two non-invasive ways to enable emulator wiring in the frontend:

A) Temporary flag in the browser console (recommended for quick tests):

1. Serve the frontend (example using Python):

```powershell
Set-Location -Path .; python -m http.server 8000
```

2. Open your page (e.g. http://localhost:8000/index.html) and in the browser DevTools Console run:

```javascript
window.__USE_EMULATORS__ = true;
```

3. Reload the page.

B) Persistent, but guarded wiring (already implemented):

This repo optionally wires emulators inside `js/firebase.js` when either:

- `window.__USE_EMULATORS__` is true, or
- `location.hostname === 'localhost'`

The implementation connects Firestore (localhost:8080), Auth (http://localhost:9099) and Functions (localhost:5001).

3. Test a quick flow

- Sign in with a test user via the Auth emulator (use the emulator UI provided by the Firebase CLI or create users programmatically).
- Open pages that use Firestore (e.g. `paneldocente.html` or `calificaciones.html`) and confirm data reads/writes go to the emulator (check emulator logs and the browser console).

Safety notes

- Do NOT commit permanent emulator flags into production branches. The current guard checks `location.hostname === 'localhost'` and an opt-in flag. This is intentionally conservative.
- If you add emulator wiring or test scripts, keep the code guarded and clearly commented.

Optional next steps I can implement

- Add a tiny `emulator-run.ps1` script that starts emulators and then serves the frontend in one command.
- Create a smoke-test harness (HTML + JS) that runs a subscribe+write+read sequence against the emulator and prints results.
