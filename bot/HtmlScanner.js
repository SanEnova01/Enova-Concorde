async function escanearEstructuraHtml(page) {
    try {
        const estructura = await page.evaluate(() => {
            const scripts = Array.from(document.querySelectorAll('script[src]')).map(s => s.src);
            const iframes = Array.from(document.querySelectorAll('iframe[src]')).map(i => i.src);
            const errorNodes = document.querySelectorAll('.error, .fatal, .exception, .alert-danger').length;
            const domElements = document.getElementsByTagName('*').length;

            const extractDomain = (url) => {
                try { return new URL(url).hostname; } catch(e) { return null; }
            };

            const externalDomains = [...new Set([...scripts, ...iframes].map(extractDomain).filter(Boolean))];

            return {
                total_scripts: scripts.length,
                total_iframes: iframes.length,
                external_domains: externalDomains,
                error_elements: errorNodes,
                total_dom_nodes: domElements
            };
        });
        
        return estructura;
    } catch (error) {
        console.warn('⚠️ Error en HtmlScanner:', error.message);
        return null;
    }
}

module.exports = { escanearEstructuraHtml };