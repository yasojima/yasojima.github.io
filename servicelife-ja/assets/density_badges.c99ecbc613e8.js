/* R20 RTE4 — calendar density badge loader.
 *
 * Fetches /api/v1/routing/density-by-day/?week_start=YYYY-MM-DD once per
 * dispatch render (or page load) and writes a density badge into every
 * matching tech-day cell. Cells are matched on
 *   .tech-day-cell[data-technician="<uuid>"][data-date="YYYY-MM-DD"]
 *
 * The endpoint contract (see RTE1 brief) returns:
 *   { rows: [ { technician_id, date, score, note, stop_count,
 *               hull_sq_miles, mean_drive_minutes }, ... ] }
 *
 * Score is null when `note` is one of empty_day | single_stop |
 * ungeocoded | budget_cap. Each note maps to its own visual treatment.
 *
 * Badge UI is intentionally additive: we never block calendar render on
 * the fetch, and a fetch failure is silent.
 */
(function () {
  'use strict';

  function classFor(row) {
    if (row.note === 'empty_day' || row.note === 'budget_cap') return 'density-badge-empty';
    if (row.note === 'single_stop') return 'density-badge-empty';
    if (row.note === 'ungeocoded') return 'density-badge-warn';
    var s = row.score;
    if (s == null) return 'density-badge-empty';
    if (s >= 75) return 'density-badge-green';
    if (s >= 50) return 'density-badge-yellow';
    return 'density-badge-red';
  }

  function textFor(row) {
    if (row.note === 'empty_day' || row.note === 'budget_cap') return '—'; // em dash
    if (row.note === 'single_stop') return '1';
    if (row.note === 'ungeocoded') return '?';
    if (row.score == null) return '—';
    return String(row.score);
  }

  function fmt1(v) {
    return (v == null) ? '—' : Number(v).toFixed(1);
  }

  function tooltipFor(row) {
    if (row.score == null) return row.note || '';
    return (row.stop_count || 0) + ' stops | hull ' +
      fmt1(row.hull_sq_miles) + ' sq mi | avg ' +
      fmt1(row.mean_drive_minutes) + ' min between stops';
  }

  function clearBadges(root) {
    var scope = root || document;
    var existing = scope.querySelectorAll('.density-badge[data-r20-rte4="1"]');
    for (var i = 0; i < existing.length; i++) {
      existing[i].parentNode.removeChild(existing[i]);
    }
  }

  function populateRow(row, root) {
    var scope = root || document;
    var sel = '.tech-day-cell[data-technician="' + row.technician_id +
      '"][data-date="' + row.date + '"]';
    var cells = scope.querySelectorAll(sel);
    for (var i = 0; i < cells.length; i++) {
      var badge = document.createElement('span');
      badge.className = 'density-badge ' + classFor(row);
      badge.textContent = textFor(row);
      badge.title = tooltipFor(row);
      badge.setAttribute('data-r20-rte4', '1');
      cells[i].appendChild(badge);
    }
  }

  function loadDensityBadges(weekStart, root) {
    if (!weekStart) return Promise.resolve();
    var url = '/api/v1/routing/density-by-day/?week_start=' +
      encodeURIComponent(weekStart);
    return fetch(url, { credentials: 'same-origin' })
      .then(function (r) {
        if (!r.ok) return null;
        return r.json();
      })
      .then(function (payload) {
        if (!payload || !Array.isArray(payload.rows)) return;
        clearBadges(root);
        for (var i = 0; i < payload.rows.length; i++) {
          populateRow(payload.rows[i], root);
        }
      })
      .catch(function () { /* silent */ });
  }

  // Compute the Monday of the ISO week containing `dateStr` (YYYY-MM-DD).
  function weekStartFor(dateStr) {
    if (!dateStr) return null;
    var parts = dateStr.split('-');
    if (parts.length !== 3) return null;
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    if (isNaN(d.getTime())) return null;
    var dow = d.getDay(); // 0=Sun..6=Sat
    var deltaToMon = (dow === 0) ? -6 : (1 - dow);
    d.setDate(d.getDate() + deltaToMon);
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  window.densityBadges = {
    load: loadDensityBadges,
    classFor: classFor,
    textFor: textFor,
    tooltipFor: tooltipFor,
    weekStartFor: weekStartFor,
    clear: clearBadges,
  };

  function bootstrap() {
    var grid = document.getElementById('dispGrid');
    var ws = (grid && grid.dataset && grid.dataset.weekStart) ||
      (document.body && document.body.dataset && document.body.dataset.weekStart);
    if (ws) loadDensityBadges(ws);
  }

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
})();
