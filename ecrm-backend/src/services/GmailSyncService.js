const { google } = require('googleapis');
const { GoogleGenAI } = require('@google/genai');
const TicketRepository = require('../repositories/TicketRepository');
const StoreRepository = require('../repositories/StoreRepository');
const db = require('../config/db');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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
    this.isProcessing = false; 

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

  async analyzeEmailWithGemini(subject, body, from, intentos = 2) {
    const dummyData = {
      priority: 'MEDIUM',
      task_type: 'CONSULTA',
      clean_name: subject || 'Ticket desde Gmail',
      summary: body || 'Sin descripción disponible.'
    };

    if (!process.env.GEMINI_API_KEY) return dummyData;

    try {
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

      const interaction = await ai.interactions.create({
        model: "gemini-3.8-flash",
        input: prompt,
      });

      let responseText = interaction.output_text;
      responseText = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
      
      return JSON.parse(responseText);
    } catch (e) {
      if (e.message.includes('429') && intentos > 0) {
        console.warn(`⚠️ Error 429 detectado. Forzando pausa de 35 segundos. Intentos restantes: ${intentos}`);
        await new Promise(r => setTimeout(r, 35000));
        return this.analyzeEmailWithGemini(subject, body, from, intentos - 1);
      }
      console.error('[Gemini Error]', e.message);
      return dummyData;
    }
  }

  async processTaggedEmails() {
    if (this.isProcessing) return; 
    this.isProcessing = true;

    try {
      const response = await this.gmail.users.messages.list({
        userId: 'me',
        q: 'label:concorde---tickets' 
      });

      const messages = response.data.messages || [];
      if (messages.length === 0) {
        this.isProcessing = false;
        return;
      }

      // Agrupamos por Hilo para procesar 1 sola vez toda la conversación
      const threadIds = [...new Set(messages.map(msg => msg.threadId))];

      for (const threadId of threadIds) {
        const threadData = await this.gmail.users.threads.get({
          userId: 'me',
          id: threadId
        });

        const threadMessages = threadData.data.messages || [];
        if (threadMessages.length === 0) continue;

        // Tomamos únicamente el último mensaje del hilo
        const lastMessage = threadMessages[threadMessages.length - 1];

        // Validamos si este mensaje en específico ya es un ticket
        if (this.procesadosEnMemoria.has(lastMessage.id)) {
          await this.removerEtiquetasHilo(threadId, lastMessage.labelIds);
          continue;
        }

        const existingTicket = await db('tickets')
          .where('description', 'like', `%[GMAIL_ID: ${lastMessage.id}]%`)
          .first();

        if (existingTicket) {
          this.procesadosEnMemoria.add(lastMessage.id);
          await this.removerEtiquetasHilo(threadId, lastMessage.labelIds);
          continue;
        }

        const headers = lastMessage.payload.headers;
        const subject = headers.find(h => h.name.toLowerCase() === 'subject')?.value || 'Sin Asunto';
        const rawFrom = headers.find(h => h.name.toLowerCase() === 'from')?.value || 'Desconocido';
        const snippet = lastMessage.snippet || 'Sin descripción';

        const cleanSenderEmail = this.cleanEmailAddress(rawFrom);
        const targetStoreId = await this.resolveStoreId(cleanSenderEmail);

        console.log(`⏳ Pausando 20 segundos para respetar cuota estricta de IA...`);
        await new Promise(resolve => setTimeout(resolve, 20000));

        const aiData = await this.analyzeEmailWithGemini(subject, snippet, rawFrom);

        await TicketRepository.create({
          name: aiData.clean_name,
          description: `[GMAIL_ID: ${lastMessage.id}]\nOrigen: Gmail\nRemitente: ${rawFrom}\n\nResumen:\n${aiData.summary}\n\nMensaje Original:\n${snippet}`,
          store_id: targetStoreId,
          priority: aiData.priority,
          task_type: aiData.task_type
        });

        this.procesadosEnMemoria.add(lastMessage.id);
        
        // REMOVER LA ETIQUETA A TODO EL HILO DE GOLPE
        await this.removerEtiquetasHilo(threadId, lastMessage.labelIds);
        console.log(`✅ [EXITO] 1 Ticket guardado para el hilo: "${aiData.clean_name}"`);
      }
    } catch (error) {
      console.error('❌ [Error]:', error.message);
    } finally {
      this.isProcessing = false; 
    }
  }

  async removerEtiquetasHilo(threadId, labelIds = []) {
    try {
      const removeIds = labelIds.filter(id => id.startsWith('Label_') || id === 'UNREAD');
      
      if (removeIds.length > 0) {
        await this.gmail.users.threads.modify({
          userId: 'me',
          id: threadId,
          requestBody: { removeLabelIds: removeIds }
        });
      }
    } catch (error) {
      console.error('Error removiendo etiqueta del hilo:', error.message);
    }
  }
}

module.exports = new GmailSyncService();