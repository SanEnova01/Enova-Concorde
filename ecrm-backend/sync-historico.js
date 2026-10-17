require('dotenv').config(); // Carga las variables de entorno si estás en local
const HubSyncService = require('./src/services/HubSyncService');

const ticketsAntiguos = [
  {
    "id": "65c4d469-f3b2-4a40-9cac-9a2bcd34d5e7",
    "serial_number": "SOP-2026-0375",
    "name": "Web - Propuestas de mejoras",
    "store_id": "Electroenchufe",
    "priority": "MEDIUM",
    "task_type": "CAMBIO",
    "status": "IN_PROGRESS",
    "assigned_to": "Santiago",
    "created_at": "2026-09-29T00:44:08.823233+00:00",
    "closed_at": null,
    "description": "[GMAIL_ID: 1a0e9e951e612649]\nOrigen: Gmail\nRemitente: Adriana Mendoza Ramos <amendoza@electroenchufeperu.com>\n\n📌 RESUMEN DE LA SOLICITUD:\nLa tienda Electroenchufe solicita cambios en sus páginas informativas para adecuarlas a su manual de marca. Han proporcionado varias URLs de Figma para el desarrollo de seis landing pages y han solicitado una cotización. Se ha emitido y enviado la factura correspondiente, y el siguiente paso es proceder con la facturación. Adriana confirmó su intención de avanzar con el desarrollo.\n\n💡 SOLUCIÓN RÁPIDA SUGERIDA:\nConfirmar el inicio del desarrollo de las landing pages y emitir seguimiento a la facturación.",
    "is_b2c": false,
    "is_apolo_sync": false
  },
  {
    "id": "7fc3cdb7-197e-4d8d-8e45-a4d67ffd87b3",
    "serial_number": "SOP-2026-1040",
    "name": "Desarrollo - Adaptación de calculadora web",
    "store_id": "Barker",
    "priority": "MEDIUM",
    "task_type": "CAMBIO",
    "status": "OPEN",
    "assigned_to": null,
    "created_at": "2026-10-15T17:25:09.298703+00:00",
    "closed_at": null,
    "description": "[GMAIL_ID: 1a1407ee2196297f]\nOrigen: Gmail\nRemitente: Michella Albertini <michella@grupoalbar.pe>\n\n📌 RESUMEN DE LA SOLICITUD:\nEl cliente, Michella Albertini de Barker, solicita la adaptación de su calculadora web para que funcione como un modelo de referencia. Pide información necesaria para el desarrollo, viabilidad del proyecto y la posibilidad de enviar un correo personalizado al finalizar. Actualmente, la calculadora se encuentra en su página web. Se requiere feedback y detalles sobre los datos necesarios.\n\n💡 SOLUCIÓN RÁPIDA SUGERIDA:\nRevisar la calculadora actual y analizar la propuesta de características. Solicitar información específica sobre el contenido a enviar por correo.",
    "is_b2c": false,
    "is_apolo_sync": false
  },
  {
    "id": "52656b19-f3e0-4d4e-8329-3b2faaedbbba",
    "serial_number": "SOP-2026-1039",
    "name": "Hosting - Límite de visitas alcanzado",
    "store_id": "Origens",
    "priority": "HIGH",
    "task_type": "BUG_FIX",
    "status": "IN_PROGRESS",
    "assigned_to": "Josue Caro",
    "created_at": "2026-10-15T16:11:19.70143+00:00",
    "closed_at": null,
    "description": "[GMAIL_ID: 1a140315eaf11ed3]\nOrigen: Gmail\nRemitente: \"Anthony Márquez\" <amarquez@imexvet-peru.com>\n\n📌 RESUMEN DE LA SOLICITUD:\nEl cliente, Imexvet SAC, ha alcanzado el límite mensual de visitas en su plan de alojamiento Kinsta y recibieron una notificación de cobros adicionales por exceso de visitas. Se solicita solución a esta situación y se espera respuesta para un posible upgrade del plan. No se menciona ninguna acción previa realizada sobre este problema.\n\n💡 SOLUCIÓN RÁPIDA SUGERIDA:\nRevisar el consumo actual en MyKinsta y considerar un upgrade de plan para evitar cargos adicionales.",
    "is_b2c": false,
    "is_apolo_sync": false
  },
  {
    "id": "1429124e-a528-401b-b956-a5a4d751c5b2",
    "serial_number": "SOP-2026-1044",
    "name": "Google Merchant Center - Problema de Misrepresentation",
    "store_id": "Yarnalia",
    "priority": "HIGH",
    "task_type": "BUG_FIX",
    "status": "OPEN",
    "assigned_to": null,
    "created_at": "2026-10-15T21:50:46.222652+00:00",
    "closed_at": null,
    "description": "[GMAIL_ID: 1a1417933eb13192]\nOrigen: Gmail\nRemitente: \"Andrés Sanchez - YARNALIA\" <asanchez@yarnalia.com>\n\n📌 RESUMEN DE LA SOLICITUD:\nYarnalia enfrenta un problema en Google Merchant Center relacionado con una alerta de 'Misrepresentation'. Después de corregir la política de 'Affiliates', ahora necesitan apoyo para identificar elementos que causan el nuevo problema. Están buscando ajustar la información del negocio y políticas para cumplir con los requisitos de Google. Se solicitan revisiones de contenido y ajustes antes de solicitar una nueva revisión a Google.\n\n💡 SOLUCIÓN RÁPIDA SUGERIDA:\nRevisar la información del negocio, políticas de envío, devoluciones y la coherencia de precios entre yarnalia.com y Merchant Center. Realizar las correcciones necesarias antes de la re-evaluación con Google.",
    "is_b2c": false,
    "is_apolo_sync": false
  },
  {
    "id": "96d4d816-edce-4bf2-b7e5-bcf4bfff0ea7",
    "serial_number": "SOP-2026-1081",
    "name": "Revisión de tráfico en tienda Shopify",
    "store_id": "HLM",
    "priority": "HIGH",
    "task_type": "BUG_FIX",
    "status": "OPEN",
    "assigned_to": null,
    "created_at": "2026-10-16T17:59:22.851131+00:00",
    "closed_at": null,
    "description": "[GMAIL_ID: 1a145dd5567bb99f]\nOrigen: Gmail\nRemitente: Anderson Puican <anderson@enova.agency>\n\n📌 RESUMEN DE LA SOLICITUD:\nHLM Computer ha reportado un comportamiento inusual en las visitas de su tienda Shopify. Se han proporcionado evidencias sobre el tráfico en la URL específica: https://hlmcomputer.pe/memoria-ram-42. Se solicita la revisión técnica del caso para determinar las causas de este problema. Se adjuntan capturas para referencia.\n\n💡 SOLUCIÓN RÁPIDA SUGERIDA:\nRealizar un análisis del tráfico en la URL indicada y verificar posibles anomalías en el comportamiento de los usuarios.",
    "is_b2c": false,
    "is_apolo_sync": false
  },
  {
    "id": "915ba350-0bca-4385-b5a4-8cd338d7b24a",
    "serial_number": "SOP-2026-0426",
    "name": "Template - Implementar botones en Lanzamientos",
    "store_id": "Kuna_Peru",
    "priority": "MEDIUM",
    "task_type": "CAMBIO",
    "status": "IN_PROGRESS",
    "assigned_to": "Santiago",
    "created_at": "2026-09-29T21:02:52.407339+00:00",
    "closed_at": null,
    "description": "[GMAIL_ID: 1a0eef78bfe1be84]\nOrigen: Gmail\nRemitente: Maryori Coya - INCALPACA TPX <mcoya@incalpaca.com>\n\n📌 RESUMEN DE LA SOLICITUD:\nMaryori Coya solicita la implementación de botones configurables en el template de Lanzamientos en Shopify para Kuna. Esta funcionalidad no fue incluida en la última fase del desarrollo a pesar de haber sido parte del alcance inicial. Se requiere que se añadan los mismos parámetros y elementos actualmente disponibles, con la opción adicional de configur el color del borde desde el administrador. El cliente espera comentarios sobre esta solicitud.\n\n💡 SOLUCIÓN RÁPIDA SUGERIDA:\nRevisar el desarrollo previo del template y definir los elementos necesarios para la implementación de los botones configurables.",
    "is_b2c": false,
    "is_apolo_sync": false
  },
  {
    "id": "f1709162-503d-42cf-8398-c48c196619c9",
    "serial_number": "SOP-2026-1003",
    "name": "Desarrollo - Sección Preguntas Frecuentes",
    "store_id": "Floreria_San_Borja",
    "priority": "MEDIUM",
    "task_type": "CAMBIO",
    "status": "OPEN",
    "assigned_to": "Josue Caro, Santiago",
    "created_at": "2026-10-15T03:29:42.413694+00:00",
    "closed_at": null,
    "description": "[GMAIL_ID: 1a13ce7372b04c3f]\nOrigen: Gmail\nRemitente: Mario Yaranga <mario@enova.agency>\n\n📌 RESUMEN DE LA SOLICITUD:\nEl cliente solicita el diseño y desarrollo de una sección de preguntas frecuentes en su sitio web https://floreriasb.com.pe/. La implementación debe incluir URLs individuales para cada pregunta y categorías para agruparlas, similar a la sección en https://sydney.pe/blogs/preguntas-frecuentes. Se espera una respuesta con una fecha tentativa de publicación.\n\n💡 SOLUCIÓN RÁPIDA SUGERIDA:\nConfirmar la factibilidad del diseño solicitado y proporcionar una fecha estimada de entrega.",
    "is_b2c": false,
    "is_apolo_sync": false
  },
  {
    "id": "6abf87b5-c9cb-4360-a010-31fab45106d8",
    "serial_number": "SOP-2026-1082",
    "name": "Consultas - Información sobre DEMO HUB",
    "store_id": "lead_1790207526163",
    "priority": "LOW",
    "task_type": "CONSULTA",
    "status": "OPEN",
    "assigned_to": "Josue Caro",
    "created_at": "2026-10-17T00:39:30.700547+00:00",
    "closed_at": null,
    "description": "[GMAIL_ID: 1a1474afc141d0a6]\nOrigen: Gmail\nRemitente: Santiago Perez Esparza <josestgo.2000@gmail.com>\n\n📌 RESUMEN DE LA SOLICITUD:\nEl remitente, Santiago Perez Esparza, solicita información sobre un tema relacionado con 'DEMO HUB'. No se han proporcionado detalles adicionales ni contexto específico sobre la consulta. Se necesita claridad sobre qué tipo de información se requiere. Actualmente, no hay acciones previas reportadas.\n\n💡 SOLUCIÓN RÁPIDA SUGERIDA:\nSolicitar más información al cliente sobre el tema específico de 'DEMO HUB' que desea consultar.",
    "is_b2c": false,
    "is_apolo_sync": false
  },
  {
    "id": "5c53bdff-f5dd-4446-bcc3-b82a3ec4bff1",
    "serial_number": "SOP-2026-0665",
    "name": "Web - Nuevas páginas en Shopify",
    "store_id": "Yarnalia",
    "priority": "HIGH",
    "task_type": "CAMBIO",
    "status": "IN_PROGRESS",
    "assigned_to": "Santiago",
    "created_at": "2026-10-05T21:38:38.834084+00:00",
    "closed_at": null,
    "description": "[GMAIL_ID: 1a10ded16bd08134]\nOrigen: Gmail\nRemitente: \"Andrés Sanchez - YARNALIA\" <asanchez@yarnalia.com>\n\n📌 RESUMEN DE LA SOLICITUD:\nEl cliente solicita implementar dos nuevas páginas en yarnalia.com: una para Wholesale y otra para el nuevo hilo EPIC. Wholesales requiere un formulario de solicitud y seguimiento en Google Tag Manager, mientras que EPIC necesita un botón para agregar varios ovillos al carrito. Las fechas de entrega son críticas, con la página EPIC que debe estar lista para revisión entre el 12 y 13 de octubre.\n\n💡 SOLUCIÓN RÁPIDA SUGERIDA:\nRevisar los mockups adjuntos y planificar las tareas de desarrollo para cumplir con las fechas establecidas.",
    "is_b2c": false,
    "is_apolo_sync": false
  },
  {
    "id": "cbd6d911-fd3c-4312-8416-2890b83f8a19",
    "serial_number": "SOP-2026-0927",
    "name": "Reunión - Ajustes en Premium Hauss",
    "store_id": "Premium_Hauss",
    "priority": "MEDIUM",
    "task_type": "CAMBIO",
    "status": "IN_PROGRESS",
    "assigned_to": "Josue Caro, Santiago",
    "created_at": "2026-10-12T17:58:53.413946+00:00",
    "closed_at": null,
    "description": "[GMAIL_ID: 1a130ffa82dee371]\nOrigen: Gmail\nRemitente: Josue Caro <josue@e-growth.team>\n\n📌 RESUMEN DE LA SOLICITUD:\nSe requiere ajustar la altura del banner principal en la versión desktop, implementar un pop-up para campañas y reordenar automáticamente el catálogo durante campañas. Se enviarán dimensiones recomendadas y se espera respuesta sobre estos requerimientos. Josue Caro envió la solicitud en nombre del equipo de Enova.\n\n💡 SOLUCIÓN RÁPIDA SUGERIDA:\nConfirmar las dimensiones para el banner y la lógica de visualización del pop-up. Iniciar la configuración automática para el catálogo según las indicaciones.",
    "is_b2c": false,
    "is_apolo_sync": false
  },
  {
    "id": "e77bf179-73e9-4f6b-a060-a7f2b48f0692",
    "serial_number": "SOP-2026-0926",
    "name": "Política de envíos - Nueva implementación",
    "store_id": "Yarnalia",
    "priority": "HIGH",
    "task_type": "CAMBIO",
    "status": "IN_PROGRESS",
    "assigned_to": "Santiago",
    "created_at": "2026-10-12T17:58:40.278528+00:00",
    "closed_at": null,
    "description": "[GMAIL_ID: 1a13133ff4ad5ffa]\nOrigen: Gmail\nRemitente: \"Andrés Sanchez - YARNALIA\" <asanchez@yarnalia.com>\n\n📌 RESUMEN DE LA SOLICITUD:\nAndrés Sanchez de Yarnalia solicita un cambio en la política de envíos gratis, modificando el umbral y las condiciones. Se menciona que este ajuste debe implementarse para el miércoles 14 de octubre. Además, se proporcionan detalles sobre el peso variable de las madejas y el impacto en la solución. Se adjuntan documentos para facilitar el trabajo del equipo.\n\n💡 SOLUCIÓN RÁPIDA SUGERIDA:\nRevisar los documentos adjuntos y ajustar la política de envíos en Shopify según los nuevos requerimientos.",
    "is_b2c": false,
    "is_apolo_sync": false
  },
  {
    "id": "d189e45e-1afc-472a-8d5b-8a7722a7889f",
    "serial_number": "SOP-2026-0929",
    "name": "Consulta - Prueba aplicativo Discounty",
    "store_id": "Sydney",
    "priority": "MEDIUM",
    "task_type": "CONSULTA",
    "status": "IN_PROGRESS",
    "assigned_to": "Josue Caro",
    "created_at": "2026-10-12T23:36:11.671807+00:00",
    "closed_at": null,
    "description": "[GMAIL_ID: 1a1325ba4e6c8f1e]\nOrigen: Gmail\nRemitente: <online@sydney.pe>\n\n📌 RESUMEN DE LA SOLICITUD:\nLa tienda Sydney está interesada en utilizar una prueba gratuita del aplicativo Discounty para evaluar su funcionamiento. La consulta fue realizada por Jackeline del equipo de ventas online. No se han reportado problemas específicos ni se han tomado acciones previas.\n\n💡 SOLUCIÓN RÁPIDA SUGERIDA:\nConfirmar disponibilidad de la prueba gratuita y proporcionar acceso al aplicativo.",
    "is_b2c": false,
    "is_apolo_sync": false
  },
  {
    "id": "da08aeba-2b3a-42d6-8c75-c11d984a872e",
    "serial_number": "SOP-2026-0818",
    "name": "Traducción automática de nombres de productos",
    "store_id": "Kuna_Peru",
    "priority": "HIGH",
    "task_type": "CAMBIO",
    "status": "IN_PROGRESS",
    "assigned_to": "Santiago",
    "created_at": "2026-10-09T17:59:08.175321+00:00",
    "closed_at": null,
    "description": "[GMAIL_ID: 1a121b4b69f18f12]\nOrigen: Gmail\nRemitente: \"'Maryori Coya - INCALPACA TPX' via Soporte\" <soporte@enova.agency>\n\n📌 RESUMEN DE LA SOLICITUD:\nEl cliente solicita apoyo para la implementación de una lógica de traducción automática en el sitio web de Kuna. Las traducciones de nombres de productos deben seguir una estructura específica en español e inglés, manteniendo el nombre del modelo sin traducción. Adjunto la estructura requerida para cada idioma para asegurar consistencia. Se requiere ajustar la configuración para que los cambios de idioma reflejen las estructuras correspondientes.\n\n💡 SOLUCIÓN RÁPIDA SUGERIDA:\nRevisar la lógica actual de traducción y ajustar la configuración según la estructura proporcionada por el cliente.",
    "is_b2c": false,
    "is_apolo_sync": false
  },
  {
    "id": "19432c6d-3922-4b39-bbd1-65afb8ba0f24",
    "serial_number": "SOP-2026-1002",
    "name": "E-commerce - Integración de flujo para pedidos",
    "store_id": "Silkeborg",
    "priority": "HIGH",
    "task_type": "CAMBIO",
    "status": "RESOLVED",
    "assigned_to": "Josue Caro",
    "created_at": "2026-10-14T23:18:36.999398+00:00",
    "closed_at": "2026-10-16T18:44:33.499681+00:00",
    "description": "[GMAIL_ID: 1a1308b5a5aa220d]\nOrigen: Gmail\nRemitente: \"Nátaly Fonseca\" <nataly@silkeborg-peru.com>\n\n📌 RESUMEN DE LA SOLICITUD:\nEl cliente está en el proceso de implementar un sistema para manejar productos bajo pedido que están en cero stock. Se acordó que el flujo debe cambiar a un sistema que permita cotizaciones automáticamente al usuario logueado, con restricciones asociadas a artículos 'End Sale'. Se ha decidido proceder con el desarrollo y se aguarda la emisión de factura para el pago.\n\n💡 SOLUCIÓN RÁPIDA SUGERIDA:\nConfirmar los elementos a integrar en el carrito y realizar el desarrollo del plugin para manejar los pedidos a producción según los requisitos discutidos.",
    "is_b2c": false,
    "is_apolo_sync": false
  }
];

async function syncOldTickets() {
  console.log(`🚀 Iniciando sincronización de ${ticketsAntiguos.length} tickets hacia el Hub...`);
  
  let successCount = 0;
  let errorCount = 0;

  for (const ticket of ticketsAntiguos) {
    console.log(`\n⏳ Procesando ticket: ${ticket.serial_number}...`);
    try {
      // Reutilizamos el servicio que encripta la petición[cite: 8]
      const response = await HubSyncService.registrarTicketEnHub(ticket);
      
      if (response && (response.ok || response.success)) {
        successCount++;
      } else {
        errorCount++;
      }
    } catch (error) {
      console.error(`❌ Falló la sincronización de ${ticket.serial_number}:`, error.message);
      errorCount++;
    }
    
    // Pausa de 500ms para cumplir con el límite de 120 req/minuto del API de Hub[cite: 4]
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`\n======================================`);
  console.log(`🎉 Migración finalizada.`);
  console.log(`✅ Éxitos: ${successCount}`);
  console.log(`❌ Fallos: ${errorCount}`);
  console.log(`======================================\n`);
  
  process.exit(0);
}

syncOldTickets();