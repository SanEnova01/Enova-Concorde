const express = require('express');
const router = express.Router();
const db = require('../config/db');
const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'dummy' });

// Helper para obtener el ID real de la tienda si vienen solicitando 'cuentacliente'
async function resolveStoreId(storeIdParam, userEmail) {
  if (storeIdParam !== 'cuentacliente') {
    return storeIdParam;
  }
  const stores = await db('stores').select('*');
  const correoLimpio = String(userEmail).toLowerCase().trim();
  const matched = stores.find(store => {
    const list = String(store.emails).toLowerCase().split(/[\s,;]+/).map(e => e.trim());
    return list.includes(correoLimpio);
  });
  return matched ? matched.id : null;
}

// GET: Leer todo el conocimiento de una tienda
router.get('/:store_id', async (req, res) => {
  try {
    const rawStoreId = req.params.store_id;
    const userEmail = req.adminUser ? req.adminUser.email : '';
    const store_id = await resolveStoreId(rawStoreId, userEmail);

    if (!store_id) {
      return res.json({ success: true, data: [] });
    }

    const kb = await db('knowledge_base')
      .where({ store_id })
      .orderBy('created_at', 'desc');

    res.json({ success: true, data: kb || [] });
  } catch (error) {
    console.error("Error en GET /knowledge:", error.message);
    res.status(500).json({ success: false, error: 'Error al consultar la base de datos.' });
  }
});

// POST: Agregar una nueva regla/política a la IA
router.post('/', async (req, res) => {
  try {
    let { store_id, category, question, answer } = req.body;
    const userEmail = req.adminUser ? req.adminUser.email : '';
    store_id = await resolveStoreId(store_id, userEmail);

    if (!store_id || !category || !answer) {
      return res.status(400).json({ success: false, error: 'Faltan datos obligatorios.' });
    }

    // Generar el vector matemático (Embedding) del documento usando OpenAI
    let embeddingString = null;
    if (process.env.OPENAI_API_KEY) {
      const embedRes = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: `${category} - ${question}\n${answer}`,
      });
      // Formatear array a string vector para Postgres: "[0.1, 0.2, ...]"
      embeddingString = `[${embedRes.data[0].embedding.join(',')}]`;
    }

    const [newEntry] = await db('knowledge_base').insert({
      store_id, 
      category, 
      question: question || '', 
      answer, 
      embedding: embeddingString
    }).returning('*');

    res.json({ success: true, data: newEntry });
  } catch (error) {
    console.error("Error en POST /knowledge:", error);
    res.status(500).json({ success: false, error: 'Error al guardar la regla.' });
  }
});

// DELETE: Borrar una regla
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db('knowledge_base').where({ id }).del();
    res.json({ success: true, message: 'Regla eliminada' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error al eliminar la regla.' });
  }
});

module.exports = router;