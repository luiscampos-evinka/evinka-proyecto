import json
import html
from pathlib import Path

ROOT = Path('/root/.openclaw/workspace/apps/overview-app/public')
DATA = json.loads((ROOT / 'data' / 'overview-data.json').read_text(encoding='utf-8'))


def is_test_station(station):
    name = (station.get('name') or '').strip().lower()
    return name.startswith('lab')


FILTERED_STATIONS = [s for s in DATA.get('stations', []) if not is_test_station(s)]
FILTERED_STATION_IDS = {s.get('id') for s in FILTERED_STATIONS}
FILTERED_ALERTS_RAW = [a for a in DATA.get('alerts', []) if not a.get('stationId') or a.get('stationId') in FILTERED_STATION_IDS]
FILTERED_INCIDENTS = [i for i in DATA.get('incidents', []) if not i.get('stationId') or i.get('stationId') in FILTERED_STATION_IDS]
FILTERED_TOTALS = {
    'stations': len(FILTERED_STATIONS),
    'connectors': sum(len(s.get('connectors', [])) for s in FILTERED_STATIONS),
    'available': sum(1 for s in FILTERED_STATIONS if s.get('tone') == 'available'),
    'offline': sum(1 for s in FILTERED_STATIONS if s.get('tone') == 'offline'),
    'charging': sum(1 for s in FILTERED_STATIONS if s.get('tone') == 'charging'),
    'preparing': sum(1 for s in FILTERED_STATIONS if s.get('tone') == 'preparing'),
    'faulted': sum(1 for s in FILTERED_STATIONS if s.get('tone') == 'faulted'),
}


def esc(value=''):
    return html.escape(str(value or ''))


def unique_alerts(alerts):
    seen = set()
    out = []
    for a in alerts or []:
        key = (a.get('title'), a.get('detail'), a.get('stationId'), a.get('connectorId'), a.get('createdLabel'))
        if key in seen:
            continue
        seen.add(key)
        out.append(a)
    return out


def chip(tone, label=None):
    lbl = label or tone or 'Disponible'
    return f'<span class="status-chip {esc(tone or "available")}">{esc(lbl)}</span>'


ASSET_VERSION = '20260425b'

def layout(page_title, active_slug, main_html, extra_head='', extra_script=''):
    pages = [
        ('index.html', 'Resumen'),
        ('ubicaciones.html', 'Ubicaciones'),
        ('incidentes.html', 'Incidentes'),
        ('mapa.html', 'Mapa'),
        ('reportes.html', 'Reportes'),
        ('alertas.html', 'Alertas'),
    ]
    nav = []
    for href, label in pages:
        cls = 'nav-link active' if href == active_slug else 'nav-link'
        nav.append(f'<a class="{cls}" href="./{href}">{label}</a>')

    return f'''<!doctype html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>EVINKA Overview · {esc(page_title)}</title>
  <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
  <meta http-equiv="Pragma" content="no-cache" />
  <meta http-equiv="Expires" content="0" />
  <link rel="icon" type="image/png" href="./assets/favicon.png?v={ASSET_VERSION}" />
  {extra_head}
  <link rel="stylesheet" href="./styles.css?v={ASSET_VERSION}" />
</head>
<body>
  <div class="shell">
    <aside class="sidebar">
      <div>
        <div class="brand-block">
          <div class="brand-title">EVINKA</div>
          <div class="brand-subtitle">Status Center</div>
        </div>
        <nav class="nav">
          {''.join(nav)}
        </nav>
      </div>
      <div class="sidebar-note">
        <div class="small-label">EVINKA</div>
        <strong>Network status</strong>
      </div>
    </aside>

    <main class="main">
      <header class="page-header card">
        <div>
          <div class="eyebrow">EVINKA CONNECT</div>
          <h1>{esc(page_title)}</h1>
        </div>
      </header>

      <section class="status-strip card">
        <div><span>Última actualización</span><strong>{esc(DATA.get('generatedAt'))}</strong></div>
        <div><span>Operador</span><strong>{esc(DATA.get('operator'))}</strong></div>
        <div><span>Refresh</span><strong>{esc(DATA.get('refreshSeconds'))}s</strong></div>
        <div><span>Estado</span><strong>{esc(DATA.get('status'))}</strong></div>
      </section>

      {main_html}
    </main>
  </div>
  {extra_script}
</body>
</html>'''


def metrics_section():
    totals = FILTERED_TOTALS
    cards = [
        ('Estaciones', totals['stations'], 'Red total', ''),
        ('Conectores', totals['connectors'], 'Conectores monitoreados', ''),
        ('Disponibles', totals['available'], 'Listos para operar', 'available'),
        ('Offline', totals['offline'], 'Sin comunicación', 'offline'),
        ('Charging', totals['charging'], 'Sesiones activas', 'charging'),
        ('Preparing', totals['preparing'], 'Transición de carga', 'preparing'),
        ('Faulted', totals['faulted'], 'Requieren atención', 'faulted'),
    ]
    html_cards = ''.join(
        f'<article class="metric-card {esc(tone)}"><div class="metric-label">{esc(label)}</div><div class="metric-value">{esc(value)}</div><div class="metric-hint">{esc(hint)}</div></article>'
        for label, value, hint, tone in cards
    )
    return f'<section class="metrics-grid">{html_cards}</section>'


def quick_health_section():
    alerts = unique_alerts(FILTERED_ALERTS_RAW)
    totals = FILTERED_TOTALS
    cards = [
        ('Salud operativa', f"{totals['offline']} estación(es) offline" if totals['offline'] else 'Sin estaciones caídas', chip('offline' if totals['offline'] else 'available', 'Offline' if totals['offline'] else 'Disponible')),
        ('Alertas activas', f'{len(alerts)} alerta(s) pendientes', chip('faulted' if alerts else 'available', 'Faulted' if alerts else 'Disponible')),
        ('Reporte mensual', f"{len(DATA.get('reports', []))} cortes listos", chip('preparing', 'Preparing')),
    ]
    inner = ''.join(f'<div class="info-card"><div class="small-label">{esc(title)}</div><div class="info-value">{esc(value)}</div>{badge}</div>' for title, value, badge in cards)
    return f'<div class="info-stack">{inner}</div>'


def alerts_cards(limit=None):
    alerts = unique_alerts(FILTERED_ALERTS_RAW)
    if limit:
        alerts = alerts[:limit]
    if not alerts:
        return '<div class="empty">No hay alertas activas.</div>'
    return ''.join(
        f'''<article class="list-card">
          <div class="row-between"><strong>{esc(a.get('title'))}</strong>{chip(a.get('status') or 'faulted', (a.get('status') or 'Faulted').capitalize())}</div>
          <div class="muted">{esc(a.get('detail') or 'Sin detalle')}</div>
          <div class="muted">{esc(a.get('stationId') or '')}{(' · Conector ' + esc(a.get('connectorId'))) if a.get('connectorId') else ''}</div>
          <div class="muted">{esc(a.get('createdLabel') or '')}</div>
        </article>'''
        for a in alerts
    )


def incidents_cards():
    incidents = FILTERED_INCIDENTS
    if not incidents:
        return '<div class="empty">No hay estaciones caídas en este snapshot.</div>'
    return ''.join(
        f'''<article class="list-card">
          <div class="row-between"><strong>{esc(i.get('title'))}</strong>{chip('offline', i.get('status') or 'Offline')}</div>
          <div class="muted">{esc(i.get('location') or '')}</div>
          <div class="muted">Heartbeat: {esc(i.get('heartbeat') or 'Sin dato')}</div>
          <div class="muted">Último boot: {esc(i.get('boot') or 'Sin dato')}</div>
        </article>'''
        for i in incidents
    )


def stations_table():
    rows = []
    for s in FILTERED_STATIONS:
        connectors = ''.join(
            f'<div class="connector-line">{chip(c.get("tone"), f"Conector {c.get("connectorId")} · {c.get("status")}")}<span class="muted-inline">{esc(c.get("errorCode") or "NoError")}</span></div>'
            for c in s.get('connectors', [])
        ) or '<span class="muted">Sin conectores</span>'
        rows.append(f'''<tr>
          <td><strong>{esc(s.get('name'))}</strong><div class="muted">{esc(s.get('id'))} · {esc(s.get('merchantName'))}</div>{chip(s.get('tone'), s.get('summaryStatus'))}</td>
          <td><strong>{esc(s.get('plazaName') or '')}</strong><div class="muted">{esc(s.get('address') or s.get('locationText') or '')}</div></td>
          <td><strong>{esc(s.get('vendor') or 'Sin dato')} {esc(s.get('model') or '')}</strong><div class="muted">FW: {esc(s.get('firmware') or 'Sin dato')}</div></td>
          <td><strong>{esc(s.get('heartbeatLabel') or 'Sin dato')}</strong><div class="muted">{esc(s.get('actualHeartbeatInterval') or '')}</div></td>
          <td>{esc(s.get('bootLabel') or 'Sin dato')}</td>
          <td>{connectors}</td>
        </tr>''')
    return f'''<div class="table-wrap"><table>
      <thead><tr><th>Estación</th><th>Ubicación</th><th>Equipo</th><th>Heartbeat</th><th>Boot</th><th>Conectores</th></tr></thead>
      <tbody>{''.join(rows)}</tbody>
    </table></div>'''


def plazas_grid():
    plazas = DATA.get('plazas', [])
    if not plazas:
        return '<div class="empty">No se encontraron plazas.</div>'
    cards = ''.join(
        f'''<article class="plaza-card">
          <div class="plaza-merchant">{esc(p.get('merchantName') or p.get('merchantId') or 'EVINKA')}</div>
          <h3>{esc(p.get('name') or 'Ubicación')}</h3>
          <div class="muted">{esc(p.get('address') or 'Sin dirección')}</div>
        </article>'''
        for p in plazas
    )
    return f'<section class="plaza-grid">{cards}</section>'


def reports_grid():
    reports = DATA.get('reports', [])
    if not reports:
        return '<div class="empty">No se encontraron estadísticas.</div>'
    return '<section class="reports-grid">' + ''.join(
        f'''<article class="report-card-item">
          <strong>{esc(r.get('idRef'))}</strong>
          <div class="muted">Transacciones: {esc(r.get('transactionCount'))}</div>
          <div class="muted">Energía: {esc(r.get('energyCharged'))} kWh</div>
          <div class="muted">Recaudación: S/ {esc(r.get('feesCollected'))}</div>
          <div class="muted">CO₂ evitado: {esc(r.get('reductionOfCarbonEmissions'))}</div>
        </article>'''
        for r in reports
    ) + '</section>'


def build_pages():
    index_main = metrics_section() + f'''
    <section class="two-col">
      <article class="card"><div class="section-title">Estado rápido</div><p class="section-copy">Resumen general de la red y prioridades inmediatas.</p>{quick_health_section()}</article>
      <article class="card"><div class="section-title row-between"><span>Alertas activas</span><span class="badge">{len(unique_alerts(FILTERED_ALERTS_RAW))}</span></div><p class="section-copy">Vista resumida de alertas pendientes.</p><div class="list-stack">{alerts_cards(limit=4)}</div></article>
    </section>
    '''
    (ROOT / 'index.html').write_text(layout('Resumen', 'index.html', index_main), encoding='utf-8')

    ubic_main = f'''<section class="card"><div class="section-title">Ubicaciones EVINKA</div><p class="section-copy">Listado de plazas con merchant y dirección.</p>{plazas_grid()}</section>'''
    (ROOT / 'ubicaciones.html').write_text(layout('Ubicaciones', 'ubicaciones.html', ubic_main), encoding='utf-8')

    inc_main = f'''
    <section class="two-col">
      <article class="card"><div class="section-title row-between"><span>Estaciones caídas</span><span class="badge">{len(FILTERED_INCIDENTS)}</span></div><p class="section-copy">Equipos sin comunicación o heartbeat atrasado.</p><div class="list-stack">{incidents_cards()}</div></article>
      <article class="card"><div class="section-title row-between"><span>Alertas específicas</span><span class="badge">{len(unique_alerts(FILTERED_ALERTS_RAW))}</span></div><p class="section-copy">Alarmas activas agrupadas por estación.</p><div class="list-stack">{alerts_cards()}</div></article>
    </section>
    <section class="wide-layout">
      <article class="card"><div class="section-title">Cargadores</div><p class="section-copy">Vista operativa por estación y conector.</p>{stations_table()}</article>
      <article class="card narrow"><div class="section-title">Estado rápido</div><p class="section-copy">Salud general de la red y acciones inmediatas.</p>{quick_health_section()}</article>
    </section>
    '''
    (ROOT / 'incidentes.html').write_text(layout('Incidentes', 'incidentes.html', inc_main), encoding='utf-8')

    map_points = [s for s in FILTERED_STATIONS if isinstance(s.get('latitude'), (int, float)) and isinstance(s.get('longitude'), (int, float))]
    totals = FILTERED_TOTALS
    legend_counts = {
        'available': totals.get('available', 0),
        'offline': totals.get('offline', 0),
        'faulted': totals.get('faulted', 0),
        'preparing': totals.get('preparing', 0),
        'charging': totals.get('charging', 0),
    }
    map_locations = ''.join(
        f'''<button type="button" class="map-location-item" data-station-id="{esc(s.get('id'))}">
          <div class="map-location-top"><strong>{esc(s.get('name') or 'Estación')}</strong>{chip(s.get('tone'), s.get('summaryStatus'))}</div>
          <div class="muted">{esc(s.get('plazaName') or '')}</div>
          <div class="muted">{esc(s.get('address') or '')}</div>
        </button>'''
        for s in sorted(map_points, key=lambda item: ((item.get('plazaName') or ''), (item.get('name') or '')))
    )
    map_script = f'''<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
<script>
const stations = {json.dumps(map_points)};
const map = L.map('map', {{ zoomControl: true }}).setView([-12.3, -76.8], 6);
const markersById = new Map();
L.tileLayer('https://{{s}}.tile.openstreetmap.org/{{z}}/{{x}}/{{y}}.png', {{ attribution: '&copy; OpenStreetMap contributors' }}).addTo(map);
const bounds = [];
for (const s of stations) {{
  const color = {{ available:'#25c27b', charging:'#2d6cdf', preparing:'#f0c86f', offline:'#111111', faulted:'#d84c4c' }}[s.tone] || '#98a7ba';
  const marker = L.circleMarker([s.latitude, s.longitude], {{ radius: 9, color, fillColor: color, fillOpacity: .95, weight: 2 }})
    .addTo(map)
    .bindPopup(`<strong>${{s.name || ''}}</strong><br />${{s.plazaName || ''}}<br />${{s.address || ''}}<br />Estado: ${{s.summaryStatus || ''}}`);
  markersById.set(s.id, marker);
  bounds.push([s.latitude, s.longitude]);
}}
if (bounds.length) map.fitBounds(bounds, {{ padding: [24, 24] }});
for (const button of document.querySelectorAll('.map-location-item')) {{
  button.addEventListener('click', () => {{
    const id = button.dataset.stationId;
    const marker = markersById.get(id);
    if (!marker) return;
    const latlng = marker.getLatLng();
    map.flyTo(latlng, 15, {{ duration: 0.8 }});
    marker.openPopup();
    document.querySelectorAll('.map-location-item').forEach(el => el.classList.remove('active'));
    button.classList.add('active');
  }});
}}
</script>'''
    map_main = f'''<section class="card"><div class="section-title">Mapa del Perú</div><p class="section-copy">Todas las estaciones geolocalizadas con su estatus en vivo.</p><div class="map-legend"><div class="legend-item"><span class="legend-dot available"></span><span>Disponibles <strong>{legend_counts['available']}</strong></span></div><div class="legend-item"><span class="legend-dot offline"></span><span>Offline <strong>{legend_counts['offline']}</strong></span></div><div class="legend-item"><span class="legend-dot faulted"></span><span>Fallando <strong>{legend_counts['faulted']}</strong></span></div><div class="legend-item"><span class="legend-dot preparing"></span><span>Preparing <strong>{legend_counts['preparing']}</strong></span></div><div class="legend-item"><span class="legend-dot charging"></span><span>Charging <strong>{legend_counts['charging']}</strong></span></div></div><div id="map"></div></section><section class="card"><div class="section-title">Ubicaciones en mapa</div><p class="section-copy">Haz clic en una ubicación para centrar el mapa en ese cargador.</p><div class="map-location-list">{map_locations}</div></section>'''
    (ROOT / 'mapa.html').write_text(layout('Mapa', 'mapa.html', map_main, extra_head='<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin="" />', extra_script=map_script), encoding='utf-8')

    rep_main = f'''<section class="card"><div class="section-title">Reporte mensual</div><p class="section-copy">Transacciones, energía, recaudación y CO₂ evitado.</p>{reports_grid()}</section>'''
    (ROOT / 'reportes.html').write_text(layout('Reportes', 'reportes.html', rep_main), encoding='utf-8')

    alt_main = f'''
    <section class="two-col">
      <article class="card"><div class="section-title row-between"><span>Alertas activas</span><span class="badge">{len(unique_alerts(FILTERED_ALERTS_RAW))}</span></div><p class="section-copy">Vista resumida de alertas pendientes.</p><div class="list-stack">{alerts_cards()}</div></article>
      <article class="card"><div class="section-title">Alertas WhatsApp</div><p class="section-copy">Controles anti-spam y operación de notificaciones.</p><div class="action-list"><div>Silenciar 24 horas</div><div>Reactivar alertas</div><div>Enviar resumen ahora</div><div>Registrar operador</div></div><ul class="plain-list"><li>Notificar caída de cargador</li><li>Notificar caída del bot/servidor</li><li>Confirmación manual de recibido</li><li>Evitar spam por repetición del mismo incidente</li></ul></article>
    </section>
    '''
    (ROOT / 'alertas.html').write_text(layout('Alertas', 'alertas.html', alt_main), encoding='utf-8')


if __name__ == '__main__':
    build_pages()
    print('pages generated')
