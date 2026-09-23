const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const pidusage = require('pidusage');
const cron = require('node-cron');

puppeteer.use(StealthPlugin());

// ============================================================
// CONFIGURACIÓN RAILWAY
// ============================================================

const RAILWAY_PUPPETEER_ARGS = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--no-zygote',
    '--disable-crash-reporter',
    '--disable-breakpad',
    '--disable-software-rasterizer',
    '--disable-ipc-flooding-protection',
    '--enable-precise-memory-info',
    '--disable-blink-features=AutomationControlled'
];

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;

const API_BASE_URL =
    process.env.API_BASE_URL ||
    'https://enova-concorde-staging-2027.up.railway.app/api';

const API_KEY =
    process.env.API_KEY ||
    'ENOVA_SECRET_API_KEY_2026';

// Planes permitidos para ser analizados
const PLANES_VALIDOS = [
    'go',
    'growth',
    'escale',
    'scale',
    'scale_plus'
];

let estaEjecutando = false;

// ============================================================
// HELPERS
// ============================================================

function normalizarUrl(targetUrl) {
    if (!targetUrl) return '';

    let url = String(targetUrl).trim();

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = `https://${url}`;
    }

    return url;
}

// ============================================================
// 1. OBTENER TIENDAS DESDE LA BD DE CONCORDE
// ============================================================

async function obtenerTiendasFiltradas() {
    try {
        const res = await fetch(`${API_BASE_URL}/stores`, {
            headers: {
                'x-api-key': API_KEY
            }
        });

        const jsonResponse = await res.json();

        console.log(
            '🔍 [DEBUG] Respuesta de /stores:',
            JSON.stringify(jsonResponse)
        );

        let tiendas = [];

        if (Array.isArray(jsonResponse)) {
            tiendas = jsonResponse;
        } else if (Array.isArray(jsonResponse.data)) {
            tiendas = jsonResponse.data;
        } else if (Array.isArray(jsonResponse.stores)) {
            tiendas = jsonResponse.stores;
        } else if (
            jsonResponse.data &&
            Array.isArray(jsonResponse.data.stores)
        ) {
            tiendas = jsonResponse.data.stores;
        } else {
            console.error(
                '❌ El backend no devolvió un Array. Estructura recibida:',
                jsonResponse
            );

            return [];
        }

        const filtradas = tiendas.filter((t) => {
            const planLimpio = String(
                t.plan_type || t.plan || ''
            )
                .toLowerCase()
                .trim();

            const tieneWeb =
                (t.web || t.url) &&
                String(t.web || t.url).trim() !== '';

            return (
                tieneWeb &&
                PLANES_VALIDOS.includes(planLimpio)
            );
        });

        console.log(
            `📋 [Filtro] Se encontraron ${filtradas.length} tiendas con plan elegible (${PLANES_VALIDOS.join(', ')}).`
        );

        return filtradas;
    } catch (error) {
        console.error(
            '❌ Error obteniendo tiendas de la API:',
            error.message
        );

        return [];
    }
}

// ============================================================
// 2. ENVIAR MÉTRICAS AL BACKEND
// ============================================================

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

        return data.success
            ? { status: 'success' }
            : {
                  status: 'error',
                  message: data.error
              };
    } catch (error) {
        return {
            status: 'network_error',
            message: error.message
        };
    }
}

// ============================================================
// 3. NOTIFICACIÓN DE FINALIZACIÓN
// ============================================================

async function notificarFinalizacion(
    total,
    exitosos,
    fallidos,
    fechaActual
) {
    try {
        await fetch(
            `${API_BASE_URL}/metrics/notify-completion`,
            {
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
            }
        );

        console.log(
            '📧 Correo de notificación enviado con éxito.'
        );
    } catch (error) {
        console.error(
            'Error enviando correo de notificación:',
            error.message
        );
    }
}

// ============================================================
// 4. ANÁLISIS PRINCIPAL AUTOMATIZADO
// ============================================================

async function ejecutarAnalisisAutomated() {
    if (estaEjecutando) {
        console.log(
            '⚠️ Ya hay un análisis en curso. Solicitud omitida.'
        );

        return {
            success: false,
            message: 'Un análisis ya se encuentra en ejecución.'
        };
    }

    estaEjecutando = true;

    const fechaActual = new Date().toISOString();

    try {
        const tiendas = await obtenerTiendasFiltradas();

        if (tiendas.length === 0) {
            console.log(
                '⚠️ No se encontraron tiendas activas para analizar.'
            );

            return {
                success: false,
                message:
                    'No hay tiendas activas registradas con los planes permitidos.'
            };
        }

        console.log(
            `\n▶ [${new Date().toLocaleTimeString()}] INICIANDO ANÁLISIS AUTOMÁTICO EN ${tiendas.length} TIENDAS...`
        );

        let exitosos = 0;
        let fallidos = 0;

        for (let i = 0; i < tiendas.length; i++) {
            const web = tiendas[i];

            let browser = null;

            try {
                const urlLimpia = normalizarUrl(
                    web.web || web.url
                );

                console.log(
                    `\n🌐 [${i + 1}/${tiendas.length}] Analizando: ${web.name}`
                );

                console.log(
                    `🔗 URL: ${urlLimpia}`
                );

                // ====================================================
                // LANZAMIENTO NORMAL DE CHROMIUM
                //
                // NO HAY:
                // - CPU throttling
                // - Network throttling
                // - Mobile viewport
                // - iPhone User-Agent
                // - Cache deshabilitada
                // ====================================================

                browser = await puppeteer.launch({
                    headless: 'new',
                    args: RAILWAY_PUPPETEER_ARGS
                });

                const browserPid =
                    browser.process()?.pid;

                const page = await browser.newPage();

                // ====================================================
                // NAVEGACIÓN NORMAL
                // ====================================================

                try {
                    await page.goto(urlLimpia, {
                        waitUntil: 'domcontentloaded',
                        timeout: 30000
                    });

                    // Permitimos que terminen recursos y scripts
                    await new Promise((resolve) =>
                        setTimeout(resolve, 4000)
                    );
                } catch (navError) {
                    console.warn(
                        `⚠️ [Timeout Parcial] La página no terminó de cargar completamente en ${urlLimpia}.`
                    );

                    console.warn(
                        `⚠️ Se intentarán extraer las métricas disponibles.`
                    );

                    await page
                        .evaluate(() => window.stop())
                        .catch(() => {});
                }

                // ====================================================
                // MÉTRICAS DEL NAVEGADOR
                // ====================================================

                const datosReporte = await page.evaluate(() => {
                    const nav =
                        performance.getEntriesByType(
                            'navigation'
                        )[0];

                    const resources =
                        performance.getEntriesByType(
                            'resource'
                        );

                    const memory =
                        performance.memory;

                    let totalBytes = 0;

                    resources.forEach((resource) => {
                        if (resource.transferSize) {
                            totalBytes +=
                                resource.transferSize;
                        }
                    });

                    const currentMs =
                        Math.round(
                            performance.now()
                        );

                    return {
                        redirect: nav
                            ? Math.round(
                                  nav.redirectEnd -
                                      nav.redirectStart
                              )
                            : 0,

                        dns: nav
                            ? Math.round(
                                  nav.domainLookupEnd -
                                      nav.domainLookupStart
                              )
                            : 0,

                        tcp: nav
                            ? Math.round(
                                  nav.connectEnd -
                                      nav.connectStart
                              )
                            : 0,

                        ttfb: nav
                            ? Math.round(
                                  nav.responseStart -
                                      nav.startTime
                              )
                            : 0,

                        domInteractive: nav
                            ? Math.round(
                                  nav.domInteractive -
                                      nav.startTime
                              )
                            : currentMs / 2,

                        domReady: nav
                            ? Math.round(
                                  nav.domContentLoadedEventEnd -
                                      nav.startTime
                              )
                            : currentMs / 2,

                        loadTime:
                            nav &&
                            nav.loadEventEnd > 0
                                ? Math.round(
                                      nav.loadEventEnd -
                                          nav.startTime
                                  )
                                : currentMs,

                        peso: (
                            totalBytes /
                            1024 /
                            1024
                        ).toFixed(2),

                        peticiones:
                            resources.length + 1,

                        ramCore: memory
                            ? (
                                  memory.usedJSHeapSize /
                                  1024 /
                                  1024
                              ).toFixed(2)
                            : 0
                    };
                });

                // ====================================================
                // RAM DEL PROCESO DE CHROMIUM
                // ====================================================

                let ramTotalMB = 0;

                if (browserPid) {
                    try {
                        const statsOS =
                            await pidusage(
                                browserPid
                            );

                        ramTotalMB = parseFloat(
                            (
                                statsOS.memory /
                                1024 /
                                1024
                            ).toFixed(2)
                        );
                    } catch (memoryError) {
                        console.warn(
                            '⚠️ No se pudo obtener RAM del proceso:',
                            memoryError.message
                        );
                    }
                }

                // ====================================================
                // PAYLOAD
                // ====================================================

                const payload = {
                    store_id: web.id,
                    date: fechaActual,

                    server_status: 'ONLINE',

                    // Antes:
                    // Auto-Mobile-4G
                    //
                    // Ahora:
                    // Navegador real sin throttling artificial
                    web_flow: 'Real-Browser',

                    redirect_ms:
                        datosReporte.redirect || 0,

                    dns_ms:
                        datosReporte.dns || 0,

                    tcp_ms:
                        datosReporte.tcp || 0,

                    ttfb_ms:
                        datosReporte.ttfb || 0,

                    dom_interactive_ms:
                        datosReporte.domInteractive || 0,

                    dom_ms:
                        datosReporte.domReady || 0,

                    load_ms:
                        datosReporte.loadTime || 0,

                    total_weight_mb:
                        parseFloat(
                            datosReporte.peso || 0
                        ),

                    total_requests:
                        parseInt(
                            datosReporte.peticiones || 0
                        ),

                    ram_core_mb:
                        parseFloat(
                            datosReporte.ramCore || 0
                        ),

                    ram_total_mb:
                        ramTotalMB
                };

                // ====================================================
                // ENVIAR AL BACKEND
                // ====================================================

                const apiResponse =
                    await enviarMetricasAPI(
                        payload
                    );

                if (
                    apiResponse.status ===
                    'success'
                ) {
                    exitosos++;
                } else {
                    fallidos++;
                }

                console.log(
                    `✔ [${i + 1}/${tiendas.length}] ${web.name} (${web.plan_type})`
                );

                console.log(
                    `   Load: ${datosReporte.loadTime}ms`
                );

                console.log(
                    `   Peso: ${datosReporte.peso}MB`
                );

                console.log(
                    `   Requests: ${datosReporte.peticiones}`
                );

                console.log(
                    `   RAM Chromium: ${ramTotalMB}MB`
                );

                console.log(
                    `   Perfil: Real-Browser`
                );
            } catch (error) {
                console.error(
                    `✖ ${web.name} | ERROR: ${error.message}`
                );

                fallidos++;

                await enviarMetricasAPI({
                    store_id: web.id,
                    date: fechaActual,
                    server_status: 'OFFLINE',
                    web_flow: 'Crash',

                    ram_core_mb: 0,
                    ram_total_mb: 0,

                    redirect_ms: 0,
                    dns_ms: 0,
                    tcp_ms: 0,
                    ttfb_ms: 0,
                    dom_interactive_ms: 0,
                    dom_ms: 0,
                    load_ms: 0,

                    total_weight_mb: 0,
                    total_requests: 0
                });
            } finally {
                // ====================================================
                // CIERRE SEGURO DEL NAVEGADOR
                // ====================================================

                if (browser) {
                    try {
                        await browser.close();
                    } catch (closeError) {
                        console.warn(
                            '⚠️ Error cerrando navegador:',
                            closeError.message
                        );
                    }
                }
            }

            try {
                pidusage.clear();
            } catch (e) {}

            // ====================================================
            // COOLDOWN
            // ====================================================

            console.log(
                '⏳ [Cooldown] Esperando 15 segundos antes de la siguiente tienda...'
            );

            await new Promise((resolve) =>
                setTimeout(resolve, 15000)
            );
        }

        console.log(
            '\n✅ ANÁLISIS FINALIZADO.'
        );

        await notificarFinalizacion(
            tiendas.length,
            exitosos,
            fallidos,
            fechaActual
        );

        return {
            success: true,
            message:
                'Análisis finalizado exitosamente'
        };
    } catch (error) {
        console.error(
            '❌ Error general del análisis:',
            error.message
        );

        return {
            success: false,
            message: error.message
        };
    } finally {
        estaEjecutando = false;
    }
}

// ============================================================
// 5. HEARTBEAT
// ============================================================

async function enviarHeartbeat() {
    try {
        const res = await fetch(
            `${API_BASE_URL}/metrics/bot-heartbeat`,
            {
                method: 'POST',
                headers: {
                    'Content-Type':
                        'application/json',
                    'x-api-key': API_KEY
                },
                body: JSON.stringify({
                    is_running: estaEjecutando
                })
            }
        );

        if (res.ok) {
            console.log(
                '💓 [Heartbeat] Latido enviado con éxito al Backend.'
            );
        } else {
            console.error(
                `⚠️ [Heartbeat] Servidor respondió con estado: ${res.status}`
            );
        }
    } catch (error) {
        console.error(
            '❌ Error enviando heartbeat:',
            error.message
        );
    }
}

setInterval(
    enviarHeartbeat,
    60 * 1000
);

setTimeout(() => {
    enviarHeartbeat();
}, 15000);

// ============================================================
// 6. ENDPOINT /run-force
// ============================================================

app.post('/run-force', async (req, res) => {
    const rawKey =
        req.headers['x-api-key'] || '';

    if (rawKey.trim() !== API_KEY) {
        return res.status(401).json({
            success: false,
            error: 'API Key no autorizada'
        });
    }

    if (estaEjecutando) {
        return res.json({
            success: false,
            message:
                'El bot ya está ejecutando un análisis actualmente.'
        });
    }

    ejecutarAnalisisAutomated();

    res.json({
        success: true,
        message:
            'Análisis forzado iniciado correctamente.'
    });
});

// ============================================================
// 7. STATUS
// ============================================================

app.get('/status', (req, res) => {
    res.json({
        running: estaEjecutando
    });
});

// ============================================================
// 8. EXTRACTOR MASIVO DE PRODUCTOS
// ============================================================

const extractionProgress = {};

async function extractStoreImages(targetUrl) {
    let urlLimpia = normalizarUrl(targetUrl);

    urlLimpia = urlLimpia.replace(/\/+$/, '');

    extractionProgress[urlLimpia] = {
        total: 0,
        scanned: 0,
        phase:
            '1/3: Escaneando APIs de Catálogo...'
    };

    const uniqueImagesMap = new Map();

    const addImage = (
        url,
        origen,
        nombre,
        ancho = 0,
        alto = 0
    ) => {
        if (
            !url ||
            !url.startsWith('http')
        ) {
            return;
        }

        const cleanUrl =
            url.split('?')[0];

        if (!uniqueImagesMap.has(cleanUrl)) {
            uniqueImagesMap.set(
                cleanUrl,
                {
                    url: cleanUrl,
                    origen,
                    nombre:
                        nombre ||
                        cleanUrl
                            .split('/')
                            .pop(),
                    ancho,
                    alto,
                    peso: null
                }
            );
        }
    };

    // ============================================================
    // SHOPIFY
    // ============================================================

    let isShopify = false;

    try {
        let pageShopify = 1;
        let keepFetching = true;

        while (keepFetching) {
            const res = await fetch(
                `${urlLimpia}/products.json?limit=250&page=${pageShopify}`
            );

            if (res.ok) {
                isShopify = true;

                const data =
                    await res.json();

                if (
                    data.products &&
                    data.products.length > 0
                ) {
                    for (const p of data.products) {
                        for (const img of p.images) {
                            addImage(
                                img.src,
                                `Catálogo Shopify: ${p.title}`,
                                img.src
                                    .split('/')
                                    .pop(),
                                img.width,
                                img.height
                            );
                        }
                    }

                    pageShopify++;
                } else {
                    keepFetching = false;
                }
            } else {
                keepFetching = false;
            }
        }
    } catch (e) {
        console.warn(
            '⚠️ Shopify API no disponible.'
        );
    }

    // ============================================================
    // WOOCOMMERCE
    // ============================================================

    if (!isShopify) {
        try {
            let pageWoo = 1;
            let keepFetching = true;

            while (keepFetching) {
                const res = await fetch(
                    `${urlLimpia}/wp-json/wc/store/products?per_page=50&page=${pageWoo}`
                );

                if (res.ok) {
                    const data =
                        await res.json();

                    if (
                        data &&
                        data.length > 0
                    ) {
                        for (const p of data) {
                            if (
                                p.images &&
                                p.images.length > 0
                            ) {
                                for (const img of p.images) {
                                    addImage(
                                        img.src,
                                        `Catálogo Woo: ${p.name}`,
                                        img.name ||
                                            img.src
                                                .split(
                                                    '/'
                                                )
                                                .pop()
                                    );
                                }
                            }
                        }

                        pageWoo++;
                    } else {
                        keepFetching = false;
                    }
                } else {
                    keepFetching = false;
                }
            }
        } catch (e) {
            console.warn(
                '⚠️ WooCommerce API no disponible.'
            );
        }
    }

    // ============================================================
    // SITEMAPS
    // ============================================================

    extractionProgress[
        urlLimpia
    ].phase =
        '2/3: Mapeando Sitemaps de Productos...';

    const productLinks =
        new Set();

    try {
        const sitemaps = [
            '/sitemap.xml',
            '/sitemap_index.xml',
            '/product-sitemap.xml',
            '/sitemap_products_1.xml'
        ];

        for (const sm of sitemaps) {
            const res = await fetch(
                `${urlLimpia}${sm}`
            ).catch(() => null);

            if (res && res.ok) {
                const text =
                    await res.text();

                const locs = [
                    ...text.matchAll(
                        /<loc>(.*?)<\/loc>/g
                    )
                ].map((m) => m[1]);

                const prodSitemaps =
                    locs.filter(
                        (href) =>
                            href.includes(
                                'product-sitemap'
                            ) ||
                            href.includes(
                                'sitemap_products'
                            )
                    );

                for (const subSm of prodSitemaps) {
                    const subRes =
                        await fetch(
                            subSm
                        ).catch(
                            () => null
                        );

                    if (
                        subRes &&
                        subRes.ok
                    ) {
                        const subText =
                            await subRes.text();

                        const imgMatches = [
                            ...subText.matchAll(
                                /<image:loc>(.*?)<\/image:loc>/g
                            )
                        ].map(
                            (m) => m[1]
                        );

                        imgMatches.forEach(
                            (imgUrl) =>
                                addImage(
                                    imgUrl,
                                    'Sitemap Image',
                                    imgUrl
                                        .split(
                                            '/'
                                        )
                                        .pop()
                                )
                        );

                        const subLocs = [
                            ...subText.matchAll(
                                /<loc>(.*?)<\/loc>/g
                            )
                        ].map(
                            (m) => m[1]
                        );

                        subLocs.forEach(
                            (href) => {
                                if (
                                    href.includes(
                                        '/product/'
                                    ) ||
                                    href.includes(
                                        '/producto/'
                                    ) ||
                                    href.includes(
                                        '/p/'
                                    ) ||
                                    href.includes(
                                        '/products/'
                                    )
                                ) {
                                    productLinks.add(
                                        href
                                    );
                                }
                            }
                        );
                    }
                }

                locs.forEach(
                    (href) => {
                        if (
                            href.includes(
                                '/product/'
                            ) ||
                            href.includes(
                                '/producto/'
                            ) ||
                            href.includes(
                                '/p/'
                            ) ||
                            href.includes(
                                '/products/'
                            )
                        ) {
                            productLinks.add(
                                href
                            );
                        }
                    }
                );
            }
        }
    } catch (e) {
        console.warn(
            '⚠️ Error procesando sitemaps.'
        );
    }

    // ============================================================
    // CRAWLING FRONTAL
    // ============================================================

    const linksArray =
        Array.from(
            productLinks
        ).slice(0, 20);

    if (linksArray.length > 0) {
        let browser = null;

        try {
            browser =
                await puppeteer.launch({
                    headless: 'new',
                    args: RAILWAY_PUPPETEER_ARGS
                });

            const page =
                await browser.newPage();

            // NO se fuerza User-Agent.
            // Puppeteer/Chromium utiliza su configuración normal.

            for (
                let i = 0;
                i < linksArray.length;
                i++
            ) {
                extractionProgress[
                    urlLimpia
                ].phase =
                    `Escaneando vista de Producto ${i + 1}/${linksArray.length}...`;

                try {
                    await page.goto(
                        linksArray[i],
                        {
                            waitUntil:
                                'domcontentloaded',
                            timeout: 10000
                        }
                    );

                    const prodImages =
                        await page.evaluate(
                            (urlProd) => {
                                return Array.from(
                                    document.querySelectorAll(
                                        'img'
                                    )
                                )
                                    .filter(
                                        (img) =>
                                            img.naturalWidth >
                                                150 ||
                                            img.width >
                                                150
                                    )
                                    .map(
                                        (img) => ({
                                            url:
                                                img.src ||
                                                img.dataset
                                                    .src ||
                                                img.dataset
                                                    .lazySrc,

                                            ancho:
                                                img.naturalWidth ||
                                                img.width ||
                                                0,

                                            alto:
                                                img.naturalHeight ||
                                                img.height ||
                                                0,

                                            origen: `Rastreo Frontal: ${urlProd
                                                .split(
                                                    '/'
                                                )
                                                .pop()}`
                                        })
                                    );
                            },
                            linksArray[i]
                        );

                    prodImages.forEach(
                        (img) =>
                            addImage(
                                img.url,
                                img.origen,
                                img.url
                                    ? img.url
                                          .split(
                                              '/'
                                          )
                                          .pop()
                                    : '',
                                img.ancho,
                                img.alto
                            )
                    );
                } catch (e) {}
            }
        } catch (e) {
            console.error(
                '❌ Error en navegador del extractor:',
                e.message
            );
        } finally {
            if (browser) {
                try {
                    await browser.close();
                } catch (e) {}
            }
        }
    }

    // ============================================================
    // PESOS DE IMÁGENES
    // ============================================================

    const finalImagesList =
        Array.from(
            uniqueImagesMap.values()
        );

    extractionProgress[
        urlLimpia
    ].phase =
        '3/3: Calculando pesos reales de los archivos...';

    extractionProgress[
        urlLimpia
    ].total =
        finalImagesList.length;

    const BATCH_SIZE = 25;

    for (
        let i = 0;
        i < finalImagesList.length;
        i += BATCH_SIZE
    ) {
        const batch =
            finalImagesList.slice(
                i,
                i + BATCH_SIZE
            );

        await Promise.all(
            batch.map(
                async (img) => {
                    try {
                        const headRes =
                            await fetch(
                                img.url,
                                {
                                    method:
                                        'HEAD'
                                }
                            );

                        const sizeBytes =
                            headRes.headers.get(
                                'content-length'
                            );

                        if (sizeBytes) {
                            const kb =
                                parseInt(
                                    sizeBytes
                                ) / 1024;

                            img.peso =
                                kb > 1024
                                    ? (
                                          kb /
                                          1024
                                      ).toFixed(
                                          2
                                      ) +
                                      ' MB'
                                    : kb.toFixed(
                                          2
                                      ) +
                                      ' KB';
                        } else {
                            img.peso =
                                'Desconocido';
                        }
                    } catch (e) {
                        img.peso =
                            'Error de conexión';
                    }
                }
            )
        );

        extractionProgress[
            urlLimpia
        ].scanned +=
            batch.length;
    }

    extractionProgress[
        urlLimpia
    ].phase =
        'Generando archivo CSV...';

    return finalImagesList;
}

// ============================================================
// 9. ENDPOINT EXTRACT-IMAGES
// ============================================================

app.post(
    '/extract-images',
    async (req, res) => {
        const rawKey =
            req.headers['x-api-key'] || '';

        if (
            rawKey.trim() !==
            API_KEY
        ) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized'
            });
        }

        const { url } = req.body;

        if (!url) {
            return res.status(400).json({
                success: false,
                error: 'URL requerida'
            });
        }

        try {
            const images =
                await extractStoreImages(
                    url
                );

            if (
                images.length === 0
            ) {
                return res.status(404).json({
                    success: false,
                    error:
                        'No se encontraron imágenes de productos.'
                });
            }

            let csv =
                'Origen,Nombre de Archivo,Peso,Ancho (px),Alto (px),URL\n';

            images.forEach(
                (img) => {
                    csv +=
                        `"${img.origen}","${img.nombre}","${img.peso}",${img.ancho},${img.alto},"${img.url}"\n`;
                }
            );

            res.header(
                'Content-Type',
                'text/csv; charset=utf-8'
            );

            return res.send(csv);
        } catch (error) {
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

// ============================================================
// 10. PROGRESO DEL EXTRACTOR
// ============================================================

app.get(
    '/extract-progress',
    (req, res) => {
        const { url } =
            req.query;

        if (!url) {
            return res.json({
                total: 0,
                scanned: 0,
                phase: 'Esperando...'
            });
        }

        let urlLimpia =
            normalizarUrl(url);

        urlLimpia =
            urlLimpia.replace(
                /\/+$/,
                ''
            );

        const currentProgress =
            extractionProgress[
                urlLimpia
            ] || {
                total: 0,
                scanned: 0,
                phase:
                    'Iniciando motor...'
            };

        res.json(
            currentProgress
        );
    }
);

// ============================================================
// 11. CRON
// ============================================================

cron.schedule(
    '0 9,18 * * *',
    () => {
        console.log(
            '[Cron] Ejecutando análisis automático programado...'
        );

        ejecutarAnalisisAutomated();
    },
    {
        timezone:
            'America/Lima'
    }
);

// ============================================================
// 12. ANÁLISIS INDIVIDUAL
// ============================================================

app.post(
    '/run-single',
    async (req, res) => {
        const rawKey =
            req.headers['x-api-key'] || '';

        if (
            rawKey.trim() !==
            API_KEY
        ) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized'
            });
        }

        const { url } = req.body;

        if (!url) {
            return res.status(400).json({
                success: false,
                error: 'URL is required'
            });
        }

        try {
            console.log(
                `[INFO] Iniciando analisis individual para: ${url}`
            );

            const metrics =
                await performPuppeteerAnalysis(
                    url
                );

            console.log(
                '[SUCCESS] Analisis individual completado.'
            );

            return res.json({
                success: true,
                data: metrics
            });
        } catch (error) {
            console.error(
                '[ERROR] Fallo el analisis individual:',
                error.message
            );

            return res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

// ============================================================
// 13. PUPPETEER - ANÁLISIS INDIVIDUAL
// ============================================================

async function performPuppeteerAnalysis(
    targetUrl
) {
    const urlLimpia =
        normalizarUrl(
            targetUrl
        );

    let browser = null;

    try {
        // ========================================================
        // CHROMIUM NORMAL
        //
        // SIN:
        // - CPU THROTTLING
        // - NETWORK THROTTLING
        // - MOBILE VIEWPORT
        // - IPHONE USER AGENT
        // - CACHE DISABLED
        // ========================================================

        browser =
            await puppeteer.launch({
                headless: 'new',
                args: RAILWAY_PUPPETEER_ARGS
            });

        const page =
            await browser.newPage();

        try {
            await page.goto(
                urlLimpia,
                {
                    waitUntil:
                        'domcontentloaded',
                    timeout: 30000
                }
            );

            await new Promise(
                (resolve) =>
                    setTimeout(
                        resolve,
                        4000
                    )
            );
        } catch (navError) {
            console.warn(
                `⚠️ [Timeout Parcial] La página no terminó de cargar completamente en ${urlLimpia}.`
            );

            await page
                .evaluate(
                    () =>
                        window.stop()
                )
                .catch(() => {});
        }

        const pageMetrics =
            await page.evaluate(
                () => {
                    const nav =
                        performance.getEntriesByType(
                            'navigation'
                        )[0];

                    const resources =
                        performance.getEntriesByType(
                            'resource'
                        );

                    const memory =
                        performance.memory;

                    let totalBytes = 0;

                    resources.forEach(
                        (resource) => {
                            if (
                                resource.transferSize
                            ) {
                                totalBytes +=
                                    resource.transferSize;
                            }
                        }
                    );

                    const currentMs =
                        Math.round(
                            performance.now()
                        );

                    return {
                        load_ms:
                            nav &&
                            nav.loadEventEnd >
                                0
                                ? Math.round(
                                      nav.loadEventEnd -
                                          nav.startTime
                                  )
                                : currentMs,

                        dom_interactive_ms:
                            nav
                                ? Math.round(
                                      nav.domInteractive -
                                          nav.startTime
                                  )
                                : currentMs /
                                  2,

                        ram_total_mb:
                            memory
                                ? parseFloat(
                                      (
                                          memory.totalJSHeapSize /
                                          1024 /
                                          1024
                                      ).toFixed(
                                          2
                                      )
                                  )
                                : 0,

                        ram_core_mb:
                            memory
                                ? parseFloat(
                                      (
                                          memory.usedJSHeapSize /
                                          1024 /
                                          1024
                                      ).toFixed(
                                          2 
                                      )
                                  )
                                : 0,

                        total_requests:
                            resources.length +
                            1,

                        total_weight_mb:
                            parseFloat(
                                (
                                    totalBytes /
                                    1024 /
                                    1024
                                ).toFixed(
                                    2
                                )
                            )
                    };
                }
            );

        return {
            url: urlLimpia,

            load_ms:
                pageMetrics.load_ms,

            dom_ms:
                pageMetrics.dom_interactive_ms,

            ram_total_mb:
                pageMetrics.ram_total_mb,

            ram_core_mb:
                pageMetrics.ram_core_mb,

            total_requests:
                pageMetrics.total_requests,

            total_weight_mb:
                pageMetrics.total_weight_mb,

            web_flow:
                'Real-Browser'
        };
    } finally {
        if (browser) {
            try {
                await browser.close();
            } catch (closeError) {
                console.warn(
                    '⚠️ Error cerrando navegador:',
                    closeError.message
                );
            }
        }
    }
}

// ============================================================
// 14. INICIAR SERVIDOR
// ============================================================

app.listen(PORT, () => {
    console.log(
        `🚀 Bot escuchando comandos manuales en el puerto ${PORT}`
    );

    console.log(
        '🌐 Perfil de medición: Real-Browser'
    );

    console.log(
        '🚫 CPU throttling: DESACTIVADO'
    );

    console.log(
        '🚫 Network throttling: DESACTIVADO'
    );

    console.log(
        '🚫 Mobile emulation: DESACTIVADA'
    );

    console.log(
        '🚫 Cache deshabilitada: NO'
    );
});