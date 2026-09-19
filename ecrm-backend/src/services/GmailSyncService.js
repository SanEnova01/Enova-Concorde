const { google } = require('googleapis');
const { generateText } = require('ai');
const { openai } = require('@ai-sdk/openai');
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

    console.log('[Gmail Sync] Bot de Vercel AI SDK activo. Revisión cada 60s.');
    setTimeout(() => this.processTaggedEmails(), 2000);
    setInterval(() => this.processTaggedEmails(), 60000);
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

  // 🤖 PROCESAMIENTO CON VERCEL AI SDK
  async analyzeEmailWithAI(subject, body, from, storeInfo, intentos = 2) {
    const dummyData = {
      priority: 'MEDIUM',
      task_type: 'CONSULTA',
      clean_name: subject || 'Ticket desde Gmail',
      summary: body || 'Sin descripción',
      quick_solution: 'Revisión manual requerida.'
    };

    // Si no hay API Key de OpenAI o del Gateway, usamos fallback
    if (!process.env.OPENAI_API_KEY && !process.env.AI_GATEWAY_API_KEY) {
        console.warn('[Vercel AI] Llave no detectada. Procesando con datos dummy.');
        return dummyData;
    }

    try {
      const systemInstruction = `Eres un asistente de soporte técnico nivel 3. Analiza el correo y responde ÚNICAMENTE en formato JSON válido.
Estructura obligatoria:
{
  "clean_name": "Título conciso (máx 10 palabras)",
  "priority": "LOW" o "MEDIUM" o "HIGH" o "CRITICAL",
  "task_type": "BUG_FIX" o "TASK_INTERNA" o "CAMBIO" o "CONSULTA",
  "summary": "Resumen del problema",
  "quick_solution": "Paso a paso o recomendación técnica basada en la tecnología de la tienda."
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

      // Vercel AI SDK Ejecución
      const { text } = await generateText({
        model: openai('gpt-4o-mini'), // Cámbialo a 'gpt-4o' si necesitas más razonamiento
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

        // 1. Extraemos los datos del cliente
        const storeInfo = await this.resolveStoreData(cleanSenderEmail);

        // 2. Procesamos usando Vercel AI
        const aiData = await this.analyzeEmailWithAI(subject, snippet, rawFrom, storeInfo);

        // 3. Generamos el Ticket en Concorde
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