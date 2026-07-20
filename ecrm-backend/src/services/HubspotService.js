const db = require('../config/db');
const TicketRepository = require('../repositories/TicketRepository');

// Marca de tiempo capturada exactamente al iniciar el servidor (en milisegundos)
const serviceStartTime = Date.now();

class HubspotService {
  static async syncTickets() {
    const token = process.env.HUBSPOT_ACCESS_TOKEN;
    if (!token) return;

    try {
      // Usamos el endpoint de BÚSQUEDA para filtrar solo tickets creados desde este instante
      const response = await fetch(
        'https://api.hubapi.com/crm/v3/objects/tickets/search',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            filterGroups: [
              {
                filters: [
                  {
                    propertyName: 'createdate',
                    operator: 'GTE', // Greater Than or Equal (Mayor o igual que)
                    value: serviceStartTime
                  }
                ]
              }
            ],
            properties: ['subject', 'content', 'hs_ticket_priority', 'hs_pipeline_stage', 'createdate'],
            associations: ['contacts'],
            sorts: [{ propertyName: 'createdate', direction: 'DESCENDING' }]
          })
        }
      );

      if (!response.ok) {
        console.error('[HubSpot Search] Error en la API:', response.statusText);
        return;
      }

      const data = await response.json();
      const hubspotTickets = data.results || [];

      for (const hsTicket of hubspotTickets) {
        const hsId = hsTicket.id;
        const props = hsTicket.properties || {};

        // Evitar duplicados por si se ejecuta la consulta varias veces
        const existingTicket = await db('tickets')
          .where('description', 'like', `%[HUBSPOT_ID: ${hsId}]%`)
          .first();

        if (!existingTicket) {
          // A) Mapeo de prioridad
          let concordePriority = 'MEDIUM';
          const hsPriority = (props.hs_ticket_priority || '').toUpperCase();
          if (hsPriority === 'HIGH' || hsPriority === 'URGENT') concordePriority = 'HIGH';
          if (hsPriority === 'LOW') concordePriority = 'LOW';

          // B) Búsqueda de tienda en Concorde según el email del contacto
          let storeId = null;
          const contactAssoc = hsTicket.associations?.contacts?.results?.[0];

          if (contactAssoc) {
            const contactRes = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${contactAssoc.id}?properties=email`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });

            if (contactRes.ok) {
              const contactData = await contactRes.json();
              const clientEmail = (contactData.properties?.email || '').toLowerCase().trim();

              if (clientEmail) {
                const matchedStore = await db('stores')
                  .whereRaw('LOWER(emails) LIKE ?', [`%${clientEmail}%`])
                  .first();

                if (matchedStore) storeId = matchedStore.id;
              }
            }
          }

          if (!storeId) {
            const defaultStore = await db('stores').first();
            storeId = defaultStore ? defaultStore.id : null;
          }

          // C) Inyección en la base de datos de Concorde
          await TicketRepository.create({
            name: props.subject || 'Ticket sin título (HubSpot)',
            description: `[HUBSPOT_ID: ${hsId}]\n\n${props.content || 'Sin descripción.'}`,
            store_id: storeId,
            priority: concordePriority,
            task_type: 'SOPORTE'
          });

          console.log(`[HubSpot -> Concorde] Nuevo ticket ${hsId} importado con éxito.`);
        }
      }
    } catch (error) {
      console.error('[HubSpot Sync Error]:', error.message);
    }
  }
}

module.exports = HubspotService;