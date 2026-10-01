import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import Chart from 'chart.js/auto';

function AnalisisReportGenerator() {
  const [storeName, setStoreName] = useState('CLIENTE / TIENDA');
  const [period, setPeriod] = useState('AGOSTO 2026');
  
  const filesRef = {
    sessions: useRef(null),
    general: useRef(null),
    channels: useRef(null),
    devices: useRef(null),
    countries: useRef(null),
    cities: useRef(null),
    pages: useRef(null),
    campaigns: useRef(null),
    utms: useRef(null),
  };

  const chartsRef = useRef({});

  const cleanNum = (v) => parseFloat(String(v).replace(/[^\d.-]/g, '')) || 0;
  const fmtN = (v) => new Intl.NumberFormat('es-ES').format(Math.round(v));
  const fmtPct = (v) => (v * 100).toFixed(2).replace('.', ',') + '%';
  const txt = (v) => (!v || String(v).trim() === '') ? 'No identificado' : String(v).trim();
  const dateFmt = (d) => {
    const p = String(d).split('-');
    return p.length === 3 ? `${p[2]} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][parseInt(p[1])-1]}` : d;
  };

  const dict = { 'mobile': 'Móvil (Mobile)', 'desktop': 'Escritorio (Desktop)', 'tablet': 'Tablet', 'other': 'Otro' };
  const trans = (s) => dict[String(s).toLowerCase()] || txt(s);

  const parseCSV = (file) => {
    return new Promise(res => {
      Papa.parse(file, {
        header: false,
        skipEmptyLines: 'greedy',
        complete: c => {
          let d = c.data;
          if (d.length > 0) d.shift();
          res(d);
        }
      });
    });
  };

  const buildReport = async () => {
    const f = (key) => filesRef[key].current?.files[0];

    if (f('sessions')) doSesDia(await parseCSV(f('sessions')));
    if (f('general')) doMetricas(await parseCSV(f('general')));
    if (f('channels')) doCanales(await parseCSV(f('channels')));
    if (f('devices')) doDisp(await parseCSV(f('devices')));
    if (f('countries')) doDemog(await parseCSV(f('countries')), 'tb-pais');
    if (f('cities')) doDemog(await parseCSV(f('cities')), 'tb-ciudad');
    if (f('pages')) doPaginas(await parseCSV(f('pages')));
    if (f('campaigns')) doUTM(await parseCSV(f('campaigns')), 'tb-camp');
    if (f('utms')) doUTM(await parseCSV(f('utms')), 'tb-utm');

    alert("¡Reporte generado con éxito!");
  };

  const doSesDia = (data) => {
    let t = 0, mx = -1, mn = Infinity, dMx = '', dMn = '', lb = [], vl = [];
    data.forEach(r => {
      if (r.length < 2) return;
      let v = cleanNum(r[1]), d = r[0];
      lb.push(dateFmt(d)); vl.push(v); t += v;
      if (v > mx) { mx = v; dMx = d; }
      if (v < mn) { mn = v; dMn = d; }
    });

    let avg = (t / (data.length || 1));
    document.getElementById('t-total').innerText = fmtN(t);
    document.getElementById('t-avg').innerText = avg.toFixed(1).replace('.', ',');
    document.getElementById('t-max').innerText = `${dateFmt(dMx)} (${fmtN(mx)} sesiones)`;
    document.getElementById('t-min').innerText = `${dateFmt(dMn)} (${fmtN(mn)} sesiones)`;

    drawSessionsChart('c-sesiones', lb, vl, avg, mx, mn, period);
  };

  const doMetricas = (data) => {
    let tSes = 0, tVis = 0, tVist = 0, tDurPnd = 0;
    data.forEach(r => {
      if (r.length < 5) return;
      let s = cleanNum(r[1]);
      tSes += s; tVis += cleanNum(r[2]); tVist += cleanNum(r[3]); tDurPnd += (cleanNum(r[4]) * s);
    });
    let avgD = tSes > 0 ? (tDurPnd / tSes) : 0;
    let tb = document.getElementById('tb-metricas');
    tb.innerHTML = `
      <tr><td>Sesiones Totales</td><td style="text-align: right; font-weight: bold;">${fmtN(tSes)}</td></tr>
      <tr><td>Visitantes de la tienda online</td><td style="text-align: right; font-weight: bold;">${fmtN(tVis)}</td></tr>
      <tr><td>Vistas de página</td><td style="text-align: right; font-weight: bold;">${fmtN(tVist)}</td></tr>
      <tr><td>Duración media de la sesión</td><td style="text-align: right; font-weight: bold;">${avgD.toFixed(2).replace('.', ',')} s (${Math.floor(avgD/60)} min ${Math.floor(avgD%60)} s)</td></tr>
    `;
  };

  const doCanales = (data) => {
    let tot = data.reduce((a, r) => a + cleanNum(r[1]), 0), lb = [], vl = [], tb = document.getElementById('tb-canales');
    tb.innerHTML = '';
    data.forEach(r => {
      if (r.length < 4) return;
      let c = txt(r[0]), s = cleanNum(r[1]), reb = cleanNum(r[3]);
      lb.push(c); vl.push(s);
      tb.innerHTML += `<tr><td>${c}</td><td style="text-align: right; font-weight: bold;">${fmtN(s)}</td><td style="text-align: right; font-weight: bold;">${fmtN(cleanNum(r[2]))}</td><td style="text-align: right; font-weight: bold;">${fmtPct(reb<=1?reb:reb/100)}</td><td style="text-align: right; font-weight: bold;">${tot?fmtPct(s/tot):'0%'}</td></tr>`;
    });
    drawGeneral('c-canales', 'pie', lb, vl, '');
  };

  const doDisp = (data) => {
    let tot = data.reduce((a, r) => a + cleanNum(r[1]), 0), lb = [], vl = [], tb = document.getElementById('tb-disp');
    tb.innerHTML = '';
    data.forEach(r => {
      if (r.length < 2) return;
      let d = trans(r[0]), s = cleanNum(r[1]);
      lb.push(d); vl.push(s);
      tb.innerHTML += `<tr><td>${d}</td><td style="text-align: right; font-weight: bold;">${fmtN(s)}</td><td style="text-align: right; font-weight: bold;">${tot?fmtPct(s/tot):'0%'}</td></tr>`;
    });
    drawGeneral('c-disp', 'doughnut', lb, vl, '');
  };

  const doDemog = (data, id) => {
    let tot = data.reduce((a, r) => a + cleanNum(r[1]), 0), tb = document.getElementById(id);
    tb.innerHTML = '';
    data.slice(0, 10).forEach(r => {
      if (r.length < 2) return;
      let s = cleanNum(r[1]);
      tb.innerHTML += `<tr><td>${txt(r[0])}</td><td style="text-align: right; font-weight: bold;">${fmtN(s)}</td><td style="text-align: right; font-weight: bold;">${tot?fmtPct(s/tot):'0%'}</td></tr>`;
    });
  };

  const doPaginas = (data) => {
    let tot = data.reduce((a, r) => a + cleanNum(r[1]), 0), lb = [], vl = [], tb = document.getElementById('tb-paginas');
    tb.innerHTML = '';
    data.slice(0, 10).forEach(r => {
      if (r.length < 2) return;
      let p = r[0], s = cleanNum(r[1]);
      lb.push(p.length > 18 ? p.substring(0, 18) + '...' : p);
      vl.push(s);
      let tableText = p.length > 50 ? p.substring(0, 50) + '...' : p;
      tb.innerHTML += `<tr><td style="word-break: break-all; font-weight: bold;">${tableText}</td><td style="text-align: right; font-weight: bold;">${fmtN(s)}</td><td style="text-align: right; font-weight: bold;">${tot?fmtPct(s/tot):'0%'}</td></tr>`;
    });
    drawGeneral('c-paginas', 'bar', lb, vl, 'Vistas');
  };

  const doUTM = (data, id) => {
    let tot = data.reduce((a, r) => a + cleanNum(r[1]), 0), tb = document.getElementById(id);
    tb.innerHTML = '';
    data.slice(0, 10).forEach(r => {
      if (r.length < 2) return;
      let s = cleanNum(r[1]);
      tb.innerHTML += `<tr><td>${txt(r[0])}</td><td style="text-align: right; font-weight: bold;">${fmtN(s)}</td><td style="text-align: right; font-weight: bold;">${tot?fmtPct(s/tot):'0%'}</td></tr>`;
    });
  };

  const drawSessionsChart = (id, lb, dt, avg, mx, mn, periodStr) => {
    if (chartsRef.current[id]) chartsRef.current[id].destroy();
    const canvas = document.getElementById(id);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const pointColors = dt.map(v => {
      if (v === mx) return '#d62728';
      if (v === mn) return '#2ca02c';
      return '#1f77b4';
    });

    const pointSizes = dt.map(v => (v === mx || v === mn) ? 6 : 4);
    const avgData = Array(dt.length).fill(avg);

    chartsRef.current[id] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: lb,
        datasets: [
          {
            label: 'Sesiones',
            data: dt,
            borderColor: '#1f77b4',
            backgroundColor: 'rgba(31, 119, 180, 0.15)',
            fill: true,
            tension: 0,
            pointBackgroundColor: pointColors,
            pointBorderColor: pointColors,
            pointRadius: pointSizes,
            borderWidth: 2
          },
          { label: `Máximo (${fmtN(mx)})`, data: [], backgroundColor: '#d62728', borderColor: '#d62728', pointStyle: 'circle' },
          { label: `Mínimo (${fmtN(mn)})`, data: [], backgroundColor: '#2ca02c', borderColor: '#2ca02c', pointStyle: 'circle' },
          { label: `Promedio (${Math.round(avg)})`, data: avgData, borderColor: '#ff7f0e', borderWidth: 1.5, borderDash: [4, 4], fill: false, pointRadius: 0 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 15, bottom: 20, left: 10, right: 15 } },
        plugins: {
          title: { display: true, text: `Sesiones Diarias (${periodStr})`, font: { size: 12, weight: 'bold' }, color: '#333' },
          legend: { display: true, position: 'top', align: 'end', labels: { boxWidth: 12, font: { size: 10 }, usePointStyle: true } }
        },
        scales: {
          x: { grid: { display: false }, ticks: { maxRotation: 45, minRotation: 45, font: { size: 9 }, color: '#555' } },
          y: { beginAtZero: true, suggestedMax: Math.ceil(mx / 100) * 100 + 100, grid: { color: '#e5e5e5' }, ticks: { font: { size: 10 }, color: '#555' } }
        }
      }
    });
  };

  const drawGeneral = (id, typ, lb, dt, tit) => {
    if (chartsRef.current[id]) chartsRef.current[id].destroy();
    const canvas = document.getElementById(id);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const clr = ['#000000', '#2563eb', '#16a34a', '#d97706', '#dc2626', '#4b5563', '#9ca3af', '#6b7280', '#1f2937', '#e5e7eb'];
    const isPie = (typ === 'pie' || typ === 'doughnut');

    chartsRef.current[id] = new Chart(ctx, {
      type: typ,
      data: {
        labels: lb,
        datasets: [{ label: tit, data: dt, backgroundColor: clr, borderColor: '#fff', borderWidth: 2 }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: 15 },
        plugins: {
          legend: { display: isPie, position: 'bottom', labels: { boxWidth: 12, font: { size: 11 }, padding: 15 } }
        },
        scales: (typ === 'bar') ? {
          x: { grid: { display: false }, ticks: { maxRotation: 45, minRotation: 45, font: { size: 9 } } },
          y: { beginAtZero: true, ticks: { font: { size: 10 } } }
        } : { x: { display: false }, y: { display: false } }
      }
    });
  };

  return (
    <div style={{ padding: '20px', backgroundColor: '#f3f2eb', minHeight: '100vh', fontFamily: 'Arial, Helvetica, sans-serif' }}>
      
      {/* PANEL DE CONFIGURACIÓN */}
      <div className="crm-card-paper" style={{ backgroundColor: '#fff', border: '4px solid #000', padding: '25px', marginBottom: '40px', boxShadow: '6px 6px 0 #000' }}>
        <h2 style={{ margin: '0 0 20px 0', fontWeight: '900', textTransform: 'uppercase', fontSize: '18px' }}>⚙️ Configuración y Carga de CSVs</h2>
        
        <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <div style={{ flex: '1', minWidth: '200px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={{ fontWeight: '900', fontSize: '11px', textTransform: 'uppercase' }}>Tienda / Cliente:</label>
            <input type="text" value={storeName} onChange={e => setStoreName(e.target.value)} className="crm-input-text" style={{ border: '2px solid #000', fontWeight: 'bold' }} />
          </div>
          <div style={{ flex: '1', minWidth: '200px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={{ fontWeight: '900', fontSize: '11px', textTransform: 'uppercase' }}>Período:</label>
            <input type="text" value={period} onChange={e => setPeriod(e.target.value)} className="crm-input-text" style={{ border: '2px solid #000', fontWeight: 'bold' }} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '15px' }}>
          {[
            { id: 'sessions', label: '1. Sesiones por día' },
            { id: 'general', label: '2. Métricas generales' },
            { id: 'channels', label: '3. Medio de Referencia' },
            { id: 'devices', label: '4. Dispositivos' },
            { id: 'countries', label: '5A. Top 10 Países' },
            { id: 'cities', label: '5B. Top 10 Ciudades' },
            { id: 'pages', label: '6. Top 10 Páginas' },
            { id: 'campaigns', label: '7A. Top 10 por Campaña' },
            { id: 'utms', label: '7B. Top 10 por Fuente UTM' },
          ].map(item => (
            <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: '5px', backgroundColor: '#f9f9f9', padding: '10px', border: '1px solid #ddd' }}>
              <label style={{ fontWeight: '900', fontSize: '11px', textTransform: 'uppercase', color: '#333' }}>{item.label}</label>
              <input type="file" ref={filesRef[item.id]} accept=".csv" style={{ fontSize: '11px' }} />
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '15px', marginTop: '25px', justifyContent: 'center' }}>
          <button className="crm-btn-black" onClick={buildReport} style={{ padding: '12px 24px', fontSize: '14px' }}>Generar Reporte Completo</button>
          <button className="crm-btn-black" onClick={() => window.print()} style={{ padding: '12px 24px', fontSize: '14px', backgroundColor: '#2563eb', borderColor: '#2563eb' }}>🖨 Exportar a PDF</button>
        </div>
      </div>

      {/* DOCUMENTO Y REPORTE VISUAL */}
      <div style={{ maxWidth: '900px', margin: '0 auto', backgroundColor: '#f3f2eb' }}>
        
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '4px solid #000', paddingBottom: '10px', marginBottom: '30px' }}>
          <div>
            <h1 style={{ fontSize: '38px', fontWeight: '900', letterSpacing: '1px', lineHeight: '1', textTransform: 'uppercase', margin: 0 }}>{storeName}</h1>
            <div style={{ fontSize: '18px', fontWeight: '700', marginTop: '5px' }}>Concorde Analisis</div>
          </div>
          <div style={{ textAlign: 'right', fontSize: '16px', fontWeight: '900', lineHeight: '1.2', textTransform: 'uppercase' }}>
            REPORTE DE RENDIMIENTO WEB<br />
            <span>PERÍODO: {period}</span>
          </div>
        </header>

        {/* SECCIONES DEL REPORTE */}
        <div style={{ backgroundColor: '#fff', border: '4px solid #000', padding: '25px', marginBottom: '30px' }}>
          <div style={{ backgroundColor: '#000', color: '#fff', display: 'inline-block', padding: '8px 15px', fontSize: '16px', fontWeight: '900', marginBottom: '10px', textTransform: 'uppercase' }}>1. RESUMEN DE TRÁFICO Y SESIONES DIARIAS</div>
          <p style={{ fontSize: '14px', fontWeight: '700', marginBottom: '20px', color: '#222' }}>Evolución del tráfico a lo largo del mes, destacando los picos de mayor y menor actividad.</p>
          <div style={{ width: '100%', border: '3px solid #000', backgroundColor: '#fff', padding: '10px', marginBottom: '20px', height: '350px' }}>
            <div style={{ position: 'relative', height: '100%', width: '100%' }}>
              <canvas id="c-sesiones"></canvas>
            </div>
          </div>
          <table className="crm-table-data" style={{ border: '4px solid #000' }}>
            <thead><tr><th>RESUMEN DEL MES</th><th style={{ textAlign: 'right' }}>VALOR</th></tr></thead>
            <tbody>
              <tr><td>Total de sesiones en el mes</td><td style={{ textAlign: 'right', fontWeight: 'bold' }} id="t-total">-</td></tr>
              <tr><td>Promedio diario de sesiones</td><td style={{ textAlign: 'right', fontWeight: 'bold' }} id="t-avg">-</td></tr>
              <tr><td>Día con mayor tráfico (Pico)</td><td style={{ textAlign: 'right', fontWeight: 'bold' }} id="t-max">-</td></tr>
              <tr><td>Día con menor tráfico</td><td style={{ textAlign: 'right', fontWeight: 'bold' }} id="t-min">-</td></tr>
            </tbody>
          </table>
        </div>

        <div style={{ backgroundColor: '#fff', border: '4px solid #000', padding: '25px', marginBottom: '30px' }}>
          <div style={{ backgroundColor: '#000', color: '#fff', display: 'inline-block', padding: '8px 15px', fontSize: '16px', fontWeight: '900', marginBottom: '10px', textTransform: 'uppercase' }}>2. MÉTRICAS GENERALES</div>
          <p style={{ fontSize: '14px', fontWeight: '700', marginBottom: '20px', color: '#222' }}>Visión global del comportamiento de los usuarios dentro de la tienda online durante el mes.</p>
          <table className="crm-table-data" style={{ border: '4px solid #000' }}>
            <thead><tr><th>MÉTRICA</th><th style={{ textAlign: 'right' }}>VALOR</th></tr></thead>
            <tbody id="tb-metricas"><tr><td colSpan="2" style={{ textAlign: 'center' }}>Cargue el CSV</td></tr></tbody>
          </table>
        </div>

        <div style={{ backgroundColor: '#fff', border: '4px solid #000', padding: '25px', marginBottom: '30px' }}>
          <div style={{ backgroundColor: '#000', color: '#fff', display: 'inline-block', padding: '8px 15px', fontSize: '16px', fontWeight: '900', marginBottom: '10px', textTransform: 'uppercase' }}>3. ADQUISICIÓN Y CANALES DE TRÁFICO</div>
          <p style={{ fontSize: '14px', fontWeight: '700', marginBottom: '20px', color: '#222' }}>Desglose de las fuentes principales que generaron visitas a la web, junto con su calidad (medida en tasa de rebote).</p>
          <div style={{ width: '100%', border: '3px solid #000', backgroundColor: '#fff', padding: '10px', marginBottom: '20px', height: '350px' }}>
            <div style={{ position: 'relative', height: '100%', width: '100%' }}>
              <canvas id="c-canales"></canvas>
            </div>
          </div>
          <table className="crm-table-data" style={{ border: '4px solid #000' }}>
            <thead><tr><th>MEDIO DE REFERENCIA</th><th style={{ textAlign: 'right' }}>SESIONES</th><th style={{ textAlign: 'right' }}>VISITANTES ÚNICOS</th><th style={{ textAlign: 'right' }}>TASA DE REBOTE</th><th style={{ textAlign: 'right' }}>% DEL TOTAL</th></tr></thead>
            <tbody id="tb-canales"><tr><td colSpan="5" style={{ textAlign: 'center' }}>Cargue el CSV</td></tr></tbody>
          </table>
        </div>

        <div style={{ backgroundColor: '#fff', border: '4px solid #000', padding: '25px', marginBottom: '30px' }}>
          <div style={{ backgroundColor: '#000', color: '#fff', display: 'inline-block', padding: '8px 15px', fontSize: '16px', fontWeight: '900', marginBottom: '10px', textTransform: 'uppercase' }}>4. DISTRIBUCIÓN POR DISPOSITIVO</div>
          <p style={{ fontSize: '14px', fontWeight: '700', marginBottom: '20px', color: '#222' }}>Preferencia tecnológica de los usuarios al navegar por la tienda.</p>
          <div style={{ width: '100%', border: '3px solid #000', backgroundColor: '#fff', padding: '10px', marginBottom: '20px', height: '350px' }}>
            <div style={{ position: 'relative', height: '100%', width: '100%' }}>
              <canvas id="c-disp"></canvas>
            </div>
          </div>
          <table className="crm-table-data" style={{ border: '4px solid #000' }}>
            <thead><tr><th>TIPO DE DISPOSITIVO</th><th style={{ textAlign: 'right' }}>SESIONES</th><th style={{ textAlign: 'right' }}>% DEL TOTAL</th></tr></thead>
            <tbody id="tb-disp"><tr><td colSpan="3" style={{ textAlign: 'center' }}>Cargue el CSV</td></tr></tbody>
          </table>
        </div>

        <div style={{ backgroundColor: '#fff', border: '4px solid #000', padding: '25px', marginBottom: '30px' }}>
          <div style={{ backgroundColor: '#000', color: '#fff', display: 'inline-block', padding: '8px 15px', fontSize: '16px', fontWeight: '900', marginBottom: '10px', textTransform: 'uppercase' }}>5. DEMOGRAFÍA DE USUARIOS (TOP 10)</div>
          <p style={{ fontSize: '14px', fontWeight: '700', marginBottom: '20px', color: '#222' }}>Distribución geográfica de las sesiones generadas durante el mes.</p>
          <p style={{ fontWeight: '900', marginBottom: '8px', marginTop: '20px', textTransform: 'uppercase', fontSize: '14px' }}>Por País</p>
          <table className="crm-table-data" style={{ border: '4px solid #000' }}>
            <thead><tr><th>PAÍS</th><th style={{ textAlign: 'right' }}>SESIONES</th><th style={{ textAlign: 'right' }}>% DEL TOTAL</th></tr></thead>
            <tbody id="tb-pais"><tr><td colSpan="3" style={{ textAlign: 'center' }}>Cargue el CSV</td></tr></tbody>
          </table>
          <p style={{ fontWeight: '900', marginBottom: '8px', marginTop: '20px', textTransform: 'uppercase', fontSize: '14px' }}>Por Ciudad</p>
          <table className="crm-table-data" style={{ border: '4px solid #000' }}>
            <thead><tr><th>CIUDAD</th><th style={{ textAlign: 'right' }}>SESIONES</th><th style={{ textAlign: 'right' }}>% DEL TOTAL</th></tr></thead>
            <tbody id="tb-ciudad"><tr><td colSpan="3" style={{ textAlign: 'center' }}>Cargue el CSV</td></tr></tbody>
          </table>
        </div>

        <div style={{ backgroundColor: '#fff', border: '4px solid #000', padding: '25px', marginBottom: '30px' }}>
          <div style={{ backgroundColor: '#000', color: '#fff', display: 'inline-block', padding: '8px 15px', fontSize: '16px', fontWeight: '900', marginBottom: '10px', textTransform: 'uppercase' }}>6. COMPORTAMIENTO EN EL SITIO (TOP 10 PÁGINAS)</div>
          <p style={{ fontSize: '14px', fontWeight: '700', marginBottom: '20px', color: '#222' }}>Las secciones de la web que concentraron la mayor cantidad de tráfico.</p>
          <div style={{ width: '100%', border: '3px solid #000', backgroundColor: '#fff', padding: '10px', marginBottom: '20px', height: '350px' }}>
            <div style={{ position: 'relative', height: '100%', width: '100%' }}>
              <canvas id="c-paginas"></canvas>
            </div>
          </div>
          <table className="crm-table-data" style={{ border: '4px solid #000' }}>
            <thead><tr><th>RUTA DE LA PÁGINA</th><th style={{ textAlign: 'right' }}>CARGAS DE PÁGINA</th><th style={{ textAlign: 'right' }}>% DEL TOTAL</th></tr></thead>
            <tbody id="tb-paginas"><tr><td colSpan="3" style={{ textAlign: 'center' }}>Cargue el CSV</td></tr></tbody>
          </table>
        </div>

        <div style={{ backgroundColor: '#fff', border: '4px solid #000', padding: '25px', marginBottom: '30px' }}>
          <div style={{ backgroundColor: '#000', color: '#fff', display: 'inline-block', padding: '8px 15px', fontSize: '16px', fontWeight: '900', marginBottom: '10px', textTransform: 'uppercase' }}>7. RENDIMIENTO DE CAMPAÑAS (UTMS)</div>
          <p style={{ fontSize: '14px', fontWeight: '700', marginBottom: '20px', color: '#222' }}>Análisis de la efectividad del etiquetado de enlaces para campañas de marketing.</p>
          <p style={{ fontWeight: '900', marginBottom: '8px', marginTop: '20px', textTransform: 'uppercase', fontSize: '14px' }}>Top 10 por Campaña UTM</p>
          <table className="crm-table-data" style={{ border: '4px solid #000' }}>
            <thead><tr><th>CAMPAÑA UTM</th><th style={{ textAlign: 'right' }}>SESIONES</th><th style={{ textAlign: 'right' }}>% DEL TOTAL</th></tr></thead>
            <tbody id="tb-camp"><tr><td colSpan="3" style={{ textAlign: 'center' }}>Cargue el CSV</td></tr></tbody>
          </table>
          <p style={{ fontWeight: '900', marginBottom: '8px', marginTop: '20px', textTransform: 'uppercase', fontSize: '14px' }}>Top 10 por Fuente UTM</p>
          <table className="crm-table-data" style={{ border: '4px solid #000' }}>
            <thead><tr><th>FUENTE UTM</th><th style={{ textAlign: 'right' }}>SESIONES</th><th style={{ textAlign: 'right' }}>% DEL TOTAL</th></tr></thead>
            <tbody id="tb-utm"><tr><td colSpan="3" style={{ textAlign: 'center' }}>Cargue el CSV</td></tr></tbody>
          </table>
        </div>

      </div>
    </div>
  );
}

export default AnalisisReportGenerator;