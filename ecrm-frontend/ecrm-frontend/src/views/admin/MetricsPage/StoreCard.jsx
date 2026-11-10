import React from 'react';
import { Activity, AlertTriangle, ArrowUpRight, Clock, Code, ShieldAlert, ShieldCheck } from 'lucide-react';
import { LEVEL_STYLE } from './metricsLogic';
import { getPlanBadgeStyle, getStatusBadgeStyle } from './badgeStyles';

// Tarjeta de una tienda monitoreada
const StoreCard = ({ store, navigate, onResolveStore, onShowJson }) => {
  const lv = LEVEL_STYLE[store.urgency.level];
  const isUrgent = store.urgency.level !== 'OK';
  return (
    <div
      onClick={() => navigate(`/admin/clientes/${store.id}`)}
      style={{
        backgroundColor: '#ffffff',
        borderRadius: '10px',
        border: isUrgent ? `2px solid ${lv.border}` : '1px solid #e5e7eb',
        padding: isUrgent ? '15px' : '16px',
        cursor: 'pointer',
        transition: 'all 0.15s ease-in-out',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = isUrgent ? lv.border : '#111827'; e.currentTarget.style.boxShadow = '0 6px 12px rgba(0,0,0,0.08)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = isUrgent ? lv.border : '#e5e7eb'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'; }}
    >
      {/* BANNER DE URGENCIA: motivos por los que esta tienda va primero */}
      {isUrgent && (
        <div style={{ backgroundColor: lv.bg, border: `1px solid ${lv.border}`, borderRadius: '8px', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '10px', fontWeight: '900', color: lv.text, letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <AlertTriangle size={12} color={lv.border} /> {lv.label}
          </span>
          {store.urgency.reasons.slice(0, 3).map((r, i) => (
            <span key={i} style={{ fontSize: '11px', color: r.level === 'CRITICAL' ? '#991b1b' : '#92400e', lineHeight: '1.35' }}>
              <strong>{r.source === 'IA' ? 'IA: ' : ''}</strong>{r.text}
            </span>
          ))}
          {store.urgency.reasons.length > 3 && (
            <span style={{ fontSize: '10px', color: '#6b7280' }}>+{store.urgency.reasons.length - 3} motivo(s) más</span>
          )}
          {store.urgency.ai_alerts > 0 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onResolveStore(store.id); }}
              style={{ alignSelf: 'flex-start', marginTop: '2px', fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '4px', border: '1px solid #d1d5db', backgroundColor: '#ffffff', color: '#374151', cursor: 'pointer' }}
            >
              ✓ Marcar alertas IA como atendidas
            </button>
          )}
        </div>
      )}

      {/* Alertas corregidas: el último escaneo ya no empeora respecto al anterior */}
      {store.recoveries.length > 0 && store.urgency.ai_alerts === 0 && (
        <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '6px 10px', fontSize: '11px', color: '#166534' }}>
          ✓ Corregido: el último escaneo mejoró frente al anterior.
        </div>
      )}

      {/* CABECERA DE LA TIENDA */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '70%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '900', color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {store.name}
            </h3>
            <span style={{ fontSize: '9px', fontWeight: '800', padding: '1px 6px', borderRadius: '4px', textTransform: 'uppercase', ...getPlanBadgeStyle(store.plan_type) }}>
              {store.plan_type}
            </span>
          </div>
          {store.web && (
            <span style={{ fontSize: '11px', color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {store.web.replace(/^https?:\/\//, '')}
            </span>
          )}
        </div>

        <div style={getStatusBadgeStyle(store.status)}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: store.status === 'ONLINE' ? '#10b981' : '#ef4444' }} />
          {store.status}
        </div>
      </div>

      {/* BLOQUE 1: MÉTRICAS PURAS DE RED (NÚMEROS NEGROS NEUTROS) */}
      <div style={{ backgroundColor: '#f9fafb', borderRadius: '8px', padding: '10px 12px', border: '1px solid #f3f4f6' }}>
        <div style={{ fontSize: '10px', fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Activity size={12} color="#6b7280" /> Rendimiento de Carga
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
          <div>
            <span style={{ fontSize: '9px', color: '#6b7280', textTransform: 'uppercase', display: 'block', fontWeight: '600' }}>Carga Total</span>
            <span style={{ fontSize: '15px', fontWeight: '900', color: '#111827' }}>
              {store.loadMs ? (store.loadMs / 1000).toFixed(2) + 's' : '--'}
            </span>
          </div>
          <div>
            <span style={{ fontSize: '9px', color: '#6b7280', textTransform: 'uppercase', display: 'block', fontWeight: '600' }}>TTFB</span>
            <span style={{ fontSize: '15px', fontWeight: '900', color: '#111827' }}>
              {store.ttfb ? store.ttfb + 'ms' : '--'}
            </span>
          </div>
          <div>
            <span style={{ fontSize: '9px', color: '#6b7280', textTransform: 'uppercase', display: 'block', fontWeight: '600' }}>RAM Total</span>
            <span style={{ fontSize: '15px', fontWeight: '900', color: '#111827' }}>
              {store.ramTotal ? Math.round(store.ramTotal) + 'MB' : '--'}
            </span>
          </div>
          <div>
            <span style={{ fontSize: '9px', color: '#6b7280', textTransform: 'uppercase', display: 'block', fontWeight: '600' }}>Peso</span>
            <span style={{ fontSize: '13px', fontWeight: '800', color: '#111827' }}>
              {store.totalWeight ? store.totalWeight + 'MB' : '--'}
            </span>
          </div>
          <div>
            <span style={{ fontSize: '9px', color: '#6b7280', textTransform: 'uppercase', display: 'block', fontWeight: '600' }}>Peticiones</span>
            <span style={{ fontSize: '13px', fontWeight: '800', color: '#111827' }}>
              {store.totalRequests ?? '--'}
            </span>
          </div>
          <div>
            <span style={{ fontSize: '9px', color: '#6b7280', textTransform: 'uppercase', display: 'block', fontWeight: '600' }}>DOM Ready</span>
            <span style={{ fontSize: '13px', fontWeight: '800', color: '#111827' }}>
              {store.domMs ? (store.domMs / 1000).toFixed(2) + 's' : '--'}
            </span>
          </div>
        </div>
      </div>

      {/* BLOQUE 2: RADIOGRAFÍA ESTRUCTURAL HTML (NÚMEROS NEUTROS + INDICADORES CON COLOR) */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', padding: '10px 12px', border: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '10px', fontWeight: '800', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Code size={12} color="#4b5563" /> Radiografía DOM & HTML
            <span style={{ fontWeight: '600', color: '#9ca3af', textTransform: 'none', letterSpacing: 0 }}>
              · {store.html_date ? new Date(store.html_date).toLocaleString([], { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '--'}{store.html_is_stale ? ' (no es el último escaneo)' : ''}
            </span>
          </span>

          {/* INDICADOR DE ERRORES CON COLOR */}
          {store.html?.error_elements > 0 ? (
            <span style={{ fontSize: '10px', fontWeight: '800', color: '#991b1b', backgroundColor: '#fef2f2', border: '1px solid #fecaca', padding: '2px 6px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <ShieldAlert size={11} color="#dc2626" /> {store.html.error_elements} error(es)
            </span>
          ) : (
            <span style={{ fontSize: '10px', fontWeight: '700', color: '#166534', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', padding: '2px 6px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <ShieldCheck size={11} color="#16a34a" /> 0 errores
            </span>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', textAlign: 'center', marginBottom: '8px' }}>
          <div style={{ backgroundColor: '#f9fafb', padding: '6px 4px', borderRadius: '6px', border: '1px solid #f3f4f6' }}>
            <span style={{ fontSize: '8px', color: '#6b7280', textTransform: 'uppercase', display: 'block', fontWeight: '700' }}>Nodos DOM</span>
            <span style={{ fontSize: '13px', fontWeight: '900', color: '#111827' }}>
              {store.html?.total_dom_nodes ? Number(store.html.total_dom_nodes).toLocaleString() : '--'}
            </span>
          </div>

          <div style={{ backgroundColor: '#f9fafb', padding: '6px 4px', borderRadius: '6px', border: '1px solid #f3f4f6' }}>
            <span style={{ fontSize: '8px', color: '#6b7280', textTransform: 'uppercase', display: 'block', fontWeight: '700' }}>Scripts</span>
            <span style={{ fontSize: '13px', fontWeight: '900', color: '#111827' }}>
              {store.html?.total_scripts ?? '--'}
            </span>
          </div>

          <div style={{ backgroundColor: '#f9fafb', padding: '6px 4px', borderRadius: '6px', border: '1px solid #f3f4f6' }}>
            <span style={{ fontSize: '8px', color: '#6b7280', textTransform: 'uppercase', display: 'block', fontWeight: '700' }}>Iframes</span>
            <span style={{ fontSize: '13px', fontWeight: '900', color: '#111827' }}>
              {store.html?.total_iframes ?? '--'}
            </span>
          </div>
        </div>

        {/* DOMINIOS EXTERNOS (CHIPS CON COLOR AZUL SUTIL) */}
        <div style={{ marginTop: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{ fontSize: '10px', color: '#6b7280', fontWeight: '600' }}>Dominios externos:</span>
            <span style={{ fontSize: '10px', fontWeight: '800', color: '#2563eb' }}>
              {store.html?.external_domains?.length || 0} detectados
            </span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxHeight: '42px', overflowY: 'hidden' }}>
            {store.html?.external_domains && store.html.external_domains.length > 0 ? (
              store.html.external_domains.slice(0, 3).map((dom, i) => (
                <span key={i} style={{ fontSize: '9px', fontWeight: '600', padding: '2px 6px', backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #dbeafe', borderRadius: '4px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: '130px' }}>
                  {dom}
                </span>
              ))
            ) : (
              <span style={{ fontSize: '10px', color: '#9ca3af' }}>Origen limpio (sin externos)</span>
            )}
            {store.html?.external_domains?.length > 3 && (
              <span style={{ fontSize: '9px', fontWeight: '700', padding: '2px 5px', backgroundColor: '#f3f4f6', color: '#4b5563', borderRadius: '4px' }}>
                +{store.html.external_domains.length - 3}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* PIE DE TARJETA */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '8px', borderTop: '1px dashed #e5e7eb' }}>
        <span style={{ fontSize: '11px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Clock size={12} color="#9ca3af" /> {new Date(store.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onShowJson({
                store_id: store.id,
                store_name: store.name,
                plan_type: store.plan_type,
                web: store.web,
                scanned_at: store.date,
                urgency: store.urgency,
                metrics: {
                  server_status: store.status,
                  web_flow: store.web_flow,
                  load_ms: store.loadMs,
                  dom_ms: store.domMs,
                  ttfb_ms: store.ttfb,
                  total_weight_mb: store.totalWeight,
                  total_requests: store.totalRequests,
                  ram_core_mb: store.ramCore,
                  ram_total_mb: store.ramTotal
                },
                html_analysis: store.html,
                raw_db_record: store.raw_record
              });
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 8px',
              fontSize: '11px',
              fontWeight: '700',
              backgroundColor: '#f3f4f6',
              color: '#111827',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            <Code size={12} /> JSON
          </button>

          <span style={{ fontSize: '11px', fontWeight: '800', color: '#111827', display: 'flex', alignItems: 'center', gap: '2px' }}>
            Auditoría <ArrowUpRight size={13} />
          </span>
        </div>
      </div>
    </div>
  );
};

export default StoreCard;
