const { google } = require('googleapis');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const TicketRepository = require('../repositories/TicketRepository');
const StoreRepository = require('../repositories/StoreRepository');
const db = require('../config/db');

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
    
    this.procesadosEnMemoria = new Set();

    console.log('[Gmail Sync] Servicio iniciado. Revisión cada 60s.');
    
    setTimeout(() => {
      this.processTaggedEmails();
    }, 5000);

    setInterval(() => {
      this.processTaggedEmails();
    }, 60000);
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
    } catch (error) {}
    return 'enova.agency';
  }

  async analyzeEmailWithGemini(subject, body, from) {
    const dummyData = {
      priority: 'MEDIUM',
      task_type: 'CONSULTA',
      clean_name: subject || 'Ticket desde Gmail',
      summary: body || 'Sin descripción disponible.'
    };

    if (!process.env.GEMINI_API_KEY) return dummyData;

    try {
      // 🌟 SOLUCIÓN APLICADA: Actualizado al modelo vigente y recomendado
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      const prompt = `Analiza el siguiente correo recibido y clasifícalo para registrar un ticket en el CRM.

Remitente: ${from}
Asunto: ${subject}
Mensaje: ${body}

Responde ÚNICA Y EXCLUSIVAMENTE en formato JSON con la siguiente estructura, sin texto adicional ni bloques de código markdown:
{
  "clean_name": "Título conciso y limpio para el ticket (máximo 10 palabras)",
  "priority": "LOW" o "MEDIUM" o "HIGH" o "CRITICAL",
  "task_type": "BUG_FIX" o "TASK_INTERNA" o "CAMBIO" o "CONSULTA",
  "summary": "Resumen ejecutivo profesional de la solicitud"
}`;

      const result = await model.generateContent(prompt);
      let responseText = result.response.text();
      responseText = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
      
      return JSON.parse(responseText);
    } catch (e) {
      console.error('[Gemini Error]', e.message);
      return dummyData;
    }
  }

  async processTaggedEmails() {
    try {
      const response = await this.gmail.users.messages.list({
        userId: 'me',
        q: 'label:concorde---tickets' 
      });

      const messages = response.data.messages || [];
      if (messages.length === 0) return;

      for (const msg of messages) {
        if (this.procesadosEnMemoria.has(msg.id)) continue;

        const existingTicket = await db('tickets')
          .where('description', 'like', `%[GMAIL_ID: ${msg.id}]%`)
          .first();

        if (existingTicket) {
          this.procesadosEnMemoria.add(msg.id);
          this.removerEtiquetas(msg.id);
          continue;
        }

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
          description: `[GMAIL_ID: ${msg.id}]\nOrigen: Gmail\nRemitente: ${rawFrom}\n\nResumen:\n${aiData.summary}\n\nMensaje Original:\n${snippet}`,
          store_id: targetStoreId,
          priority: aiData.priority,
          task_type: aiData.task_type
        });

        this.procesadosEnMemoria.add(msg.id);
        await this.removerEtiquetas(msg.id, messageData.data.labelIds);
        console.log(`✅ [EXITO] Ticket guardado: "${aiData.clean_name}"`);
      }
    } catch (error) {
      console.error('❌ [Error]:', error.message);
    }
  }

  async removerEtiquetas(messageId, labelIds = null) {
    try {
      if (!labelIds) {
        const msgData = await this.gmail.users.messages.get({ userId: 'me', id: messageId });
        labelIds = msgData.data.labelIds || [];
      }
      
      const removeIds = labelIds.filter(id => id.startsWith('Label_') || id === 'UNREAD');
      
      if (removeIds.length > 0) {
        await this.gmail.users.messages.modify({
          userId: 'me',
          id: messageId,
          requestBody: { removeLabelIds: removeIds }
        });
      }
    } catch (error) {}
  }
}

module.exports = new GmailSyncService();