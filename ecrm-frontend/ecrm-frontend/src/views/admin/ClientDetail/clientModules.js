// ============================================================
// REGISTRO DE MÓDULOS
// - id: identificador estable (se guarda en BD y en localStorage)
// - span: 'full' ocupa toda la fila, 'half' media fila
// - configurable: si el admin puede ocultarlo por plan / por cliente
// ============================================================
export const MODULES = [
  { id: 'quick_analysis',   label: 'Monitor de Rendimiento en Tiempo Real', span: 'full', configurable: true },
  { id: 'contact',          label: 'Datos de Contacto',                     span: 'half', configurable: true },
  { id: 'external_monitor', label: 'Monitor externo (Shopify / VTEX / Woo)', span: 'half', configurable: true },
  { id: 'performance',      label: 'Gráfico de Rendimiento',                span: 'half', configurable: true },
  { id: 'memory',           label: 'Memoria (VU)',                          span: 'half', configurable: true },
  { id: 'tickets',          label: 'Tickets',                               span: 'half', configurable: true },
  { id: 'metrics_history',  label: 'Historial de Métricas',                 span: 'half', configurable: true },
  { id: 'html_scan',        label: 'Radiografía HTML del Escaneo',          span: 'full', configurable: true },
  { id: 'quality',          label: 'Control de Calidad y Revisiones Manuales', span: 'full', configurable: true },
  { id: 'notes',            label: 'Notas Internas',                        span: 'full', configurable: false } // solo admins, nunca para clientes
];

export const DEFAULT_ORDER = MODULES.map(m => m.id);
export const CONFIGURABLE_IDS = MODULES.filter(m => m.configurable).map(m => m.id);

// ------------------------------------------------------------
// MÓDULOS POR PLAN (edita aquí qué ve cada plan por defecto)
// Hoy TODOS los planes ven TODOS los módulos, para no cambiar lo que ven
// los clientes actuales. Quita ids de la lista de un plan para ocultárselos.
// Un cliente concreto puede sobreescribir esto desde "Módulos del cliente".
// ------------------------------------------------------------
export const PLAN_MODULES = {
  GO:         [...CONFIGURABLE_IDS],
  GROWTH:     [...CONFIGURABLE_IDS],
  ESCALE:     [...CONFIGURABLE_IDS],
  SCALE:      [...CONFIGURABLE_IDS],
  SCALE_PLUS: [...CONFIGURABLE_IDS]
};

export const planDefaultEnabled = (planKey, id) => {
  const list = PLAN_MODULES[planKey];
  return list ? list.includes(id) : true; // planes no listados (WARRANTY, LEAD...) ven todo
};

export const parseJsonSafe = (raw) => {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return null; }
};
