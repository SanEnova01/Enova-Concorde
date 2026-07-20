const db = require('../config/db');
const TicketRepository = require('../repositories/TicketRepository');

class HubspotService {
  static async syncTickets() {
    const token = process.env.HUBSPOT_ACCESS_TOKEN;
    if (!token) return;

    try {
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

      // Obtener la tienda por defecto (Resuelve not-null constraint de store_id)
      const defaultStore = await db('stores').first();
      if (!defaultStore) {
        console.error('[HubSpot Sync Error]: No existen tiendas en la BD para vincular.');
        return;
      }

      for (const hsTicket of hubspotTickets) {
        const hsId = hsTicket.id;
        const props = hsTicket.properties || {};

        const existingTicket = await db('tickets')
          .where('description', 'like', `%[HUBSPOT_ID: ${hsId}]%`)
          .first();

        if (!existingTicket) {
          await TicketRepository.create({
            name: props.subject || 'Ticket de HubSpot (Sin Asunto)',
            description: `[HUBSPOT_ID: ${hsId}]\nFecha origen: ${props.createdate}\n\n${props.content || 'Sin descripción.'}`,
            store_id: defaultStore.id, // Válido
            assigned_to: null,
            priority: 'MEDIUM',        // Válido (Pasa tickets_priority_check)
            task_type: 'CONSULTA'      // Válido (Pasa tickets_task_type_check)
          });

          console.log(`[HubSpot -> Concorde] ¡TICKET INSERTADO EXITOSAMENTE! ID ${hsId}`);
        }
      }
    } catch (error) {
      console.error('[HubSpot Sync Error]:', error.message);
    }
  }
}

module.exports = HubspotService;