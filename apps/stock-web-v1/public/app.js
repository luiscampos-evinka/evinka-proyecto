const config = window.STOCK_APP_CONFIG || {};
const monthlyDays = Number(config.defaults?.monthlyDays || 30);
const state = {
  inventory: [],
  incoming: [],
  filteredInventory: [],
};

init().catch((error) => {
  console.error(error);
  document.getElementById('alertsList').innerHTML = `<div class="alert-item"><h3>Error cargando datos</h3><p>${escapeHtml(error.message || String(error))}</p></div>`;
});

async function init() {
  applyBranding();
  bindFilters();
  const [inventory, incoming] = await Promise.all([loadInventory(), loadIncoming()]);
  state.inventory = inventory.map(enrichInventoryRow);
  state.incoming = incoming;
  updateModeBadge();
  render();
}

function applyBranding() {
  const title = `${config.company?.name || 'EVINKA'} ${config.company?.productName || 'Stock Center'}`;
  document.title = title;
  document.getElementById('headerSummary').textContent = config.company?.tagline || 'Control operativo de inventario y reabastecimiento';
}

function bindFilters() {
  document.getElementById('searchInput').addEventListener('input', render);
  document.getElementById('statusFilter').addEventListener('change', render);
}

async function loadInventory() {
  if (!config.useDemoData && config.dataSources?.inventoryCsvUrl) {
    const text = await fetchText(config.dataSources.inventoryCsvUrl);
    return parseCsv(text);
  }
  const res = await fetch('./data/demo-inventory.json');
  return res.json();
}

async function loadIncoming() {
  if (!config.useDemoData && config.dataSources?.incomingCsvUrl) {
    const text = await fetchText(config.dataSources.incomingCsvUrl);
    return parseCsv(text);
  }
  const res = await fetch('./data/demo-incoming.json');
  return res.json();
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No pude leer ${url}`);
  return res.text();
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = splitCsvLine(lines.shift()).map((value) => normalizeKey(value));
  return lines.map((line) => {
    const values = splitCsvLine(line);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? '';
    });
    return row;
  });
}

function splitCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function normalizeKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function enrichInventoryRow(row) {
  const stockActual = toNumber(row.stock_actual);
  const stockComprometido = toNumber(row.stock_comprometido);
  const stockSeguridad = toNumber(row.stock_seguridad) || Math.ceil((toNumber(row.demanda_mensual) || 0) * (config.defaults?.fallbackSafetyMultiplier || 1.5));
  const demandaMensual = toNumber(row.demanda_mensual);
  const leadTimeDias = toNumber(row.lead_time_dias);
  const disponible = stockActual - stockComprometido;
  const demandaDiaria = demandaMensual / monthlyDays;
  const puntoReorden = Math.ceil((demandaDiaria * leadTimeDias) + stockSeguridad);
  const diasCobertura = demandaDiaria > 0 ? disponible / demandaDiaria : 999;
  const status = disponible <= stockSeguridad ? 'critical' : disponible <= puntoReorden ? 'warning' : 'healthy';
  return {
    ...row,
    stockActual,
    stockComprometido,
    stockSeguridad,
    demandaMensual,
    leadTimeDias,
    disponible,
    demandaDiaria,
    puntoReorden,
    diasCobertura,
    status,
  };
}

function render() {
  const search = document.getElementById('searchInput').value.trim().toLowerCase();
  const statusFilter = document.getElementById('statusFilter').value;
  state.filteredInventory = state.inventory.filter((item) => {
    const matchesSearch = !search || [item.sku, item.producto, item.categoria].join(' ').toLowerCase().includes(search);
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });
  renderMetrics();
  renderAlerts();
  renderIncoming();
  renderInventoryTable();
}

function renderMetrics() {
  const totalDisponible = sumBy(state.filteredInventory, 'disponible');
  const totalComprometido = sumBy(state.filteredInventory, 'stockComprometido');
  const criticalCount = state.filteredInventory.filter((item) => item.status === 'critical').length;
  const warningCount = state.filteredInventory.filter((item) => item.status === 'warning').length;
  const incomingUnits = state.incoming.reduce((acc, item) => acc + toNumber(item.cantidad), 0);
  const cards = [
    { label: 'Stock disponible', value: formatNumber(totalDisponible), note: 'Unidades libres hoy' },
    { label: 'Stock comprometido', value: formatNumber(totalComprometido), note: 'Pedidos ya tomados' },
    { label: 'Ítems críticos', value: formatNumber(criticalCount), note: 'Debajo del stock de seguridad' },
    { label: 'Por llegar', value: formatNumber(incomingUnits), note: `${warningCount} ítems en riesgo` },
  ];
  document.getElementById('metricsGrid').innerHTML = cards.map((card) => `
    <article class="card metric-card">
      <strong>${escapeHtml(card.label)}</strong>
      <span>${escapeHtml(card.value)}</span>
      <small>${escapeHtml(card.note)}</small>
    </article>
  `).join('');
}

function renderAlerts() {
  const alertItems = state.inventory
    .filter((item) => item.status !== 'healthy')
    .sort((a, b) => a.diasCobertura - b.diasCobertura)
    .slice(0, 6);
  document.getElementById('alertsCount').textContent = String(alertItems.length);
  document.getElementById('alertsList').innerHTML = alertItems.length ? alertItems.map((item) => {
    const nextIncoming = findNextIncoming(item.sku);
    const urgency = item.status === 'critical' ? 'Acción inmediata' : 'Monitorear reposición';
    const incomingText = nextIncoming
      ? `Próximo ingreso: ${formatDate(nextIncoming.fecha_estimada)} · ${formatNumber(toNumber(nextIncoming.cantidad))} und.`
      : 'Sin embarque registrado.';
    return `
      <div class="alert-item">
        <h3>${escapeHtml(item.producto)} <span class="pill ${item.status}">${labelStatus(item.status)}</span></h3>
        <p>${urgency}. Disponible ${formatNumber(item.disponible)} und, seguridad ${formatNumber(item.stockSeguridad)} und, cobertura ${formatDays(item.diasCobertura)}.</p>
        <p>${incomingText}</p>
      </div>
    `;
  }).join('') : '<div class="alert-item"><h3>Sin alertas por ahora</h3><p>Todos los SKUs filtrados están por encima del punto de reorden.</p></div>';
}

function renderIncoming() {
  const items = [...state.incoming].sort((a, b) => String(a.fecha_estimada).localeCompare(String(b.fecha_estimada))).slice(0, 6);
  document.getElementById('incomingCount').textContent = String(items.length);
  document.getElementById('incomingList').innerHTML = items.length ? items.map((item) => `
    <div class="incoming-item">
      <h3>${escapeHtml(item.producto)}</h3>
      <p>${formatNumber(toNumber(item.cantidad))} und · ${escapeHtml(item.estado || 'Pendiente')} · ${escapeHtml(item.proveedor || 'Proveedor') }</p>
      <p>Llegada estimada: ${formatDate(item.fecha_estimada)}</p>
    </div>
  `).join('') : '<div class="incoming-item"><h3>Sin embarques registrados</h3><p>Aquí aparecerán las órdenes de compra en tránsito.</p></div>';
}

function renderInventoryTable() {
  const tbody = document.getElementById('inventoryTable');
  tbody.innerHTML = state.filteredInventory.map((item) => `
    <tr>
      <td>${escapeHtml(item.sku)}</td>
      <td><strong>${escapeHtml(item.producto)}</strong><br><span class="muted">${escapeHtml(item.categoria || '-')}</span></td>
      <td>${formatNumber(item.disponible)}</td>
      <td>${formatNumber(item.stockSeguridad)}</td>
      <td>${formatNumber(item.demandaMensual)}</td>
      <td>${formatNumber(item.leadTimeDias)} días</td>
      <td>${formatNumber(item.puntoReorden)}</td>
      <td>${formatDays(item.diasCobertura)}</td>
      <td><span class="pill ${item.status}">${labelStatus(item.status)}</span></td>
    </tr>
  `).join('');
}

function updateModeBadge() {
  document.getElementById('dataModeBadge').textContent = config.useDemoData ? 'Demo' : 'Sheets';
}

function findNextIncoming(sku) {
  return state.incoming
    .filter((item) => String(item.sku) === String(sku))
    .sort((a, b) => String(a.fecha_estimada).localeCompare(String(b.fecha_estimada)))[0] || null;
}

function labelStatus(status) {
  return status === 'critical' ? 'Crítico' : status === 'warning' ? 'En riesgo' : 'Saludable';
}

function toNumber(value) {
  const normalized = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(normalized) ? normalized : 0;
}

function sumBy(rows, key) {
  return rows.reduce((acc, item) => acc + toNumber(item[key]), 0);
}

function formatNumber(value) {
  return new Intl.NumberFormat('es-PE').format(Math.round(value || 0));
}

function formatDays(value) {
  if (!Number.isFinite(value)) return '—';
  return `${Math.max(0, value).toFixed(1)} días`;
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
