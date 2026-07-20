const db = require('../config/db');
const TicketRepository = require('../repositories/TicketRepository');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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

      // Obtener la tienda por defecto
      const defaultStore = await db('stores').first();
      if (!defaultStore) {
        console.error('[HubSpot Sync Error]: No existen tiendas en la BD para vincular.');
        return;
      }

      // Directorio del volumen de Railway (el mismo que usa multer en index.js)
      const uploadDirectory = path.join(__dirname, '../public/assets');
      if (!fs.existsSync(uploadDirectory)) {
        fs.mkdirSync(uploadDirectory, { recursive: true });
      }

      for (const hsTicket of hubspotTickets) {
        const hsId = hsTicket.id;
        const props = hsTicket.properties || {};

        const existingTicket = await db('tickets')
          .where('description', 'like', `%[HUBSPOT_ID: ${hsId}]%`)
          .first();

        if (!existingTicket) {
          let ticketContent = props.content || 'Sin descripción.';

          // --- SCRAPER DE IMÁGENES AUTOMÁTICO ---
          // Busca etiquetas <img src="..."> en el HTML que manda HubSpot
          const imgRegex = /<img[^>]+src="([^">]+)"/g;
          let match;

          while ((match = imgRegex.exec(ticketContent)) !== null) {
            const imgUrl = match[1];
            try {
              const imgRes = await fetch(imgUrl);
              if (imgRes.ok) {
                const buffer = await imgRes.arrayBuffer();
                // Nombramos la imagen con un ID único
                const fileName = `hs-img-${crypto.randomUUID()}.png`;
                const savePath = path.join(uploadDirectory, fileName);
                
                // Guarda físicamente la imagen en tu disco/volumen de Railway
                fs.writeFileSync(savePath, Buffer.from(buffer));

                // Reemplaza la URL protegida de HubSpot por la ruta local libre de Concorde
                ticketContent = ticketContent.replace(imgUrl, `/assets/${fileName}`);
              }
            } catch (err) {
              console.error('[HubSpot Image Scraper] Error descargando imagen:', err.message);
            }
          }
          // --------------------------------------

          await TicketRepository.create({
            name: props.subject || 'Ticket de HubSpot (Sin Asunto)',
            description: `[HUBSPOT_ID: ${hsId}]\nFecha origen: ${props.createdate}\n\n${ticketContent}`,
            store_id: defaultStore.id,
            assigned_to: null,
            priority: 'MEDIUM',
            task_type: 'CONSULTA'
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