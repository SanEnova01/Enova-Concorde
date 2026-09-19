const { google } = require('googleapis');
const TicketRepository = require('../repositories/TicketRepository');
const db = require('../config/db');

class GmailSyncService {
  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      'https://developers.google.com/oauthplayground'
    );

    this.oauth2Client.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
    this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
    
    this.procesadosEnMemoria = new Set();
  this.isProcessing = false; 
  this.processedLabelId = null;

  // 1. Modifica el mensaje de la consola
  console.log('[Gmail Sync] Bot activo. Revisión cada 2s.');

  // 2. Ejecución inicial (espera 2000 ms / 2 segundos al arrancar)
  setTimeout(() => this.processTaggedEmails(), 2000);

  // 3. Bucle recurrente (se ejecuta cada 2000 ms / 2 segundos)
  setInterval(() => this.processTaggedEmails(), 2000);
}

  cleanEmailAddress(rawFrom) {
    const match = rawFrom.match(/<([^>]+)>/) || rawFrom.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/);
    return match ? match[1].toLowerCase().trim() : rawFrom.toLowerCase().trim();
  }

  async getProcessedLabelId() {
    if (this.processedLabelId) return this.processedLabelId;
    try {
      const res = await this.gmail.users.labels.list({ userId: 'me' });
      const target = (res.data.labels || []).find(l => l.name.toLowerCase().includes('concorde') && l.name.toLowerCase().includes('procesad'));
      if (target) return (this.processedLabelId = target.id);

      const newLabel = await this.gmail.users.labels.create({
        userId: 'me',
        requestBody: { name: 'CONCORDE - PROCESADOS', labelListVisibility: 'labelShow', messageListVisibility: 'show' }
      });
      return (this.processedLabelId = newLabel.data.id);
    } catch (error) {
      return null;
    }
  }

  // 🌟 BUSCAMOS TODA LA DATA DEL CLIENTE ANTES DE LLAMAR A LA IA
  async resolveStoreData(senderEmail) {
    try {
      const domainMatch = senderEmail.match(/@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      const domain = domainMatch && domainMatch[1] ? domainMatch[1].toLowerCase().trim() : '';
      const dominiosGenericos = ['gmail.com', 'hotmail.com', 'yahoo.com', 'outlook.com', 'icloud.com'];

      if (domain && !dominiosGenericos.includes(domain)) {
        const storeDb = await db('stores')
          .where('web', 'like', `%${domain}%`)
          .orWhere('emails', 'like', `%${domain}%`)
          .first();
          
        if (storeDb) return storeDb;
      }
    } catch (error) {
      console.error('⚠️ [Error en Scanner de ID]:', error.message);
    }
    
    // Fallback si no lo encuentra
    return { id: 'enova.agency', name: 'Cliente Desconocido', tecnologia: 'No especificada' };
  }

  // 🤖 PROCESAMIENTO CON VERCEL AI SDK Y SU GATEWAY
  async analyzeEmailWithAI(subject, body, from, storeInfo, intentos = 2) {
    const dummyData = {
      priority: 'MEDIUM',
      task_type: 'CONSULTA',
      clean_name: subject || 'Ticket desde Gmail',
      summary: body || 'Sin descripción',
      quick_solution: 'Revisión manual requerida.'
    };

    const apiKey = process.env.AI_GATEWAY_API_KEY || process.env.OPENAI_API_KEY;

    if (!apiKey) {
        console.warn('[Vercel AI] Llave no detectada en Variables de Entorno. Procesando con datos dummy.');
        return dummyData;
    }

    try {
      // 🌟 CARGA DINÁMICA DE DEPENDENCIAS ESM
      const { generateText } = await import('ai');
      const { createOpenAI } = await import('@ai-sdk/openai');

      // 🌟 CONFIGURAMOS EL CLIENTE PARA USAR EL GATEWAY DE VERCEL
      const vercelGateway = createOpenAI({
        baseURL: 'https://ai-gateway.vercel.sh/v1', // URL del Gateway de Vercel
        apiKey: apiKey,
      });

      const systemInstruction = `Eres un sistema automatizado de triaje (Soporte Técnico Nivel 3). Tu única función es extraer datos técnicos de correos no estructurados y devolver un objeto JSON estricto.

REGLAS DE COMPORTAMIENTO:
1. NINGÚN texto fuera del JSON. Ni saludos, ni "Aquí tienes", ni bloques de código (\`\`\`).
2. Idioma: El JSON debe estar siempre en Español, sin importar el idioma del correo original.
3. Objetividad: Ignora el tono emocional, insultos o urgencia percibida del cliente. Basate SOLO en el impacto técnico.
4. Datos faltantes: Si un dato no se menciona en el correo, devuelve 'null' (sin comillas). NUNCA inventes IDs, URLs o errores.

CRITERIOS DE CLASIFICACIÓN EXACTOS:
- priority (Basado en impacto de negocio):
  * CRITICAL: Bloquea ventas/operaciones globales (ej: Checkout caído, pasarela de pagos, base de datos offline, error 500 general).
  * HIGH: Funcionalidad clave rota para múltiples usuarios, sin alternativa (ej: Integración ERP fallando, error en cálculo de envíos).
  * MEDIUM: Falla en funciones secundarias o afecta a un solo usuario (ej: Un cliente no puede resetear contraseña, lentitud específica).
  * LOW: Dudas de configuración, cambios estéticos, o peticiones de información.
- task_type:
  * BUG_FIX: Hay un error en el sistema (excepciones, pantalla blanca, botones que no hacen nada).
  * CAMBIO: El sistema funciona como fue diseñado, pero piden modificarlo.
  * CONSULTA: Preguntas sobre el uso de la plataforma.
  * TASK_INTERNA: Alertas automáticas de monitoreo (AWS, Datadog, Sentry).

ESTRUCTURA JSON EXACTA REQUERIDA:
{
  "clean_name": "Formato: '[Módulo/Área] - Descripción del fallo'. Ej: '[Checkout] - Fallo en token de Stripe'. Máximo 10 palabras.",
  "priority": "LOW|MEDIUM|HIGH|CRITICAL",
  "task_type": "BUG_FIX|TASK_INTERNA|CAMBIO|CONSULTA",
  "summary": "Descripción objetiva. Debe incluir (si es posible): Comportamiento actual vs. Comportamiento esperado. Máximo 3 oraciones.",
  "extracted_entities": {
    "order_ids": ["array de strings con números de orden/pedido si existen, sino []"],
    "urls_affected": ["array de enlaces o rutas mencionadas, sino []"],
    "error_codes": ["array de códigos de error literales mencionados, sino []"]
  },
  "action_plan": {
    "hypothesis": "Causa raíz técnica más probable basada en tu conocimiento L3.",
    "investigation_steps": [
      "Array de strings. Paso 1 a revisar (ej: 'Revisar logs de webhooks de Shopify').",
      "Paso 2 a revisar."
    ],
    "missing_info": "Qué datos técnicos faltan en el correo para poder resolverlo (ej: 'Se necesita el ID de la transacción'), sino null."
  }
}`;

      const userPrompt = `
Remitente: ${from}
Asunto: ${subject}
Mensaje original: ${body}

CONTEXTO DEL CLIENTE:
- Tienda ID: ${storeInfo.id}
- Nombre: ${storeInfo.name}
- Tecnología del e-commerce: ${storeInfo.tecnologia || 'General'}
`;

      const { text } = await generateText({
        model: vercelGateway('openai/gpt-4o-mini'), // Llamada a través del Gateway
        system: systemInstruction,
        prompt: userPrompt,
      });

      let responseText = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      return JSON.parse(responseText);
      
    } catch (e) {
      if (e.message.includes('429') && intentos > 0) {
        await new Promise(r => setTimeout(r, 2000));
        return this.analyzeEmailWithAI(subject, body, from, storeInfo, intentos - 1);
      }
      console.error('[Vercel AI Error]:', e.message);
      return dummyData;
    }
  }

  async processTaggedEmails() {
    if (this.isProcessing) return; 
    this.isProcessing = true;

    try {
      const response = await this.gmail.users.messages.list({
        userId: 'me',
        q: 'label:concorde---tickets -label:concorde---procesados' 
      });

      const messages = response.data.messages || [];
      if (messages.length === 0) {
        this.isProcessing = false;
        return;
      }

      const threadIds = [...new Set(messages.map(msg => msg.threadId))];

      for (const threadId of threadIds) {
        const threadData = await this.gmail.users.threads.get({ userId: 'me', id: threadId });
        const threadMessages = threadData.data.messages || [];
        if (threadMessages.length === 0) continue;

        const lastMessage = threadMessages[threadMessages.length - 1];

        if (this.procesadosEnMemoria.has(lastMessage.id)) {
          await this.moverAProcesados(threadId, lastMessage.labelIds);
          continue;
        }

        const existingTicket = await db('tickets').where('description', 'like', `%[GMAIL_ID: ${lastMessage.id}]%`).first();
        if (existingTicket) {
          this.procesadosEnMemoria.add(lastMessage.id);
          await this.moverAProcesados(threadId, lastMessage.labelIds);
          continue;
        }

        const headers = lastMessage.payload.headers;
        const subject = headers.find(h => h.name.toLowerCase() === 'subject')?.value || 'Sin Asunto';
        const rawFrom = headers.find(h => h.name.toLowerCase() === 'from')?.value || 'Desconocido';
        const snippet = lastMessage.snippet || 'Sin descripción';
        const cleanSenderEmail = this.cleanEmailAddress(rawFrom);

        this.procesadosEnMemoria.add(lastMessage.id);

        const storeInfo = await this.resolveStoreData(cleanSenderEmail);
        const aiData = await this.analyzeEmailWithAI(subject, snippet, rawFrom, storeInfo);

        const ticketDescription = `[GMAIL_ID: ${lastMessage.id}]\nOrigen: Gmail\nRemitente: ${rawFrom}\n\n📌 RESUMEN DE LA SOLICITUD:\n${aiData.summary}\n\n💡 SOLUCIÓN RÁPIDA SUGERIDA (IA):\n${aiData.quick_solution}\n\n------------------------\n✉️ MENSAJE ORIGINAL:\n${snippet}`;

        await TicketRepository.create({
          name: aiData.clean_name,
          description: ticketDescription,
          store_id: storeInfo.id,
          priority: aiData.priority,
          task_type: aiData.task_type
        });

        await this.moverAProcesados(threadId, lastMessage.labelIds);
        console.log(`⚡ [Sincronizado Vercel AI] Ticket: "${aiData.clean_name}" (Tienda: ${storeInfo.id})`);
      }
    } catch (error) {
      console.error('❌ [Error en Sync]:', error.message);
    } finally {
      this.isProcessing = false; 
    }
  }

  async moverAProcesados(threadId, currentLabelIds = []) {
    try {
      const processedLabelId = await this.getProcessedLabelId();
      const removeIds = currentLabelIds.filter(id => id.startsWith('Label_') || id === 'UNREAD');
      const addIds = processedLabelId ? [processedLabelId] : [];

      await this.gmail.users.threads.modify({
        userId: 'me',
        id: threadId,
        requestBody: { removeLabelIds: removeIds, addLabelIds: addIds }
      });
    } catch (error) {
      console.error('Error moviendo etiquetas:', error.message);
    }
  }
}

module.exports = new GmailSyncService();