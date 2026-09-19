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

    console.log('[Gmail Sync] Bot activo. Revisión cada 2s.');

    setTimeout(() => this.processTaggedEmails(), 2000);
    setInterval(() => this.processTaggedEmails(), 2000);
  }

  cleanEmailAddress(rawFrom) {
    const match = rawFrom.match(/<([^>]+)>/) || rawFrom.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/);
    return match ? match[1].toLowerCase().trim() : rawFrom.toLowerCase().trim();
  }

  decodeBase64(data) {
    if (!data) return '';
    const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
    return Buffer.from(base64, 'base64').toString('utf-8');
  }

  parseMessageBody(message) {
    if (!message || !message.payload) return message.snippet || '';
    
    let bodyText = '';

    const extractParts = (parts) => {
      for (const part of parts) {
        if (part.mimeType === 'text/plain' && part.body && part.body.data) {
          bodyText += this.decodeBase64(part.body.data) + '\n';
        } else if (part.parts) {
          extractParts(part.parts);
        }
      }
    };

    if (message.payload.body && message.payload.body.data) {
      bodyText = this.decodeBase64(message.payload.body.data);
    } else if (message.payload.parts) {
      extractParts(message.payload.parts);
    }

    return bodyText.trim() || message.snippet || 'Sin contenido de texto.';
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
    
    return { id: 'enova.agency', name: 'Cliente Desconocido', tecnologia: 'No especificada' };
  }

  async analyzeEmailWithAI(subject, fullConversation, from, storeInfo, intentos = 2) {
    const dummyData = {
      priority: 'MEDIUM',
      task_type: 'CONSULTA',
      clean_name: subject || 'Ticket desde Gmail',
      summary: fullConversation || 'Sin descripción',
      quick_solution: 'Revisión manual requerida por el equipo técnico.'
    };

    const apiKey = process.env.AI_GATEWAY_API_KEY || process.env.OPENAI_API_KEY;

    if (!apiKey) {
      console.warn('[Vercel AI] Llave no detectada en Variables de Entorno. Procesando con datos dummy.');
      return dummyData;
    }

    try {
      const { generateText } = await import('ai');
      const { createOpenAI } = await import('@ai-sdk/openai');

      const vercelGateway = createOpenAI({
        baseURL: 'https://ai-gateway.vercel.sh/v1',
        apiKey: apiKey,
      });

      const systemInstruction = `Eres un sistema automatizado de triaje (Soporte Técnico Nivel 3). Tu función es analizar LA CADENA ENTERA DE CORREOS (de más antiguo a más reciente) para entender el problema real en su totalidad, extraer datos técnicos y devolver un objeto JSON estricto.

REGLAS DE COMPORTAMIENTO:
1. NINGÚN texto fuera del JSON. Ni saludos, ni "Aquí tienes", ni bloques de código (\`\`\`).
2. Idioma: El JSON debe estar siempre en Español, sin importar el idioma del correo original.
3. Analiza toda la secuencia de mensajes para identificar la evolución de la solicitud.
4. Datos faltantes: Si un dato no se menciona en toda la conversación, devuelve 'null' (sin comillas). NUNCA inventes IDs, URLs o errores.

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
  "summary": "Resumen técnico completo del estado actual de la conversación. Máximo 4 oraciones.",
  "quick_solution": "Diagnóstico inicial, confirmación requerida o paso a paso recomendado basado en la tecnología de la tienda.",
  "extracted_entities": {
    "order_ids": ["array de strings con números de orden/pedido si existen, sino []"],
    "urls_affected": ["array de enlaces o rutas mencionadas, sino []"],
    "error_codes": ["array de códigos de error literales mencionados, sino []"]
  },
  "action_plan": {
    "hypothesis": "Causa raíz técnica más probable analizando toda la historia del caso.",
    "investigation_steps": [
      "Paso 1 a revisar basado en la última situación descrita.",
      "Paso 2 a revisar."
    ],
    "missing_info": "Qué datos técnicos aún faltan solicitar al cliente, sino null."
  }
}`;

      const userPrompt = `
ASUNTO DEL THREAD: ${subject}
REMITENTE INICIAL: ${from}

CONTEXTO DEL CLIENTE:
- Tienda ID: ${storeInfo.id}
- Nombre: ${storeInfo.name}
- Tecnología del e-commerce: ${storeInfo.tecnologia || 'General'}

==================================================
HISTORIAL COMPLETO DE LA CONVERSACIÓN (CADENA):
==================================================
${fullConversation}
`;

      const { text } = await generateText({
        model: vercelGateway('openai/gpt-4o-mini'),
        system: systemInstruction,
        prompt: userPrompt,
      });

      let responseText = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      return JSON.parse(responseText);
      
    } catch (e) {
      if (e.message.includes('429') && intentos > 0) {
        await new Promise(r => setTimeout(r, 2000));
        return this.analyzeEmailWithAI(subject, fullConversation, from, storeInfo, intentos - 1);
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

        const fullConversation = threadMessages.map((msg, index) => {
          const msgHeaders = msg.payload?.headers || [];
          const msgFrom = msgHeaders.find(h => h.name.toLowerCase() === 'from')?.value || 'Desconocido';
          const msgDate = msgHeaders.find(h => h.name.toLowerCase() === 'date')?.value || '';
          const msgBody = this.parseMessageBody(msg);

          return `--- [Mensaje #${index + 1}] ---
De: ${msgFrom}
Fecha: ${msgDate}

${msgBody}
--------------------------------------------------`;
        }).join('\n\n');

        const firstHeaders = threadMessages[0].payload.headers;
        const subject = firstHeaders.find(h => h.name.toLowerCase() === 'subject')?.value || 'Sin Asunto';
        
        const lastHeaders = lastMessage.payload.headers;
        const rawFrom = lastHeaders.find(h => h.name.toLowerCase() === 'from')?.value || 'Desconocido';
        const cleanSenderEmail = this.cleanEmailAddress(rawFrom);

        this.procesadosEnMemoria.add(lastMessage.id);

        const storeInfo = await this.resolveStoreData(cleanSenderEmail);
        const aiData = await this.analyzeEmailWithAI(subject, fullConversation, rawFrom, storeInfo);

        // Garantiza que si no hay solución rápida, devuelva un texto por defecto en lugar de undefined
        const quickSolutionText = aiData.quick_solution || (aiData.action_plan?.hypothesis ? aiData.action_plan.hypothesis : 'Revisión manual requerida.');

        const ticketDescription = `[GMAIL_ID: ${lastMessage.id}]\nOrigen: Gmail\nRemitente: ${rawFrom}\n\n📌 RESUMEN DE LA SOLICITUD:\n${aiData.summary || 'Sin resumen disponible.'}\n\n💡 SOLUCIÓN RÁPIDA SUGERIDA:\n${quickSolutionText}\n\n------------------------\n✉️ CADENA COMPLETA DE LA CONVERSACIÓN:\n${fullConversation}`;

        await TicketRepository.create({
          name: aiData.clean_name,
          description: ticketDescription,
          store_id: storeInfo.id,
          priority: aiData.priority,
          task_type: aiData.task_type
        });

        await this.moverAProcesados(threadId, lastMessage.labelIds);
        console.log(`⚡ [Sincronizado] Ticket: "${aiData.clean_name}" (Tienda: ${storeInfo.id})`);
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