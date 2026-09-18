const { google } = require('googleapis');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const TicketRepository = require('../repositories/TicketRepository');
const StoreRepository = require('../repositories/StoreRepository');
const db = require('../config/db'); // Necesitamos la DB para verificar si el correo ya existe

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
      
      // Usamos el modelo más rápido y estable actualmente
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

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
      
      // Limpiamos cualquier formato markdown que pueda enviar la IA
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

      if (messages.length === 0) {
        console.log('[Gmail Sync] 📭 Bandeja limpia o sin correos nuevos.');
        return;
      }

      console.log(`[Gmail Sync] 📥 Se encontraron ${messages.length} correos con etiqueta. Verificando en base de datos...`);

      for (const msg of messages) {
        // 🌟 LA VERDADERA SOLUCIÓN AL BUCLE: Verificamos si este correo YA EXISTE en la base de datos
        // Usamos el ID del mensaje de Gmail para buscar en la descripción del ticket
        const existingTicket = await db('tickets')
          .where('description', 'like', `%[GMAIL_ID: ${msg.id}]%`)
          .first();

        if (existingTicket) {
          console.log(`[Gmail Sync] ⏩ Saltando correo ya procesado anteriormente: ${msg.id}`);
          
          // Intentamos borrar la etiqueta de nuevo (por si falló la vez anterior), pero sin crear el ticket
          try {
             await this.gmail.users.messages.modify({
               userId: 'me',
               id: msg.id,
               requestBody: { removeLabelIds: ['UNREAD'] }
             });
          } catch(e){}
          
          continue; // Pasamos al siguiente correo
        }

        // Si llegamos aquí, ES UN CORREO NUEVO de verdad
        const messageData = await this.gmail.users.messages.get({
          userId: 'me',
          id: msg.id
        });

        const headers = messageData.data.payload.headers;
        const subject = headers.find(h => h.name.toLowerCase() === 'subject')?.value || 'Sin Asunto';
        const rawFrom = headers.find(h => h.name.toLowerCase() === 'from')?.value || 'Desconocido';
        
        // Tratar de obtener el cuerpo del mensaje (snippet suele ser suficiente para el resumen)
        const snippet = messageData.data.snippet || 'Sin descripción';

        const cleanSenderEmail = this.cleanEmailAddress(rawFrom);
        const targetStoreId = await this.resolveStoreId(cleanSenderEmail);

        const aiData = await this.analyzeEmailWithGemini(subject, snippet, rawFrom);

        // 🌟 GUARDAMOS EL GMAIL_ID EN LA DESCRIPCIÓN PARA NO VOLVER A PROCESARLO
        await TicketRepository.create({
          name: aiData.clean_name,
          description: `[GMAIL_ID: ${msg.id}]\nOrigen: Gmail\nRemitente: ${rawFrom}\n\nResumen:\n${aiData.summary}\n\nMensaje Original:\n${snippet}`,
          store_id: targetStoreId,
          priority: aiData.priority,
          task_type: aiData.task_type
        });

        // Intentamos limpiar las etiquetas
        try {
          const labelsRes = await this.gmail.users.labels.list({ userId: 'me' });
          const concordeLabel = labelsRes.data.labels?.find(l => l.name.toUpperCase().includes('CONCORDE'));
          
          const removeIds = ['UNREAD'];
          if (concordeLabel) removeIds.push(concordeLabel.id);
          
          await this.gmail.users.messages.modify({
            userId: 'me',
            id: msg.id,
            requestBody: { removeLabelIds: removeIds }
          });
        } catch(labelError) {
          console.warn(`[Gmail Sync] ⚠️ No se pudo remover la etiqueta, pero el ticket ya está en la BD: ${labelError.message}`);
        }

        console.log(`✅ [Gmail Sync EXITO] Nuevo ticket guardado en BD para [${targetStoreId}]: "${aiData.clean_name}"`);
      }
    } catch (error) {
      console.error('❌ [Gmail Sync Error]:', error.message);
    }
  }
}

module.exports = new GmailSyncService();