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

// Listen for authentication state changes. If there is no user and we are
// currently on a protected page, redirect to the login page.
onAuth((user) => {
  if (!user && !skipPages.includes(currentPage)) {
    // Preserve query parameters when redirecting to login by appending them
    const query = window.location.search || '';
    // Avoid infinite redirect loops: if already on login, do nothing.
    window.location.href = 'login.html' + query;
  }
});