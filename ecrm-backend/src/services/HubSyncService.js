const crypto = require('crypto');

// ============================================================
// 🛑 SWITCH DE EMERGENCIA (KILL SWITCH)
// Cambia a "false" para detener la creación de tickets en el Hub
// ============================================================
const ENABLE_HUB_SYNC = true;

const HUB_API_URL = 'https://hub.enova.agency/api/concorde/v1';
const HUB_SECRET = process.env.CONCORDE_WEBHOOK_SECRET || '2513d3ea23a3be89dc9a871cc973e5437d322a58397441496f2f4ca0581bcc7b';

async function registrarTicketEnHub(ticketDB) {
    // Si el switch está apagado, salimos en silencio sin romper nada
    if (!ENABLE_HUB_SYNC) {
        console.log('⏸️ [Hub Sync] Sincronización desactivada por el switch de emergencia.');
        return null;
    }

    if (!ticketDB || !ticketDB.id) return null;

    // Construimos la descripción inyectando el texto y el emoji al final
    const descripcionOriginal = ticketDB.description || "Sin descripción";
    const descripcionConFirma = `${descripcionOriginal}\n\n✈️ Importado de Concorde`;

    const payload = {
        dry_run: false,
        ticket: {
            id: ticketDB.id,
            serial_number: ticketDB.serial_number,
            name: ticketDB.name,
            status: ticketDB.status || "OPEN",
            priority: ticketDB.priority || "MEDIUM",
            description: descripcionConFirma,
            store_id: ticketDB.store_id,
            assigned_to_email: ticketDB.assigned_to || ticketDB.assigned_to_email || null,
            task_type: ticketDB.task_type || "CAMBIO",
            created_at: ticketDB.created_at || new Date().toISOString(),
            updated_at: ticketDB.updated_at || ticketDB.created_at || new Date().toISOString()
        }
    };

    const bodyStr = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = crypto.createHmac('sha256', HUB_SECRET)
        .update(`${timestamp}.${bodyStr}`)
        .digest('hex');

    try {
        const response = await fetch(`${HUB_API_URL}/tickets`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Enova-Timestamp': timestamp,
                'X-Enova-Signature': `sha256=${signature}`
            },
            body: bodyStr
        });
        
        const json = await response.json().catch(() => null);
        
        if (response.ok && json?.ok) {
            console.log(`✅ [Hub Sync] Tarea vinculada en el Hub para ${ticketDB.serial_number}.`);
            return json;
        } else {
            console.error(`❌ [Hub Sync] Error del Hub (HTTP ${response.status}):`, json);
            return null;
        }
    } catch (error) {
        console.error(`❌ [Hub Sync] Falla de red:`, error.message);
        return null;
    }
}

module.exports = { registrarTicketEnHub };