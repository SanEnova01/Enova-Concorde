const { google } = require('googleapis');
const { GoogleGenAI } = require('@google/genai');
const TicketRepository = require('../repositories/TicketRepository');
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
    this.processedLabelId = null;

    console.log('[Gmail Sync] Modo Nivel 1 Activo (Sin pausas artificiales). Revisión cada 60s.');
    
    setTimeout(() => {
      this.processTaggedEmails();
    }, 2000);

    setInterval(() => {
      this.processTaggedEmails();
    }, 60000);
  }

  cleanEmailAddress(rawFrom) {
    const match = rawFrom.match(/<([^>]+)>/) || rawFrom.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/);
    return match ? match[1].toLowerCase().trim() : rawFrom.toLowerCase().trim();
  }

  async getProcessedLabelId() {
    if (this.processedLabelId) return this.processedLabelId;

    try {
      const res = await this.gmail.users.labels.list({ userId: 'me' });
      const labels = res.data.labels || [];
      
      // Busca cualquier etiqueta que contenga 'concorde' y 'procesad'
      const target = labels.find(l => {
        const name = l.name.toLowerCase();
        return name.includes('concorde') && name.includes('procesad');
      });

      if (target) {
        this.processedLabelId = target.id;
        return target.id;
      }

      // Si no existe ninguna similar, crea la versión estándar
      const newLabel = await this.gmail.users.labels.create({
        userId: 'me',
        requestBody: {
          name: 'CONCORDE - PROCESADOS',
          labelListVisibility: 'labelShow',
          messageListVisibility: 'show'
        }
      });
      this.processedLabelId = newLabel.data.id;
      return this.processedLabelId;
    } catch (error) {
      console.error('⚠️ Error obteniendo/creando etiqueta de procesados:', error.message);
      return null;
    }
  }

  async resolveStoreId(senderEmail, inferredCompany = '') {
    try {
      const domainMatch = senderEmail.match(/@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      const domain = domainMatch && domainMatch[1] ? domainMatch[1].toLowerCase().trim() : '';
      const dominiosGenericos = ['gmail.com', 'hotmail.com', 'yahoo.com', 'outlook.com', 'icloud.com'];

      if (domain && !dominiosGenericos.includes(domain)) {
        const storeDb = await db('stores')
          .where('web', 'like', `%${domain}%`)
          .orWhere('email', 'like', `%${domain}%`)
          .first();
          
        if (storeDb && storeDb.id) {
          return storeDb.id;
        }
      }

      if (inferredCompany && inferredCompany.trim() !== '' && inferredCompany.toLowerCase() !== 'desconocido') {
        const companyStr = inferredCompany.trim();
        const storeDb = await db('stores')
          .where('name', 'like', `%${companyStr}%`)
          .orWhere('web', 'like', `%${companyStr.replace(/\s+/g, '').toLowerCase()}%`)
          .first();
          
        if (storeDb && storeDb.id) {
          console.log(`🧠 [IA Scanner] Tienda identificada: ${companyStr} -> ID: ${storeDb.id}`);
          return storeDb.id;
        }
      }
    } catch (error) {
      console.error('⚠️ [Error en Scanner de ID]:', error.message);
    }
    
    return 'enova.agency';
  }

  async analyzeEmailWithGemini(subject, body, from, intentos = 2) {
    const dummyData = {
      priority: 'MEDIUM',
      task_type: 'CONSULTA',
      clean_name: subject || 'Ticket desde Gmail',
      summary: body || 'Sin descripción disponible.',
      inferred_company: ''
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
  "summary": "Resumen ejecutivo profesional de la solicitud",
  "inferred_company": "Nombre de la empresa, tienda o marca principal extraída del remitente, firmas o contexto del mensaje (Si no se puede deducir, déjalo vacío)"
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
        console.warn(`⚠️ Reintento rápido por fluctuación de red...`);
        await new Promise(r => setTimeout(r, 2000));
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
      // 🛡️ Filtro estricto: Trae los correos con la etiqueta de entrada pero EXCLUYE los procesados
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
        const threadData = await this.gmail.users.threads.get({
          userId: 'me',
          id: threadId
        });

        const threadMessages = threadData.data.messages || [];
        if (threadMessages.length === 0) continue;

        const lastMessage = threadMessages[threadMessages.length - 1];

        // ESCUDO 1: Verificación en memoria
        if (this.procesadosEnMemoria.has(lastMessage.id)) {
          await this.moverAProcesados(threadId, lastMessage.labelIds);
          continue;
        }

        // ESCUDO 2: Verificación en Base de Datos
        const existingTicket = await db('tickets')
          .where('description', 'like', `%[GMAIL_ID: ${lastMessage.id}]%`)
          .first();

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

        const aiData = await this.analyzeEmailWithGemini(subject, snippet, rawFrom);
        const targetStoreId = await this.resolveStoreId(cleanSenderEmail, aiData.inferred_company);

        await TicketRepository.create({
          name: aiData.clean_name,
          description: `[GMAIL_ID: ${lastMessage.id}]\nOrigen: Gmail\nRemitente: ${rawFrom}\n\nResumen:\n${aiData.summary}\n\nMensaje Original:\n${snippet}`,
          store_id: targetStoreId,
          priority: aiData.priority,
          task_type: aiData.task_type
        });

        // 🔄 Mover el hilo a 'concorde---procesados' para sacarlo del flujo de entrada
        await this.moverAProcesados(threadId, lastMessage.labelIds);
        console.log(`⚡ [Sincronizado] Ticket: "${aiData.clean_name}" (Tienda: ${targetStoreId}) -> Movido a Procesados`);
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
        requestBody: { 
          removeLabelIds: removeIds,
          addLabelIds: addIds 
        }
      });
    } catch (error) {
      console.error('Error moviendo etiquetas del hilo:', error.message);
    }
  }
}

module.exports = new GmailSyncService();