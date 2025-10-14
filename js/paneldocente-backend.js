// js/paneldocente-backend.js
// Backend para paneldocente.html (docente). Firebase 10.12.3 · ES2015.

import {
  initFirebase,
  getDb,
  onAuth,
  isTeacherByDoc,
  isTeacherEmail,
  ensureTeacherAllowlistLoaded,
} from "./firebase.js";
import { initializeFileViewer, openFileViewer } from "./file-viewer.js";
import {
  observeAllStudentUploads,
  markStudentUploadAccepted,
  gradeStudentUpload,
} from "./student-uploads.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";
import { calculateUnitGrade, calculateFinalGrade } from "./grade-calculator.js";

function $(sel, root) {
  return (root || document).querySelector(sel);
}
function $id(id) {
  return document.getElementById(id);
}
function ready() {
  return new Promise(function (r) {
    if (/complete|interactive/.test(document.readyState)) r();
    else document.addEventListener("DOMContentLoaded", r, { once: true });
  });
}
function fmtDate(d) {
  try {
    return d.toLocaleDateString();
  } catch (e) {
    return "—";
  }
}
function toDate(v) {
  if (v && typeof v.toDate === "function") return v.toDate();
  if (v instanceof Date) return v;
  if (typeof v === "string") {
    var t = Date.parse(v);
    return isNaN(t) ? null : new Date(t);
  }
  return null;
}
function clamp100(n) {
  n = Number(n) || 0;
  if (n < 0) return 0;
  if (n > 100) return 100;
  return n;
}
function toEscala5(p) {
  return (Number(p || 0) * 0.05).toFixed(1);
}
var ESC_MAP = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};
function escHtml(str) {
  return String(str == null ? "" : str).replace(/[&<>"']/g, function (ch) {
    return ESC_MAP[ch] || ch;
  });
}
function escAttr(str) {
  return escHtml(str);
}
function updateSyncStamp() {
  var now = new Date();
  setText("pd-summary-sync", fmtDate(now) + " " + now.toLocaleTimeString());
}

function formatSize(bytes) {
  var numeric = Number(bytes);
  if (!numeric || isNaN(numeric)) return "";
  var units = ["B", "KB", "MB", "GB", "TB"];
  var value = numeric;
  var unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value = value / 1024;
    unitIndex += 1;
  }
  var precision = value >= 10 || unitIndex === 0 ? 0 : 1;
  return value.toFixed(precision) + " " + units[unitIndex];
}

var ROSTER_STORAGE_KEY = "qs_roster_cache";
var DATA_COLLECTION_PAGE_SIZE = 50;
var DATA_COLLECTION_MAX_PAGES = 200;

function normalizeEmail(value) {
  if (value == null) return "";
  try {
    return String(value).trim().toLowerCase();
  } catch (_err) {
    return "";
  }
}

function normalizeRosterStudent(student) {
  if (!student) return null;
  var email = normalizeEmail(student.email || "");
  var uid = student.uid ? String(student.uid) : "";
  var matricula = student.matricula || student.id || uid || email || "";
  var id = student.id || matricula || email || uid;
  if (!id && !email && !uid) return null;
  var name = student.displayName || student.nombre || student.name || "";
  var type = student.type || "student";
  return {
    uid: uid,
    id: id,
    matricula: matricula || id,
    name: name || email || id || "Estudiante",
    email: email,
    type: type,
  };
}

function dedupeRosterEntries(list) {
  var order = [];
  var map = {};
  if (!Array.isArray(list)) return [];
  for (var i = 0; i < list.length; i++) {
    var entry = list[i];
    if (!entry) continue;
    var key =
      normalizeEmail(entry.email || "") ||
      (
        entry.id ||
        entry.matricula ||
        entry.uid ||
        entry.name ||
        "idx" + i
      ).toLowerCase();
    if (!map[key]) {
      map[key] = Object.assign({}, entry);
      order.push(key);
    } else {
      var current = map[key];
      if (entry.uid && !current.uid) current.uid = entry.uid;
      if (entry.id && !current.id) current.id = entry.id;
      if (entry.matricula && !current.matricula)
        current.matricula = entry.matricula;
      if (entry.email && !current.email) current.email = entry.email;
      if (entry.type && !current.type) current.type = entry.type;
      if (
        entry.name &&
        (!current.name ||
          current.name === current.id ||
          current.name === current.email)
      ) {
        current.name = entry.name;
      }
    }
  }
  var out = [];
  for (var j = 0; j < order.length; j++) {
    var item = map[order[j]];
    if (!item) continue;
    if (!item.id)
      item.id = item.matricula || item.email || item.uid || "student-" + j;
    if (!item.matricula) item.matricula = item.id;
    if (!item.name) item.name = item.email || item.id;
    if (!item.type) item.type = "student";
    out.push(item);
  }
  return out;
}

function emitRosterUpdate(detail) {
  if (typeof window === "undefined" || !window.dispatchEvent) return;
  try {
    window.dispatchEvent(
      new CustomEvent("qs:roster-updated", { detail: detail })
    );
  } catch (_err) {
    if (
      typeof document !== "undefined" &&
      typeof document.createEvent === "function"
    ) {
      try {
        var ev = document.createEvent("CustomEvent");
        ev.initCustomEvent("qs:roster-updated", false, false, detail);
        window.dispatchEvent(ev);
      } catch (__err) {}
    }
  }
}

function syncRosterCache(students) {
  if (typeof window === "undefined") return [];
  var list = Array.isArray(students) ? students : [];
  var normalized = [];
  for (var i = 0; i < list.length; i++) {
    var item = normalizeRosterStudent(list[i]);
    if (item) normalized.push(item);
  }
  var deduped = dedupeRosterEntries(normalized);
  var payload = {
    updatedAt: new Date().toISOString(),
    students: deduped,
  };
  try {
    if (window.localStorage)
      window.localStorage.setItem(ROSTER_STORAGE_KEY, JSON.stringify(payload));
  } catch (_err) {}
  try {
    window.students = deduped.slice();
  } catch (_err2) {}
  emitRosterUpdate(payload);
  return deduped;
}

var UPLOAD_KIND_LABELS = {
  activity: "Actividad",
  homework: "Tarea",
  evidence: "Evidencia",
};

var UPLOAD_KIND_TITLES = {
  activity: "Actividades",
  homework: "Tareas",
  evidence: "Evidencias",
  other: "Otros envíos",
};

var UPLOAD_KIND_ORDER = ["activity", "homework", "evidence", "other"];

function normalizeKind(value) {
  var key = (value == null ? "" : String(value)).toLowerCase().trim();
  if (key === "activity" || key === "homework" || key === "evidence")
    return key;
  return "other";
}

function getKindTitle(key) {
  return UPLOAD_KIND_TITLES[key] || "Otros envíos";
}

function countUploadsByKind(list) {
  var counts = { activity: 0, homework: 0, evidence: 0, other: 0, total: 0 };
  if (!Array.isArray(list)) return counts;
  for (var i = 0; i < list.length; i++) {
    var kindKey = normalizeKind(list[i] && list[i].kind);
    if (!counts.hasOwnProperty(kindKey)) counts[kindKey] = 0;
    counts[kindKey] += 1;
    counts.total += 1;
  }
  return counts;
}

function groupUploadsByKind(list) {
  var groups = { activity: [], homework: [], evidence: [], other: [] };
  if (Array.isArray(list)) {
    for (var i = 0; i < list.length; i++) {
      var upload = list[i];
      var key = normalizeKind(upload && upload.kind);
      if (!groups[key]) groups[key] = [];
      groups[key].push(upload);
    }
  }
  var sections = [];
  for (var j = 0; j < UPLOAD_KIND_ORDER.length; j++) {
    var key = UPLOAD_KIND_ORDER[j];
    var arr = groups[key] || [];
    if (!arr.length) continue;
    sections.push({ key: key, title: getKindTitle(key), uploads: arr });
  }
  return sections;
}

var DATA_ADMIN_ALLOWLIST = {
  "isaac.paniagua@potros.itson.edu.mx": true,
};

function isDataAdminUser(user) {
  if (!user || !user.email) return false;
  return !!DATA_ADMIN_ALLOWLIST[normalizeEmail(user.email)];
}

function replaceDataPathTokens(path, grupo) {
  var value = (path == null ? "" : String(path)).trim();
  if (!value) return "";
  var replaced = value
    .replace(/:grupo\b/gi, grupo)
    .replace(/:group\b/gi, grupo)
    .replace(/\{grupo\}/gi, grupo)
    .replace(/\{group\}/gi, grupo);
  // Normalizar diagonales duplicadas y eliminar la final.
  replaced = replaced.replace(new RegExp("\\/+", "g"), "/");
  if (replaced.length > 1 && replaced.endsWith("/")) {
    replaced = replaced.replace(new RegExp("\\/+$", "g"), "");
  }
  return replaced;
}

function parseDataPathSegments(path) {
  var source = (path == null ? "" : String(path)).trim();
  if (!source) return [];
  var parts = source.split("/");
  var segments = [];
  for (var i = 0; i < parts.length; i++) {
    var seg = parts[i].trim();
    if (!seg) continue;
    if (seg === "." || seg === "..") {
      throw new Error('La ruta no puede contener ".." ni ".".');
    }
    segments.push(seg);
  }
  return segments;
}

function formatDataPreview(data) {
  try {
    var str = JSON.stringify(data);
    if (str.length > 140) return str.slice(0, 137) + "…";
    return str;
  } catch (_err) {
    try {
      return String(data);
    } catch (__err) {
      return "[No disponible]";
    }
  }
}

function ensureDataAdminStore(state) {
  var defaults = {
    lastInputPath: "",
    currentCollectionSegments: [],
    currentPathResolved: "",
    selectedId: "",
    docExists: false,
    editorEnabled: false,
    lastDocs: [],
    docsMap: {},
    lastQuery: null,
  };
  if (!state) return Object.assign({}, defaults);
  if (!state.dataAdmin) {
    state.dataAdmin = Object.assign({}, defaults);
    return state.dataAdmin;
  }
  var store = state.dataAdmin;
  if (!Array.isArray(store.currentCollectionSegments))
    store.currentCollectionSegments = [];
  if (!Array.isArray(store.lastDocs)) store.lastDocs = [];
  if (!store.docsMap) store.docsMap = {};
  if (!store.lastQuery) store.lastQuery = null;
  if (typeof store.lastInputPath !== "string") store.lastInputPath = "";
  if (typeof store.currentPathResolved !== "string")
    store.currentPathResolved = "";
  if (typeof store.selectedId !== "string") store.selectedId = "";
  store.docExists = !!store.docExists;
  store.editorEnabled = !!store.editorEnabled;
  return store;
}

var UPLOAD_STATUS_LABELS = {
  enviado: "Enviado",
  aceptado: "Aceptado",
  calificado: "Calificado",
  rechazado: "Rechazado",
};

function normalizeStatus(value) {
  var status = value == null ? "enviado" : String(value);
  status = status.toLowerCase().trim();
  if (!UPLOAD_STATUS_LABELS[status]) return "enviado";
  return status;
}

function formatDateTime(value) {
  var date = toDate(value);
  if (!date) return "";
  var result = fmtDate(date);
  try {
    var time = date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    if (time) result += " · " + time;
  } catch (_err) {}
  return result;
}

function formatReviewInfo(upload) {
  if (!upload) return "";
  var reviewer = upload.gradedBy || upload.reviewedBy || null;
  var parts = [];
  if (reviewer && (reviewer.displayName || reviewer.email)) {
    parts.push("por " + (reviewer.displayName || reviewer.email));
  }
  var when = toDate(
    upload.gradedAt ||
      upload.acceptedAt ||
      upload.reviewedAt ||
      upload.updatedAt
  );
  if (when) {
    try {
      var tm = when.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      parts.push("el " + fmtDate(when) + " · " + tm);
    } catch (_err) {
      parts.push("el " + fmtDate(when));
    }
  }
  if (!parts.length) return "";
  return "Revisado " + parts.join(" ");
}

function countPendingUploads(list) {
  if (!Array.isArray(list)) return 0;
  var pending = 0;
  for (var i = 0; i < list.length; i++) {
    var status = normalizeStatus(list[i] && list[i].status);
    if (status !== "calificado") pending += 1;
  }
  return pending;
}

function getUploadStudentEntries(state) {
  var entries = [];
  var grouped = state && state.uploadGroups ? state.uploadGroups : {};
  var students = state && state.students ? state.students : [];
  var seen = {};
  for (var i = 0; i < students.length; i++) {
    var stu = students[i] || {};
    var uid = stu.uid || "";
    var group = grouped[uid] || { uploads: [] };
    entries.push({
      uid: uid,
      displayName: stu.displayName || stu.nombre || "Alumno",
      email: stu.email || "",
      uploads: group.uploads || [],
      pending: countPendingUploads(group.uploads || []),
    });
    if (uid) seen[uid] = true;
  }
  var keys = Object.keys(grouped);
  for (var j = 0; j < keys.length; j++) {
    var uidKey = keys[j];
    if (seen[uidKey]) continue;
    var g = grouped[uidKey] || {};
    var info = g.student || {};
    entries.push({
      uid: uidKey,
      displayName:
        info.displayName || info.nombre || info.email || "Estudiante",
      email: info.email || "",
      uploads: g.uploads || [],
      pending: countPendingUploads(g.uploads || []),
    });
  }
  entries.sort(function (a, b) {
    var an = a.displayName || "";
    var bn = b.displayName || "";
    return an.localeCompare(bn, "es", { sensitivity: "base" });
  });
  return entries;
}

function ensureUploadSelection(state, entries) {
  var list = entries || getUploadStudentEntries(state);
  if (state.selectedUploadStudent) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].uid === state.selectedUploadStudent) return list;
    }
  }
  var choice = null;
  for (var j = 0; j < list.length; j++) {
    if (list[j].pending > 0) {
      choice = list[j];
      break;
    }
  }
  if (!choice && list.length) {
    for (var k = 0; k < list.length; k++) {
      if ((list[k].uploads || []).length) {
        choice = list[k];
        break;
      }
    }
  }
  if (!choice && list.length) choice = list[0];
  state.selectedUploadStudent = choice ? choice.uid : null;
  return list;
}

function showStatusBanner(title, message, variant) {
  var banner = $id("pd-status-banner");
  if (!banner) return;
  var titleEl = $id("pd-status-title");
  var msgEl = $id("pd-status-message");
  if (titleEl) titleEl.textContent = title || "";
  if (msgEl) msgEl.textContent = message || "";
  banner.setAttribute("data-variant", variant || "info");
  banner.hidden = false;
}

function hideStatusBanner() {
  var banner = $id("pd-status-banner");
  if (banner) banner.hidden = true;
}

function setPanelLocked(root, locked) {
  var target = root || $id("paneldocente-root");
  if (!target) return;
  if (locked) target.setAttribute("data-locked", "true");
  else target.removeAttribute("data-locked");
}

async function computeTeacherState(user) {
  var email = user && user.email ? user.email : "";
  var teacher = false;
  await ensureTeacherAllowlistLoaded();
  if (user && user.uid) {
    try {
      teacher = await isTeacherByDoc(user.uid);
    } catch (_) {
      teacher = false;
    }
  }
  if (!teacher && email) {
    try {
      teacher = isTeacherEmail(email);
    } catch (_) {
      teacher = false;
    }
  }
  return { user: user || null, email: email, isTeacher: !!teacher };
}

// ===== Cálculo de calificaciones (obsoleto, usar grade-calculator.js) =====
function inferUnidad(it) {
  if (it.unidad != null) return Number(it.unidad);
  var n = String(it.nombre || it.title || "").toLowerCase();
  if (/\bu1\b|unidad\s*1/.test(n)) return 1;
  if (/\bu2\b|unidad\s*2/.test(n)) return 2;
  if (/\bu3\b|unidad\s*3/.test(n)) return 3;
  return 0;
}

function groupItemsByUnitAndType(items) {
  const units = {
    1: { actividades: [], asignaciones: [], examen: [], participaciones: [] },
    2: { actividades: [], asignaciones: [], examen: [], participaciones: [] },
    3: { project: [] },
  };

  for (const item of items) {
    const unitNum = inferUnidad(item);
    if (!unitNum || !units[unitNum]) continue;

    const type = item.calItemKey || "unknown";
    if (unitNum === 3) {
      if (type.includes("project")) {
        units[3].project.push(item.puntos || 0);
      }
    } else {
      if (type.includes("actividad")) {
        units[unitNum].actividades.push(item.puntos || 0);
      } else if (type.includes("asignacion")) {
        units[unitNum].asignaciones.push(item.puntos || 0);
      } else if (type.includes("examen")) {
        units[unitNum].examen.push(item.puntos || 0);
      } else if (type.includes("participacion")) {
        units[unitNum].participaciones.push(item.puntos || 0);
      }
    }
  }

  const avg = (arr) =>
    arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  const grades = {
    unit1: {
      actividades: avg(units[1].actividades),
      asignaciones: avg(units[1].asignaciones),
      examen: avg(units[1].examen),
      participaciones: avg(units[1].participaciones),
    },
    unit2: {
      actividades: avg(units[2].actividades),
      asignaciones: avg(units[2].asignaciones),
      examen: avg(units[2].examen),
      participaciones: avg(units[2].participaciones),
    },
    unit3: {
      project: avg(units[3].project),
    },
  };

  return grades;
}

function computeMetricsFromItems(items) {
  const groupedGrades = groupItemsByUnitAndType(items);
  const finalGrade = calculateFinalGrade(groupedGrades);

  return {
    u1: calculateUnitGrade(groupedGrades.unit1, 1) * 10,
    u2: calculateUnitGrade(groupedGrades.unit2, 2) * 10,
    u3: calculateUnitGrade(groupedGrades.unit3, 3) * 10,
    finalPct: finalGrade,
  };
}

// ===== Student fallback (sin Firebase) =====
var STUDENT_FALLBACK_KEY = "pd_student_fallback_data";
var STUDENT_FALLBACK_CACHE = null;
var STUDENT_FALLBACK_ACTIVE = false;

function cloneStudentEntry(entry) {
  if (!entry)
    return { uid: "", displayName: "Alumno", email: "", matricula: null };
  return {
    uid: entry.uid || "",
    displayName: entry.displayName || "Alumno",
    email: entry.email || "",
    matricula: entry.matricula != null ? entry.matricula : null,
  };
}

function clampMetricValue(value) {
  return clamp100(Number(value || 0));
}

function normalizeMetricEntry(entry) {
  entry = entry || {};
  var u1 = clampMetricValue(entry.u1 != null ? entry.u1 : entry.unidad1);
  var u2 = clampMetricValue(entry.u2 != null ? entry.u2 : entry.unidad2);
  var u3 = clampMetricValue(entry.u3 != null ? entry.u3 : entry.unidad3);

  const finalPct = calculateFinalGrade({
    unit1: { score: u1 / 10 },
    unit2: { score: u2 / 10 },
    unit3: { project: u3 / 10 },
  });

  return { u1: u1, u2: u2, u3: u3, finalPct: finalPct };
}

function scoreStudentPriority(student, metrics) {
  if (!student) return 0;
  var score = 0;
  var uid = student.uid || "";
  var matricula =
    student.matricula != null ? String(student.matricula).trim() : "";
  var displayName = student.displayName || "";
  if (matricula && matricula !== uid && matricula !== student.email)
    score += 30;
  if (displayName && displayName !== uid && displayName !== student.email)
    score += 10;
  if (uid && /^local-/.test(uid)) score += 8;
  if (uid && uid.length >= 20) score += 2;
  if (uid) score += 1;
  if (student.__order != null) {
    var orderScore = Number(student.__order);
    if (!isNaN(orderScore)) score += orderScore * 0.0001;
  }
  if (metrics && metrics[uid]) {
    var metric = normalizeMetricEntry(metrics[uid]);
    if (metric.finalPct > 0) score += 5;
    if (metric.u1 > 0 || metric.u2 > 0 || metric.u3 > 0) score += 3;
  }
  return score;
}

function applyStudentEmailDeduplication(state) {
  if (!state || !Array.isArray(state.students)) return;
  var metricsMap = state.metrics || {};
  var groups = {};
  var order = [];

  for (var i = 0; i < state.students.length; i++) {
    var original = state.students[i];
    if (!original) continue;
    var entry = cloneStudentEntry(original);
    entry.uid = original.uid || entry.uid || "";
    entry.email = entry.email || "";
    entry.__order = i;
    var emailKey = entry.email ? normalizeEmail(entry.email) : "";
    var key;
    var skipMerge = false;
    if (emailKey) {
      key = "email:" + emailKey;
    } else {
      key = "uid:" + (entry.uid || "idx" + i);
      skipMerge = true;
    }
    if (!groups[key]) {
      groups[key] = { entries: [], order: i, skipMerge: skipMerge };
      order.push(key);
    }
    groups[key].entries.push(entry);
    if (i < groups[key].order) groups[key].order = i;
  }

  order.sort(function (a, b) {
    return groups[a].order - groups[b].order;
  });

  var deduped = [];
  var aggregatedMetrics = {};
  var aliasMap = {};

  function normalizedMetric(uid) {
    if (metricsMap && metricsMap[uid]) {
      return normalizeMetricEntry(metricsMap[uid]);
    }
    return { u1: 0, u2: 0, u3: 0, finalPct: 0 };
  }

  for (var oi = 0; oi < order.length; oi++) {
    var key = order[oi];
    var group = groups[key];
    if (!group || !group.entries.length) continue;
    if (group.skipMerge || group.entries.length === 1) {
      var single = group.entries[0];
      single.sourceUids = single.uid ? [single.uid] : [];
      aggregatedMetrics[single.uid] = normalizedMetric(single.uid);
      if (single.hasOwnProperty("__order")) delete single.__order;
      deduped.push(single);
      continue;
    }
    var best = group.entries[0];
    var bestScore = scoreStudentPriority(best, metricsMap);
    for (var gi = 1; gi < group.entries.length; gi++) {
      var candidate = group.entries[gi];
      var candidateScore = scoreStudentPriority(candidate, metricsMap);
      if (candidateScore > bestScore) {
        best = candidate;
        bestScore = candidateScore;
      }
    }
    if (!best.sourceUids) best.sourceUids = [];
    var combinedMetric = { u1: 0, u2: 0, u3: 0, finalPct: 0 };
    var hasMetric = false;
    for (var mj = 0; mj < group.entries.length; mj++) {
      var member = group.entries[mj];
      if (!member) continue;
      if (best.sourceUids.indexOf(member.uid) === -1 && member.uid) {
        best.sourceUids.push(member.uid);
      }
      if (member.uid && member.uid !== best.uid) {
        aliasMap[member.uid] = best.uid;
      }
      if (
        (!best.displayName ||
          best.displayName === best.email ||
          best.displayName === best.uid) &&
        member.displayName &&
        member.displayName !== member.email
      ) {
        best.displayName = member.displayName;
      }
      if (
        (!best.matricula ||
          best.matricula === best.uid ||
          best.matricula === best.email) &&
        member.matricula
      ) {
        best.matricula = member.matricula;
      }
      if (!best.email && member.email) {
        best.email = member.email;
      }
      var metric = metricsMap ? metricsMap[member.uid] : null;
      if (metric) {
        var normalized = normalizeMetricEntry(metric);
        hasMetric = true;
        combinedMetric.u1 = Math.max(combinedMetric.u1, normalized.u1);
        combinedMetric.u2 = Math.max(combinedMetric.u2, normalized.u2);
        combinedMetric.u3 = Math.max(combinedMetric.u3, normalized.u3);
        combinedMetric.finalPct = Math.max(
          combinedMetric.finalPct,
          normalized.finalPct
        );
      }
    }
    if (!best.sourceUids.length && best.uid) {
      best.sourceUids.push(best.uid);
    }
    aggregatedMetrics[best.uid] = hasMetric
      ? combinedMetric
      : { u1: 0, u2: 0, u3: 0, finalPct: 0 };
    if (best.hasOwnProperty("__order")) delete best.__order;
    deduped.push(best);
  }

  state.students = deduped;
  state.metrics = aggregatedMetrics;
  state.studentAliasMap = aliasMap;
  if (state.selectedUploadStudent && aliasMap[state.selectedUploadStudent]) {
    state.selectedUploadStudent = aliasMap[state.selectedUploadStudent];
  }
}

function cloneMetrics(metrics) {
  var out = {};
  for (var key in metrics) {
    if (Object.prototype.hasOwnProperty.call(metrics, key)) {
      out[key] = normalizeMetricEntry(metrics[key]);
    }
  }
  return out;
}

function sortFallbackStudents(list) {
  list.sort(function (a, b) {
    var rawA = a && a.displayName ? a.displayName : "";
    var rawB = b && b.displayName ? b.displayName : "";
    var nameA;
    var nameB;
    try {
      nameA = rawA.toLocaleLowerCase("es-MX");
    } catch (_errA) {
      nameA = rawA.toLowerCase();
    }
    try {
      nameB = rawB.toLocaleLowerCase("es-MX");
    } catch (_errB) {
      nameB = rawB.toLowerCase();
    }
    if (nameA < nameB) return -1;
    if (nameA > nameB) return 1;
    return 0;
  });
}

function normalizeFallbackSource(data) {
  var list = [];
  var metrics = {};
  var students = data && Array.isArray(data.students) ? data.students : [];
  for (var i = 0; i < students.length; i++) {
    var src = students[i] || {};
    var uid = String(
      src.uid || src.id || src.matricula || "fallback-" + i
    ).trim();
    if (!uid) uid = "fallback-" + i;
    var displayName =
      src.displayName || src.nombre || src.name || "Estudiante " + (i + 1);
    var email = src.email || src.correo || "";
    var matricula =
      src.matricula != null
        ? String(src.matricula)
        : src.id != null
        ? String(src.id)
        : null;
    list.push({
      uid: uid,
      displayName: displayName,
      email: email,
      matricula: matricula,
    });

    var grades = src.grades || src.calificaciones || {};
    if (
      grades &&
      (grades.u1 != null ||
        grades.u2 != null ||
        grades.u3 != null ||
        grades.unidad1 != null ||
        grades.unidad2 != null ||
        grades.unidad3 != null)
    ) {
      metrics[uid] = normalizeMetricEntry(grades);
    }
  }

  var metricEntries = data && data.metrics ? data.metrics : {};
  for (var key in metricEntries) {
    if (Object.prototype.hasOwnProperty.call(metricEntries, key)) {
      metrics[key] = normalizeMetricEntry(metricEntries[key]);
    }
  }

  for (var j = 0; j < list.length; j++) {
    var stu = list[j];
    if (!metrics[stu.uid]) {
      metrics[stu.uid] = { u1: 0, u2: 0, u3: 0, finalPct: 0 };
    }
  }

  sortFallbackStudents(list);
  return { students: list, metrics: metrics };
}

function setFallbackCache(data) {
  STUDENT_FALLBACK_CACHE = {
    students: (data.students || []).map(cloneStudentEntry),
    metrics: cloneMetrics(data.metrics || {}),
  };
}

function cloneFallbackData() {
  if (!STUDENT_FALLBACK_CACHE) {
    return { students: [], metrics: {} };
  }
  return {
    students: STUDENT_FALLBACK_CACHE.students.map(cloneStudentEntry),
    metrics: cloneMetrics(STUDENT_FALLBACK_CACHE.metrics),
  };
}

function readFallbackStorage() {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    var raw = window.localStorage.getItem(STUDENT_FALLBACK_KEY);
    if (!raw) return null;
    var parsed = JSON.parse(raw);
    return normalizeFallbackSource(parsed);
  } catch (_err) {
    return null;
  }
}

function persistFallbackData() {
  if (typeof window === "undefined" || !window.localStorage) return;
  if (!STUDENT_FALLBACK_CACHE) return;
  try {
    var payload = {
      students: STUDENT_FALLBACK_CACHE.students,
      metrics: STUDENT_FALLBACK_CACHE.metrics,
      updatedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(STUDENT_FALLBACK_KEY, JSON.stringify(payload));
  } catch (_err) {}
}

async function ensureStudentFallbackLoaded() {
  if (STUDENT_FALLBACK_CACHE) return;
  var stored = readFallbackStorage();
  if (stored) {
    setFallbackCache(stored);
    return;
  }
  try {
    var res = await fetch("./data/students.json", { cache: "no-store" });
    if (!res || !res.ok) {
      throw new Error("Respuesta inválida al cargar base local de estudiantes");
    }
    var json = await res.json();
    setFallbackCache(normalizeFallbackSource(json));
  } catch (err) {
    console.error("No se pudo cargar la base local de estudiantes", err);
    setFallbackCache({ students: [], metrics: {} });
  }
}

async function loadStudentFallbackData() {
  await ensureStudentFallbackLoaded();
  return cloneFallbackData();
}

function mutateFallbackData(mutator) {
  if (!STUDENT_FALLBACK_CACHE) return;
  try {
    mutator(STUDENT_FALLBACK_CACHE);
  } catch (err) {
    console.error("No se pudo actualizar la base local de estudiantes", err);
  }
  sortFallbackStudents(STUDENT_FALLBACK_CACHE.students);
  persistFallbackData();
}

function generateFallbackId() {
  return (
    "local-" +
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2, 8)
  );
}

function markStudentFallbackActive(flag) {
  STUDENT_FALLBACK_ACTIVE = !!flag;
}

function isStudentFallbackActive() {
  return !!STUDENT_FALLBACK_ACTIVE;
}

function sanitizeStudentInput(data) {
  data = data || {};
  return {
    displayName: (data.displayName || data.nombre || "").trim(),
    email: (data.email || "").trim(),
    matricula:
      data.matricula != null && String(data.matricula).trim() !== ""
        ? String(data.matricula).trim()
        : null,
  };
}

// ===== Firestore =====
async function fetchStudents(db, grupoId) {
  var out = [];
  var seen = {};

  function pushFromSnapshot(snap) {
    if (!snap || snap.empty) return;
    snap.forEach(function (docSnap) {
      var data = docSnap.data() || {};
      var uid = docSnap.id;
      if (seen[uid]) return;
      seen[uid] = 1;
      out.push({
        uid: uid,
        displayName: data.displayName || data.nombre || "Alumno",
        email: data.email || "",
        matricula: data.matricula || null,
      });
    });
  }

  try {
    var courseRef = doc(db, "courses", grupoId);
    var courseMembers = collection(courseRef, "members");
    var snapCourse = await getDocs(
      query(courseMembers, where("role", "==", "student"))
    );
    pushFromSnapshot(snapCourse);
  } catch (_err) {
    // Ignorar y continuar con otras rutas.
  }

  try {
    var grupoRef = doc(db, "grupos", grupoId);
    var grupoMembers = collection(grupoRef, "members");
    var snapGrupo = await getDocs(
      query(grupoMembers, where("role", "==", "student"))
    );
    pushFromSnapshot(snapGrupo);
  } catch (_err2) {
    // Ignorar y continuar con otras rutas.
  }

  if (!out.length) {
    try {
      var usersSnap = await getDocs(
        query(
          collection(db, "users"),
          where("role", "==", "student"),
          limit(300)
        )
      );
      pushFromSnapshot(usersSnap);
    } catch (_err3) {
      // Ignorar error final y regresar lo que se tenga.
    }
  }

  return out;
}

function normalizeStudentPayload(data, opts) {
  data = data || {};
  var name = data.displayName || data.nombre || "";
  var payload = {
    displayName: name,
    nombre: name,
    email: data.email || "",
    matricula: data.matricula ? data.matricula : null,
    role: "student",
    updatedAt: serverTimestamp(),
  };
  if (opts && opts.includeCreatedAt) {
    payload.createdAt = serverTimestamp();
  }
  if (data.uid) {
    payload.uid = data.uid;
  }
  return payload;
}

async function createGroupStudent(db, grupoId, data) {
  if (isStudentFallbackActive()) {
    await ensureStudentFallbackLoaded();
    var clean = sanitizeStudentInput(data);
    var docId = data && data.uid ? String(data.uid).trim() : "";
    if (!docId) docId = generateFallbackId();
    var newStudent = {
      uid: docId,
      displayName: clean.displayName || "Alumno",
      email: clean.email || "",
      matricula: clean.matricula,
    };
    mutateFallbackData(function (cache) {
      var list = cache.students;
      var replaced = false;
      for (var i = 0; i < list.length; i++) {
        if (list[i] && list[i].uid === docId) {
          list[i] = newStudent;
          replaced = true;
          break;
        }
      }
      if (!replaced) {
        list.push(newStudent);
      }
      if (!cache.metrics[docId]) {
        cache.metrics[docId] = { u1: 0, u2: 0, u3: 0, finalPct: 0 };
      }
    });
    return docId;
  }

  var membersCol = collection(db, "grupos", grupoId, "members");
  var docIdFs = data && data.uid ? String(data.uid).trim() : "";
  if (docIdFs) {
    var payloadExisting = normalizeStudentPayload(
      Object.assign({}, data, { uid: docIdFs }),
      { includeCreatedAt: true }
    );
    await setDoc(doc(membersCol, docIdFs), payloadExisting);
    return docIdFs;
  }
  var newRef = doc(membersCol);
  var payload = normalizeStudentPayload(
    Object.assign({}, data, { uid: newRef.id }),
    { includeCreatedAt: true }
  );
  await setDoc(newRef, payload);
  return newRef.id;
}

async function updateGroupStudent(db, grupoId, uid, data) {
  if (!uid) {
    throw new Error("Identificador no válido");
  }
  if (isStudentFallbackActive()) {
    await ensureStudentFallbackLoaded();
    var clean = sanitizeStudentInput(data);
    mutateFallbackData(function (cache) {
      for (var i = 0; i < cache.students.length; i++) {
        if (cache.students[i] && cache.students[i].uid === uid) {
          cache.students[i] = Object.assign({}, cache.students[i], {
            displayName:
              clean.displayName || cache.students[i].displayName || "Alumno",
            email: clean.email || cache.students[i].email || "",
            matricula:
              clean.matricula != null
                ? clean.matricula
                : cache.students[i].matricula,
          });
          return;
        }
      }
      cache.students.push({
        uid: uid,
        displayName: clean.displayName || "Alumno",
        email: clean.email || "",
        matricula: clean.matricula,
      });
      if (!cache.metrics[uid]) {
        cache.metrics[uid] = { u1: 0, u2: 0, u3: 0, finalPct: 0 };
      }
    });
    return;
  }
  var payload = normalizeStudentPayload(
    Object.assign({}, data, { uid: uid }),
    {}
  );
  await updateDoc(doc(db, "grupos", grupoId, "members", uid), payload);
}

async function deleteGroupStudent(db, grupoId, uid) {
  if (!uid) {
    throw new Error("Identificador no válido");
  }
  if (isStudentFallbackActive()) {
    await ensureStudentFallbackLoaded();
    mutateFallbackData(function (cache) {
      cache.students = cache.students.filter(function (stu) {
        return !stu || stu.uid !== uid;
      });
      if (cache.metrics && cache.metrics[uid]) {
        delete cache.metrics[uid];
      }
    });
    return;
  }
  await deleteDoc(doc(db, "grupos", grupoId, "members", uid));
}
async function fetchCalifItems(db, grupoId, uid) {
  try {
    var snap = await getDocs(
      query(
        collection(db, "grupos", grupoId, "calificaciones", uid, "items"),
        orderBy("fecha", "asc")
      )
    );
    var arr = [];
    snap.forEach(function (d) {
      var o = d.data();
      o.id = d.id;
      arr.push(o);
    });
    return arr;
  } catch (e) {
    console.error("Error al obtener calificaciones para", uid, e);
    return [];
  }
}
async function fetchDeliverables(db, grupoId) {
  try {
    var snap = await getDocs(
      query(
        collection(db, "grupos", grupoId, "deliverables"),
        orderBy("dueAt", "asc")
      )
    );
    var arr = [];
    snap.forEach(function (d) {
      var o = d.data();
      o.id = d.id;
      arr.push(o);
    });
    return arr;
  } catch (e) {
    console.error("Error al obtener entregables", e);
    return [];
  }
}
async function fetchExams(db, grupoId) {
  try {
    var snap = await getDocs(query(collection(db, "grupos", grupoId, "exams")));
    var map = {};
    snap.forEach(function (d) {
      map[d.id] = d.data();
    });
    return map; // u1/u2
  } catch (e) {
    console.error("Error al obtener ligas de exámenes", e);
    return {};
  }
}
async function fetchGantt(db, grupoId) {
  try {
    var snap = await getDocs(
      query(
        collection(db, "grupos", grupoId, "gantt"),
        orderBy("startAt", "asc")
      )
    );
    var arr = [];
    snap.forEach(function (d) {
      var o = d.data();
      o.id = d.id;
      arr.push(o);
    });
    return arr;
  } catch (e) {
    console.error("Error al obtener el cronograma", e);
    return [];
  }
}
async function getRubric(db, grupoId) {
  try {
    var r = await getDoc(doc(db, "grupos", grupoId, "rubric", "main"));
    return r.exists() ? r.data() : { content: "" };
  } catch (e) {
    console.error("Error al obtener la rúbrica", e);
    return { content: "" };
  }
}
async function saveRubric(db, grupoId, content) {
  await setDoc(
    doc(db, "grupos", grupoId, "rubric", "main"),
    { content: content, updatedAt: serverTimestamp() },
    { merge: true }
  );
}
async function createDeliverable(db, grupoId, payload) {
  var ref = await addDoc(
    collection(db, "grupos", grupoId, "deliverables"),
    Object.assign({}, payload, { createdAt: serverTimestamp() })
  );
  return ref.id;
}
async function updateDeliverable(db, grupoId, id, patch) {
  await updateDoc(
    doc(db, "grupos", grupoId, "deliverables", id),
    Object.assign({}, patch, { updatedAt: serverTimestamp() })
  );
}
async function deleteDeliverable(db, grupoId, id) {
  await updateDoc(doc(db, "grupos", grupoId, "deliverables", id), {
    deleted: true,
    updatedAt: serverTimestamp(),
  });
}

function rebuildStudentIndex(state) {
  var list = state && Array.isArray(state.students) ? state.students : [];
  var index = {};
  for (var i = 0; i < list.length; i++) {
    var stu = list[i];
    if (stu && stu.uid) {
      index[stu.uid] = stu;
    }
  }
  var aliasMap = state && state.studentAliasMap ? state.studentAliasMap : {};
  for (var alias in aliasMap) {
    if (!Object.prototype.hasOwnProperty.call(aliasMap, alias)) continue;
    var target = aliasMap[alias];
    if (target && index[target]) {
      index[alias] = index[target];
    }
  }
  state.studentIndex = index;
  return index;
}

function ensureMetricsForStudents(state) {
  var metrics = state && state.metrics ? state.metrics : {};
  var list = state && Array.isArray(state.students) ? state.students : [];
  var next = {};
  for (var i = 0; i < list.length; i++) {
    var stu = list[i];
    var uid = stu && stu.uid ? stu.uid : "";
    if (!uid) continue;
    next[uid] = metrics[uid] || { u1: 0, u2: 0, u3: 0, finalPct: 0 };
  }
  state.metrics = next;
  return next;
}

async function reloadStudents(db, grupoId, state) {
  if (isStudentFallbackActive() || (state && state.isUsingStudentFallback)) {
    await ensureStudentFallbackLoaded();
    var fallback = cloneFallbackData();
    state.students = fallback.students;
    state.metrics = fallback.metrics;
    state.isUsingStudentFallback = true;
    state.studentAliasMap = {};
    applyStudentEmailDeduplication(state);
    rebuildStudentIndex(state);
    syncRosterCache(state.students);
    ensureMetricsForStudents(state);
    renderSummaryStats(state.students, state.metrics);
    renderStudentsTable(state.students, state.metrics);
    handleUploadsSnapshot(state, state.uploads);
    return;
  }

  state.students = await fetchStudents(db, grupoId);
  state.isUsingStudentFallback = false;
  state.studentAliasMap = {};
  applyStudentEmailDeduplication(state);
  rebuildStudentIndex(state);
  syncRosterCache(state.students);
  ensureMetricsForStudents(state);
  renderSummaryStats(state.students, state.metrics);
  renderStudentsTable(state.students, state.metrics);
  handleUploadsSnapshot(state, state.uploads);
}

// ===== Render =====
function setText(id, value) {
  var el = $id(id);
  if (el) el.textContent = String(value);
}
function renderSummaryStats(students, metrics) {
  var list = Array.isArray(students) ? students : [];
  setText("pd-summary-total-students", list.length);
  var finals = [];
  for (var i = 0; i < list.length; i++) {
    var stu = list[i];
    if (!stu || !stu.uid) continue;
    var m = metrics && metrics[stu.uid] ? metrics[stu.uid] : null;
    if (m && !isNaN(m.finalPct)) finals.push(m.finalPct);
  }
  var avg = finals.length
    ? finals.reduce(function (a, b) {
        return a + b;
      }, 0) / finals.length
    : 0;
  setText("pd-summary-avg-final", toEscala5(avg));
}

function renderDeliverablesList(arr) {
  var tbody = $id("pd-deliverables-tbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  var countActive = 0;
  if (!Array.isArray(arr) || !arr.length) {
    setText("pd-summary-active-deliverables", 0);
    tbody.innerHTML =
      '<tr><td colspan="6" class="pd-empty">Sin entregables.</td></tr>';
    return;
  }
  for (var i = 0; i < arr.length; i++) {
    var d = arr[i];
    var due = toDate(d.dueAt);
    var dueTxt = due ? fmtDate(due) : "—";
    var w = d.weight != null ? d.weight + "%" : "—";
    if (!d.deleted) countActive++;
    var deleted = d.deleted ? " (eliminado)" : "";
    var row =
      '\
      <tr data-id="' +
      escAttr(d.id) +
      '">\
        <td>' +
      escHtml(d.title || "Entregable") +
      deleted +
      "</td>\
        <td>" +
      escHtml(d.description || "—") +
      '</td>\
        <td style="text-align:center">' +
      escHtml(d.unidad || "—") +
      '</td>\
        <td style="text-align:right">' +
      escHtml(w) +
      '</td>\
        <td style="text-align:center">' +
      escHtml(dueTxt) +
      '</td>\
        <td style="text-align:right"><button class="pd-deliv-edit pd-action-btn">Editar</button> <button class="pd-deliv-del pd-action-btn">Eliminar</button></td>\
      </tr>';
    tbody.insertAdjacentHTML("beforeend", row);
  }
  setText("pd-summary-active-deliverables", countActive);
}

function renderStudentsTable(students, metrics) {
  var tbody = $id("pd-students-tbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  var list = Array.isArray(students) ? students : [];
  if (!list.length) {
    tbody.innerHTML =
      '<tr><td colspan="8" class="pd-empty">Sin estudiantes.</td></tr>';
    return;
  }
  for (var i = 0; i < list.length; i++) {
    var s = list[i] || {};
    var uid = s.uid || "";
    var m = metrics[s.uid] || { u1: 0, u2: 0, u3: 0, finalPct: 0 };
    var row =
      '\
      <tr data-id="' +
      escAttr(uid) +
      '">\
        <td style="text-align:center"><input type="checkbox" class="pd-student-check" data-email="' +
      escAttr(s.email || "") +
      '" aria-label="Seleccionar estudiante" /></td>\
        <td>' +
      escHtml(s.displayName || "Alumno") +
      "</td>\
        <td>" +
      escHtml(s.email || "") +
      '</td>\
        <td style="text-align:right">' +
      escHtml(toEscala5(m.u1)) +
      '</td>\
        <td style="text-align:right">' +
      escHtml(toEscala5(m.u2)) +
      '</td>\
        <td style="text-align:right">' +
      escHtml(toEscala5(m.u3)) +
      '</td>\
        <td style="text-align:right; font-weight:700">' +
      escHtml(toEscala5(m.finalPct)) +
      '</td>\
        <td>\
          <div class="pd-student-actions">\
            <button type="button" class="pd-action-btn pd-student-edit">Editar</button>\
            <button type="button" class="pd-action-btn pd-student-delete">Eliminar</button>\
          </div>\
        </td>\
      </tr>';
    tbody.insertAdjacentHTML("beforeend", row);
  }
}

function renderUploadStudentsList(state, providedEntries) {
  var listEl = $id("pd-upload-student-list");
  var emptyEl = $id("pd-upload-empty");
  if (!listEl) return;
  var entries = providedEntries || getUploadStudentEntries(state);
  if (!entries.length) {
    listEl.innerHTML = "";
    listEl.hidden = true;
    if (emptyEl) {
      emptyEl.hidden = false;
      emptyEl.textContent = "No hay evidencias registradas todavía.";
    }
    return;
  }
  listEl.hidden = false;
  if (emptyEl) emptyEl.hidden = true;

  var html = "";
  for (var i = 0; i < entries.length; i++) {
    var entry = entries[i];
    var pressed = state.selectedUploadStudent === entry.uid ? "true" : "false";
    var breakdown = countUploadsByKind(entry.uploads);
    html +=
      '\
      <li class="pd-uploads__student">\
        <button type="button" data-uid="' +
      escAttr(entry.uid || "") +
      '" aria-pressed="' +
      pressed +
      '">\
          <span class="pd-uploads__student-name">' +
      escHtml(entry.displayName || entry.email || "Estudiante") +
      "</span>";
    if (entry.email) {
      html +=
        '<span class="pd-uploads__student-email">' +
        escHtml(entry.email) +
        "</span>";
    }
    html +=
      '<span class="pd-uploads__student-counts">\
        <span class="pd-uploads__student-count" title="Total de entregas">' +
      escHtml(String((entry.uploads || []).length)) +
      "</span>";
    if (entry.pending > 0) {
      html +=
        '<span class="pd-uploads__student-pending">' +
        escHtml(
          entry.pending === 1 ? "1 pendiente" : entry.pending + " pendientes"
        ) +
        "</span>";
    }
    html +=
      "</span>\
          ";
    if (breakdown.total > 0) {
      html += '<span class="pd-uploads__student-breakdown">';
      if (breakdown.activity > 0) {
        html +=
          '<span class="pd-uploads__student-chip" title="Actividades">A: ' +
          escHtml(String(breakdown.activity)) +
          "</span>";
      }
      if (breakdown.homework > 0) {
        html +=
          '<span class="pd-uploads__student-chip" title="Tareas">T: ' +
          escHtml(String(breakdown.homework)) +
          "</span>";
      }
      if (breakdown.evidence > 0) {
        html +=
          '<span class="pd-uploads__student-chip" title="Evidencias">E: ' +
          escHtml(String(breakdown.evidence)) +
          "</span>";
      }
      if (breakdown.other > 0) {
        html +=
          '<span class="pd-uploads__student-chip" title="Otros envíos">O: ' +
          escHtml(String(breakdown.other)) +
          "</span>";
      }
      html += "</span>";
    }
    html +=
      "\
        </button>\
      </li>";
  }
  listEl.innerHTML = html;
}

function buildUploadCard(upload) {
  if (!upload) return "";
  var status = normalizeStatus(upload.status);
  var statusClass = "pd-uploads__item-status--" + status;
  if (!UPLOAD_STATUS_LABELS[status]) {
    status = "enviado";
    statusClass = "pd-uploads__item-status--enviado";
  }
  var statusLabel = UPLOAD_STATUS_LABELS[status] || "Enviado";
  var kind = UPLOAD_KIND_LABELS[(upload.kind || "").toLowerCase()] || "Entrega";
  var metaParts = [];
  var submittedTxt = formatDateTime(
    upload.submittedAt || upload.createdAt || upload.updatedAt
  );
  if (submittedTxt) metaParts.push("Enviado: " + submittedTxt);
  if (upload.fileName) metaParts.push(upload.fileName);
  var sizeTxt = formatSize(upload.fileSize);
  if (sizeTxt) metaParts.push(sizeTxt);
  var description = (upload.description || "").trim();
  var hasGrade = typeof upload.grade === "number" && !isNaN(upload.grade);
  var gradeTxt = hasGrade
    ? "Calificación: " + upload.grade + " / 100"
    : "Sin calificación registrada";
  var reviewInfo = formatReviewInfo(upload);

  var html =
    '\
    <article class="pd-uploads__item" data-id="' +
    escAttr(upload.id || "") +
    '">\
      <header class="pd-uploads__item-header">\
        <div class="pd-uploads__item-heading">\
          <h4>' +
    escHtml(upload.title || "Entrega sin título") +
    '</h4>\
          <span class="pd-uploads__item-chip">' +
    escHtml(kind) +
    '</span>\
        </div>\
        <span class="pd-uploads__item-status ' +
    escAttr(statusClass) +
    '">' +
    escHtml(statusLabel) +
    "</span>\
      </header>";

  if (metaParts.length) {
    html +=
      '<p class="pd-uploads__item-meta">' +
      escHtml(metaParts.join(" · ")) +
      "</p>";
  }
  if (description) {
    html +=
      '<p class="pd-uploads__item-description">' +
      escHtml(description) +
      "</p>";
  }
  if (gradeTxt) {
    var gradeClass = hasGrade
      ? "pd-uploads__item-grade"
      : "pd-uploads__item-grade pd-uploads__item-grade--pending";
    html += '<p class="' + gradeClass + '">' + escHtml(gradeTxt) + "</p>";
  }
  if (upload.teacherFeedback) {
    html +=
      '<p class="pd-uploads__item-feedback"><strong>Comentarios:</strong> ' +
      escHtml(upload.teacherFeedback) +
      "</p>";
  }
  if (reviewInfo) {
    html +=
      '<p class="pd-uploads__item-reviewer">' + escHtml(reviewInfo) + "</p>";
  }

  html += '<div class="pd-uploads__item-actions">';
  if (upload.fileUrl) {
    var fileUrlAttr = escAttr(upload.fileUrl);
    var fileTitleAttr = escAttr(upload.title || "Entrega sin título");
    var fileNameAttr = escAttr(upload.fileName || "");
    html +=
      '<button type="button" class="pd-action-btn pd-uploads__action" data-action="preview" data-file-url="' +
      fileUrlAttr +
      '" data-file-title="' +
      fileTitleAttr +
      '" data-file-name="' +
      fileNameAttr +
      '">Visualizar</button>';
    html +=
      '<a class="pd-action-btn" href="' +
      fileUrlAttr +
      '" target="_blank" rel="noopener">Abrir en pestaña nueva</a>';
  } else {
    html +=
      '<span class="pd-uploads__item-link-disabled">Archivo no disponible</span>';
  }
  var disableAccept = status === "aceptado" || status === "calificado";
  html +=
    '<button type="button" class="pd-action-btn pd-uploads__action" data-action="accept"' +
    (disableAccept ? " disabled" : "") +
    ">Marcar como aceptada</button>";
  var gradeLabel = hasGrade
    ? "Actualizar calificación"
    : "Registrar calificación";
  html +=
    '<button type="button" class="pd-action-btn pd-uploads__action" data-action="grade">' +
    escHtml(gradeLabel) +
    "</button>";
  html += "</div>";

  html += "</article>";
  return html;
}

function renderUploadDetail(state, providedEntries) {
  var container = $id("pd-upload-detail");
  if (!container) return;
  var entries = providedEntries || getUploadStudentEntries(state);
  var uid = state.selectedUploadStudent;
  container.innerHTML = "";
  if (!uid) {
    container.insertAdjacentHTML(
      "beforeend",
      '<p class="pd-empty">Selecciona un estudiante para revisar sus evidencias.</p>'
    );
    return;
  }
  var grouped = state.uploadGroups || {};
  var group = grouped[uid] || null;
  var info =
    (state.studentIndex && state.studentIndex[uid]) ||
    (group && group.student) ||
    {};
  var header =
    '\
    <div class="pd-uploads__detail-header">\
      <h3>' +
    escHtml(info.displayName || info.nombre || info.email || "Estudiante") +
    "</h3>";
  if (info.email) {
    header += "<span>" + escHtml(info.email) + "</span>";
  }
  header += "</div>";
  container.insertAdjacentHTML("beforeend", header);

  if (!group || !group.uploads || !group.uploads.length) {
    container.insertAdjacentHTML(
      "beforeend",
      '<p class="pd-empty">Este estudiante aún no registra entregas.</p>'
    );
    return;
  }

  var sections = groupUploadsByKind(group.uploads);
  for (var si = 0; si < sections.length; si++) {
    var section = sections[si];
    var count = section.uploads.length;
    var badge = count === 1 ? "1 entrega" : count + " entregas";
    var secHtml =
      '\
      <section class="pd-uploads__kind-section" data-kind="' +
      escAttr(section.key) +
      '">\
        <header class="pd-uploads__kind-header">\
          <h4 class="pd-uploads__kind-heading">' +
      escHtml(section.title) +
      '</h4>\
          <span class="pd-uploads__kind-badge">' +
      escHtml(badge) +
      '</span>\
        </header>\
        <div class="pd-uploads__kind-list">';
    for (var ui = 0; ui < section.uploads.length; ui++) {
      secHtml += buildUploadCard(section.uploads[ui]);
    }
    secHtml +=
      "</div>\
      </section>";
    container.insertAdjacentHTML("beforeend", secHtml);
  }
}

// Solo mostrar los datos ya calculados y guardados por actividades.js
function renderGradesTable(students) {
  const tableBody = document.getElementById("grades-table-body");
  if (!tableBody) return;

  tableBody.innerHTML = "";
  students.forEach((student) => {
    // Lee los promedios y calificaciones ya calculados
    const unit1 = student.unit1?.average ?? student.unit1 ?? 0;
    const unit2 = student.unit2?.average ?? student.unit2 ?? 0;
    const projectFinal = student.projectFinal ?? 0;
    const finalGrade = student.finalGrade ?? student.final ?? 0;

    const row = document.createElement("tr");
    row.className = "border-b hover:bg-gray-50";
    row.innerHTML = `
      <td class="py-3 px-4 font-medium text-gray-800">${
        student.name || student.displayName || "Nombre no disponible"
      }</td>
      <td class="py-3 px-4 text-center">${Number(unit1).toFixed(2)}</td>
      <td class="py-3 px-4 text-center">${Number(unit2).toFixed(2)}</td>
      <td class="py-3 px-4 text-center">${Number(projectFinal).toFixed(2)}</td>
      <td class="py-3 px-4 text-center font-bold text-blue-600">${Number(
        finalGrade
      ).toFixed(1)}</td>
    `;
    tableBody.appendChild(row);
  });
}

// ===== Panel docente =====
function renderPanelDocente(state) {
  var root = $id("paneldocente-root");
  if (!root) return;

  var isFallback = state.isUsingStudentFallback === true;
  var hasStudents = Array.isArray(state.students) && state.students.length > 0;

  var emptyStateEl = $id("pd-empty-state");
  var mainContentEl = $id("pd-main-content");

  if (isFallback || !hasStudents) {
    if (emptyStateEl) emptyStateEl.hidden = false;
    if (mainContentEl) mainContentEl.hidden = true;
    if (isFallback) {
      setText("pd-empty-title", "Sin conexión a Firebase");
      setText(
        "pd-empty-message",
        "No se pudo acceder a la base de datos en línea. Revisa tu conexión o permisos."
      );
    } else {
      setText("pd-empty-title", "Sin estudiantes");
      setText(
        "pd-empty-message",
        "No hay estudiantes registrados en este grupo."
      );
    }
    return;
  }

  if (emptyStateEl) emptyStateEl.hidden = true;
  if (mainContentEl) mainContentEl.hidden = false;

  var weights = {
    unit1: 0.3,
    unit2: 0.3,
    project: 0.4,
  };

  renderGradesTable(state.students, weights);

  var deliverableSection = $id("pd-deliverable-section");
  if (deliverableSection) {
    deliverableSection.hidden = !Array.isArray(state.deliverables);
  }
}

// ===== Main =====
async function main() {
  await ready();
  initializeFileViewer();
  initFirebase();
  var db = getDb();

  var root = $id("paneldocente-root") || document.body;
  var params = new URLSearchParams(location.search);
  var dataset = root && root.dataset ? root.dataset : {};
  var grupo = (
    dataset && dataset.grupo
      ? dataset.grupo
      : params.get("grupo") || "calidad-2025"
  ).trim();

  var state = {
    students: [],
    deliverables: [],
    metrics: {},
    studentIndex: {},
    studentAliasMap: {},
    isUsingStudentFallback: false,
    uploads: [],
    uploadGroups: {},
    uploadIndex: {},
    selectedUploadStudent: null,
    unsubscribeUploads: null,
    currentTeacher: null,
    editingStudentId: null,
    groupId: grupo,
    dataAdmin: null,
  };
  var isLoading = false;
  var hasLoaded = false;
  var lastLoadedUid = null;

  bindUploadStudentList(state);
  bindUploadDetail(state);

  setPanelLocked(root, true);
  showStatusBanner("Preparando panel…", "Esperando autenticación.", "info");

  onAuth(function (user) {
    handleAuthChange(user).catch(function (err) {
      console.error(err);
    });
  });

  async function handleAuthChange(user) {
    var info = await computeTeacherState(user);
    var body = document.body;
    if (body) {
      body.classList.toggle("teacher-yes", !!info.isTeacher);
      body.classList.toggle("teacher-no", !info.isTeacher);
    }

    if (!info.isTeacher) {
      hasLoaded = false;
      lastLoadedUid = null;
      if (state.unsubscribeUploads) {
        state.unsubscribeUploads();
        state.unsubscribeUploads = null;
      }
      state.currentTeacher = null;
      clearUploadsState(state);
      setPanelLocked(root, true);
      showStatusBanner(
        user ? "Sin privilegios de docente" : "Autenticación requerida",
        user
          ? "Tu cuenta no tiene permisos para ver este panel. Solicita acceso al coordinador."
          : "Inicia sesión con tu cuenta institucional de docente para revisar este panel.",
        user ? "warning" : "info"
      );
      return;
    }

    var uid = user && user.uid ? user.uid : null;
    state.currentTeacher = {
      uid: uid || "",
      email: user && user.email ? user.email : "",
      displayName: user && user.displayName ? user.displayName : "",
    };

    if (!state.unsubscribeUploads) {
      state.unsubscribeUploads = observeAllStudentUploads(
        function (items) {
          handleUploadsSnapshot(state, items);
        },
        function (err) {
          console.error("observeAllStudentUploads:error", err);
        }
      );
    }

    if (hasLoaded && lastLoadedUid === uid) {
      hideStatusBanner();
      setPanelLocked(root, false);
      return;
    }

    if (isLoading) return;
    isLoading = true;
    showStatusBanner(
      "Cargando información del grupo…",
      "Obteniendo datos desde Firebase.",
      "info"
    );
    try {
      await loadDataForGroup(db, grupo, state);
      hideStatusBanner();
      setPanelLocked(root, false);
      hasLoaded = true;
      lastLoadedUid = uid;
    } catch (err) {
      console.error("No se pudo cargar la información del panel", err);
      showStatusBanner(
        "No se pudieron cargar los datos",
        "Verifica tu conexión o permisos e intenta nuevamente.",
        "error"
      );
      setPanelLocked(root, true);
      hasLoaded = false;
      lastLoadedUid = null;
    } finally {
      isLoading = false;
    }
  }
}

main().catch(console.error);
