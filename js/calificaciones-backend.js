// === Imports Firebase (SDK modular) ===
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  collection,
  collectionGroup,
  query,
  where,
  orderBy,
  getDocs,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

// === API pública ===
export const Calificaciones = (() => {
  let app,
    auth,
    db,
    _grupoId = null,
    _user = null,
    _role = null;

  const init = async ({ firebaseConfig, grupoId }) => {
    if (!firebaseConfig) throw new Error("Falta firebaseConfig");
    if (!grupoId) throw new Error("Falta grupoId");
    _grupoId = grupoId;
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);

    // Espera sesión y carga rol
    await new Promise((res, rej) => {
      onAuthStateChanged(auth, async (u) => {
        _user = u || null;
        if (!_user) return rej(new Error("No autenticado"));
        const uref = doc(db, "users", _user.uid);
        const usnap = await getDoc(uref);
        _role = usnap.exists() ? usnap.data().role || null : null;
        res(true);
      });
    });
    return { uid: _user.uid, role: _role, grupoId: _grupoId };
  };

  const _assertAuth = () => {
    if (!_user) throw new Error("No autenticado");
    if (!_grupoId) throw new Error("Sin grupoId");
  };
  const _isDocente = () => _role === "docente";

  const _pathAlumnoItems = (alumnoUid) =>
    collection(db, "grupos", _grupoId, "calificaciones", alumnoUid, "items");

  const _computeResumen = (items) => {
    // porcentaje = Σ( (puntos/maxPuntos)*ponderacion )
    let porc = 0;
    items.forEach((it) => {
      const max = Number(it.maxPuntos) || 0;
      const pts = Number(it.puntos) || 0;
      const pond = Number(it.ponderacion) || 0;
      if (max > 0) porc += (pts / max) * pond;
    });
    // clamp 0-100
    porc = Math.max(0, Math.min(100, Number(porc.toFixed(2))));
    return { porcentaje: porc };
  };

  // === Alumno: mis calificaciones ===
  const listMyGrades = async () => {
    _assertAuth();
    const q = query(_pathAlumnoItems(_user.uid), orderBy("fecha", "asc"));
    const snap = await getDocs(q);
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const resumen = _computeResumen(items);
    return { items, resumen };
  };

  // === Docente: calificaciones del grupo (agregado por alumno) ===
  const listGroupGrades = async () => {
    _assertAuth();
    if (!_isDocente()) throw new Error("Solo docente");
    // usamos collectionGroup sobre 'items' filtrando por grupoId
    const q = query(
      collectionGroup(db, "items"),
      where("grupoId", "==", _grupoId)
    );
    const snap = await getDocs(q);
    const porAlumno = new Map();
    snap.forEach((d) => {
      const it = { id: d.id, ...d.data() };
      const key = it.alumnoUid;
      if (!porAlumno.has(key)) porAlumno.set(key, []);
      porAlumno.get(key).push(it);
    });
    const salida = [];
    for (const [alumnoUid, items] of porAlumno.entries()) {
      const resumen = _computeResumen(items);
      salida.push({
        alumnoUid,
        items: items.sort((a, b) => a.fecha?.seconds - b.fecha?.seconds),
        resumen,
      });
    }
    // opcional: ordenar por porcentaje desc
    salida.sort((a, b) => b.resumen.porcentaje - a.resumen.porcentaje);
    return salida;
  };

  // === Docente: alta de calificación para 1 alumno ===
  const addGradeForStudent = async (
    alumnoUid,
    { nombre, ponderacion, puntos, maxPuntos, fecha }
  ) => {
    _assertAuth();
    if (!_isDocente()) throw new Error("Solo docente");
    if (!alumnoUid) throw new Error("Falta alumnoUid");
    const payload = {
      nombre: String(nombre || "Actividad"),
      ponderacion: Number(ponderacion || 0),
      puntos: Number(puntos || 0),
      maxPuntos: Number(maxPuntos || 0),
      fecha: fecha ? fecha : serverTimestamp(),
      autorUid: _user.uid,
      grupoId: _grupoId,
      alumnoUid,
    };
    return await addDoc(_pathAlumnoItems(alumnoUid), payload);
  };

  // === Docente: edición ===
  const updateGrade = async (alumnoUid, itemId, patch) => {
    _assertAuth();
    if (!_isDocente()) throw new Error("Solo docente");
    const ref = doc(
      db,
      "grupos",
      _grupoId,
      "calificaciones",
      alumnoUid,
      "items",
      itemId
    );
    const clean = {};
    ["nombre", "ponderacion", "puntos", "maxPuntos", "fecha"].forEach((k) => {
      if (k in patch) clean[k] = patch[k];
    });
    await updateDoc(ref, clean);
    return true;
  };

  // === Docente: borrar ===
  const deleteGrade = async (alumnoUid, itemId) => {
    _assertAuth();
    if (!_isDocente()) throw new Error("Solo docente");
    const ref = doc(
      db,
      "grupos",
      _grupoId,
      "calificaciones",
      alumnoUid,
      "items",
      itemId
    );
    await deleteDoc(ref);
    return true;
  };

  // === Docente: export CSV rápido ===
  const exportCSV = async () => {
    const data = await listGroupGrades();
    const rows = [["alumnoUid", "porcentaje", "items"]];
    data.forEach((r) => {
      rows.push([
        r.alumnoUid,
        r.resumen.porcentaje,
        r.items
          .map(
            (it) =>
              `${it.nombre}:${it.puntos}/${it.maxPuntos}(${it.ponderacion}%)`
          )
          .join(" | "),
      ]);
    });
    const csv = rows
      .map((r) =>
        r.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(",")
      )
      .join("\n");
    return csv;
  };

  return {
    init,
    listMyGrades,
    listGroupGrades,
    addGradeForStudent,
    updateGrade,
    deleteGrade,
    exportCSV,
  };
})();
