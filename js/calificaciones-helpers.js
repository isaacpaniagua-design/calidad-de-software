// js/calificaciones-helpers.js
// Utilidades compartidas para calcular identificadores de documentos
// de calificaciones en Firestore.

function sanitizeIdentifier(value) {
  if (value == null) return null;
  const str = String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!str) return null;
  return str.length > 120 ? str.slice(0, 120) : str;
}

export function getPrimaryDocId(profile = {}) {
  const emailKey = sanitizeIdentifier(profile.email);
  if (emailKey) return `email-${emailKey}`;
  const idKey = sanitizeIdentifier(
    profile.id || profile.studentId || profile.matricula
  );
  if (idKey) return `id-${idKey}`;
  const uidKey = sanitizeIdentifier(profile.uid);
  if (uidKey) return `uid-${uidKey}`;
  return null;
}

export function buildCandidateDocIds(profile = {}) {
  const ids = [];
  const emailKey = sanitizeIdentifier(profile.email);
  if (emailKey) ids.push(`email-${emailKey}`);
  const idKey = sanitizeIdentifier(
    profile.id || profile.studentId || profile.matricula
  );
  if (idKey) ids.push(`id-${idKey}`);
  const uidKey = sanitizeIdentifier(profile.uid);
  if (uidKey) ids.push(`uid-${uidKey}`);
  return Array.from(new Set(ids.filter(Boolean)));
}

export function sanitizeIdentifierForDisplay(value) {
  return sanitizeIdentifier(value);
}
