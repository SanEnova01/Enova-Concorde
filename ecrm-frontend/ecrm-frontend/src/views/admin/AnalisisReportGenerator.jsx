import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import Chart from 'chart.js/auto';

function AnalisisReportGenerator() {
  const [storeName, setStoreName] = useState('KNOMAD');
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

  const num = (v) => parseFloat(String(v).replace(/[^\d.-]/g, '')) || 0;
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
    const f = (id) => filesRef[id].current?.files[0];

    if (f('sessions')) doSesDia(await parseCSV(f('sessions')));
    if (f('general')) doMetricas(await parseCSV(f('general')));
    if (f('channels')) doCanales(await parseCSV(f('channels')));
    if (f('devices')) doDisp(await parseCSV(f('devices')));
    if (f('countries')) doDemog(await parseCSV(f('countries')), 'tb-pais');
    if (f('cities')) doDemog(await parseCSV(f('cities')), 'tb-ciudad');
    if (f('pages')) doPaginas(await parseCSV(f('pages')));
    if (f('campaigns')) doUTM(await parseCSV(f('campaigns')), 'tb-camp');
    if (f('utms')) doUTM(await parseCSV(f('utms')), 'tb-utm');
  };

  const doSesDia = (data) => {
    let t = 0, mx = -1, mn = Infinity, dMx = '', dMn = '', lb = [], vl = [];
    data.forEach(r => {
      if (r.length < 2) return;
      let v = num(r[1]), d = r[0];
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
      let s = num(r[1]);
      tSes += s; tVis += num(r[2]); tVist += num(r[3]); tDurPnd += (num(r[4]) * s);
    });
    let avgD = tSes > 0 ? (tDurPnd / tSes) : 0;
    let tb = document.getElementById('tb-metricas');
    tb.innerHTML = `
      <tr><td>Sesiones Totales</td><td class="text-right">${fmtN(tSes)}</td></tr>
      <tr><td>Visitantes de la tienda online</td><td class="text-right">${fmtN(tVis)}</td></tr>
      <tr><td>Vistas de página</td><td class="text-right">${fmtN(tVist)}</td></tr>
      <tr><td>Duración media de la sesión</td><td class="text-right">${avgD.toFixed(2).replace('.', ',')} s (${Math.floor(avgD/60)} min ${Math.floor(avgD%60)} s)</td></tr>
    `;
  };

  const doCanales = (data) => {
    let tot = data.reduce((a, r) => a + num(r[1]), 0), lb = [], vl = [], tb = document.getElementById('tb-canales');
    tb.innerHTML = '';
    data.forEach(r => {
      if (r.length < 4) return;
      let c = txt(r[0]), s = num(r[1]), reb = num(r[3]);
      lb.push(c); vl.push(s);
      tb.innerHTML += `<tr><td>${c}</td><td class="text-right">${fmtN(s)}</td><td class="text-right">${fmtN(num(r[2]))}</td><td class="text-right">${fmtPct(reb<=1?reb:reb/100)}</td><td class="text-right">${tot?fmtPct(s/tot):'0%'}</td></tr>`;
    });
    drawGeneral('c-canales', 'pie', lb, vl, '');
  };

  const doDisp = (data) => {
    let tot = data.reduce((a, r) => a + num(r[1]), 0), lb = [], vl = [], tb = document.getElementById('tb-disp');
    tb.innerHTML = '';
    data.forEach(r => {
      if (r.length < 2) return;
      let d = trans(r[0]), s = num(r[1]);
      lb.push(d); vl.push(s);
      tb.innerHTML += `<tr><td>${d}</td><td class="text-right">${fmtN(s)}</td><td class="text-right">${tot?fmtPct(s/tot):'0%'}</td></tr>`;
    });
    drawGeneral('c-disp', 'doughnut', lb, vl, '');
  };

  const doDemog = (data, id) => {
    let tot = data.reduce((a, r) => a + num(r[1]), 0), tb = document.getElementById(id);
    tb.innerHTML = '';
    data.slice(0, 10).forEach(r => {
      if (r.length < 2) return;
      let s = num(r[1]);
      tb.innerHTML += `<tr><td>${txt(r[0])}</td><td class="text-right">${fmtN(s)}</td><td class="text-right">${tot?fmtPct(s/tot):'0%'}</td></tr>`;
    });
  };

  const doPaginas = (data) => {
    let tot = data.reduce((a, r) => a + num(r[1]), 0), lb = [], vl = [], tb = document.getElementById('tb-paginas');
    tb.innerHTML = '';
    data.slice(0, 10).forEach(r => {
      if (r.length < 2) return;
      let p = r[0], s = num(r[1]);
      lb.push(p.length > 18 ? p.substring(0, 18) + '...' : p);
      vl.push(s);
      let tableText = p.length > 50 ? p.substring(0, 50) + '...' : p;
      tb.innerHTML += `<tr><td style="word-break: break-all;">${tableText}</td><td class="text-right">${fmtN(s)}</td><td class="text-right">${tot?fmtPct(s/tot):'0%'}</td></tr>`;
    });
    drawGeneral('c-paginas', 'bar', lb, vl, 'Vistas');
  };

  const doUTM = (data, id) => {
    let tot = data.reduce((a, r) => a + num(r[1]), 0), tb = document.getElementById(id);
    tb.innerHTML = '';
    data.slice(0, 10).forEach(r => {
      if (r.length < 2) return;
      let s = num(r[1]);
      tb.innerHTML += `<tr><td>${txt(r[0])}</td><td class="text-right">${fmtN(s)}</td><td class="text-right">${tot?fmtPct(s/tot):'0%'}</td></tr>`;
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
            pointHoverRadius: 7,
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
        layout: { padding: { top: 20, bottom: 45, left: 10, right: 30 } },
        plugins: {
          title: { display: true, text: `Sesiones Diarias (${periodStr})`, font: { size: 12, weight: 'bold' }, color: '#333' },
          legend: { display: true, position: 'top', align: 'end', labels: { boxWidth: 12, font: { size: 10 }, usePointStyle: true } }
        },
        scales: {
          x: { grid: { display: false }, ticks: { maxRotation: 45, minRotation: 45, font: { size: 9 } } },
          y: { beginAtZero: true, ticks: { font: { size: 10 } } }
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
    <div style={{ padding: '40px 20px', backgroundColor: '#f3f2eb', minHeight: '100vh', fontFamily: 'Arial, Helvetica, sans-serif', color: '#000' }}>
      
      {/* ESTILOS EXACTOS Y AISLAMIENTO DE IMPRESIÓN */}
      <style>{`
        .arg-body { background-color: #f3f2eb; color: #000; font-family: Arial, Helvetica, sans-serif; }
        .arg-controls-panel { background: #fff; border: 4px solid #000; padding: 25px; margin-bottom: 40px; box-shadow: 6px 6px 0 #000; max-width: 1000px; margin-left: auto; margin-right: auto; }
        .arg-controls-panel h2 { margin-bottom: 20px; font-weight: 900; text-transform: uppercase; font-size: 18px; }
        .arg-grid-controls { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }
        .arg-control-group { display: flex; flex-direction: column; gap: 5px; background: #f9f9f9; padding: 10px; border: 1px solid #ddd; }
        .arg-control-group label { font-weight: 900; font-size: 11px; text-transform: uppercase; color: #333; }
        .arg-control-group input[type="file"] { font-size: 11px; }
        .arg-control-group input[type="text"] { padding: 8px; border: 2px solid #000; font-family: inherit; font-weight: bold; }
        .arg-btn-group { display: flex; gap: 15px; margin-top: 25px; justify-content: center; }
        .arg-btn { background: #000; color: #fff; padding: 12px 24px; border: 2px solid #000; font-weight: 900; cursor: pointer; font-size: 14px; text-transform: uppercase; transition: 0.2s; }
        .arg-btn:hover { background: #fff; color: #000; }
        .arg-btn-blue { background: #2563eb; border-color: #2563eb; color: #fff; }
        .arg-btn-blue:hover { background: #fff; color: #2563eb; }

        .arg-container { max-width: 900px; margin: 0 auto; background: #f3f2eb; }
        .arg-main-header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 4px solid #000; padding-bottom: 10px; margin-bottom: 30px; }
        .arg-title-container { display: flex; flex-direction: column; }
        .arg-main-header h1 { font-size: 38px; font-weight: 900; letter-spacing: 1px; line-height: 1; text-transform: uppercase; margin: 0; }
        .arg-main-header .sub-brand { font-size: 18px; font-weight: 700; margin-top: 5px; }
        .arg-main-header .subtitle { text-align: right; font-size: 16px; font-weight: 900; line-height: 1.2; text-transform: uppercase; }

        .arg-section-box { background-color: #fff; border: 4px solid #000; padding: 25px; margin-bottom: 30px; }
        .arg-section-title { background-color: #000; color: #fff; display: inline-block; padding: 8px 15px; font-size: 16px; font-weight: 900; margin-bottom: 10px; text-transform: uppercase; }
        .arg-description { font-size: 14px; font-weight: 700; margin-bottom: 20px; color: #222; }
        .arg-sub-heading { font-weight: 900; margin-bottom: 8px; margin-top: 20px; text-transform: uppercase; font-size: 14px; }

        .arg-chart-area { width: 100%; border: 3px solid #000; background-color: #f9f9f9; padding: 10px; margin-bottom: 20px; height: 350px; display: block; }
        .arg-canvas-wrapper { position: relative; height: 100%; width: 100%; display: block; }

        .arg-table { width: 100%; border-collapse: collapse; border: 4px solid #000; margin-bottom: 15px; }
        .arg-table th, .arg-table td { border: 2px solid #000; padding: 10px 12px; font-size: 13px; }
        .arg-table th { background-color: #000; color: #fff; text-align: left; text-transform: uppercase; font-weight: bold; }
        .arg-table td { font-weight: 700; }
        .arg-text-right { text-align: right; }
        .arg-text-center { text-align: center; }

        /* IMPRESIÓN LIMPIA DE PDF (OCULTA SIDEBAR Y CONTROLES) */
        @media print {
          .no-print, .crm-sidebar, .crm-mobile-header, .crm-sidebar-overlay { display: none !important; }
          body { background-color: #fff !important; padding: 0 !important; }
          .crm-main-content { margin-left: 0 !important; padding: 0 !important; width: 100% !important; max-width: 100% !important; }
          .crm-layout { display: block !important; }
          .arg-container { max-width: 100% !important; margin: 0 !important; background: #fff !important; }
          .arg-section-box { break-inside: avoid; page-break-inside: avoid; border-width: 3px; padding: 20px; }
          .arg-table { border-width: 3px; }
          .arg-table th, .arg-table td { border-width: 1px; padding: 6px 8px; font-size: 11px; }
          .arg-chart-area { border-width: 2px; height: 320px; padding: 5px; }
          .arg-canvas-wrapper { width: 100%; height: 100%; }
          .arg-main-header { margin-top: 0; padding-top: 0; }
        }
      `}</style>

      {/* PANEL DE CONFIGURACIÓN */}
      <div className="arg-controls-panel no-print">
        <h2>⚙️ Configuración y Carga de CSVs</h2>
        <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
          <div className="arg-control-group" style={{ flex: 1 }}>
            <label>Tienda / Cliente:</label>
            <input type="text" value={storeName} onChange={e => setStoreName(e.target.value)} />
          </div>
          <div className="arg-control-group" style={{ flex: 1 }}>
            <label>Período:</label>
            <input type="text" value={period} onChange={e => setPeriod(e.target.value)} />
          </div>
        </div>

        <div className="arg-grid-controls">
          <div className="arg-control-group"><label>1. Sesiones por día</label><input type="file" ref={filesRef.sessions} /></div>
          <div className="arg-control-group"><label>2. Métricas generales</label><input type="file" ref={filesRef.general} /></div>
          <div className="arg-control-group"><label>3. Medio de Referencia</label><input type="file" ref={filesRef.channels} /></div>
          <div className="arg-control-group"><label>4. Dispositivos</label><input type="file" ref={filesRef.devices} /></div>
          <div className="arg-control-group"><label>5A. Top 10 Países</label><input type="file" ref={filesRef.countries} /></div>
          <div className="arg-control-group"><label>5B. Top 10 Ciudades</label><input type="file" ref={filesRef.cities} /></div>
          <div className="arg-control-group"><label>6. Top 10 Páginas</label><input type="file" ref={filesRef.pages} /></div>
          <div className="arg-control-group"><label>7A. Top 10 por Campaña</label><input type="file" ref={filesRef.campaigns} /></div>
          <div className="arg-control-group"><label>7B. Top 10 por Fuente UTM</label><input type="file" ref={filesRef.utms} /></div>
        </div>

        <div className="arg-btn-group">
          <button className="arg-btn" onClick={buildReport}>Generar Reporte Completo</button>
          <button className="arg-btn arg-btn-blue" onClick={() => window.print()}>🖨 Exportar a PDF</button>
        </div>
      </div>

      {/* DOCUMENTO Y REPORTE VISUAL */}
      <div className="arg-container">
        
        <header className="arg-main-header">
          <div className="arg-title-container">
            <h1>{storeName}</h1>
            <div className="sub-brand">Concorde Analisis</div>
          </div>
          <div className="subtitle">
            REPORTE DE RENDIMIENTO WEB<br />
            <span>PERÍODO: {period}</span>
          </div>
        </header>

        {/* SECCIÓN 1 */}
        <div className="arg-section-box">
          <div className="arg-section-title">1. RESUMEN DE TRÁFICO Y SESIONES DIARIAS</div>
          <p className="arg-description">Evolución del tráfico a lo largo del mes, destacando los picos de mayor y menor actividad.</p>
          <div className="arg-chart-area">
            <div className="arg-canvas-wrapper">
              <canvas id="c-sesiones"></canvas>
            </div>
          </div>
          <table className="arg-table">
            <thead><tr><th>RESUMEN DEL MES</th><th className="arg-text-right">VALOR</th></tr></thead>
            <tbody>
              <tr><td>Total de sesiones en el mes</td><td className="arg-text-right" id="t-total">-</td></tr>
              <tr><td>Promedio diario de sesiones</td><td className="arg-text-right" id="t-avg">-</td></tr>
              <tr><td>Día con mayor tráfico (Pico)</td><td className="arg-text-right" id="t-max">-</td></tr>
              <tr><td>Día con menor tráfico</td><td className="arg-text-right" id="t-min">-</td></tr>
            </tbody>
          </table>
        </div>

        {/* SECCIÓN 2 */}
        <div className="arg-section-box">
          <div className="arg-section-title">2. MÉTRICAS GENERALES</div>
          <p className="arg-description">Visión global del comportamiento de los usuarios dentro de la tienda online durante el mes.</p>
          <table className="arg-table">
            <thead><tr><th>MÉTRICA</th><th className="arg-text-right">VALOR</th></tr></thead>
            <tbody id="tb-metricas"><tr><td colSpan="2" className="arg-text-center">Cargue el CSV</td></tr></tbody>
          </table>
        </div>

        {/* SECCIÓN 3 */}
        <div className="arg-section-box">
          <div className="arg-section-title">3. ADQUISICIÓN Y CANALES DE TRÁFICO</div>
          <p className="arg-description">Desglose de las fuentes principales que generaron visitas a la web, junto con su calidad (medida en tasa de rebote).</p>
          <div className="arg-chart-area">
            <div className="arg-canvas-wrapper">
              <canvas id="c-canales"></canvas>
            </div>
          </div>
          <table className="arg-table">
            <thead><tr><th>MEDIO DE REFERENCIA</th><th className="arg-text-right">SESIONES</th><th className="arg-text-right">VISITANTES ÚNICOS</th><th className="arg-text-right">TASA DE REBOTE</th><th className="arg-text-right">% DEL TOTAL</th></tr></thead>
            <tbody id="tb-canales"><tr><td colSpan="5" className="arg-text-center">Cargue el CSV</td></tr></tbody>
          </table>
        </div>

        {/* SECCIÓN 4 */}
        <div className="arg-section-box">
          <div className="arg-section-title">4. DISTRIBUCIÓN POR DISPOSITIVO</div>
          <p className="arg-description">Preferencia tecnológica de los usuarios al navegar por la tienda.</p>
          <div className="arg-chart-area">
            <div className="arg-canvas-wrapper">
              <canvas id="c-disp"></canvas>
            </div>
          </div>
          <table className="arg-table">
            <thead><tr><th>TIPO DE DISPOSITIVO</th><th className="arg-text-right">SESIONES</th><th className="arg-text-right">% DEL TOTAL</th></tr></thead>
            <tbody id="tb-disp"><tr><td colSpan="3" className="arg-text-center">Cargue el CSV</td></tr></tbody>
          </table>
        </div>

        {/* SECCIÓN 5 */}
        <div className="arg-section-box">
          <div className="arg-section-title">5. DEMOGRAFÍA DE USUARIOS (TOP 10)</div>
          <p className="arg-description">Distribución geográfica de las sesiones generadas durante el mes.</p>
          <p className="arg-sub-heading">Por País</p>
          <table className="arg-table">
            <thead><tr><th>PAÍS</th><th className="arg-text-right">SESIONES</th><th className="arg-text-right">% DEL TOTAL</th></tr></thead>
            <tbody id="tb-pais"><tr><td colSpan="3" className="arg-text-center">Cargue el CSV</td></tr></tbody>
          </table>
          <p className="arg-sub-heading">Por Ciudad</p>
          <table className="arg-table">
            <thead><tr><th>CIUDAD</th><th className="arg-text-right">SESIONES</th><th className="arg-text-right">% DEL TOTAL</th></tr></thead>
            <tbody id="tb-ciudad"><tr><td colSpan="3" className="arg-text-center">Cargue el CSV</td></tr></tbody>
          </table>
        </div>

        {/* SECCIÓN 6 */}
        <div className="arg-section-box">
          <div className="arg-section-title">6. COMPORTAMIENTO EN EL SITIO (TOP 10 PÁGINAS)</div>
          <p className="arg-description">Las secciones de la web que concentraron la mayor cantidad de tráfico.</p>
          <div className="arg-chart-area">
            <div className="arg-canvas-wrapper">
              <canvas id="c-paginas"></canvas>
            </div>
          </div>
          <table className="arg-table">
            <thead><tr><th>RUTA DE LA PÁGINA</th><th className="arg-text-right">CARGAS DE PÁGINA</th><th className="arg-text-right">% DEL TOTAL</th></tr></thead>
            <tbody id="tb-paginas"><tr><td colSpan="3" className="arg-text-center">Cargue el CSV</td></tr></tbody>
          </table>
        </div>

        {/* SECCIÓN 7 */}
        <div className="arg-section-box">
          <div className="arg-section-title">7. RENDIMIENTO DE CAMPAÑAS (UTMS)</div>
          <p className="arg-description">Análisis de la efectividad del etiquetado de enlaces para campañas de marketing.</p>
          <p className="arg-sub-heading">Top 10 por Campaña UTM</p>
          <table className="arg-table">
            <thead><tr><th>CAMPAÑA UTM</th><th className="arg-text-right">SESIONES</th><th className="arg-text-right">% DEL TOTAL</th></tr></thead>
            <tbody id="tb-camp"><tr><td colSpan="3" className="arg-text-center">Cargue el CSV</td></tr></tbody>
          </table>
          <p className="arg-sub-heading">Top 10 por Fuente UTM</p>
          <table className="arg-table">
            <thead><tr><th>FUENTE UTM</th><th className="arg-text-right">SESIONES</th><th className="arg-text-right">% DEL TOTAL</th></tr></thead>
            <tbody id="tb-utm"><tr><td colSpan="3" className="arg-text-center">Cargue el CSV</td></tr></tbody>
          </table>
        </div>

      </div>
    </div>
  );
}

export default AnalisisReportGenerator;