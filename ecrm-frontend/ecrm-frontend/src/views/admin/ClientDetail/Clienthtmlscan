import React, { useMemo, useState } from 'react';

// ============================================================
// Módulo: Radiografía HTML del último escaneo
// Lee metrics[].html_analysis (el JSON que genera HtmlScanner.js)
// y lo compara contra el escaneo anterior que también tuvo radiografía.
// ============================================================

const parseJsonSafe = (raw) => {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return null; }
};

// Una radiografía válida siempre trae "tech". Descarta objetos de diagnóstico antiguos.
const parseHtmlValido = (raw) => {
  const parsed = parseJsonSafe(raw);
  return parsed && typeof parsed === 'object' && parsed.tech ? parsed : null;
};

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

function Tile({ label, value, prev, goodWhenUp = false, danger = false }) {
  const has = isNum(value);
  const hasPrev = isNum(prev);
  const delta = has && hasPrev ? value - prev : null;

  let deltaColor = '#6b7280';
  if (delta) {
    const increased = delta > 0;
    deltaColor = (increased === goodWhenUp) ? '#15803d' : '#b91c1c';
  }

  return (
    <div style={{
      backgroundColor: danger ? '#fef2f2' : '#f9fafb',
      border: `1px solid ${danger ? '#fecaca' : '#f3f4f6'}`,
      borderRadius: '6px', padding: '8px 6px', textAlign: 'center'
    }}>
      <span style={{ fontSize: '9px', color: '#6b7280', textTransform: 'uppercase', display: 'block', fontWeight: '700' }}>{label}</span>
      <span style={{ fontSize: '16px', fontWeight: '900', color: danger ? '#991b1b' : '#111827' }}>
        {has ? value.toLocaleString() : '--'}
      </span>
      {delta !== null && delta !== 0 && (
        <span style={{ display: 'block', fontSize: '10px', fontWeight: '800', color: deltaColor }}>
          {delta > 0 ? '▲' : '▼'} {Math.abs(delta).toLocaleString()}
        </span>
      )}
    </div>
  );
}

function ChipList({ items = [], previous = [], emptyText, max = 12 }) {
  const [expanded, setExpanded] = useState(false);
  const prevSet = useMemo(() => new Set(previous), [previous]);
  const shown = expanded ? items : items.slice(0, max);

  if (items.length === 0) {
    return <span style={{ fontSize: '12px', color: '#9ca3af' }}>{emptyText}</span>;
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', alignItems: 'center' }}>
      {shown.map((item) => {
        const isNew = previous.length > 0 && !prevSet.has(item);
        return (
          <span key={item} style={{
            fontSize: '11px', fontWeight: '600', padding: '2px 7px', borderRadius: '4px',
            backgroundColor: isNew ? '#fef2f2' : '#eff6ff',
            color: isNew ? '#991b1b' : '#1d4ed8',
            border: `1px solid ${isNew ? '#fecaca' : '#dbeafe'}`
          }}>
            {item}{isNew ? ' · NUEVO' : ''}
          </span>
        );
      })}
      {items.length > max && (
        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          style={{ fontSize: '11px', fontWeight: '700', padding: '2px 7px', borderRadius: '4px', border: '1px solid #d1d5db', backgroundColor: '#f3f4f6', cursor: 'pointer' }}
        >
          {expanded ? 'Ver menos' : `+${items.length - max} más`}
        </button>
      )}
    </div>
  );
}

const SectionLabel = ({ children, right }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '14px 0 6px 0' }}>
    <span style={{ fontSize: '11px', fontWeight: '800', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{children}</span>
    {right}
  </div>
);

export default function ClientHtmlScan({ metrics = [] }) {
  const [showJson, setShowJson] = useState(false);

  // metrics llega ordenado de más antiguo a más reciente
  const scans = useMemo(() => (
    metrics
      .map(m => ({ date: m.date || m.created_at, html: parseHtmlValido(m.html_analysis) }))
      .filter(s => s.html)
  ), [metrics]);

  const latest = scans[scans.length - 1];
  const previous = scans[scans.length - 2];

  if (!latest) {
    return (
      <div className="crm-card-paper" style={{ width: '100%', boxSizing: 'border-box' }}>
        <h3 className="crm-section-title" style={{ marginTop: 0 }}>Radiografía HTML del Escaneo</h3>
        <p className="crm-text-muted" style={{ margin: 0 }}>
          Esta tienda aún no tiene una radiografía HTML válida. Se genera con el escaneo de las 9 AM o con un análisis individual.
        </p>
      </div>
    );
  }

  const h = latest.html;
  const p = previous ? previous.html : null;
  const scannedAt = latest.date ? new Date(latest.date).toLocaleString() : '--';

  return (
    <div className="crm-card-paper" style={{ width: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px', marginBottom: '4px' }}>
        <div>
          <h3 className="crm-section-title" style={{ marginTop: 0, marginBottom: '2px' }}>Radiografía HTML del Escaneo</h3>
          <span style={{ fontSize: '11px', color: '#6b7280' }}>
            Capturada: {scannedAt}{previous ? ' · comparada con el escaneo anterior' : ' · sin escaneo previo para comparar'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', fontWeight: '800', padding: '3px 8px', borderRadius: '4px', backgroundColor: '#111', color: '#FFD700', textTransform: 'uppercase' }}>
            {h.tech}
          </span>
          {h.theme && (
            <span style={{ fontSize: '11px', fontWeight: '700', padding: '3px 8px', borderRadius: '4px', backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb' }}>
              Tema: {h.theme}
            </span>
          )}
          {h.http_status && (
            <span style={{
              fontSize: '11px', fontWeight: '700', padding: '3px 8px', borderRadius: '4px',
              backgroundColor: h.http_status >= 400 ? '#fef2f2' : '#f0fdf4',
              color: h.http_status >= 400 ? '#991b1b' : '#166534',
              border: `1px solid ${h.http_status >= 400 ? '#fecaca' : '#bbf7d0'}`
            }}>
              HTTP {h.http_status}
            </span>
          )}
        </div>
      </div>

      {h.blocked_suspect && (
        <div style={{ margin: '10px 0', padding: '8px 10px', backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px', fontSize: '12px', color: '#92400e' }}>
          Posible bloqueo WAF o captcha{h.page_title ? ` (título: "${h.page_title}")` : ''}. La medición puede no reflejar la tienda real.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(105px, 1fr))', gap: '8px', marginTop: '12px' }}>
        <Tile label="Nodos DOM" value={h.total_dom_nodes} prev={p?.total_dom_nodes} />
        <Tile label="Scripts" value={h.total_scripts} prev={p?.total_scripts} />
        <Tile label="Scripts inline" value={h.inline_scripts} prev={p?.inline_scripts} />
        <Tile label="Bloqueantes" value={h.blocking_scripts} prev={p?.blocking_scripts} />
        <Tile label="Hojas de estilo" value={h.stylesheets} prev={p?.stylesheets} />
        <Tile label="Iframes" value={h.total_iframes} prev={p?.total_iframes} />
        <Tile label="Imágenes" value={h.images_total} prev={p?.images_total} />
        <Tile label="Imágenes lazy" value={h.images_lazy} prev={p?.images_lazy} goodWhenUp />
        <Tile label="Elementos de error" value={h.error_elements} prev={p?.error_elements} danger={h.error_elements > 0} />
      </div>

      <SectionLabel right={<span style={{ fontSize: '11px', fontWeight: '800', color: '#2563eb' }}>{(h.external_domains || []).length} detectados</span>}>
        Dominios externos
      </SectionLabel>
      <ChipList
        items={h.external_domains || []}
        previous={p?.external_domains || []}
        emptyText="Origen limpio (sin dominios externos)"
      />

      {h.tech === 'woocommerce' && (
        <>
          <SectionLabel right={<span style={{ fontSize: '11px', fontWeight: '800', color: '#6b7280' }}>{(h.plugins || []).length} detectados</span>}>
            Plugins con recursos en el front
          </SectionLabel>
          <ChipList items={h.plugins || []} previous={p?.plugins || []} emptyText="Sin plugins detectados" />
        </>
      )}

      {(h.tech === 'shopify' || h.tech === 'vtex') && (
        <>
          <SectionLabel right={<span style={{ fontSize: '11px', fontWeight: '800', color: '#6b7280' }}>{(h.apps || []).length} detectadas</span>}>
            Apps instaladas
          </SectionLabel>
          <ChipList items={h.apps || []} previous={p?.apps || []} emptyText="Sin apps detectadas" />
        </>
      )}

      <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px dashed #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '11px', color: '#6b7280' }}>
          Los elementos marcados "NUEVO" no estaban en el escaneo anterior.
        </span>
        <button
          type="button"
          onClick={() => setShowJson(s => !s)}
          className="crm-btn-border"
          style={{ padding: '3px 10px', fontSize: '11px' }}
        >
          {showJson ? 'Ocultar JSON' : 'Ver JSON'}
        </button>
      </div>

      {showJson && (
        <pre style={{ marginTop: '10px', marginBottom: 0, backgroundColor: '#0f172a', color: '#38bdf8', fontSize: '11px', padding: '12px', borderRadius: '6px', overflowX: 'auto', maxHeight: '300px' }}>
          <code>{JSON.stringify(h, null, 2)}</code>
        </pre>
      )}
    </div>
  );
}
