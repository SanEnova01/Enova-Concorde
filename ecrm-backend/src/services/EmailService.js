const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const TicketRepository = require('../repositories/TicketRepository');
const MessageRepository = require('../repositories/MessageRepository');

class EmailService {
  constructor(email, password) {
    this.email = email;
    this.client = new ImapFlow({
      host: 'imap.gmail.com',
      port: 993,
      secure: true,
      auth: { user: email, pass: password },
      logger: false 
    });
  }

  async startListening() {
    try {
      await this.client.connect();
      console.log(`[IMAP] Escuchando correos en: ${this.email}`);

      // Escuchamos la bandeja principal
      let lock = await this.client.getMailboxLock('INBOX');
      try {
        this.client.on('exists', () => this.processUnreadEmails());
        await this.processUnreadEmails();
      } finally {
        lock.release();
      }
    } catch (error) {
      console.error(`[IMAP] Error conectando a ${this.email}:`, error);
    }
  }

  async processUnreadEmails() {
    try {
      for await (let msg of this.client.fetch({ unseen: true }, { source: true, uid: true })) {
        const parsedEmail = await simpleParser(msg.source);
        
        const sender = parsedEmail.from.value[0].address;
        const subject = parsedEmail.subject;
        const body = parsedEmail.text || parsedEmail.html || 'Mensaje sin texto';
        const messageId = parsedEmail.messageId;
        const inReplyTo = parsedEmail.inReplyTo;

        console.log(`[IMAP] Nuevo ticket/mensaje de: ${sender}`);

        let ticketId = null;

        if (inReplyTo) {
          ticketId = await MessageRepository.findTicketIdByMessageId(inReplyTo);
        }

        if (!ticketId) {
          const newTicket = await TicketRepository.create({
            name: subject || 'Sin Asunto',
            store_id: 'enova.agency', 
            task_type: 'CONSULTA',
            priority: 'MEDIUM'
          });
          ticketId = newTicket.id;
        }

        await MessageRepository.addMessage(ticketId, {
          sender,
          body,
          message_id: messageId,
          in_reply_to: inReplyTo
        });

        // Marcamos como leído para no repetir
        await this.client.messageFlagsAdd({ uid: msg.uid }, ['\\Seen']);
      }
    } catch (error) {
      console.error('[IMAP] Error procesando correos:', error);
    }
  }
}

module.exports = EmailService;