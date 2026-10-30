const { allPlaybooksText, normalizeTech, techLabel, isSaas } = require('./playbooks');

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const TASK_TYPES = ['BUG_FIX', 'TASK_INTERNA', 'CAMBIO', 'CONSULTA'];
const OWNERS = ['agencia', 'cliente', 'plataforma'];

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

Tu función es analizar LA CADENA ENTERA DE CORREOS para entender el problema, identificar exactamente a qué cliente/tienda corresponde el mensaje y devolver un objeto JSON estricto con un checklist técnico accionable.

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

TECNOLOGÍA Y CHECKLIST (CRÍTICO):
1. Una vez identificada la tienda, toma su campo "Tecnología" de la lista. Esa es la plataforma real del cliente.
2. Si la tecnología figura como "No registrada" o la tienda es "enova.agency", deduce la plataforma solo si el correo da evidencia clara (URLs de wp-admin, myshopify.com, vtexcommercestable, mensajes de error típicos). Si no hay evidencia, usa "Desconocida" y limita el checklist a pasos de diagnóstico que no dependan de la plataforma.
3. Genera entre 3 y 8 pasos en "checklist", ordenados del que menos esfuerzo y menos riesgo requiere al que más.
4. Cada paso debe ser exacto y ejecutable por un técnico sin interpretar: "step" es la acción concreta; "where" es la ruta exacta del menú, archivo, panel o comando; "check" es lo que se debe observar para dar el paso por bueno o por fallido; "owner" es quién lo ejecuta: "agencia", "cliente" o "plataforma".
5. Usa solo rutas y menús de los PLAYBOOKS de abajo o que conozcas con certeza. Si no estás seguro de una ruta exacta, nombra la sección general; nunca inventes menús, plugins, archivos ni comandos.
6. Respeta los límites de la plataforma:
   - En plataformas SaaS (Shopify, VTEX) NO propongas acceso a servidor, PHP, base de datos, .htaccess ni logs de servidor. Si la causa probable está en infraestructura de la plataforma, el último paso debe ser abrir un caso con el soporte de la plataforma indicando qué datos adjuntar, y "can_agency_fix" debe ser false.
   - En plataformas autoalojadas (WooCommerce, Magento, PrestaShop) puedes incluir pasos de hosting, PHP, logs y plugins, siempre con copia de seguridad o staging antes de cambiar producción.
7. Si el tipo de tarea es CONSULTA, usa entre 2 y 4 pasos. Si faltan datos para diagnosticar, ponlos en "missing_info" como lista de preguntas concretas para el cliente.
8. No pidas contraseñas por correo: pide un acceso de colaborador o un enlace de invitación.

PLAYBOOKS POR PLATAFORMA:
${allPlaybooksText()}

REGLAS GENERALES:
- NINGÚN texto fuera del JSON y sin bloques de código.
- Idioma: siempre español.
- Si un dato no se menciona, devuelve null o una lista vacía.
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
  "quick_solution": "Diagnóstico inicial en 1 o 2 oraciones, específico para la plataforma.",
  "extracted_entities": {
    "order_ids": [],
    "urls_affected": [],
    "error_codes": []
  },
  "action_plan": {
    "hypothesis": "Causa raíz técnica más probable.",
    "can_agency_fix": true,
    "platform_limits": "Limitación de la plataforma que afecta la solución, o null.",
    "checklist": [
      {
        "step": "Acción concreta a realizar",
        "where": "Ruta exacta, archivo, panel o comando",
        "check": "Qué debe verse para dar el paso por correcto",
        "owner": "agencia|cliente|plataforma"
      }
    ],
    "missing_info": ["Pregunta concreta al cliente"]
  }
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

function normalizeChecklist(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((item) => {
      if (typeof item === 'string') return { step: str(item, 400), where: '', check: '', owner: 'agencia' };
      const owner = str(item?.owner, 20).toLowerCase();
      return {
        step: str(item?.step, 400),
        where: str(item?.where, 400),
        check: str(item?.check, 400),
        owner: OWNERS.includes(owner) ? owner : 'agencia'
      };
    })
    .filter((i) => i.step)
    .slice(0, 8);
}

function validateAnalysis(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('Respuesta inválida: no es un objeto');
  if (!str(raw.clean_name) || !str(raw.summary)) throw new Error('Respuesta inválida: faltan clean_name o summary');

  const plan = raw.action_plan && typeof raw.action_plan === 'object' ? raw.action_plan : {};
  const priority = str(raw.priority, 20).toUpperCase();
  const taskType = str(raw.task_type, 20).toUpperCase();
  const missing = Array.isArray(plan.missing_info)
    ? plan.missing_info.map((m) => str(m, 300)).filter(Boolean)
    : plan.missing_info
      ? [str(plan.missing_info, 300)]
      : [];

  return {
    identified_store_id: str(raw.identified_store_id, 120) || 'enova.agency',
    clean_name: str(raw.clean_name, 200),
    priority: PRIORITIES.includes(priority) ? priority : 'MEDIUM',
    task_type: TASK_TYPES.includes(taskType) ? taskType : 'CONSULTA',
    detected_technology: str(raw.detected_technology, 60) || 'Desconocida',
    summary: str(raw.summary, 1200),
    quick_solution: str(raw.quick_solution, 800),
    extracted_entities: {
      order_ids: Array.isArray(raw.extracted_entities?.order_ids) ? raw.extracted_entities.order_ids : [],
      urls_affected: Array.isArray(raw.extracted_entities?.urls_affected) ? raw.extracted_entities.urls_affected : [],
      error_codes: Array.isArray(raw.extracted_entities?.error_codes) ? raw.extracted_entities.error_codes : []
    },
    action_plan: {
      hypothesis: str(plan.hypothesis, 600),
      can_agency_fix: plan.can_agency_fix !== false,
      platform_limits: str(plan.platform_limits, 600) || null,
      checklist: normalizeChecklist(plan.checklist),
      missing_info: missing
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
  const plan = aiData.action_plan || {};
  const label = resolveTechLabel(registeredTech, aiData.detected_technology);
  const techKey = normalizeTech(registeredTech) || normalizeTech(aiData.detected_technology);
  const owners = { agencia: 'Agencia', cliente: 'Cliente', plataforma: 'Soporte de la plataforma' };

  let text = `[GMAIL_ID: ${gmailId}]
Origen: Gmail
Remitente: ${rawFrom}
Tecnología: ${label}

📌 RESUMEN DE LA SOLICITUD:
${aiData.summary || 'Sin resumen disponible.'}

💡 SOLUCIÓN RÁPIDA SUGERIDA:
${quickSolutionText}`;

  if (plan.hypothesis) {
    text += `\n\n🔎 HIPÓTESIS:\n${plan.hypothesis}`;
  }

  if (plan.platform_limits || (techKey && isSaas(techKey))) {
    const limit = plan.platform_limits || 'Plataforma SaaS: sin acceso a servidor ni a infraestructura.';
    text += `\n\n⚠️ LÍMITES DE LA PLATAFORMA:\n${limit}`;
    if (plan.can_agency_fix === false) {
      text += '\nLa agencia no puede resolverlo por sí sola: requiere al soporte de la plataforma.';
    }
  }

  const checklist = Array.isArray(plan.checklist) ? plan.checklist : [];
  if (checklist.length > 0) {
    text += `\n\n🧭 CHECKLIST DE REVISIÓN (${label}):`;
    checklist.forEach((item, i) => {
      text += `\n☐ ${i + 1}. ${item.step}`;
      if (item.where) text += `\n   📍 Dónde: ${item.where}`;
      if (item.check) text += `\n   ✔️ Verificar: ${item.check}`;
      text += `\n   👤 Responsable: ${owners[item.owner] || 'Agencia'}`;
    });
  }

  const missing = Array.isArray(plan.missing_info) ? plan.missing_info : [];
  if (missing.length > 0) {
    text += `\n\n❓ INFORMACIÓN FALTANTE:\n${missing.map((m) => `- ${m}`).join('\n')}`;
  }

  return text;
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
