/* Estadísticas: filtro de periodo, KPIs y gráficos (citas por cliente, empleado, servicio y evolución temporal) */
const STATS_PRESETS = [
  { id: 'today', label: 'Hoy' },
  { id: '7d', label: '7 días' },
  { id: '30d', label: '30 días' },
  { id: 'month', label: 'Este mes' },
  { id: 'year', label: 'Este año' },
  { id: 'all', label: 'Todo' },
];

const STATS_MAX_RANKED_ITEMS = 8;

const Statistics = {
  currentPreset: 'all',
  rangeStart: null,
  rangeEnd: null,
  viewModes: {},
  cache: {},

  init() {
    initChartTooltip();
    this.populatePresets();

    document.getElementById('stats-range-start').addEventListener('change', () => this.handleCustomRangeChange());
    document.getElementById('stats-range-end').addEventListener('change', () => this.handleCustomRangeChange());

    document.querySelectorAll('.btn-view-toggle').forEach(btn => {
      btn.addEventListener('click', () => this.toggleView(btn));
    });

    this.setPreset('all');
  },

  populatePresets() {
    const container = document.getElementById('stats-filter-presets');
    container.innerHTML = STATS_PRESETS
      .map(p => `<button type="button" class="filter-preset-btn" data-preset="${p.id}">${p.label}</button>`)
      .join('');
    container.querySelectorAll('.filter-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => this.setPreset(btn.dataset.preset));
    });
  },

  setPreset(id) {
    this.currentPreset = id;
    const computed = computeRangeForPreset(id);
    if (computed) {
      this.rangeStart = computed.start;
      this.rangeEnd = computed.end;
    }
    this.syncPresetButtons();
    this.renderAll();
  },

  syncPresetButtons() {
    document.querySelectorAll('.filter-preset-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.preset === this.currentPreset);
    });
  },

  handleCustomRangeChange() {
    const start = document.getElementById('stats-range-start').value;
    const end = document.getElementById('stats-range-end').value;
    if (!start || !end || start > end) {
      showToast('Selecciona un rango de fechas válido', 'error');
      return;
    }
    this.rangeStart = start;
    this.rangeEnd = end;
    this.currentPreset = 'custom';
    this.syncPresetButtons();
    this.renderAll();
  },

  getEffectiveRange() {
    if (this.currentPreset !== 'all') {
      return { start: this.rangeStart, end: this.rangeEnd };
    }
    const all = Store.getAll();
    if (all.length === 0) {
      const today = toISODate(new Date());
      return { start: today, end: today };
    }
    const dates = all.map(a => a.date).sort();
    return { start: dates[0], end: dates[dates.length - 1] };
  },

  toggleView(btn) {
    const id = btn.dataset.target;
    this.viewModes[id] = this.viewModes[id] === 'table' ? 'chart' : 'table';
    btn.textContent = this.viewModes[id] === 'table' ? 'Ver gráfico' : 'Ver tabla';
    this.renderSection(id);
  },

  renderAll() {
    const range = this.getEffectiveRange();
    document.getElementById('stats-range-start').value = range.start;
    document.getElementById('stats-range-end').value = range.end;

    const appts = Store.getAll().filter(a => a.date >= range.start && a.date <= range.end);
    const employees = EmployeeStore.getAll();

    document.getElementById('stats-range-summary').textContent =
      appts.length === 0
        ? `No hay citas registradas entre el ${formatStatsDate(range.start)} y el ${formatStatsDate(range.end)}.`
        : `Mostrando ${appts.length} cita${appts.length === 1 ? '' : 's'} del ${formatStatsDate(range.start)} al ${formatStatsDate(range.end)}.`;

    this.renderKpis(appts, employees);

    const selfBookedAppts = appts.filter(a => a.createdByClient);

    this.cache.timeline = { buckets: buildTimelineBuckets(appts, range.start, range.end) };
    this.cache.clients = { items: capRankedItems(aggregateByClient(appts)) };
    this.cache.employees = { items: capRankedItems(aggregateByEmployee(appts, employees)) };
    this.cache.services = { items: capRankedItems(aggregateByService(appts)) };
    this.cache.selfBooked = { items: capRankedItems(aggregateByClient(selfBookedAppts)) };

    this.renderSection('timeline');
    this.renderSection('clients');
    this.renderSection('employees');
    this.renderSection('services');
    this.renderSection('selfBooked');
  },

  renderKpis(appts, employees) {
    document.getElementById('stats-kpi-total-appts').textContent = appts.length;
    document.getElementById('stats-kpi-total-appts-sub').textContent =
      appts.length === 0 ? 'Sin datos en el periodo' : 'en el periodo seleccionado';

    const uniqueClients = new Set(appts.map(a => a.clientId || a.name)).size;
    document.getElementById('stats-kpi-clients').textContent = uniqueClients;
    document.getElementById('stats-kpi-clients-sub').textContent =
      uniqueClients === 0 ? 'Sin datos en el periodo' : 'clientes distintos atendidos';

    const services = aggregateByService(appts);
    const topService = services[0];
    document.getElementById('stats-kpi-top-service').textContent = topService ? topService.label : '—';
    document.getElementById('stats-kpi-top-service-sub').textContent =
      topService ? `${topService.value} cita${topService.value === 1 ? '' : 's'}` : 'Sin datos en el periodo';

    const employeesAgg = aggregateByEmployee(appts, employees);
    const topEmployee = employeesAgg[0];
    document.getElementById('stats-kpi-top-employee').textContent = topEmployee ? topEmployee.label : '—';
    document.getElementById('stats-kpi-top-employee-sub').textContent =
      topEmployee ? `${topEmployee.value} cita${topEmployee.value === 1 ? '' : 's'}` : 'Sin datos en el periodo';

    const clientBooked = appts.filter(a => a.createdByClient).length;
    document.getElementById('stats-kpi-client-booked').textContent = clientBooked;
    document.getElementById('stats-kpi-client-booked-sub').textContent =
      appts.length === 0
        ? 'Sin datos en el periodo'
        : `${Math.round((clientBooked / appts.length) * 100)}% del total`;
  },

  renderSection(id) {
    const container = document.getElementById(`stats-${id}-view`);
    const mode = this.viewModes[id] || 'chart';
    const data = this.cache[id];
    if (!data) return;

    if (id === 'timeline') {
      if (data.buckets.every(b => b.value === 0)) {
        container.innerHTML = '<div class="empty-state"><p>No hay citas en este periodo.</p></div>';
        return;
      }
      if (mode === 'table') {
        renderStatsTable(container, ['Periodo', 'Citas'], data.buckets.map(b => [b.label, b.value]));
      } else {
        renderTimelineChart(container, data.buckets);
      }
      return;
    }

    if (data.items.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>No hay datos para este periodo.</p></div>';
      return;
    }
    if (mode === 'table') {
      renderStatsTable(container, ['Nombre', 'Citas'], data.items.map(i => [i.label, i.value]));
    } else {
      renderRankingChart(container, data.items);
    }
  }
};

function computeRangeForPreset(id) {
  const today = new Date();
  const todayStr = toISODate(today);
  switch (id) {
    case 'today':
      return { start: todayStr, end: todayStr };
    case '7d': {
      const s = new Date(today);
      s.setDate(s.getDate() - 6);
      return { start: toISODate(s), end: todayStr };
    }
    case '30d': {
      const s = new Date(today);
      s.setDate(s.getDate() - 29);
      return { start: toISODate(s), end: todayStr };
    }
    case 'month': {
      const s = new Date(today.getFullYear(), today.getMonth(), 1);
      const e = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return { start: toISODate(s), end: toISODate(e) };
    }
    case 'year': {
      const s = new Date(today.getFullYear(), 0, 1);
      const e = new Date(today.getFullYear(), 11, 31);
      return { start: toISODate(s), end: toISODate(e) };
    }
    default:
      return null;
  }
}

function parseStatsISO(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function daysBetweenStats(start, end) {
  return Math.round((parseStatsISO(end) - parseStatsISO(start)) / 86400000);
}

function formatStatsDate(iso) {
  return parseStatsISO(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

function aggregateByClient(appts) {
  const map = new Map();
  appts.forEach(a => {
    const key = a.clientId || a.name;
    if (!map.has(key)) map.set(key, { label: a.name, value: 0 });
    const entry = map.get(key);
    entry.value += 1;
    entry.label = a.name;
  });
  return [...map.values()].sort((a, b) => b.value - a.value);
}

function aggregateByEmployee(appts, employees) {
  const map = new Map();
  appts.forEach(a => {
    const key = a.employeeId || '__none__';
    if (!map.has(key)) map.set(key, { key, value: 0 });
    map.get(key).value += 1;
  });
  return [...map.values()]
    .map(entry => {
      const employee = employees.find(e => e.id === entry.key);
      return { label: employee ? employee.name : 'Sin asignar', value: entry.value };
    })
    .sort((a, b) => b.value - a.value);
}

function aggregateByService(appts) {
  const map = new Map();
  appts.forEach(a => {
    const raw = (a.notes || '').trim().replace(/\s+/g, ' ');
    const key = raw ? raw.toLowerCase() : '__none__';
    if (!map.has(key)) map.set(key, { label: raw || 'Sin especificar', value: 0 });
    map.get(key).value += 1;
  });
  return [...map.values()].sort((a, b) => b.value - a.value);
}

function capRankedItems(items, max = STATS_MAX_RANKED_ITEMS) {
  if (items.length <= max) return items;
  const top = items.slice(0, max - 1);
  const otherValue = items.slice(max - 1).reduce((sum, i) => sum + i.value, 0);
  top.push({ label: 'Otros', value: otherValue, isOther: true });
  return top;
}

function buildTimelineBuckets(appts, start, end) {
  const span = daysBetweenStats(start, end) + 1;
  let granularity = 'day';
  if (span > 400) granularity = 'year';
  else if (span > 45) granularity = 'month';

  const bucketKeyOf = (dateStr) => {
    if (granularity === 'day') return dateStr;
    if (granularity === 'month') return dateStr.slice(0, 7);
    return dateStr.slice(0, 4);
  };

  const counts = new Map();
  appts.forEach(a => {
    const key = bucketKeyOf(a.date);
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  const buckets = [];

  if (granularity === 'day') {
    const cursor = parseStatsISO(start);
    const endDate = parseStatsISO(end);
    while (cursor <= endDate) {
      const iso = toISODate(cursor);
      buckets.push({
        key: iso,
        label: cursor.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
        value: counts.get(iso) || 0,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
  } else if (granularity === 'month') {
    let y = Number(start.slice(0, 4));
    let m = Number(start.slice(5, 7));
    const endY = Number(end.slice(0, 4));
    const endM = Number(end.slice(5, 7));
    while (y < endY || (y === endY && m <= endM)) {
      const key = `${y}-${String(m).padStart(2, '0')}`;
      buckets.push({
        key,
        label: new Date(y, m - 1, 1).toLocaleDateString('es-ES', { month: 'short', year: '2-digit' }),
        value: counts.get(key) || 0,
      });
      m += 1;
      if (m > 12) { m = 1; y += 1; }
    }
  } else {
    let y = Number(start.slice(0, 4));
    const endY = Number(end.slice(0, 4));
    while (y <= endY) {
      const key = String(y);
      buckets.push({ key, label: key, value: counts.get(key) || 0 });
      y += 1;
    }
  }

  return buckets;
}

function renderRankingChart(containerEl, items) {
  const max = Math.max(1, ...items.map(i => i.value));
  const rowsHtml = items.map((item, idx) => {
    const pct = Math.max(4, Math.round((item.value / max) * 100));
    const color = item.isOther ? 'var(--chart-other)' : `var(--chart-series-${(idx % 8) + 1})`;
    const noun = item.value === 1 ? 'cita' : 'citas';
    return `
      <div class="hbar-row" data-tooltip="${escapeHtml(item.label)}: ${item.value} ${noun}">
        <div class="hbar-label" title="${escapeHtml(item.label)}">${escapeHtml(item.label)}</div>
        <div class="hbar-track">
          <div class="hbar-fill" style="width:${pct}%; background:${color};"></div>
        </div>
        <div class="hbar-value">${item.value}</div>
      </div>`;
  }).join('');
  containerEl.innerHTML = `<div class="hbar-chart">${rowsHtml}</div>`;
}

function initChartTooltip() {
  if (document.getElementById('chart-tooltip')) return;
  const tip = document.createElement('div');
  tip.id = 'chart-tooltip';
  tip.className = 'chart-tooltip hidden';
  document.body.appendChild(tip);

  document.addEventListener('mouseover', (e) => {
    const target = e.target.closest('[data-tooltip]');
    if (!target) return;
    tip.textContent = target.dataset.tooltip;
    tip.classList.remove('hidden');
  });
  document.addEventListener('mousemove', (e) => {
    if (tip.classList.contains('hidden')) return;
    tip.style.left = `${e.clientX}px`;
    tip.style.top = `${e.clientY - 12}px`;
  });
  document.addEventListener('mouseout', (e) => {
    const target = e.target.closest('[data-tooltip]');
    if (!target) return;
    if (e.relatedTarget && target.contains(e.relatedTarget)) return;
    tip.classList.add('hidden');
  });
}

function renderTimelineChart(containerEl, buckets) {
  const max = Math.max(1, ...buckets.map(b => b.value));
  const trackHeight = 100;
  const useFixedCols = buckets.length > 20;
  const showEvery = Math.max(1, Math.ceil(buckets.length / 14));
  const rowClass = useFixedCols ? 'vbar-fixed-cols' : '';

  const tracksHtml = buckets.map(b => {
    const heightPx = b.value === 0 ? 0 : Math.max(3, Math.round((b.value / max) * trackHeight));
    const noun = b.value === 1 ? 'cita' : 'citas';
    return `<div class="vbar-col" data-tooltip="${escapeHtml(b.label)}: ${b.value} ${noun}">
      <div class="vbar-fill" style="height:${heightPx}px"></div>
    </div>`;
  }).join('');

  const labelsHtml = buckets.map((b, idx) => {
    const showLabel = idx % showEvery === 0 || idx === buckets.length - 1;
    return `<div class="vbar-col-label">${showLabel ? escapeHtml(b.label) : ''}</div>`;
  }).join('');

  containerEl.innerHTML = `
    <div class="vbar-chart">
      <div class="vbar-axis"><span class="vbar-axis-max">${max}</span></div>
      <div class="vbar-body">
        <div class="vbar-tracks-row ${rowClass}" style="height:${trackHeight}px">${tracksHtml}</div>
        <div class="vbar-labels-row ${rowClass}">${labelsHtml}</div>
      </div>
    </div>`;
}

function renderStatsTable(containerEl, headers, rows) {
  const theadHtml = `<tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr>`;
  const tbodyHtml = rows.map(r => `<tr>${r.map(c => `<td>${escapeHtml(String(c))}</td>`).join('')}</tr>`).join('');
  containerEl.innerHTML = `<div class="stats-table-wrap"><table class="stats-table"><thead>${theadHtml}</thead><tbody>${tbodyHtml}</tbody></table></div>`;
}
