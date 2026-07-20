const db = require('../config/db');
const TicketRepository = require('../repositories/TicketRepository');

class HubspotService {
  static async syncTickets() {
    const token = process.env.HUBSPOT_ACCESS_TOKEN;
    if (!token) {
      console.log('[HubSpot] No hay Token configurado. Abortando sincronización.');
      return;
    }

    try {
      console.log('[HubSpot] Iniciando búsqueda de tickets recientes...');
      
      // Buscar tickets creados en las últimas 24 horas (protege contra reinicios de Railway)
      // Se usa toString() porque la API de HubSpot exige que el valor sea texto
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
            properties: ['subject', 'content', 'hs_ticket_priority', 'hs_pipeline_stage', 'createdate'],
            associations: ['contacts'],
            sorts: [{ propertyName: 'createdate', direction: 'DESCENDING' }]
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.text();
        console.error('[HubSpot Search] Error API HTTP:', response.status, errorData);
        return;
      }

      const data = await response.json();
      const hubspotTickets = data.results || [];
      
      console.log(`[HubSpot] Se encontraron ${hubspotTickets.length} tickets en las últimas 24h.`);

      for (const hsTicket of hubspotTickets) {
        const hsId = hsTicket.id;
        const props = hsTicket.properties || {};

        // Verificamos si ya lo importamos antes
        const existingTicket = await db('tickets')
          .where('description', 'like', `%[HUBSPOT_ID: ${hsId}]%`)
          .first();

        if (!existingTicket) {
          let concordePriority = 'MEDIUM';
          const hsPriority = (props.hs_ticket_priority || '').toUpperCase();
          if (hsPriority === 'HIGH' || hsPriority === 'URGENT') concordePriority = 'HIGH';
          if (hsPriority === 'LOW') concordePriority = 'LOW';

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

          // Reemplaza esta sección en HubspotService.js:
await TicketRepository.create({
  name: props.subject || 'Ticket sin título (HubSpot)',
  description: `[HUBSPOT_ID: ${hsId}]\n\n${props.content || 'Sin descripción.'}`,
  store_id: storeId,
  priority: concordePriority,
  task_type: 'GENERAL' // <-- Cambiamos 'SOPORTE' por un tipo permitido por la DB
});

          console.log(`[HubSpot -> Concorde] INYECTADO NUEVO TICKET: ID ${hsId} - ${props.subject}`);
        } else {
          // Ya existía, lo ignoramos en silencio
        }
      }
    } catch (error) {
      console.error('[HubSpot Sync Error]:', error.message);
    }
  }
}

module.exports = HubspotService;