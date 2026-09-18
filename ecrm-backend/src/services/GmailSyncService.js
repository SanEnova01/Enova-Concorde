const { google } = require('googleapis');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const TicketRepository = require('../repositories/TicketRepository');
const StoreRepository = require('../repositories/StoreRepository');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

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

    this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
  }

  cleanEmailAddress(rawFrom) {
    const match = rawFrom.match(/<([^>]+)>/) || rawFrom.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/);
    return match ? match[1].toLowerCase().trim() : rawFrom.toLowerCase().trim();
  }

  async resolveStoreId(senderEmail) {
    try {
      if (StoreRepository && typeof StoreRepository.findByEmail === 'function') {
        const store = await StoreRepository.findByEmail(senderEmail);
        if (store && store.id) return store.id;
      }
    } catch (error) {
      console.warn(`[Gmail Sync] Cliente no encontrado para ${senderEmail}. Asignando cliente por defecto.`);
    }
    return 'enova_digital';
  }

  async analyzeEmailWithGemini(subject, body, from) {
    const dummyData = {
      priority: 'MEDIUM',
      task_type: 'CONSULTA',
      clean_name: subject || 'Ticket desde Gmail',
      summary: body || 'Sin descripción disponible.'
    };

    if (!process.env.GEMINI_API_KEY) {
      console.warn('[Gemini Sync] GEMINI_API_KEY no detectada. Procesando con datos dummy.');
      return dummyData;
    }

    try {
      const model = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        generationConfig: { responseMimeType: 'application/json' }
      });

      const prompt = `Analiza el siguiente correo recibido y clasifícalo para registrar un ticket en el CRM.

Remitente: ${from}
Asunto: ${subject}
Mensaje: ${body}

Responde en formato JSON con la siguiente estructura:
{
  "clean_name": "Título conciso y limpio para el ticket (máximo 10 palabras)",
  "priority": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "task_type": "BUG_FIX" | "TASK_INTERNA" | "CAMBIO" | "CONSULTA",
  "summary": "Resumen ejecutivo profesional de la solicitud"
}`;

      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      return JSON.parse(responseText);

    } catch (e) {
      console.error('[Gemini Sync Warning] Error de tokens/cuota o servicio no disponible. Aplicando datos dummy:', e.message);
      return dummyData;
    }
  }

  async processTaggedEmails() {
    try {
      // Al buscar solo por el nombre de la etiqueta, Gmail procesará el correo
      // sin importar si es antiguo, nuevo, está leído, no leído o archivado.
      const response = await this.gmail.users.messages.list({
        userId: 'me',
        q: 'label:"CONCORDE - TICKETS"'
      });

      const messages = response.data.messages || [];
      if (messages.length === 0) return;

      // Obtenemos el ID interno de la etiqueta para poder quitársela y no duplicar el ticket
      const labelsRes = await this.gmail.users.labels.list({ userId: 'me' });
      const concordeLabel = labelsRes.data.labels?.find(l => l.name === 'CONCORDE - TICKETS');

      for (const msg of messages) {
        const messageData = await this.gmail.users.messages.get({
          userId: 'me',
          id: msg.id
        });

        const headers = messageData.data.payload.headers;
        const subject = headers.find(h => h.name.toLowerCase() === 'subject')?.value || 'Sin Asunto';
        const rawFrom = headers.find(h => h.name.toLowerCase() === 'from')?.value || 'Desconocido';
        const snippet = messageData.data.snippet || 'Sin descripción';

        const cleanSenderEmail = this.cleanEmailAddress(rawFrom);
        const targetStoreId = await this.resolveStoreId(cleanSenderEmail);

        const aiData = await this.analyzeEmailWithGemini(subject, snippet, rawFrom);

        await TicketRepository.create({
          name: aiData.clean_name,
          description: `Origen: Gmail\nRemitente: ${rawFrom}\n\nResumen:\n${aiData.summary}\n\nMensaje Original:\n${snippet}`,
          store_id: targetStoreId,
          priority: aiData.priority,
          task_type: aiData.task_type
        });

        const removeIds = ['UNREAD'];
        if (concordeLabel) removeIds.push(concordeLabel.id);

        await this.gmail.users.messages.batchModify({
          userId: 'me',
          requestBody: {
            ids: [msg.id],
            removeLabelIds: removeIds
          }
        });

        console.log(`[Gmail Sync] Ticket generado para [${targetStoreId}]: "${aiData.clean_name}" (${aiData.priority})`);
      }
    } catch (error) {
      console.error('[Gmail Sync Error]:', error.message);
    }
  }
}

module.exports = new GmailSyncService();