const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const pidusage = require('pidusage');
const cron = require('node-cron');

puppeteer.use(StealthPlugin());

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;
const API_BASE_URL = process.env.API_BASE_URL || 'https://enova-concorde-staging-2027.up.railway.app/api';
const API_KEY = process.env.API_KEY || 'ENOVA_SECRET_API_KEY_2026';

// Planes permitidos para ser analizados
const PLANES_VALIDOS = ['go', 'growth', 'escale', 'scale', 'scale_plus'];

let estaEjecutando = false;

// 1. Obtener tiendas dinámicamente desde la BD de Concorde
async function obtenerTiendasFiltradas() {
  try {
    const res = await fetch(`${API_BASE_URL}/stores`, {
      headers: { 'x-api-key': API_KEY }
    });
    const jsonResponse = await res.json();
    
    // 🔍 Imprimimos la respuesta exacta en los logs para auditarla
    console.log("🔍 [DEBUG] Respuesta de /stores:", JSON.stringify(jsonResponse));

    let tiendas = [];
    if (Array.isArray(jsonResponse)) {
      tiendas = jsonResponse;
    } else if (Array.isArray(jsonResponse.data)) {
      tiendas = jsonResponse.data;
    } else if (Array.isArray(jsonResponse.stores)) {
      tiendas = jsonResponse.stores;
    } else if (jsonResponse.data && Array.isArray(jsonResponse.data.stores)) {
      tiendas = jsonResponse.data.stores;
    } else {
      console.error("❌ El backend no devolvió un Array. Estructura recibida:", jsonResponse);
      return [];
    }

    // Filtrar solo tiendas con web y con planes válidos
    const filtradas = tiendas.filter(t => {
      const planLimpio = String(t.plan_type || t.plan || '').toLowerCase().trim();
      const tieneWeb = (t.web || t.url) && String(t.web || t.url).trim() !== '';
      return tieneWeb && PLANES_VALIDOS.includes(planLimpio);
    });

    console.log(`📋 [Filtro] Se encontraron ${filtradas.length} tiendas con plan elegible (${PLANES_VALIDOS.join(', ')}).`);
    return filtradas;
  } catch (error) {
    console.error("❌ Error obteniendo tiendas de la API:", error.message);
    return [];
  }
}

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
    console.error("Error enviando correo de notificación:", error.message);
  }
}

// 2. Función principal de auditoría (CRON / BULK)
async function ejecutarAnalisisAutomated() {
  if (estaEjecutando) {
    console.log("⚠️ Ya hay un análisis en curso. Solicitud omitida.");
    return { success: false, message: 'Un análisis ya se encuentra en ejecución.' };
  }

  estaEjecutando = true;
  const fechaActual = new Date().toISOString();
  const tiendas = await obtenerTiendasFiltradas();

  if (tiendas.length === 0) {
    console.log("⚠️ No se encontraron tiendas activas para analizar.");
    estaEjecutando = false;
    return { success: false, message: 'No hay tiendas activas registradas con los planes permitidos.' };
  }

  console.log(`\n▶ [${new Date().toLocaleTimeString()}] INICIANDO ANÁLISIS AUTOMÁTICO EN ${tiendas.length} TIENDAS...`);

  let exitosos = 0;
  let fallidos = 0;

  for (let i = 0; i < tiendas.length; i++) {
    const web = tiendas[i];
    let browser;

    try {
      let urlLimpia = web.web.trim();
      if (!urlLimpia.startsWith('http')) {
        urlLimpia = `https://${urlLimpia}`;
      }

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

      // 🌟 SOLUCIÓN BLINDADA PARA EVITAR TIMEOUT DE 60S
      try {
        await page.goto(urlLimpia, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await new Promise(r => setTimeout(r, 4000));
      } catch (navError) {
        console.warn(`⚠️ [Timeout Parcial] La red no hizo silencio en ${urlLimpia}, forzando extracción de métricas...`);
      }

      const datosReporte = await page.evaluate(() => {
        const nav = performance.getEntriesByType('navigation')[0];
        const resources = performance.getEntriesByType('resource');
        const memory = performance.memory;
        
        let totalBytes = 0;
        resources.forEach(res => { if (res.transferSize) totalBytes += res.transferSize; });
        
        // Salvaguarda: Si el timeout impidió que el evento de carga terminara, calculamos el tiempo real transcurrido
        const currentMs = Math.round(performance.now());
        
        return {
          redirect: nav ? Math.round(nav.redirectEnd - nav.redirectStart) : 0,
          dns: nav ? Math.round(nav.domainLookupEnd - nav.domainLookupStart) : 0,
          tcp: nav ? Math.round(nav.connectEnd - nav.connectStart) : 0,
          ttfb: nav ? Math.round(nav.responseStart - nav.startTime) : 0,
          domInteractive: nav ? Math.round(nav.domInteractive - nav.startTime) : currentMs / 2,
          domReady: nav ? Math.round(nav.domContentLoadedEventEnd - nav.startTime) : currentMs / 2,
          loadTime: (nav && nav.loadEventEnd > 0) ? Math.round(nav.loadEventEnd - nav.startTime) : currentMs,
          peso: (totalBytes / 1024 / 1024).toFixed(2),
          peticiones: resources.length + 1,
          ramCore: memory ? (memory.usedJSHeapSize / 1024 / 1024).toFixed(2) : 0
        };
      });

      const statsOS = await pidusage(browserPid);
      const ramTotalMB = parseFloat((statsOS.memory / 1024 / 1024).toFixed(2));

      const payload = {
        store_id: web.id,
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

      console.log(`✔ [${i + 1}/${tiendas.length}] ${web.name} (${web.plan_type}) | ${ramTotalMB}MB RAM | ${datosReporte.loadTime}ms`);

      await browser.close();
    } catch (error) {
      console.error(`✖ ${web.name} | ERROR: ${error.message}`);
      fallidos++;
      await enviarMetricasAPI({ 
        store_id: web.id, date: fechaActual, server_status: 'OFFLINE', 
        web_flow: 'Crash', ram_core_mb: 0, ram_total_mb: 0, redirect_ms: 0, 
        dns_ms: 0, tcp_ms: 0, ttfb_ms: 0, dom_interactive_ms: 0, dom_ms: 0, 
        load_ms: 0, total_weight_mb: 0, total_requests: 0 
      });
      if (browser) await browser.close();
    }
    pidusage.clear();

    const jitter = Math.floor(Math.random() * 3000) + 2000;
    await new Promise(r => setTimeout(r, jitter));
  }

  console.log(`\n✅ ANÁLISIS FINALIZADO.`);
  estaEjecutando = false;
  await notificarFinalizacion(tiendas.length, exitosos, fallidos, fechaActual);
  return { success: true, message: 'Análisis finalizado exitosamente' };
}

// 3. Heartbeat periódico
async function enviarHeartbeat() {
  try {
    const res = await fetch(`${API_BASE_URL}/metrics/bot-heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      },
      body: JSON.stringify({ is_running: estaEjecutando })
    });
    
    if (res.ok) {
      console.log("💓 [Heartbeat] Latido enviado con éxito al Backend.");
    } else {
      console.error(`⚠️ [Heartbeat] Servidor respondió con estado: ${res.status}`);
    }
  } catch (error) {
    console.error("❌ Error enviando heartbeat:", error.message);
  }
}

// Cambiar a 30 minutos (30 * 60 * 1000 = 1800000 ms)
setInterval(enviarHeartbeat, 30 * 60 * 1000);

// 🔥 EL FIX DEL HEARTBEAT: Esperar 15 segundos para dar tiempo al backend de encender 🔥
setTimeout(() => {
    enviarHeartbeat();
}, 15000);

// 4. ENDPOINTS DEL BOT (Disparo manual)
app.post('/run-force', async (req, res) => {
  const rawKey = req.headers['x-api-key'] || '';
  if (rawKey.trim() !== API_KEY) {
    return res.status(401).json({ success: false, error: 'API Key no autorizada' });
  }

  if (estaEjecutando) {
    return res.json({ success: false, message: 'El bot ya está ejecutando un análisis actualmente.' });
  }

  // Ejecutar en segundo plano para no bloquear la respuesta HTTP
  ejecutarAnalisisAutomated();

  res.json({ success: true, message: 'Análisis forzado iniciado correctamente.' });
});

app.get('/status', (req, res) => {
  res.json({ running: estaEjecutando });
});
// ==============================================================
// 🌟 MÓDULO: EXTRACTOR MASIVO CON TRACKING DE PROGRESO
// ==============================================================
// Objeto global para guardar cómo va cada URL
const extractionProgress = {};

async function extractStoreImages(targetUrl) {
    let urlLimpia = targetUrl.trim();
    if (!urlLimpia.startsWith('http')) urlLimpia = `https://${urlLimpia}`;

    // Reiniciamos el estado para esta URL
    extractionProgress[urlLimpia] = { total: 0, scanned: 0, phase: '1/3: Escaneando Home (Banners)...' };
    
    let imagesData = [];
    let browser;

    // FASE 1: HOME (Puppeteer)
    try {
        browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1');
        await page.goto(urlLimpia, { waitUntil: 'domcontentloaded', timeout: 40000 });
        
        await page.evaluate(async () => {
            await new Promise((resolve) => {
                let totalHeight = 0; const distance = 400;
                const timer = setInterval(() => {
                    window.scrollBy(0, distance); totalHeight += distance;
                    if(totalHeight >= document.body.scrollHeight - window.innerHeight){ clearInterval(timer); resolve(); }
                }, 150);
            });
        });

        const homeImages = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('img')).map(img => ({
                url: img.src || img.dataset.src || img.dataset.lazySrc,
                nombre: (img.src || '').split('/').pop().split('?')[0] || 'imagen_desconocida',
                ancho: img.naturalWidth || img.width || 0, alto: img.naturalHeight || img.height || 0,
                metadatos: (img.alt || '').replace(/"/g, '""'), origen: 'Home / Banner / Diseño (Front)'
            })).filter(img => img.url && img.url.startsWith('http'));
        });
        imagesData = [...homeImages];
        await browser.close();
    } catch (error) { if (browser) await browser.close(); }

    extractionProgress[urlLimpia].phase = '2/3: Descargando Catálogo Vía API...';

    // FASE 2: CATÁLOGO MASIVO (Paginación Infinita)
    try {
        let isShopify = false; let pageShopify = 1; let keepFetchingShopify = true;
        while (keepFetchingShopify) {
            const shopifyRes = await fetch(`${urlLimpia}/products.json?limit=250&page=${pageShopify}`);
            if (shopifyRes.ok) {
                isShopify = true; const data = await shopifyRes.json();
                if (data.products && data.products.length > 0) {
                    for (const p of data.products) {
                        for (const img of p.images) {
                            imagesData.push({
                                url: img.src, nombre: img.src.split('/').pop().split('?')[0],
                                ancho: img.width || 0, alto: img.height || 0,
                                metadatos: (img.alt || '').replace(/"/g, '""'), origen: `Catálogo Shopify: ${p.title.replace(/"/g, '""')}`
                            });
                        }
                    }
                    pageShopify++; 
                } else { keepFetchingShopify = false; }
            } else { keepFetchingShopify = false; }
        }

        if (!isShopify) {
            let pageWoo = 1; let keepFetchingWoo = true;
            while (keepFetchingWoo) {
                const wooRes = await fetch(`${urlLimpia}/wp-json/wp/v2/media?per_page=100&page=${pageWoo}`);
                if (wooRes.ok) {
                    const data = await wooRes.json();
                    if (data && data.length > 0) {
                        for (const m of data) {
                            imagesData.push({
                                url: m.source_url, nombre: m.slug || (m.source_url || '').split('/').pop(),
                                pesoPrecalculado: m.media_details?.filesize ? (m.media_details.filesize / 1024).toFixed(2) + ' KB' : null,
                                ancho: m.media_details?.width || 0, alto: m.media_details?.height || 0,
                                metadatos: (m.alt_text || '').replace(/"/g, '""'), origen: `Librería WooCommerce (ID: ${m.post || m.id})`
                            });
                        }
                        pageWoo++; 
                    } else { keepFetchingWoo = false; }
                } else { keepFetchingWoo = false; }
            }
        }
    } catch (e) { console.error("Error APIs:", e.message); }

    const uniqueImagesMap = new Map();
    imagesData.forEach(img => { if (img.url && !uniqueImagesMap.has(img.url)) uniqueImagesMap.set(img.url, img); });
    const finalImagesList = Array.from(uniqueImagesMap.values());

    // FASE 3: CALCULAR PESOS CON BARRA DE PROGRESO
    extractionProgress[urlLimpia].phase = '3/3: Analizando Pesos y Cabeceras...';
    extractionProgress[urlLimpia].total = finalImagesList.length;
    
    const BATCH_SIZE = 20; 
    for (let i = 0; i < finalImagesList.length; i += BATCH_SIZE) {
        const batch = finalImagesList.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (img) => {
            if (img.pesoPrecalculado) { img.peso = img.pesoPrecalculado; return; }
            try {
                const headRes = await fetch(img.url, { method: 'HEAD', timeout: 5000 });
                const sizeBytes = headRes.headers.get('content-length');
                img.peso = sizeBytes ? (parseInt(sizeBytes) / 1024).toFixed(2) + ' KB' : 'Desconocido';
            } catch(e) { img.peso = 'Error de lectura'; }
        }));
        // Actualizamos la barra de progreso global
        extractionProgress[urlLimpia].scanned += batch.length;
    }
    
    extractionProgress[urlLimpia].phase = 'Generando archivo CSV...';
    return finalImagesList;
}

// ENDPOINT PRINCIPAL (Genera CSV)
app.post('/extract-images', async (req, res) => {
    const rawKey = req.headers['x-api-key'] || '';
    if (rawKey.trim() !== API_KEY) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const { url } = req.body;
    if (!url) return res.status(400).json({ success: false, error: 'URL requerida' });

    try {
        const images = await extractStoreImages(url);
        if (images.length === 0) return res.status(404).json({ success: false, error: 'No se encontraron imágenes.' });

        let csv = 'Origen,Nombre de Archivo,Peso,Ancho (px),Alto (px),Metadato (Alt),URL\n';
        images.forEach(img => { csv += `"${img.origen}","${img.nombre}","${img.peso}",${img.ancho},${img.alto},"${img.metadatos}","${img.url}"\n`; });

        res.header('Content-Type', 'text/csv; charset=utf-8');
        return res.send(csv);
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});

// NUEVO ENDPOINT: CONSULTAR PROGRESO DESDE EL FRONTEND
app.get('/extract-progress', (req, res) => {
    const { url } = req.query;
    if (!url) return res.json({ total: 0, scanned: 0, phase: 'Esperando...' });
    
    let urlLimpia = url.trim();
    if (!urlLimpia.startsWith('http')) urlLimpia = `https://${urlLimpia}`;

    const currentProgress = extractionProgress[urlLimpia] || { total: 0, scanned: 0, phase: 'Iniciando escaneo...' };
    res.json(currentProgress);
});

app.listen(PORT, () => {
  console.log(`Bot escuchando comandos manuales en el puerto ${PORT}`);
});

// Cron programado a las 9:00 AM y 6:00 PM
cron.schedule('0 9,18 * * *', () => {
  console.log("[Cron] Ejecutando analisis automatico programado...");
  ejecutarAnalisisAutomated();
}, {
  timezone: "America/Lima"
});

// Endpoint para procesar una URL individual on-demand
app.post('/run-single', async (req, res) => {
    const rawKey = req.headers['x-api-key'] || '';
    if (rawKey.trim() !== API_KEY) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { url } = req.body;
    if (!url) {
        return res.status(400).json({ success: false, error: 'URL is required' });
    }

    try {
        console.log(`[INFO] Iniciando analisis individual para: ${url}`);
        const metrics = await performPuppeteerAnalysis(url);
        console.log(`[SUCCESS] Analisis individual completado.`);
        return res.json({ success: true, data: metrics });
    } catch (error) {
        console.error(`[ERROR] Fallo el analisis individual:`, error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
});

async function performPuppeteerAnalysis(targetUrl) {
    let urlLimpia = targetUrl.trim();
    if (!urlLimpia.startsWith('http')) {
        urlLimpia = `https://${urlLimpia}`;
    }

    const browser = await puppeteer.launch({
        headless: 'new',
        args: [
            '--enable-precise-memory-info',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled'
        ]
    });
    
    try {
        const page = await browser.newPage();
        
        // Emulacion de red (3G Fast / 4G)
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

        // 🌟 SOLUCIÓN BLINDADA PARA ANÁLISIS INDIVIDUAL
        try {
            await page.goto(urlLimpia, { waitUntil: 'domcontentloaded', timeout: 45000 });
            await new Promise(r => setTimeout(r, 4000));
        } catch (navError) {
            console.warn(`⚠️ [Timeout Parcial] La red no hizo silencio en ${urlLimpia}, forzando extracción de métricas...`);
        }
        
        const pageMetrics = await page.evaluate(() => {
            const nav = performance.getEntriesByType('navigation')[0];
            const resources = performance.getEntriesByType('resource');
            const memory = performance.memory;
            let totalBytes = 0;
            resources.forEach(res => { if (res.transferSize) totalBytes += res.transferSize; });
            
            // Salvaguarda si el evento load nunca disparó por el timeout
            const currentMs = Math.round(performance.now());
            
            return {
                load_ms: (nav && nav.loadEventEnd > 0) ? Math.round(nav.loadEventEnd - nav.startTime) : currentMs,
                dom_interactive_ms: nav ? Math.round(nav.domInteractive - nav.startTime) : currentMs / 2,
                ram_total_mb: memory ? parseFloat((memory.totalJSHeapSize / 1024 / 1024).toFixed(2)) : 0,
                ram_core_mb: memory ? parseFloat((memory.usedJSHeapSize / 1024 / 1024).toFixed(2)) : 0,
                total_requests: resources.length + 1,
                total_weight_mb: parseFloat((totalBytes / 1024 / 1024).toFixed(2))
            };
        });

        await browser.close();

        return {
            url: urlLimpia,
            load_ms: pageMetrics.load_ms,
            dom_ms: pageMetrics.dom_interactive_ms,
            ram_total_mb: pageMetrics.ram_total_mb,
            ram_core_mb: pageMetrics.ram_core_mb,
            total_requests: pageMetrics.total_requests,
            total_weight_mb: pageMetrics.total_weight_mb
        };
    } catch (err) {
        if (browser) await browser.close();
        throw err;
    }
}