const { normalizeTech, techLabel } = require('./playbooks');

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const TASK_TYPES = ['BUG_FIX', 'TASK_INTERNA', 'CAMBIO', 'CONSULTA'];

function str(v, max = 600) {
  if (v === null || v === undefined) return '';
  return String(v).replace(/</g, '‹').replace(/>/g, '›').replace(/\s+/g, ' ').trim().slice(0, max);
}

function buildStoresCatalog(allStores) {
  return allStores
    .map(
      (s) =>
        `- ID: "${s.id}" | Nombre: "${s.name || ''}" | Web: "${s.web || ''}" | Emails: "${s.emails || ''}" | Tecnología: "${s.tecnologia || 'No registrada'}"`
    )
    .join('\n');
}

function buildSystemInstruction({ from, storesCatalog }) {
  return `Eres un sistema automatizado de triaje (Soporte Técnico Nivel 3) de una agencia de e-commerce.

Tu función es analizar LA CADENA ENTERA DE CORREOS para entender el problema, identificar exactamente a qué cliente/tienda corresponde el mensaje y devolver un objeto JSON estricto.

SOBRE EL RESUMEN:
- Debe ser autónomo y entendible sin leer la cadena original.
- Resume el problema actual, lo que el cliente solicita, los antecedentes importantes y las acciones ya realizadas.
- Máximo 4 oraciones.

IDENTIFICACIÓN DE TIENDA (CRÍTICO):
1. Analiza el remitente (${from}), el asunto, el cuerpo, las firmas, URLs y nombres de marcas.
2. Compara contra la LISTA DE TIENDAS REGISTRADAS.
3. Asigna en "identified_store_id" el ID exacto de la tienda que coincida.
4. Si el correo viene de un correo genérico o de un miembro interno de la agencia pero habla de una tienda específica, asigna la tienda de la que habla.
5. Si no coincide con ninguna, asigna "enova.agency".

TECNOLOGÍA:
1. Toma el campo "Tecnología" de la lista de tiendas.
2. Si figura como "No registrada" o es "enova.agency", deduce la plataforma solo si el correo da evidencia clara (Shopify, WooCommerce, VTEX, Magento, PrestaShop). Si no hay evidencia, usa "Desconocida".

REGLAS GENERALES:
- NINGÚN texto fuera del JSON y sin bloques de código.
- Idioma: siempre español.
- No inventes información que no aparezca en la conversación.

LISTA DE TIENDAS REGISTRADAS EN EL CRM:
${storesCatalog}

CRITERIOS DE CLASIFICACIÓN EXACTOS:
- priority: CRITICAL | HIGH | MEDIUM | LOW
- task_type: BUG_FIX | CAMBIO | CONSULTA | TASK_INTERNA

ESTRUCTURA JSON EXACTA REQUERIDA:
{
  "identified_store_id": "ID exacto de la lista o 'enova.agency'",
  "clean_name": "Formato: '[Módulo/Área] - Descripción del fallo'. Máximo 10 palabras.",
  "priority": "LOW|MEDIUM|HIGH|CRITICAL",
  "task_type": "BUG_FIX|TASK_INTERNA|CAMBIO|CONSULTA",
  "detected_technology": "Shopify|WooCommerce|VTEX|Magento|PrestaShop|E-commerce a medida|Desconocida",
  "summary": "Resumen técnico completo del estado actual. Máximo 4 oraciones.",
  "quick_solution": "Solución o pasos recomendados en 1 o 2 oraciones.",
  "hypothesis": "Causa raíz técnica más probable en 1 o 2 oraciones."
}`;
}

function buildUserPrompt({ subject, from, fullConversation }) {
  return `
ASUNTO DEL THREAD: ${subject}
REMITENTE INICIAL: ${from}

==================================================
HISTORIAL COMPLETO DE LA CONVERSACIÓN:
==================================================

${fullConversation}
`;
}

function validateAnalysis(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('Respuesta inválida: no es un objeto');
  if (!str(raw.clean_name) || !str(raw.summary)) throw new Error('Respuesta inválida: faltan clean_name o summary');

  const priority = str(raw.priority, 20).toUpperCase();
  const taskType = str(raw.task_type, 20).toUpperCase();
  const hypothesis = str(raw.hypothesis || raw.action_plan?.hypothesis, 600);
  const solution = str(raw.quick_solution, 800);

  return {
    identified_store_id: str(raw.identified_store_id, 120) || 'enova.agency',
    clean_name: str(raw.clean_name, 200),
    priority: PRIORITIES.includes(priority) ? priority : 'MEDIUM',
    task_type: TASK_TYPES.includes(taskType) ? taskType : 'CONSULTA',
    detected_technology: str(raw.detected_technology, 60) || 'Desconocida',
    summary: str(raw.summary, 1200),
    quick_solution: solution,
    hypothesis: hypothesis,
    extracted_entities: {
      order_ids: [],
      urls_affected: [],
      error_codes: []
    },
    action_plan: {
      hypothesis: hypothesis,
      can_agency_fix: true,
      platform_limits: null,
      checklist: [],
      missing_info: []
    }
  };
}

function buildFallback({ subject, fullConversation, initialStore }) {
  return {
    identified_store_id: initialStore ? initialStore.id : 'enova.agency',
    clean_name: subject || 'Ticket desde Gmail',
    priority: 'MEDIUM',
    task_type: 'CONSULTA',
    detected_technology: 'Desconocida',
    summary: fullConversation || 'Sin descripción',
    quick_solution: 'Revisión manual requerida por el equipo técnico.',
    hypothesis: 'Revisión manual requerida.',
    extracted_entities: { order_ids: [], urls_affected: [], error_codes: [] },
    action_plan: {
      hypothesis: 'Revisión manual requerida.',
      can_agency_fix: true,
      platform_limits: null,
      checklist: [],
      missing_info: []
    }
  };
}

function resolveTechLabel(registeredTech, detectedTech) {
  const registered = normalizeTech(registeredTech);
  if (registered) return techLabel(registered);
  const detected = normalizeTech(detectedTech);
  if (detected) return techLabel(detected);
  return 'Desconocida';
}

function renderDescription({ gmailId, rawFrom, aiData, quickSolutionText, registeredTech }) {
  const label = resolveTechLabel(registeredTech, aiData.detected_technology);
  const summary = aiData.summary || 'Sin resumen disponible.';
  const solution = quickSolutionText || aiData.quick_solution || 'Revisión manual requerida.';
  const hypothesis = aiData.hypothesis || aiData.action_plan?.hypothesis || 'Revisión manual requerida.';

  return `[GMAIL_ID: ${gmailId}]
Origen: Gmail
Remitente: ${rawFrom}
Tecnología: ${label}

📌 RESUMEN DE LA SOLICITUD:
${summary}

💡 SOLUCIÓN SUGERIDA:
${solution}

🔎 HIPÓTESIS:
${hypothesis}`;
}

module.exports = {
  buildStoresCatalog,
  buildSystemInstruction,
  buildUserPrompt,
  validateAnalysis,
  buildFallback,
  resolveTechLabel,
  renderDescription
};