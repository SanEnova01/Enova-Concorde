import React, { useState, useEffect } from 'react';
import axios from 'axios';

const StoreReviewHistory = ({ storeId }) => {
  const [reviews, setReviews] = useState([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const token = localStorage.getItem('token');
        const { data } = await axios.get(`/api/manual-reviews/${storeId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (data.success) setReviews(data.data);
      } catch (error) {
        console.error('Error obteniendo historial', error);
      }
    };
    if (storeId) fetchReviews();
  }, [storeId]);

  const getFilteredReviews = () => {
    const now = new Date();
    return reviews.filter(rev => {
      const revDate = new Date(rev.review_date);
      if (filter === 'diario') return revDate.toDateString() === now.toDateString();
      if (filter === 'semanal') {
        const diff = (now - revDate) / (1000 * 60 * 60 * 24);
        return diff <= 7;
      }
      if (filter === 'mensual') return revDate.getMonth() === now.getMonth() && revDate.getFullYear() === now.getFullYear();
      return true;
    });
  };

  const renderCheck = (val) => val ? '✅' : '❌';

  return (
    <div style={{ marginTop: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 'bold' }}>Historial de Revisiones Manuales</h3>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ padding: '5px', borderRadius: '4px', border: '1px solid #ccc' }}>
          <option value="all">Historial Completo (Anual)</option>
          <option value="mensual">Este Mes</option>
          <option value="semanal">Últimos 7 Días</option>
          <option value="diario">Hoy</option>
        </select>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px', fontSize: '14px' }}>
        <thead>
          <tr style={{ backgroundColor: '#f3f4f6', textAlign: 'left' }}>
            <th style={{ padding: '8px', border: '1px solid #ddd' }}>Fecha</th>
            <th style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'center' }}>Home</th>
            <th style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'center' }}>Blog</th>
            <th style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'center' }}>PDP</th>
            <th style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'center' }}>Carrito</th>
            <th style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'center' }}>Checkout</th>
          </tr>
        </thead>
        <tbody>
          {getFilteredReviews().map(rev => (
            <tr key={rev.id}>
              <td style={{ padding: '8px', border: '1px solid #ddd' }}>{new Date(rev.review_date).toLocaleDateString()}</td>
              <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'center' }}>{renderCheck(rev.home_page)}</td>
              <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'center' }}>{renderCheck(rev.blog)}</td>
              <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'center' }}>{renderCheck(rev.pdp)}</td>
              <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'center' }}>{renderCheck(rev.cart)}</td>
              <td style={{ padding: '8px', border: '1px solid #ddd', textAlign: 'center' }}>{renderCheck(rev.checkout)}</td>
            </tr>
          ))}
          {getFilteredReviews().length === 0 && (
            <tr><td colSpan="6" style={{ textAlign: 'center', padding: '15px' }}>No hay revisiones en este periodo.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default StoreReviewHistory;