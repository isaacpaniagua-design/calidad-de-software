// Simple auth guard to redirect unauthenticated users to login page.
// This module initializes Firebase and listens to authentication changes.
// If no user is signed in and the current page is not the login or 404 page,
// it will redirect to login.html. See firebase.js for initFirebase/onAuth.

import { initFirebase, onAuth } from './firebase.js';

// Initialize Firebase if it hasn't been already.
initFirebase();

// Determine current filename (lowercase).
const currentPage = (window.location.pathname.split('/').pop() || '').toLowerCase();
// Pages that should not trigger a redirect when no user is signed in.
const skipPages = ['login.html', '404.html'];

const AUTH_STORAGE_KEY = 'qs_auth_state';

function readStoredAuthState() {
  try {
    const sessionValue = sessionStorage.getItem(AUTH_STORAGE_KEY);
    if (sessionValue) return sessionValue;
  } catch (_) {}
  try {
    const localValue = localStorage.getItem(AUTH_STORAGE_KEY);
    if (localValue) return localValue;
  } catch (_) {}
  return '';
}

function persistAuthState(state) {
  try {
    sessionStorage.setItem(AUTH_STORAGE_KEY, state);
  } catch (_) {}
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, state);
  } catch (_) {}
  try {
    window.__qsAuthState = state;
  } catch (_) {}
}

// Expone en memoria el último estado conocido si estaba guardado previamente.
// Esto evita que otras piezas lo reescriban con valores por defecto.
try {
  const stored = readStoredAuthState();
  if (stored) window.__qsAuthState = stored;
} catch (_) {}

// Listen for authentication state changes. If there is no user and we are
// currently on a protected page, redirect to the login page.
onAuth((user) => {
  const state = user ? 'signed-in' : 'signed-out';
  persistAuthState(state);
  if (!user && !skipPages.includes(currentPage)) {
    // Preserve query parameters when redirecting to login by appending them
    const query = window.location.search || '';
    // Avoid infinite redirect loops: if already on login, do nothing.
    window.location.href = 'login.html' + query;
  }
});