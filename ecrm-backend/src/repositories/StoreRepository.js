const db = require('../config/db');
const crypto = require('crypto');

class StoreRepository {
  static async create(storeData) {
    try {
      const storeId = storeData.id || crypto.randomUUID();

      const [newStore] = await db('stores').insert({
        id: storeId,
        name: storeData.name,
        web: storeData.web || null,
        emails: storeData.emails || null,
        phone: storeData.phone || null,
        plan_type: storeData.plan_type,
        tecnologia: storeData.tecnologia || null,
        notes: storeData.notes || null,
        logo_url: storeData.logo_url || null,
        has_cooppilot: storeData.has_cooppilot || false, // 👈 NUEVO SWITCH
        ticket_count: 0 
      }).returning('*');

      return newStore;
    } catch (error) {
      throw new Error('Error al registrar la tienda: ' + error.message);
    }
  }

  static async getAll() {
    try {
      return await db('stores').orderBy('name', 'asc');
    } catch (error) {
      throw new Error('Error al obtener las tiendas: ' + error.message);
    }
  }

  static async getById(id) {
    try {
      return await db('stores').where({ id }).first();
    } catch (error) {
      throw new Error('Error al obtener la tienda: ' + error.message);
    }
  }

  static async update(id, storeData) {
    try {
      delete storeData.id;

      const updatePayload = {
        name: storeData.name,
        web: storeData.web,
        emails: storeData.emails,
        phone: storeData.phone,
        plan_type: storeData.plan_type,
        tecnologia: storeData.tecnologia,
        logo_url: storeData.logo_url, 
        notes: storeData.notes
      };

      if (typeof storeData.has_cooppilot !== 'undefined') {
        updatePayload.has_cooppilot = storeData.has_cooppilot;
      }

      const [updatedStore] = await db('stores')
        .where({ id: id })
        .update(updatePayload)
        .returning('*');

      return updatedStore;
    } catch (error) {
      throw new Error('Error al actualizar el registro en la base de datos: ' + error.message);
    }
  }
}

module.exports = StoreRepository;