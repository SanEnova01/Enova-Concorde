// Evita que este proxy se use para consultar servicios internos (SSRF)
const isPublicHttpUrl = (raw) => {
  try {
    const u = new URL(raw);
    if (!['http:', 'https:'].includes(u.protocol)) return false;
    const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') || h === '::1' || h === '0.0.0.0') return false;
    if (/^(127|10|0)\./.test(h) || /^192\.168\./.test(h) || /^169\.254\./.test(h)) return false;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return false;
    if (/^(fc|fd|fe80)/.test(h) && h.includes(':')) return false;
    return true;
  } catch (e) {
    return false;
  }
};

module.exports = { isPublicHttpUrl };
