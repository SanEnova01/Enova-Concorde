const db = require('../config/db');

class MessageRepository {
  static async addMessage(ticketId, messageData) {
    try {
      const [newMessage] = await db('ticket_messages').insert({
        ticket_id: ticketId,
        sender: messageData.sender,
        body: messageData.body,
        message_id: messageData.message_id,
        in_reply_to: messageData.in_reply_to
      }).returning('*');
      return newMessage;
    } catch (error) {
      throw new Error('Error al guardar el mensaje: ' + error.message);
    }
  }

  static async findTicketIdByMessageId(messageId) {
    try {
      const message = await db('ticket_messages').where('message_id', messageId).first();
      return message ? message.ticket_id : null;
    } catch (error) {
      throw new Error('Error al buscar el hilo: ' + error.message);
    }
  }
}

module.exports = MessageRepository;