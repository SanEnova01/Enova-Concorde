import React from 'react';
import crmApi from '../../../api/crmApi';

const getLogoUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const domain = (crmApi.defaults.baseURL || '').replace(/\/api$/, '');
  return `${domain}${url.startsWith('/') ? '' : '/'}${url}`;
};

// HEADER DE LA TIENDA (fijo, no es un módulo)
const ClientHeader = ({ client }) => (
  <div className="crm-card-paper" style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '24px' }}>
    <div style={{ width: '64px', height: '64px', backgroundColor: '#f2f1ec', display: 'flex', justifyContent: 'center', alignItems: 'center', border: '1px solid #111111', overflow: 'hidden', flexShrink: 0, borderRadius: '8px' }}>
      {client.logo_url ? <img src={getLogoUrl(client.logo_url)} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <span style={{ fontWeight: 'bold' }}>{client.name.substring(0, 2).toUpperCase()}</span>}
    </div>
    <div style={{ flexGrow: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>{client.name}</h1>
        <p className="crm-text-muted" style={{ margin: '4px 0 0 0' }}>ID de registro: {client.id}</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
        <span className="crm-badge">Plan: {client.plan_type}</span>
        {String(client.tecnologia).toLowerCase().includes('shopify') && <img src="/assets/shopify-icon.png" alt="Shopify" style={{ height: '35px', objectFit: 'contain', marginTop: '4px' }} />}
        {String(client.tecnologia).toLowerCase().includes('woo') && <img src="/assets/woo-icon.png" alt="WooCommerce" style={{ height: '40px', objectFit: 'contain', marginTop: '4px' }} />}
        {String(client.tecnologia).toLowerCase().includes('vtex') && <img src="/assets/vtex-icon.png" alt="VTEX" style={{ height: '45px', objectFit: 'contain', marginTop: '4px' }} />}
        {!String(client.tecnologia).toLowerCase().match(/shopify|woo|vtex/) && <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#666', textTransform: 'uppercase', marginTop: '4px' }}>{client.tecnologia}</span>}
      </div>
    </div>
  </div>
);

export default ClientHeader;
