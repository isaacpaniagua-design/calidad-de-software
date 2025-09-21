
function normalizeItems(source) {
  const out = [];
  if (!Array.isArray(source)) return out;
  for (let i = 0; i < source.length; i++) {
    const it = source[i] || {};
    const normalizedMaxRaw = Number(it.maxPuntos);
    const normalizedMax = Number.isFinite(normalizedMaxRaw) ? normalizedMaxRaw : 0;
    const normalizedPointsRaw = Number(it.puntos);
    const normalizedPoints = Number.isFinite(normalizedPointsRaw) ? normalizedPointsRaw : 0;
    const maxForRatio = normalizedMax > 0 ? normalizedMax : 0;
    const clampedNormalizedPoints =
      maxForRatio > 0 ? Math.max(0, Math.min(normalizedPoints, maxForRatio)) : Math.max(0, normalizedPoints);
    const normalizedRatio = maxForRatio > 0 ? clampedNormalizedPoints / maxForRatio : 0;

    const rawMaxValue = it.rawMaxPuntos;
    const rawPointsValue = it.rawPuntos;
    const hasRawMax = rawMaxValue !== undefined && rawMaxValue !== null && rawMaxValue !== '';
    const hasRawPoints = rawPointsValue !== undefined && rawPointsValue !== null && rawPointsValue !== '';
    const rawMax = hasRawMax ? Number(rawMaxValue) : NaN;
    const rawPoints = hasRawPoints ? Number(rawPointsValue) : NaN;

    let displayMax = Number.isFinite(rawMax) && rawMax > 0 ? rawMax : null;
    if (displayMax == null) displayMax = maxForRatio > 0 ? maxForRatio : 10;

    let displayPoints;
    if (Number.isFinite(rawPoints)) displayPoints = rawPoints;
    else displayPoints = normalizedRatio * displayMax;
    if (displayMax > 0) displayPoints = Math.max(0, Math.min(displayPoints, displayMax));
    else displayPoints = Math.max(0, displayPoints);

    const estaCalificado = hasRawPoints
      ? true
      : (it.puntos !== undefined && it.puntos !== null && it.puntos !== '');

    out.push(Object.assign({}, it, {
      normalizedRatio: Math.max(0, Math.min(normalizedRatio, 1)),
      normalizedMax: Number(maxForRatio.toFixed(3)),
      normalizedPuntos: Number(clampedNormalizedPoints.toFixed(3)),
      displayMax: Number(displayMax.toFixed(2)),
      displayPuntos: Number(displayPoints.toFixed(2)),
      estaCalificado: !!estaCalificado,
    }));
  }
  return out;
}

        const max = Number(it.displayMax) || 0;
        const rawPts = Number(it.displayPuntos);
        const hasDisplayPts = !Number.isNaN(rawPts);
        const calificada = Boolean(it.estaCalificado);
        const ptsText = calificada && hasDisplayPts ? rawPts.toFixed(2) : '-';
        const pnd = Number(it.ponderacion) || 0;
        const ratio = Number(it.normalizedRatio) || 0;
        const aporta = ratio * pnd;
        const escala = calificada && max > 0 ? escPct(100 * ratio) : '-';
        const statusBadge = calificada
          ? '<span class="qsc-status qsc-status--done">Calificada</span>'
          : '<span class="qsc-status qsc-status--pending">Pendiente</span>';

            <td>${tipo}</td>
            <td>${uni}</td>
            <td style="text-align:right">${ptsText}</td>
            <td style="text-align:right">${max ? max.toFixed(2) : '-'}</td>
