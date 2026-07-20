const db = require('../config/db');
const TicketRepository = require('../repositories/TicketRepository');

class HubspotService {
  static async syncTickets() {
    const token = process.env.HUBSPOT_ACCESS_TOKEN;
    if (!token) return;

    try {
      // Buscar tickets de las últimas 24 horas
      const cutoffTime = (Date.now() - 24 * 60 * 60 * 1000).toString();

      const response = await fetch(
        'https://api.hubapi.com/crm/v3/objects/tickets/search',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            filterGroups: [{
              filters: [{
                propertyName: 'createdate',
                operator: 'GTE',
                value: cutoffTime
              }]
            }],
            properties: ['subject', 'content', 'createdate'],
            sorts: [{ propertyName: 'createdate', direction: 'DESCENDING' }]
          })
        }
      );

      if (!response.ok) return;

      const data = await response.json();
      const hubspotTickets = data.results || [];

      for (const hsTicket of hubspotTickets) {
        const hsId = hsTicket.id;
        const props = hsTicket.properties || {};

        // Evitar duplicados
        const existingTicket = await db('tickets')
          .where('description', 'like', `%[HUBSPOT_ID: ${hsId}]%`)
          .first();

        if (!existingTicket) {
          // Inyectamos el ticket crudo con valores iniciales válidos
          await TicketRepository.create({
            name: props.subject || 'Ticket de HubSpot (Sin Asunto)',
            description: `[HUBSPOT_ID: ${hsId}]\nFecha origen: ${props.createdate}\n\n${props.content || 'Sin descripción.'}`,
            store_id: null,        // Vacío para asignar manualmente en Concorde
            assigned_to: null,     // Vacío para asignar manualmente
            priority: 'MEDIA',     // Valor inicial
            task_type: 'CONSULTA'  // Valor inicial permitido por constraint
          });

          console.log(`[HubSpot -> Concorde] Inyectado ticket crudo: ID ${hsId}`);
        }
      }
    } catch (error) {
      console.error('[HubSpot Sync Error]:', error.message);
    }
  }
}

module.exports = HubspotService;