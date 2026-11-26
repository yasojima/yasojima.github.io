/* SUKIMAKUN visit planning. A read-only comparison of routes in the demo snapshot. */
(() => {
  'use strict';

  const defaultDate = '2026-11-26';
  const colors = ['#157467', '#405fa3', '#a8652a', '#77579d', '#53732d', '#a24f6a', '#326c81'];
  const speedKmPerHour = 35;

  function rows(value) {
    return Array.isArray(value) ? value : value?.results || [];
  }

  function minute(value) {
    if (typeof value !== 'string') return null;
    const time = value.match(/^(\d{2}):(\d{2})/);
    if (!time) return null;
    const hour = Number(time[1]);
    const minutes = Number(time[2]);
    return hour < 24 && minutes < 60 ? hour * 60 + minutes : null;
  }

  function clock(value) {
    return value == null ? '—' : String(Math.floor(value / 60)).padStart(2, '0') + ':' +
      String(value % 60).padStart(2, '0');
  }

  function point(latitude, longitude) {
    if (latitude == null || longitude == null || latitude === '' || longitude === '') return null;
    const lat = Number(latitude);
    const lon = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
    return [lat, lon];
  }

  function offsetDate(date, difference) {
    const value = new Date(date + 'T00:00:00Z');
    value.setUTCDate(value.getUTCDate() + difference);
    return value.toISOString().slice(0, 10);
  }

  function makeNode(tag, className, content) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (content != null) element.textContent = content;
    return element;
  }

  function extractModel(data, terms) {
    const appointments = new Map();
    const staff = new Map();
    const customers = new Map();
    const resourceDays = new Map();
    const workSchedules = new Map();
    for (const [key, value] of Object.entries(data)) {
      const path = new URL(key, 'https://example.invalid/').pathname;
      if (path === '/api/v1/scheduling/appointments/') {
        for (const row of rows(value)) if (row.id) appointments.set(row.id, row);
      } else if (path === '/api/v1/technicians/') {
        for (const row of rows(value)) if (row.id) staff.set(row.id, row);
      } else if (path === '/api/v1/work-schedules/') {
        for (const row of rows(value)) if (row.is_active && row.schedule_type === 'weekly') workSchedules.set(row.user, row);
      } else if (path === '/api/v1/scheduling/resource-day/' && value.date) {
        resourceDays.set(value.date, new Map((value.technicians || []).map(person => [person.tech_id, person])));
      } else if (/^\/api\/v1\/customers\/[^/]+\/$/.test(path) && value.id) {
        customers.set(value.id, value);
      }
    }

    const jobs = [];
    const experience = new Map();
    const localTime = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    });
    function formattedTime(input) {
      const date = new Date(input);
      if (!input || !Number.isFinite(date.getTime())) return '';
      const parts = Object.fromEntries(localTime.formatToParts(date).map(part => [part.type, part.value]));
      return parts.year + '-' + parts.month + '-' + parts.day + ' ' + parts.hour + ':' + parts.minute;
    }
    for (const record of appointments.values()) {
      const start = formattedTime(record.start_datetime);
      if (!start || record.status === 'cancelled') continue;
      const end = formattedTime(record.end_datetime);
      const startMinute = minute(start.slice(11));
      const endMinute = start.slice(0, 10) === end.slice(0, 10) ? minute(end.slice(11)) : null;
      const duration = endMinute != null && endMinute > startMinute ? endMinute - startMinute : Number(record.duration_minutes) || 0;
      const customer = customers.get(record.customer);
      const technician = record.technician || '';
      if (!staff.has(technician)) {
        staff.set(technician, { name: record.technician_name || '担当未定' });
      }
      const types = [...new Set([record.job_type, ...(record.job_types || []).map(type => type.id)].filter(Boolean))];
      if (record.status === 'completed') {
        if (!experience.has(technician)) experience.set(technician, new Map());
        for (const type of types) {
          const history = experience.get(technician);
          const date = start.slice(0, 10);
          if (!history.has(type) || history.get(type) > date) history.set(type, date);
        }
      }
      jobs.push({
        id: record.id, date: start.slice(0, 10), staff: technician,
        start: startMinute, end: startMinute + duration, duration,
        label: record.customer_name || record.title || '訪問予定',
        service: terms[record.job_type_name] || record.job_type_name || '',
        address: record.location_text || record.location || '',
        place: point(record.latitude, record.longitude), status: record.status, types,
        propertyType: customer?.property_type,
        zip: customer?.service_zip,
        preferred: customer?.preferred_technician || '',
        locked: record.do_not_reschedule || record.is_multiday || endMinute == null ||
          Boolean(record.additional_technicians?.length) || Boolean(record.multiday_parent),
        assistants: (record.additional_technicians || []).map(person => person.id || person),
        windowStart: minute(record.arrival_window_start), windowEnd: minute(record.arrival_window_end),
      });
    }
    const staffList = Array.from(staff, ([id, data]) => ({ ...data, id }))
      .filter(person => person.id)
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const [index, person] of staffList.entries()) person.routeColor = colors[index % colors.length];
    for (const person of staffList) staff.set(person.id, person);
    return { jobs, staff, staffList, resourceDays, workSchedules, experience };
  }

  function plannedShift(model, day, person) {
    const actual = model.resourceDays.get(day)?.get(person.id);
    const weekday = (new Date(day + 'T00:00:00Z').getUTCDay() + 6) % 7;
    const weekly = model.workSchedules.get(person.user_id)?.days?.find(item => item.day_of_week === weekday);
    const record = actual || weekly;
    if (!record || !(actual ? actual.is_working : weekly.is_working_day)) return null;
    const start = minute(actual ? actual.work_start : weekly.start_time);
    const end = minute(actual ? actual.work_end : weekly.end_time);
    if (start == null || end == null || start >= end) return null;
    const unavailable = [...(record.breaks || []), ...(record.off_bands || [])].map(band => ({
      start: minute(band.start || band.start_time),
      end: minute(band.end || band.end_time),
    }));
    if (unavailable.some(band => band.start == null || band.end == null || band.start >= band.end)) return null;
    return { start, end, unavailable, maxTravel: Number(actual?.max_travel_minutes ?? person.max_travel_minutes) };
  }

  function distance(a, b) {
    const rad = Math.PI / 180;
    const lat = (b[0] - a[0]) * rad;
    const lon = (b[1] - a[1]) * rad;
    const hav = Math.sin(lat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(lon / 2) ** 2;
    return 12742 * Math.asin(Math.min(1, Math.sqrt(hav)));
  }

  function travelTime(a, b) {
    return Math.ceil(distance(a, b) * 60 / speedKmPerHour);
  }

  function ordered(jobs) {
    return jobs.slice().sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
  }

  function homePoint(person) {
    return point(person?.home_latitude, person?.home_longitude);
  }

  function pathDistance(jobs, person) {
    if (!jobs.length) return 0;
    const places = ordered(jobs).map(job => job.place).filter(Boolean);
    if (!places.length) return 0;
    const home = homePoint(person);
    const points = home ? [home, ...places, home] : places;
    return points.slice(1).reduce((sum, current, index) => sum + distance(points[index], current), 0);
  }

  function qualified(model, job, person) {
    if (person.id === job.staff) return true;
    if (!person.is_available || person.user_is_active === false ||
        person.employment_status !== 'active' || !job.types.length) return false;
    if (job.preferred && job.preferred !== person.id) return false;
    const allowedProperties = person.serviceable_property_types || [];
    if (allowedProperties.length && !allowedProperties.includes(job.propertyType)) return false;
    const allowedZipCodes = person.service_area_zip_codes || [];
    if (allowedZipCodes.length && !allowedZipCodes.map(String).includes(job.zip)) return false;
    if (person.license_status?.status && person.license_status.status !== 'active') return false;
    return job.types.every(type => {
      const previousDate = model.experience.get(person.id)?.get(type);
      return previousDate && previousDate < job.date;
    });
  }

  function fits(job, person, shift, assignments) {
    if (!shift || job.start < shift.start || job.end > shift.end) return false;
    if (shift.unavailable.some(band => job.start < band.end && band.start < job.end)) return false;
    const staffSchedule = ordered(assignments.filter(existing =>
      existing.id !== job.id && (existing.staff === person.id || existing.assistants.includes(person.id))));
    if (staffSchedule.some(existing => job.start < existing.end && existing.start < job.end)) return false;
    const previous = staffSchedule.filter(existing => existing.end <= job.start)
      .sort((a, b) => b.end - a.end)[0];
    const next = staffSchedule.find(existing => existing.start >= job.end);
    if (previous && !previous.place || next && !next.place) return false;
    const before = previous ? travelTime(previous.place, job.place) : 0;
    const after = next ? travelTime(job.place, next.place) : 0;
    const limit = shift.maxTravel;
    if (limit > 0 && (before > limit || after > limit)) return false;
    if (previous && before > availableTravelMinutes(previous.end, job.start, shift.unavailable)) return false;
    if (next && after > availableTravelMinutes(job.end, next.start, shift.unavailable)) return false;
    return true;
  }

  function availableTravelMinutes(start, end, unavailable) {
    let cursor = start;
    let largestGap = 0;
    for (const band of unavailable.slice().sort((a, b) => a.start - b.start)) {
      if (band.end <= start || band.start >= end) continue;
      largestGap = Math.max(largestGap, band.start - cursor);
      cursor = Math.max(cursor, band.end);
    }
    return Math.max(largestGap, end - cursor, 0);
  }

  function flexible(job) {
    return job.windowStart != null && job.windowEnd != null && job.windowStart <= job.windowEnd;
  }

  function candidateStarts(job, mode) {
    const starts = new Set([job.start]);
    if (mode !== 'rebalance' && flexible(job)) {
      for (let start = job.windowStart; start <= job.windowEnd; start += 5) starts.add(start);
      starts.add(job.windowEnd);
    }
    return starts;
  }

  function comparePlans(model, date, selection, mode) {
    const original = ordered(model.jobs.filter(job => job.date === date));
    const possible = original.filter(job => job.place && !job.locked && job.duration > 0 &&
      (job.status === 'confirmed' || job.status === 'scheduled'));
    const shifts = new Map(model.staffList.map(person => [person.id, plannedShift(model, date, person)]));
    let plan = original.slice();
    const changes = [];
    const used = new Set();
    for (let step = 0; step < possible.length; step++) {
      let best;
      const forStaff = id => plan.filter(job => job.staff === id);
      const distanceFor = id => pathDistance(forStaff(id), model.staff.get(id));
      for (const job of possible) {
        if (used.has(job.id)) continue;
        const src = model.staff.get(job.staff);
        const currentOrigin = forStaff(job.staff);
        const beforeSrc = distanceFor(job.staff);
        for (const person of model.staffList) {
          if (selection && job.staff !== selection && person.id !== selection) continue;
          const same = person.id === job.staff;
          if (mode === 'pack' && !same || !qualified(model, job, person)) continue;
          const currentDestination = same ? currentOrigin : forStaff(person.id);
          const before = same ? beforeSrc : beforeSrc + distanceFor(person.id);
          if (currentOrigin.some(item => !item.place) || currentDestination.some(item => !item.place)) continue;
          for (const start of candidateStarts(job, mode)) {
            if (same && start === job.start) continue;
            if (mode === 'pack' && start >= job.start) continue;
            const after = { ...job, staff: person.id, start, end: start + job.duration };
            if (!fits(after, person, shifts.get(person.id), plan)) continue;
            const nextOrigin = currentOrigin.filter(item => item.id !== job.id);
            const nextDestination = same ? [...nextOrigin, after] : [...currentDestination, after];
            const afterDistance = pathDistance(nextDestination, person) + (same ? 0 : pathDistance(nextOrigin, src));
            const gain = before - afterDistance;
            const score = mode === 'pack' ? job.start - start : gain;
            const minimumGain = mode === 'pack' ? -0.001 : 0.049;
            if (gain > minimumGain && (!best || score > best.score)) best = { before: job, after, score };
          }
        }
      }
      if (!best) break;
      plan = plan.map(job => job.id === best.after.id ? best.after : job);
      changes.push(best);
      used.add(best.after.id);
    }

    const visible = job => !selection || job.staff === selection;
    const windowCount = possible.filter(job => visible(job) && flexible(job)).length;
    const allStaff = [...new Set([...original, ...plan].map(job => job.staff))];
    const total = jobs => allStaff.reduce((sum, id) =>
      sum + pathDistance(jobs.filter(job => job.staff === id), model.staff.get(id)), 0);
    return { changes, windowCount, before: total(original), after: total(plan), count: original.filter(visible).length };
  }

  function groupJobs(jobs, staff) {
    const groups = new Map();
    for (const job of ordered(jobs)) {
      if (!groups.has(job.staff)) groups.set(job.staff, []);
      groups.get(job.staff).push(job);
    }
    return Array.from(groups, ([id, jobs]) => ({
      id, jobs, name: staff.get(id)?.name || '担当未定', color: staff.get(id)?.routeColor || '#54635f',
    })).sort((a, b) => a.name.localeCompare(b.name));
  }

  function renderMap(map, layer, groups) {
    const markers = new Map();
    if (!map) return markers;
    layer.clearLayers();
    const bounds = [];
    for (const group of groups) {
      const locations = group.jobs.filter(job => job.place);
      if (locations.length > 1) L.polyline(locations.map(job => job.place), {
        color: group.color, opacity: 0.75, weight: 3, dashArray: '6 6',
      }).addTo(layer);
      for (const [index, job] of locations.entries()) {
        const symbol = makeNode('span', 'sk-route-marker', String(index + 1));
        symbol.style.background = group.color;
        const popup = makeNode('div', 'sk-route-popup');
        popup.append(makeNode('strong', '', job.label), makeNode('p', '', job.address),
          makeNode('small', '', clock(job.start) + ' · ' + group.name));
        if (job.service) popup.append(makeNode('p', '', job.service));
        const marker = L.marker(job.place, {
          icon: L.divIcon({ html: symbol, className: 'sk-route-marker-icon', iconSize: [24, 24], iconAnchor: [12, 12] }),
          title: job.label, alt: job.label,
        }).bindPopup(popup).addTo(layer);
        markers.set(job.id, marker);
        bounds.push(job.place);
      }
    }
    if (bounds.length) map.fitBounds(bounds, { padding: [34, 34], maxZoom: 14, animate: false });
    else map.setView([39.9526, -75.1652], 10, { animate: false });
    return markers;
  }

  function showComparison(dialog, model, date, selection, mode) {
    const result = comparePlans(model, date, selection, mode);
    dialog.replaceChildren();
    dialog.dataset.previewMode = mode;
    dialog.dataset.previewCount = String(result.changes.length);

    const header = makeNode('div', 'sk-route-dialog-heading');
    const headings = makeNode('div');
    const title = {
      rebalance: '訪問ルートの再配分案', optimize: '1日の訪問順の最適化案', pack: '訪問の空き時間を詰める案',
    }[mode];
    headings.append(makeNode('p', 'sk-route-scope', '閲覧用プレビュー · ' + date), makeNode('h2', '', title));
    const close = makeNode('button', 'sk-route-control sk-route-close', '閉じる');
    close.type = 'button';
    close.addEventListener('click', () => dialog.close());
    header.append(headings, close);
    dialog.append(header);
    const intro = {
      rebalance: '開始時刻を固定し、作業実績と勤務条件が合う担当変更を比較します。',
      optimize: '担当変更と、変更可能な到着時間帯がある訪問の時刻を比較します。',
      pack: '担当者を固定し、変更可能な到着時間帯の範囲で訪問を早める案を比較します。',
    }[mode];
    dialog.append(makeNode('p', 'sk-route-dialog-note', intro),
      makeNode('p', 'sk-route-dialog-note', '直線距離・時速35 km換算の試算 · 変更案 ' + result.changes.length + '件' +
        (mode !== 'rebalance' ? ' · 時刻を変えられる訪問 ' + result.windowCount + '件' : '') +
        (selection ? ' · 選択中のスタッフに関係する変更案' : '')));

    const comparison = makeNode('div', 'sk-route-comparison');
    for (const [label, km] of [['当日の総距離', result.before], ['提案後の総距離', result.after],
      ['削減見込み', Math.max(0, result.before - result.after)]]) {
      const item = makeNode('div');
      item.append(makeNode('span', '', label), makeNode('strong', '', km.toFixed(1) + ' km'));
      comparison.append(item);
    }
    dialog.append(comparison);
    if (result.changes.length) {
      const table = makeNode('table', 'sk-route-changes');
      const head = makeNode('thead');
      const headRow = makeNode('tr');
      for (const label of ['訪問先', '現在の担当・開始', '提案の担当・開始']) headRow.append(makeNode('th', '', label));
      head.append(headRow);
      const body = makeNode('tbody');
      for (const change of result.changes) {
        const row = makeNode('tr');
        for (const value of [change.before.label,
          (model.staff.get(change.before.staff)?.name || '担当未定') + ' · ' + clock(change.before.start),
          (model.staff.get(change.after.staff)?.name || '担当未定') + ' · ' + clock(change.after.start)]) {
          row.append(makeNode('td', '', value));
        }
        body.append(row);
      }
      table.append(head, body);
      dialog.append(table);
    } else {
      const empty = mode === 'pack' ? '前詰め可能な訪問はありません。'
        : '収録された勤務・予約条件で距離を短くできる変更案はありません。';
      dialog.append(makeNode('p', 'sk-route-empty', result.count ? empty : 'この条件に該当する訪問がありません。'));
    }
    dialog.showModal();
    close.focus();
  }

  window.mountRouteWorkspace = function mountRouteWorkspace(root, { data, terms = {} }) {
    const model = extractModel(data, terms);
    root.classList.add('sk-route');
    root.innerHTML = `
      <section class="sk-route-hero">
        <div>
          <p class="sk-route-scope">現場管理</p>
          <h1>当日の訪問ルート</h1>
          <p class="sk-route-guide">日付と担当者を選び、訪問順と移動の案を確認できます。</p>
        </div>
        <div class="sk-route-actions">
          <button type="button" id="sk-route-rebalance" class="sk-route-control">再配分をプレビュー</button>
          <button type="button" id="sk-route-optimize" class="sk-route-control sk-route-primary">最適化をプレビュー</button>
        </div>
      </section>
      <div class="sk-route-toolbar">
        <div class="sk-route-date-control">
          <button type="button" id="sk-route-previous" class="sk-route-control" aria-label="前日">‹</button>
          <label for="sk-route-date"><span>訪問日</span><input id="sk-route-date" type="date" value="${defaultDate}"></label>
          <button type="button" id="sk-route-next" class="sk-route-control" aria-label="翌日">›</button>
        </div>
        <label for="sk-route-staff"><span>担当スタッフ</span><select id="sk-route-staff"><option value="">全スタッフ</option></select></label>
        <p class="sk-route-timezone">訪問先の現地時刻</p>
        <button type="button" id="sk-route-pack" class="sk-route-control sk-route-secondary">訪問の空き時間を詰める</button>
      </div>
      <section class="sk-route-plan" aria-labelledby="sk-route-plan-title">
        <div class="sk-route-plan-heading">
          <h2 id="sk-route-plan-title">訪問計画</h2><p class="sk-route-summary" aria-live="polite"></p>
        </div>
        <div class="sk-route-columns">
          <div class="sk-route-map-wrap">
            <div class="sk-route-map" aria-label="訪問先地図"></div>
            <p class="sk-route-map-note">地図の点線は訪問順の目安です。</p>
          </div>
          <div class="sk-route-agenda" aria-label="担当別の訪問一覧"></div>
        </div>
      </section>
      <dialog class="sk-route-dialog" aria-label="訪問ルートのプレビュー"></dialog>
    `;
    const date = root.querySelector('#sk-route-date');
    const staff = root.querySelector('#sk-route-staff');
    const agenda = root.querySelector('.sk-route-agenda');
    const summary = root.querySelector('.sk-route-summary');
    const dialog = root.querySelector('.sk-route-dialog');
    const mapRoot = root.querySelector('.sk-route-map');
    let map;
    let layer;
    if (window.L) {
      map = L.map(mapRoot, { zoomControl: true, scrollWheelZoom: false });
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      layer = L.layerGroup().addTo(map);
    } else {
      mapRoot.append(makeNode('p', 'sk-route-empty', '地図を読み込めませんでした。訪問一覧から訪問先を確認できます。'));
    }

    for (const person of model.staffList) {
      const option = makeNode('option', '', person.name);
      option.value = person.id;
      staff.append(option);
    }

    let selectedDate = defaultDate;
    function showDate() {
      if (!date.value) return;
      selectedDate = date.value;
      const jobs = model.jobs.filter(job => job.date === selectedDate && (!staff.value || job.staff === staff.value));
      const groups = groupJobs(jobs, model.staff);
      root.dataset.routeDate = selectedDate;
      root.dataset.routeCount = String(jobs.length);
      const groupCount = groups.filter(group => group.id).length;
      summary.textContent = jobs.length + '件の訪問 · ' + groupCount + '人';
      agenda.replaceChildren();
      const markers = renderMap(map, layer, groups);
      if (!groups.length) {
        agenda.append(makeNode('p', 'sk-route-empty', 'この日付・担当の訪問は収録されていません。'));
        return;
      }
      for (const group of groups) {
        const block = makeNode('section', 'sk-route-group');
        const heading = makeNode('h3');
        const dot = makeNode('span', 'sk-route-person-dot');
        dot.style.backgroundColor = group.color;
        heading.append(dot, document.createTextNode(group.name), makeNode('small', '', group.jobs.length + '件'));
        block.append(heading);
        const list = makeNode('ol');
        for (const job of group.jobs) {
          const row = makeNode('li');
          const button = makeNode('button', 'sk-route-stop');
          button.type = 'button';
          const identity = makeNode('span', 'sk-route-stop-identity');
          identity.append(makeNode('strong', '', job.label), makeNode('small', '', job.address || job.service));
          button.append(makeNode('time', '', clock(job.start)), identity);
          const marker = markers.get(job.id);
          if (marker) button.addEventListener('click', () => {
            map.panTo(job.place);
            marker.openPopup();
          });
          else button.disabled = true;
          row.append(button);
          list.append(row);
        }
        block.append(list);
        agenda.append(block);
      }
    }

    date.addEventListener('change', showDate);
    staff.addEventListener('change', showDate);
    for (const [id, difference] of [['#sk-route-previous', -1], ['#sk-route-next', 1]]) {
      root.querySelector(id).addEventListener('click', () => {
        date.value = offsetDate(date.value || selectedDate, difference);
        showDate();
      });
    }
    for (const mode of ['rebalance', 'optimize', 'pack']) {
      const button = root.querySelector('#sk-route-' + mode);
      button.addEventListener('click', () => {
        showComparison(dialog, model, selectedDate, staff.value, mode);
        dialog.addEventListener('close', () => button.focus(), { once: true });
      });
    }
    showDate();
  };
})();
