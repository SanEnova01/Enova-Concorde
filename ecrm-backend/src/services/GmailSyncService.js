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

    this.oauth2Client.setCredentials({
      refresh_token: process.env.GMAIL_REFRESH_TOKEN
    });

    this.gmail = google.gmail({
      version: 'v1',
      auth: this.oauth2Client
    });

    this.procesadosEnMemoria = new Set();
    this.isProcessing = false;
    this.processedLabelId = null;

    console.log('[Gmail Sync] Bot activo. Revisión cada 2s.');

    setTimeout(() => this.processTaggedEmails(), 2000);
    setInterval(() => this.processTaggedEmails(), 2000);
  }

  cleanEmailAddress(rawFrom) {
    const match =
      rawFrom.match(/<([^>]+)>/) ||
      rawFrom.match(
        /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/
      );

    return match
      ? match[1].toLowerCase().trim()
      : rawFrom.toLowerCase().trim();
  }

  decodeBase64(data) {
    if (!data) return '';

    const base64 = data.replace(/-/g, '+').replace(/_/g, '/');

    return Buffer.from(base64, 'base64').toString('utf-8');
  }

  parseMessageBody(message) {
    if (!message || !message.payload) {
      return message.snippet || '';
    }

    let bodyText = '';

    const extractParts = (parts) => {
      for (const part of parts) {
        if (
          part.mimeType === 'text/plain' &&
          part.body &&
          part.body.data
        ) {
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
    if (this.processedLabelId) {
      return this.processedLabelId;
    }

    try {
      const res = await this.gmail.users.labels.list({
        userId: 'me'
      });

      const target = (res.data.labels || []).find(
        (l) =>
          l.name.toLowerCase().includes('concorde') &&
          l.name.toLowerCase().includes('procesad')
      );

      if (target) {
        return (this.processedLabelId = target.id);
      }

      const newLabel = await this.gmail.users.labels.create({
        userId: 'me',
        requestBody: {
          name: 'CONCORDE - PROCESADOS',
          labelListVisibility: 'labelShow',
          messageListVisibility: 'show'
        }
      });

      return (this.processedLabelId = newLabel.data.id);
    } catch (error) {
      return null;
    }
  }

  async getAllStores() {
    try {
      return await db('stores').select(
        'id',
        'name',
        'web',
        'emails',
        'tecnologia'
      );
    } catch (e) {
      console.error(
        '⚠️ [Error obteniendo tiendas]:',
        e.message
      );

      return [];
    }
  }

  findStoreInText(text, allStores, senderEmail) {
    if (!text || !allStores.length) {
      return null;
    }

    const lowerText = text.toLowerCase();

    const domainMatch = senderEmail
      ? senderEmail.match(/@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/)
      : null;

    const senderDomain =
      domainMatch && domainMatch[1]
        ? domainMatch[1].toLowerCase().trim()
        : '';

    const dominiosGenericos = [
      'gmail.com',
      'hotmail.com',
      'yahoo.com',
      'outlook.com',
      'icloud.com',
      'enova.agency'
    ];

    if (
      senderDomain &&
      !dominiosGenericos.includes(senderDomain)
    ) {
      const byDomain = allStores.find((s) => {
        const webMatch =
          s.web &&
          s.web.toLowerCase().includes(senderDomain);

        const emailMatch =
          s.emails &&
          s.emails.toLowerCase().includes(senderDomain);

        return webMatch || emailMatch;
      });

      if (byDomain) {
        return byDomain;
      }
    }

    for (const store of allStores) {
      const storeNameLower = store.name
        ? store.name.toLowerCase().trim()
        : '';

      const storeIdLower = store.id
        ? store.id.toLowerCase().trim()
        : '';

      if (
        storeNameLower.length >= 3 &&
        lowerText.includes(storeNameLower)
      ) {
        return store;
      }

      if (
        storeIdLower.length >= 3 &&
        lowerText.includes(storeIdLower)
      ) {
        return store;
      }
    }

    return null;
  }

  async analyzeEmailWithAI(
    subject,
    fullConversation,
    from,
    initialStore,
    allStores,
    intentos = 2
  ) {
    const dummyData = {
      identified_store_id: initialStore
        ? initialStore.id
        : 'enova.agency',

      priority: 'MEDIUM',

      task_type: 'CONSULTA',

      clean_name:
        subject || 'Ticket desde Gmail',

      summary:
        fullConversation || 'Sin descripción',

      quick_solution:
        'Revisión manual requerida por el equipo técnico.'
    };

    const apiKey =
      process.env.AI_GATEWAY_API_KEY ||
      process.env.OPENAI_API_KEY;

    if (!apiKey) {
      console.warn(
        '[Vercel AI] Llave no detectada en Variables de Entorno. Procesando con datos dummy.'
      );

      return dummyData;
    }

    try {
      const { generateText } = await import('ai');
      const { createOpenAI } = await import('@ai-sdk/openai');

      const vercelGateway = createOpenAI({
        baseURL: 'https://ai-gateway.vercel.sh/v1',
        apiKey: apiKey
      });

      const storesCatalog = allStores
        .map(
          (s) =>
            `- ID: "${s.id}" | Nombre: "${s.name || ''}" | Web: "${s.web || ''}" | Emails: "${s.emails || ''}"`
        )
        .join('\n');

      const systemInstruction = `Eres un sistema automatizado de triaje (Soporte Técnico Nivel 3). Tu función es analizar LA CADENA ENTERA DE CORREOS para entender el problema, identificar exactamente a qué cliente/tienda corresponde el mensaje y devolver un objeto JSON estricto.

REGLAS DE IDENTIFICACIÓN DE TIENDA (CRÍTICO):
1. Analiza el remitente (${from}), el asunto, el cuerpo de los mensajes, las firmas, URLs mencionadas o nombres de marcas/tiendas dentro del texto.
2. Compara el contenido contra la LISTA DE TIENDAS REGISTRADAS.
3. Asigna en 'identified_store_id' el ID exacto de la tienda que coincida.
4. Si el correo viene de un correo genérico (ej: gmail) o de un miembro interno de la agencia pero habla de una tienda específica, asigna la tienda de la que habla.
5. Si no coincide con ninguna tienda registrada de la lista, asigna 'enova.agency'.

REGLAS GENERALES:
- NINGÚN texto fuera del JSON. Ni saludos, ni bloques de código (\`\`\`).
- Idioma: Siempre en Español.
- Datos faltantes: Si un dato no se menciona, devuelve 'null'.

LISTA DE TIENDAS REGISTRADAS EN EL CRM:
${storesCatalog}

CRITERIOS DE CLASIFICACIÓN EXACTOS:
- priority: CRITICAL | HIGH | MEDIUM | LOW
- task_type: BUG_FIX | CAMBIO | CONSULTA | TASK_INTERNA

ESTRUCTURA JSON EXACTA REQUERIDA:
{
  "identified_store_id": "El 'ID' exacto de la tienda identificada de la lista o 'enova.agency'",
  "clean_name": "Formato: '[Módulo/Área] - Descripción del fallo'. Máximo 10 palabras.",
  "priority": "LOW|MEDIUM|HIGH|CRITICAL",
  "task_type": "BUG_FIX|TASK_INTERNA|CAMBIO|CONSULTA",
  "summary": "Resumen técnico completo del estado actual de la conversación. Máximo 4 oraciones.",
  "quick_solution": "Diagnóstico inicial, confirmación requerida o paso a paso recomendado basado en la tecnología de la tienda.",
  "extracted_entities": {
    "order_ids": [],
    "urls_affected": [],
    "error_codes": []
  },
  "action_plan": {
    "hypothesis": "Causa raíz técnica más probable.",
    "investigation_steps": ["Paso 1", "Paso 2"],
    "missing_info": null
  }
}`;

      const userPrompt = `
ASUNTO DEL THREAD: ${subject}
REMITENTE INICIAL: ${from}

==================================================
HISTORIAL COMPLETO DE LA CONVERSACIÓN:
==================================================

${fullConversation}
`;

      const { text } = await generateText({
        model: vercelGateway('openai/gpt-4o-mini'),
        system: systemInstruction,
        prompt: userPrompt
      });

      let responseText = text
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();

      return JSON.parse(responseText);

    } catch (e) {
      if (
        e.message &&
        e.message.includes('429') &&
        intentos > 0
      ) {
        await new Promise((r) => setTimeout(r, 2000));

        return this.analyzeEmailWithAI(
          subject,
          fullConversation,
          from,
          initialStore,
          allStores,
          intentos - 1
        );
      }

      console.error(
        '[Vercel AI Error]:',
        e.message
      );

      return dummyData;
    }
  }

  async processTaggedEmails() {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      const response =
        await this.gmail.users.messages.list({
          userId: 'me',
          q: 'label:concorde---tickets -label:concorde---procesados'
        });

      const messages =
        response.data.messages || [];

      if (messages.length === 0) {
        this.isProcessing = false;
        return;
      }

      const allStores =
        await this.getAllStores();

      const threadIds = [
        ...new Set(
          messages.map((msg) => msg.threadId)
        )
      ];

      for (const threadId of threadIds) {
        const threadData =
          await this.gmail.users.threads.get({
            userId: 'me',
            id: threadId
          });

        const threadMessages =
          threadData.data.messages || [];

        if (threadMessages.length === 0) {
          continue;
        }

        const lastMessage =
          threadMessages[
            threadMessages.length - 1
          ];

        if (
          this.procesadosEnMemoria.has(
            lastMessage.id
          )
        ) {
          await this.moverAProcesados(
            threadId,
            lastMessage.labelIds
          );

          continue;
        }

        const existingTicket =
          await db('tickets')
            .where(
              'description',
              'like',
              `%[GMAIL_ID: ${lastMessage.id}]%`
            )
            .first();

        if (existingTicket) {
          this.procesadosEnMemoria.add(
            lastMessage.id
          );

          await this.moverAProcesados(
            threadId,
            lastMessage.labelIds
          );

          continue;
        }

        const fullConversation =
          threadMessages
            .map((msg, index) => {
              const msgHeaders =
                msg.payload?.headers || [];

              const msgFrom =
                msgHeaders.find(
                  (h) =>
                    h.name.toLowerCase() ===
                    'from'
                )?.value ||
                'Desconocido';

              const msgDate =
                msgHeaders.find(
                  (h) =>
                    h.name.toLowerCase() ===
                    'date'
                )?.value || '';

              const msgBody =
                this.parseMessageBody(msg);

              return `--- [Mensaje #${index + 1}] ---
De: ${msgFrom}
Fecha: ${msgDate}

${msgBody}
--------------------------------------------------`;
            })
            .join('\n\n');

        const firstHeaders =
          threadMessages[0].payload.headers;

        const subject =
          firstHeaders.find(
            (h) =>
              h.name.toLowerCase() ===
              'subject'
          )?.value || 'Sin Asunto';

        const lastHeaders =
          lastMessage.payload.headers;

        const rawFrom =
          lastHeaders.find(
            (h) =>
              h.name.toLowerCase() ===
              'from'
          )?.value || 'Desconocido';

        const cleanSenderEmail =
          this.cleanEmailAddress(rawFrom);

        this.procesadosEnMemoria.add(
          lastMessage.id
        );

        let matchedStore =
          this.findStoreInText(
            `${subject}\n${rawFrom}\n${fullConversation}`,
            allStores,
            cleanSenderEmail
          );

        const aiData =
          await this.analyzeEmailWithAI(
            subject,
            fullConversation,
            rawFrom,
            matchedStore,
            allStores
          );

        if (aiData.identified_store_id) {
          const storeFromAI =
            allStores.find(
              (s) =>
                s.id.toLowerCase() ===
                aiData.identified_store_id.toLowerCase()
            );

          if (storeFromAI) {
            matchedStore = storeFromAI;
          }
        }

        const finalStoreInfo =
          matchedStore || {
            id: 'enova.agency',
            name: 'Cliente Desconocido',
            tecnologia: 'General'
          };

        const quickSolutionText =
          aiData.quick_solution ||
          (
            aiData.action_plan?.hypothesis
              ? aiData.action_plan.hypothesis
              : 'Revisión manual requerida.'
          );

        const ticketDescription =
          `[GMAIL_ID: ${lastMessage.id}]
Origen: Gmail
Remitente: ${rawFrom}

📌 RESUMEN DE LA SOLICITUD:
${aiData.summary || 'Sin resumen disponible.'}

💡 SOLUCIÓN RÁPIDA SUGERIDA:
${quickSolutionText}

------------------------
✉️ CADENA COMPLETA DE LA CONVERSACIÓN:
${fullConversation}`;

        await TicketRepository.create({
          name: aiData.clean_name,
          description: ticketDescription,
          store_id: finalStoreInfo.id,
          priority: aiData.priority,
          task_type: aiData.task_type
        });

        await this.moverAProcesados(
          threadId,
          lastMessage.labelIds
        );

        console.log(
          `⚡ [Sincronizado] Ticket: "${aiData.clean_name}" -> Tienda Asignada: [${finalStoreInfo.id}]`
        );
      }

    } catch (error) {
      console.error(
        '❌ [Error en Sync]:',
        error.message
      );

    } finally {
      this.isProcessing = false;
    }
  }

  async moverAProcesados(
    threadId,
    currentLabelIds = []
  ) {
    try {
      const processedLabelId =
        await this.getProcessedLabelId();

      const removeIds =
        currentLabelIds.filter(
          (id) =>
            id.startsWith('Label_') ||
            id === 'UNREAD'
        );

      const addIds =
        processedLabelId
          ? [processedLabelId]
          : [];

      await this.gmail.users.threads.modify({
        userId: 'me',
        id: threadId,
        requestBody: {
          removeLabelIds: removeIds,
          addLabelIds: addIds
        }
      });

    } catch (error) {
      console.error(
        'Error moviendo etiquetas:',
        error.message
      );
    }
  }
}

module.exports = new GmailSyncService();