import React, { useCallback, useEffect, useState } from 'react';
import crmApi from '../../api/crmApi';

// Productividad del equipo (Concorde Tools). Todos los cálculos vienen hechos del backend
// (GET /api/productivity); aquí solo se muestran.

const COLOR_CREADOS = '#2a78d6';
const COLOR_CERRADOS = '#eb6834';
const UNASSIGNED = 'Sin asignar';

const limaToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date());
const shiftDays = (ymd, n) => {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const fmtHours = (h) => {
  if (h === null || h === undefined) return '—';
  if (h < 48) return `${h} h`;
  return `${Math.round((h / 24) * 10) / 10} d`;
};

const card = {
  border: '2px solid #111',
  borderRadius: '6px',
  padding: '16px',
  backgroundColor: '#fff',
  boxShadow: '3px 3px 0px #111',
  minWidth: 0
};
const th = { textAlign: 'left', padding: '6px 8px', borderBottom: '2px solid #111', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' };
const thNum = { ...th, textAlign: 'right' };
const td = { padding: '6px 8px', borderBottom: '1px solid #eee', fontSize: '13px' };
const tdNum = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };
const input = { padding: '6px 8px', border: '2px solid #111', borderRadius: '4px', fontSize: '13px', background: '#fff' };

function Section({ title, hint, children }) {
  return (
    <section style={card}>
      <h2 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: 900 }}>{title}</h2>
      {hint && <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#666' }}>{hint}</p>}
      {children}
    </section>
  );
}

function Table({ columns, rows, empty = 'Sin datos en este período.' }) {
  if (!rows || rows.length === 0) return <p style={{ fontSize: '13px', color: '#666', margin: 0 }}>{empty}</p>;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>{columns.map((c) => <th key={c.key} style={c.num ? thNum : th}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {columns.map((c) => (
                <td key={c.key} style={c.num ? tdNum : td}>{c.render ? c.render(r) : (r[c.key] ?? '—')}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatTile({ label, value, sub }) {
  return (
    <div style={{ ...card, padding: '12px 16px' }}>
      <div style={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#555' }}>{label}</div>
      <div style={{ fontSize: '28px', fontWeight: 900, color: '#111', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {sub && <div style={{ fontSize: '11px', color: '#666' }}>{sub}</div>}
    </div>
  );
}

// Barras agrupadas por día: creados vs resueltos/cerrados, con tooltip al pasar el mouse
function TrendChart({ data }) {
  const [hover, setHover] = useState(null);
  if (!data || data.length === 0) return null;
  const max = Math.max(1, ...data.map((d) => Math.max(d.creados, d.cerrados)));
  const height = 140;
  const legendDot = (color) => ({ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: color, marginRight: 6 });
  const active = hover !== null ? data[hover] : null;

  return (
    <div>
      <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#333', marginBottom: '8px' }}>
        <span><span style={legendDot(COLOR_CREADOS)} />Creados</span>
        <span><span style={legendDot(COLOR_CERRADOS)} />Resueltos/cerrados</span>
        <span style={{ marginLeft: 'auto', color: '#666', minHeight: '16px' }}>
          {active ? `${active.dia}: ${active.creados} creados · ${active.cerrados} resueltos/cerrados` : `Máximo diario: ${max}`}
        </span>
      </div>
      <div
        style={{ display: 'flex', alignItems: 'flex-end', height, borderBottom: '1px solid #bbb', gap: data.length > 60 ? 0 : 2 }}
        onMouseLeave={() => setHover(null)}
      >
        {data.map((d, i) => (
          <div
            key={d.dia}
            onMouseEnter={() => setHover(i)}
            title={`${d.dia}: ${d.creados} creados · ${d.cerrados} resueltos/cerrados`}
            style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 2, background: hover === i ? '#f2f2f2' : 'transparent', minWidth: 0 }}
          >
            {[['creados', COLOR_CREADOS], ['cerrados', COLOR_CERRADOS]].map(([k, color]) => (
              <div
                key={k}
                style={{
                  width: '40%',
                  maxWidth: 10,
                  height: d[k] ? `${Math.max(2, (d[k] / max) * (height - 4))}px` : 0,
                  background: color,
                  borderRadius: '4px 4px 0 0'
                }}
              />
            ))}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#666', marginTop: '4px' }}>
        <span>{data[0].dia}</span>
        <span>{data[data.length - 1].dia}</span>
      </div>
      <details style={{ marginTop: '8px' }}>
        <summary style={{ fontSize: '12px', cursor: 'pointer', color: '#333' }}>Ver como tabla</summary>
        <Table
          columns={[
            { key: 'dia', label: 'Día' },
            { key: 'creados', label: 'Creados', num: true },
            { key: 'cerrados', label: 'Resueltos/cerrados', num: true }
          ]}
          rows={data}
        />
      </details>
    </div>
  );
}

export default function ProductivityView() {
  const [from, setFrom] = useState(() => shiftDays(limaToday(), -29));
  const [to, setTo] = useState(() => limaToday());
  const [assignee, setAssignee] = useState('');
  const [people, setPeople] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    crmApi.get('/users/admins')
      .then((res) => setPeople((res.data?.data || []).map((u) => u.name).filter(Boolean).sort((a, b) => a.localeCompare(b))))
      .catch(() => setPeople([]));
  }, []);

  const fetchReport = useCallback((params) => crmApi.get('/productivity', { params })
    .then((res) => { setData(res.data?.data || null); setError(''); })
    .catch((err) => setError(err.response?.data?.error || 'No se pudo cargar la productividad.'))
    .finally(() => setLoading(false)), []);

  const load = (params) => {
    setLoading(true);
    setError('');
    fetchReport(params);
  };

  // Carga inicial (loading ya empieza en true); luego se recarga con "Aplicar" o los atajos
  useEffect(() => {
    fetchReport({ from: shiftDays(limaToday(), -29), to: limaToday() });
  }, [fetchReport]);

  const apply = (e) => {
    e?.preventDefault();
    load({ from, to, ...(assignee ? { assignee } : {}) });
  };

  const preset = (days) => {
    const end = limaToday();
    const start = shiftDays(end, -(days - 1));
    setFrom(start);
    setTo(end);
    load({ from: start, to: end, ...(assignee ? { assignee } : {}) });
  };

  const r = data?.resumen;

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      <div style={{ marginBottom: '16px' }}>
        <h1 className="crm-main-title" style={{ margin: 0, border: 'none' }}>Productividad del equipo</h1>
        <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#666' }}>
          Tickets resueltos, tiempos, carga y actividad. Días en hora de Lima. No incluye los tickets automáticos de revisión diaria del bot.
        </p>
      </div>

      {/* Filtros en una sola fila */}
      <form onSubmit={apply} style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'flex-end', marginBottom: '20px' }}>
        <label style={{ fontSize: '12px', fontWeight: 700 }}>
          Desde<br /><input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} style={input} />
        </label>
        <label style={{ fontSize: '12px', fontWeight: 700 }}>
          Hasta<br /><input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} style={input} />
        </label>
        <label style={{ fontSize: '12px', fontWeight: 700 }}>
          Responsable<br />
          <select value={assignee} onChange={(e) => setAssignee(e.target.value)} style={{ ...input, minWidth: '180px' }}>
            <option value="">Todo el equipo</option>
            {people.map((p) => <option key={p} value={p}>{p}</option>)}
            <option value={UNASSIGNED}>{UNASSIGNED}</option>
          </select>
        </label>
        <button type="submit" disabled={loading} style={{ ...input, background: '#111', color: '#FFD700', fontWeight: 900, cursor: 'pointer' }}>
          {loading ? 'Cargando…' : 'Aplicar'}
        </button>
        <div style={{ display: 'flex', gap: '6px' }}>
          {[7, 30, 90].map((d) => (
            <button key={d} type="button" onClick={() => preset(d)} disabled={loading} style={{ ...input, cursor: 'pointer', fontWeight: 700 }}>
              {d} días
            </button>
          ))}
        </div>
      </form>

      {error && (
        <div style={{ ...card, borderColor: '#b00020', boxShadow: '3px 3px 0px #b00020', color: '#b00020', marginBottom: '16px', fontSize: '13px' }}>
          {error}
        </div>
      )}

      {data && (
        <div style={{ display: 'grid', gap: '20px', opacity: loading ? 0.6 : 1 }}>
          {data.warnings?.length > 0 && (
            <div style={{ ...card, fontSize: '12px', color: '#7a5600' }}>
              Algunas secciones no se pudieron calcular: {data.warnings.join(' · ')}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
            <StatTile label="Creados" value={r.creados} sub={`${data.filtros.from} → ${data.filtros.to}`} />
            <StatTile label="Resueltos/cerrados" value={r.resueltos} sub="cerrados en el período" />
            <StatTile label="Tiempo promedio" value={fmtHours(r.horas_promedio)} sub="de creación a cierre" />
            <StatTile label="Pendientes hoy" value={r.pendientes} sub="abiertos o en progreso" />
          </div>

          <Section title="Creados vs resueltos por día">
            <TrendChart data={data.tendencia} />
          </Section>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '20px' }}>
            <Section title="Resueltos por responsable" hint="Un ticket con varios responsables cuenta para cada uno.">
              <Table
                columns={[
                  { key: 'responsable', label: 'Responsable' },
                  { key: 'resueltos', label: 'Resueltos', num: true },
                  { key: 'cerrados', label: 'De ellos cerrados', num: true },
                  { key: 'horas_promedio', label: 'Promedio', num: true, render: (x) => fmtHours(x.horas_promedio) },
                  { key: 'horas_mediana', label: 'Mediana', num: true, render: (x) => fmtHours(x.horas_mediana) }
                ]}
                rows={data.resueltos}
              />
            </Section>

            <Section title="Carga actual" hint="Foto de hoy: no depende del rango de fechas.">
              <Table
                columns={[
                  { key: 'responsable', label: 'Responsable' },
                  { key: 'pendientes', label: 'Pendientes', num: true },
                  { key: 'en_progreso', label: 'En progreso', num: true },
                  { key: 'alta_prioridad', label: 'Alta/crítica', num: true },
                  { key: 'dias_mas_antiguo', label: 'Más antiguo', num: true, render: (x) => `${x.dias_mas_antiguo} d` }
                ]}
                rows={data.carga}
                empty="Nadie tiene tickets pendientes."
              />
            </Section>

            <Section title="Por tienda" hint="Creados y cerrados en el período; activos hoy.">
              <Table
                columns={[
                  { key: 'store_id', label: 'Tienda' },
                  { key: 'creados', label: 'Creados', num: true },
                  { key: 'cerrados', label: 'Cerrados', num: true },
                  { key: 'activos', label: 'Activos', num: true }
                ]}
                rows={data.tiendas}
              />
            </Section>

            <Section title="Revisiones diarias" hint="Verificaciones de tiendas registradas por cada revisor.">
              {data.revisiones === null ? <p style={{ fontSize: '13px', color: '#666', margin: 0 }}>No disponible.</p> : (
                <Table
                  columns={[
                    { key: 'revisor', label: 'Revisor' },
                    { key: 'revisiones', label: 'Revisiones', num: true },
                    { key: 'tiendas', label: 'Tiendas', num: true },
                    { key: 'dias', label: 'Días', num: true }
                  ]}
                  rows={data.revisiones}
                />
              )}
            </Section>

            <Section title="Actividad en el CRM" hint="Acciones registradas en la auditoría (top 5 por usuario).">
              {data.actividad === null ? <p style={{ fontSize: '13px', color: '#666', margin: 0 }}>No disponible.</p> : (
                <Table
                  columns={[
                    { key: 'usuario', label: 'Usuario' },
                    { key: 'total', label: 'Acciones', num: true },
                    { key: 'acciones', label: 'Más frecuentes', render: (x) => x.acciones.map((a) => `${a.accion} (${a.n})`).join(', ') }
                  ]}
                  rows={data.actividad}
                />
              )}
            </Section>
          </div>
        </div>
      )}
    </div>
  );
}
