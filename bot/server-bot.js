const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const pidusage = require('pidusage');
const cron = require('node-cron');

// Ocultar firma de bot para evitar bloqueos por WAF (Cloudflare/Sucuri)
puppeteer.use(StealthPlugin());

const API_BASE_URL = process.env.API_BASE_URL || 'https://enova-concorde-staging.up.railway.app/api';
const API_KEY = process.env.API_KEY || 'ENOVA_SECRET_API_KEY_2026';

// Lista de tiendas por defecto (También puedes consumirlas de tu API si prefieres)
const tiendasDefault = [
  { store_id: 'enova-digital', nombre: 'Enova Agency', url: 'https://enova.agency' },
  { store_id: 'alpaca_111', nombre: 'Alpaca 111', url: 'https://alpaca111.com/' },
  { store_id: 'Yarnalia', nombre: 'Yarnalia', url: 'https://yarnalia.com/' },
  { store_id: 'Catitejas', nombre: 'Catitejas', url: 'https://catitejas.pe' },
  { store_id: 'Clementine&Bastien', nombre: 'Clementine&Bastien', url: 'https://www.clebastien.com' },
  { store_id: 'DJJ', nombre: 'DJJ', url: 'https://grupodjj.pe' },
  { store_id: 'Donna_Cativa', nombre: 'Donna Cativa', url: 'https://donnacattiva.com/' },
  { store_id: 'Electroenchufe', nombre: 'Electroenchufe', url: 'https://electroenchufe.com/' },
  { store_id: 'Floreria_San_Borja', nombre: 'Floreria San Borja', url: 'https://floreriasb.com.pe' },
  { store_id: 'Ibero', nombre: 'Ibero', url: 'https://www.iberolibrerias.com' }
];

async function enviarMetricasAPI(payload) {
  try {
    const response = await fetch(`${API_BASE_URL}/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    return data.success ? { status: 'success' } : { status: 'error', message: data.error };
  } catch (error) {
    return { status: 'network_error', message: error.message };
  }
}

async function notificarFinalizacion(total, exitosos, fallidos, fechaActual) {
  try {
    await fetch(`${API_BASE_URL}/metrics/notify-completion`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      },
      body: JSON.stringify({
        total_stores: total,
        success_count: exitosos,
        failed_count: fallidos,
        date: fechaActual
      })
    });
    console.log("📧 Correo de notificación enviado con éxito.");
  } catch (error) {
    console.error("Error al enviar notificación por correo:", error.message);
  }
}

async function ejecutarAnalisisAutomated() {
  const fechaActual = new Date().toISOString();
  console.log(`\n▶ [${new Date().toLocaleTimeString()}] INICIANDO ANÁLISIS AUTOMÁTICO CON HANDICAP MÓVIL...`);

  let exitosos = 0;
  let fallidos = 0;

  for (let i = 0; i < tiendasDefault.length; i++) {
    const web = tiendasDefault[i];
    let browser;

    try {
      browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--enable-precise-memory-info',
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled'
        ]
      });

      const browserPid = browser.process().pid;
      const page = await browser.newPage();

      // 🎯 HANDICAP: Emular Móvil Gama Media + Red 4G
      const client = await page.target().createCDPSession();
      await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      await client.send('Network.emulateNetworkConditions', {
        offline: false,
        downloadThroughput: (4 * 1024 * 1024) / 8,
        uploadThroughput: (1.5 * 1024 * 1024) / 8,
        latency: 150
      });

      await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
      await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1');

      await page.setCacheEnabled(false);
      await page.goto(web.url, { waitUntil: 'load', timeout: 60000 });
      await new Promise(r => setTimeout(r, 2000));

      const datosReporte = await page.evaluate(() => {
        const [nav] = performance.getEntriesByType('navigation');
        const resources = performance.getEntriesByType('resource');
        const memory = performance.memory;
        let totalBytes = 0;
        resources.forEach(res => { if (res.transferSize) totalBytes += res.transferSize; });
        return {
          redirect: Math.round(nav.redirectEnd - nav.redirectStart),
          dns: Math.round(nav.domainLookupEnd - nav.domainLookupStart),
          tcp: Math.round(nav.connectEnd - nav.connectStart),
          ttfb: Math.round(nav.responseStart - nav.startTime),
          domInteractive: Math.round(nav.domInteractive - nav.startTime),
          domReady: Math.round(nav.domContentLoadedEventEnd - nav.startTime),
          loadTime: Math.round(nav.loadEventEnd - nav.startTime),
          peso: (totalBytes / 1024 / 1024).toFixed(2),
          peticiones: resources.length + 1,
          ramCore: memory ? (memory.usedJSHeapSize / 1024 / 1024).toFixed(2) : 0
        };
      });

      const statsOS = await pidusage(browserPid);
      const ramTotalMB = parseFloat((statsOS.memory / 1024 / 1024).toFixed(2));

      const payload = {
        store_id: web.store_id,
        date: fechaActual,
        server_status: 'ONLINE',
        web_flow: 'Auto-Mobile-4G',
        redirect_ms: datosReporte.redirect || 0,
        dns_ms: datosReporte.dns || 0,
        tcp_ms: datosReporte.tcp || 0,
        ttfb_ms: datosReporte.ttfb || 0,
        dom_interactive_ms: datosReporte.domInteractive || 0,
        dom_ms: datosReporte.domReady || 0,
        load_ms: datosReporte.loadTime || 0,
        total_weight_mb: parseFloat(datosReporte.peso || 0),
        total_requests: parseInt(datosReporte.peticiones || 0),
        ram_core_mb: parseFloat(datosReporte.ramCore),
        ram_total_mb: ramTotalMB
      };

      const apiResponse = await enviarMetricasAPI(payload);
      if (apiResponse.status === 'success') exitosos++; else fallidos++;

      console.log(`✔ [${i + 1}/${tiendasDefault.length}] ${web.nombre} | ${ramTotalMB}MB RAM | ${datosReporte.loadTime}ms | API: ${apiResponse.status}`);

      await browser.close();
    } catch (error) {
      console.error(`✖ ${web.nombre} | ERROR: ${error.message}`);
      fallidos++;
      await enviarMetricasAPI({ 
        store_id: web.store_id, date: fechaActual, server_status: 'OFFLINE', 
        web_flow: 'Crash', ram_core_mb: 0, ram_total_mb: 0, redirect_ms: 0, 
        dns_ms: 0, tcp_ms: 0, ttfb_ms: 0, dom_interactive_ms: 0, dom_ms: 0, 
        load_ms: 0, total_weight_mb: 0, total_requests: 0 
      });
      if (browser) await browser.close();
    }
    pidusage.clear();

    // Pausa aleatoria entre 3 y 6 segundos entre tienda y tienda
    const jitter = Math.floor(Math.random() * 3000) + 3000;
    await new Promise(r => setTimeout(r, jitter));
  }

  console.log(`\n✅ ANÁLISIS FINALIZADO.`);
  await notificarFinalizacion(tiendasDefault.length, exitosos, fallidos, fechaActual);
}

console.log("🤖 Servicio de monitoreo en segundo plano iniciado.");

// ⏰ PROGRAMAR A LAS 9:00 AM (Zona horaria Peru/America/Lima)
cron.schedule('0 9 * * *', () => {
  ejecutarAnalisisAutomated();
}, {
  timezone: "America/Lima"
});