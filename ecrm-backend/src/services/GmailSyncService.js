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
    
    // 🌟 MEMORIA ANTI-BUCLES: Guarda los IDs de los correos ya procesados
    this.processedMessageIds = new Set();

    console.log('[Gmail Sync] 🚀 Servicio en línea. Revisando la bandeja automáticamente cada 60 segundos...');
    
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
    } catch (error) {
      console.warn(`[Gmail Sync] Cliente no encontrado para ${senderEmail}. Asignando cliente por defecto.`);
    }
    return 'enova.agency';
  }

  async analyzeEmailWithGemini(subject, body, from) {
    const dummyData = {
      priority: 'MEDIUM',
      task_type: 'CONSULTA',
      clean_name: subject || 'Ticket desde Gmail',
      summary: body || 'Sin descripción disponible.'
    };

    if (!process.env.GEMINI_API_KEY) {
      return dummyData;
    }

    try {
      console.log(`[Gemini Sync] 🧠 Analizando correo de ${from} con Inteligencia Artificial...`);
      
      // 🌟 FIX: Usamos 'gemini-pro' (1.0) que es universal y nunca da error 404
      const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

      const prompt = `Analiza el siguiente correo recibido y clasifícalo para registrar un ticket en el CRM.

Remitente: ${from}
Asunto: ${subject}
Mensaje: ${body}

Responde ÚNICA Y EXCLUSIVAMENTE en formato JSON con la siguiente estructura, sin texto adicional:
{
  "clean_name": "Título conciso y limpio para el ticket (máximo 10 palabras)",
  "priority": "LOW" o "MEDIUM" o "HIGH" o "CRITICAL",
  "task_type": "BUG_FIX" o "TASK_INTERNA" o "CAMBIO" o "CONSULTA",
  "summary": "Resumen ejecutivo profesional de la solicitud"
}`;

      const result = await model.generateContent(prompt);
      let responseText = result.response.text();
      
      // 🌟 FIX: Limpiamos las comillas invertidas (```json) que suele poner Gemini 1.0
      responseText = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
      
      return JSON.parse(responseText);

    } catch (e) {
      console.error('[Gemini Sync Warning] Error procesando IA. Aplicando datos básicos:', e.message);
      return dummyData;
    }
  }

  async processTaggedEmails() {
    try {
      console.log('[Gmail Sync] 🔍 Buscando correos con la etiqueta de Concorde...');
      
      const response = await this.gmail.users.messages.list({
        userId: 'me',
        q: 'label:concorde---tickets' 
      });

      const messages = response.data.messages || [];
      
      // Filtramos los que ya procesamos en la memoria RAM para evitar bucles
      const newMessages = messages.filter(msg => !this.processedMessageIds.has(msg.id));

      if (newMessages.length === 0) {
        console.log('[Gmail Sync] 📭 Bandeja limpia o correos ya procesados. No hay tickets nuevos.');
        return;
      }

      console.log(`[Gmail Sync] 📥 ¡Se encontraron ${newMessages.length} correos NUEVOS con etiqueta! Iniciando extracción...`);

      const labelsRes = await this.gmail.users.labels.list({ userId: 'me' });
      const allLabels = labelsRes.data.labels || [];
      const concordeLabel = allLabels.find(l => l.name.toUpperCase().includes('CONCORDE'));

      for (const msg of newMessages) {
        // Añadimos a la memoria inmediatamente para no volver a leerlo
        this.processedMessageIds.add(msg.id);

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

        // 🌟 FIX AGRESIVO PARA REMOVER ETIQUETAS
        const removeIds = [];
        if (messageData.data.labelIds.includes('UNREAD')) {
          removeIds.push('UNREAD');
        }
        
        if (concordeLabel && messageData.data.labelIds.includes(concordeLabel.id)) {
          removeIds.push(concordeLabel.id);
        } else {
          // Si no encuentra la etiqueta global, remueve CUALQUIER etiqueta personalizada que tenga el correo
          const customLabels = messageData.data.labelIds.filter(id => id.startsWith('Label_'));
          removeIds.push(...customLabels);
        }

        if (removeIds.length > 0) {
          await this.gmail.users.messages.modify({
            userId: 'me',
            id: msg.id,
            requestBody: { removeLabelIds: removeIds }
          });
        }

        console.log(`✅ [Gmail Sync EXITO] Ticket guardado en BD y etiqueta removida para [${targetStoreId}]: "${aiData.clean_name}"`);
      }
    } catch (error) {
      console.error('❌ [Gmail Sync Error]:', error.message);
    }
  }
}

module.exports = new GmailSyncService();