async function escanearEstructuraHtml(page) {
    try {
        const estructura = await page.evaluate(() => {
            const scriptEls = Array.from(document.querySelectorAll('script[src]'));
            const scripts = scriptEls.map(s => s.src);
            const iframes = Array.from(document.querySelectorAll('iframe[src]')).map(i => i.src);
            const styleHrefs = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map(l => l.href);
            const errorNodes = document.querySelectorAll('.error, .fatal, .exception, .alert-danger').length;
            const domElements = document.getElementsByTagName('*').length;

            const extractDomain = (url) => {
                try { return new URL(url).hostname; } catch (e) { return null; }
            };

            const externalDomains = [...new Set([...scripts, ...iframes].map(extractDomain).filter(Boolean))];
            const allUrls = [...scripts, ...styleHrefs];
            const bodyClass = (document.body && document.body.className) ? String(document.body.className) : '';
            const generator = (document.querySelector('meta[name="generator"]') || {}).content || '';

            const unique = (arr, max) => [...new Set(arr)].sort().slice(0, max);
            const collect = (regex) => {
                const found = [];
                allUrls.forEach(u => {
                    const m = u.match(regex);
                    if (m && m[1]) found.push(decodeURIComponent(m[1]).toLowerCase());
                });
                return found;
            };

            let tech = 'custom';
            if (window.Shopify || allUrls.some(u => u.includes('cdn.shopify.com'))) {
                tech = 'shopify';
            } else if (window.vtex || window.__RUNTIME__ || allUrls.some(u => /vtexassets\.com|vteximg\.com|vtexcommercestable\.com/.test(u))) {
                tech = 'vtex';
            } else if (document.querySelector('script[type="text/x-magento-init"]') || /magento/i.test(generator)) {
                tech = 'magento';
            } else if (window.prestashop || /prestashop/i.test(generator)) {
                tech = 'prestashop';
            } else if (/woocommerce/.test(bodyClass) || allUrls.some(u => u.includes('/plugins/woocommerce/')) || window.wc_add_to_cart_params) {
                tech = 'woocommerce';
            } else if (allUrls.some(u => u.includes('/wp-content/')) || /wordpress/i.test(generator)) {
                tech = 'woocommerce';
            }

            let theme = null;
            let plugins = [];
            let apps = [];

            if (tech === 'shopify') {
                theme = (window.Shopify && window.Shopify.theme && window.Shopify.theme.name) ? String(window.Shopify.theme.name) : null;
                apps = unique(
                    collect(/cdn\.shopify\.com\/extensions\/[^/]+\/([^/]+)\//).map(a => a.replace(/-\d+$/, '')),
                    80
                );
            } else if (tech === 'woocommerce') {
                const themes = collect(/\/wp-content\/themes\/([^/]+)\//);
                theme = themes.length ? themes[0] : null;
                plugins = unique(collect(/\/wp-content\/plugins\/([^/]+)\//), 120);
            } else if (tech === 'vtex') {
                apps = unique(collect(/\/published\/([^/@]+)@/), 80);
            }

            const navEntry = performance.getEntriesByType('navigation')[0];
            const httpStatus = navEntry && navEntry.responseStatus ? navEntry.responseStatus : null;
            const title = (document.title || '').slice(0, 120);
            const blockedByTitle = /just a moment|attention required|access denied|verify you are human|captcha|are you a robot|checking your browser/i.test(title);
            const blockedSuspect = blockedByTitle || httpStatus === 403 || httpStatus === 429 || httpStatus === 503;

            const images = Array.from(document.images);

            return {
                total_scripts: scripts.length,
                total_iframes: iframes.length,
                external_domains: externalDomains,
                error_elements: errorNodes,
                total_dom_nodes: domElements,
                tech: tech,
                theme: theme,
                plugins: plugins,
                apps: apps,
                inline_scripts: document.querySelectorAll('script:not([src])').length,
                blocking_scripts: document.querySelectorAll('head script[src]:not([async]):not([defer]):not([type="module"])').length,
                stylesheets: styleHrefs.length,
                images_total: images.length,
                images_lazy: images.filter(i => i.loading === 'lazy').length,
                http_status: httpStatus,
                page_title: title,
                blocked_suspect: blockedSuspect
            };
        });

        return estructura;
    } catch (error) {
        console.warn('⚠️ Error en HtmlScanner:', error.message);
        return null;
    }
}

module.exports = { escanearEstructuraHtml };
