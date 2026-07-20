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

      // Buscar la primera tienda de la DB para cumplir la restricción NOT NULL de store_id
      const defaultStore = await db('stores').first();
      if (!defaultStore) {
        console.error('[HubSpot Sync Error]: No existen tiendas registradas en la BD para vincular el ticket.');
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
            store_id: defaultStore.id, // Asignación de la tienda comodín requerida por la BD
            assigned_to: null,
            priority: 'MEDIA',
            task_type: 'CONSULTA'
          });

          console.log(`[HubSpot -> Concorde] ¡EXITO! Ticket ${hsId} importado e inyectado en la BD.`);
        }
      }
    } catch (error) {
      console.error('[HubSpot Sync Error]:', error.message);
    }
  }
}

module.exports = HubspotService;