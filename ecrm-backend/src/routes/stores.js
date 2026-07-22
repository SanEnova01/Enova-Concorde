const express = require('express');
const router = express.Router();
const StoreRepository = require('../repositories/StoreRepository');

// POST: Registrar una nueva tienda/cliente
router.post('/', async (req, res) => {
  try {
    const storeData = req.body;

    if (!storeData.name || !storeData.plan_type) {
      return res.status(400).json({ 
        success: false, 
        error: 'Los campos name y plan_type son obligatorios.' 
      });
    }

    const result = await StoreRepository.create(storeData);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    console.error("Error en POST /stores:", error);
    res.status(500).json({ success: false, error: 'Error interno del servidor.' });
  }
});

// GET: Listar todas las tiendas (Para el Admin y para el Bot de Concorde)
router.get('/', async (req, res) => {
  try {
    const results = await StoreRepository.getAll();
    res.status(200).json({ success: true, data: results });
  } catch (error) {
    console.error("Error en GET /stores:", error);
    res.status(500).json({ success: false, error: 'Error interno del servidor.' });
  }
});

// GET: Obtener una tienda por ID (O resolver 'cuentacliente' por el correo del usuario)
router.get('/:id', async (req, res) => {
  try {
    let storeId = req.params.id;

    // 🌟 SI VIENE 'cuentacliente', BUSCAMOS LA TIENDA VINCULADA AL CORREO DEL TOKEN
    if (storeId === 'cuentacliente') {
      const userEmail = req.adminUser ? req.adminUser.email : '';
      const stores = await StoreRepository.getAll();
      const correoLimpio = String(userEmail).toLowerCase().trim();
      
      const matched = stores.find(store => {
        const list = String(store.emails || '').toLowerCase().split(/[\s,;]+/).map(e => e.trim());
        return list.includes(correoLimpio);
      });

      if (matched) {
        return res.status(200).json({ success: true, data: matched });
      } else {
        return res.status(404).json({ success: false, error: 'Tienda no asociada a este correo.' });
      }
    }

    const result = await StoreRepository.getById(storeId);
    if (!result) {
      return res.status(404).json({ success: false, error: 'Tienda no encontrada.' });
    }
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error("Error en GET /stores/:id", error);
    res.status(500).json({ success: false, error: 'Error interno del servidor.' });
  }
});

// PATCH: Actualizar los datos e imagen de la tienda
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const storeData = req.body;

    if (!id) {
      return res.status(400).json({ success: false, error: 'El ID de la tienda es requerido.' });
    }

    const result = await StoreRepository.update(id, storeData);
    
    if (!result) {
      return res.status(404).json({ success: false, error: 'La tienda no existe en el sistema.' });
    }

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error("Error en ruta PATCH /stores:", error);
    res.status(500).json({ success: false, error: 'Error interno del servidor al actualizar.' });
  }
});

module.exports = router;