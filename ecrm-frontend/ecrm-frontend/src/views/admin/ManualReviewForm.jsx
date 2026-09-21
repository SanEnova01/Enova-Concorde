import React, { useState, useEffect } from 'react';
import axios from 'axios';

const PLANES_ELEGIBLES = ['go', 'growth', 'scale', 'warranty'];

const ManualReviewForm = () => {
  const [stores, setStores] = useState([]);
  const [formData, setFormData] = useState({
    store_id: '',
    review_date: new Date().toISOString().split('T')[0],
    home_page: false,
    blog: false,
    pdp: false,
    cart: false,
    checkout: false,
    reviewer_name: 'Agente'
  });

  useEffect(() => {
    const fetchStores = async () => {
      try {
        const token = localStorage.getItem('token');
        const { data } = await axios.get('/api/stores', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const validStores = data.data.filter(store => 
          PLANES_ELEGIBLES.includes(String(store.plan_type).toLowerCase())
        );
        setStores(validStores);
      } catch (error) {
        console.error('Error cargando tiendas:', error);
      }
    };
    fetchStores();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.store_id) return alert('Selecciona una tienda');
    
    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/manual-reviews', formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('✅ Revisión guardada exitosamente');
      setFormData(prev => ({ ...prev, home_page: false, blog: false, pdp: false, cart: false, checkout: false }));
    } catch (error) {
      alert('Error al guardar la revisión');
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px', backgroundColor: 'white', borderRadius: '8px', margin: '20px auto', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
      <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '20px' }}>Registro de Revisión Manual</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        
        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Tienda (Planes: Go, Growth, Scale, Warranty)</label>
          <select name="store_id" value={formData.store_id} onChange={handleChange} required style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
            <option value="">-- Selecciona una tienda --</option>
            {stores.map(store => (
              <option key={store.id} value={store.id}>{store.name} ({store.plan_type})</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Fecha de Revisión</label>
          <input type="date" name="review_date" value={formData.review_date} onChange={handleChange} required style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
        </div>

        <div style={{ border: '1px solid #ccc', padding: '15px', borderRadius: '5px' }}>
          <strong style={{ display: 'block', marginBottom: '10px' }}>Puntos de Control Verificados (Marca si está OK):</strong>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}><input type="checkbox" name="home_page" checked={formData.home_page} onChange={handleChange} /> 1. Página Principal (Home)</label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}><input type="checkbox" name="blog" checked={formData.blog} onChange={handleChange} /> 2. Blog</label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}><input type="checkbox" name="pdp" checked={formData.pdp} onChange={handleChange} /> 3. PDP (Página de Producto)</label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}><input type="checkbox" name="cart" checked={formData.cart} onChange={handleChange} /> 4. Carrito / Pre-checkout</label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}><input type="checkbox" name="checkout" checked={formData.checkout} onChange={handleChange} /> 5. Checkout</label>
          </div>
        </div>

        <button type="submit" style={{ padding: '10px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', marginTop: '10px' }}>
          Subir Registro
        </button>
      </form>
    </div>
  );
};

export default ManualReviewForm;