import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import crmApi from '../../api/crmApi';

function MailsList() {
  const [mails, setMails] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchMails();
  }, []);

  const fetchMails = async () => {
    try {
      const res = await crmApi.get('/emails/inbox');
      if (res.data.success) {
        setMails(res.data.data);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error cargando correos:', error);
      setLoading(false);
    }
  };

  if (loading) return <div className="crm-text-loading">Cargando bandeja de entrada...</div>;

  return (
    <div>
      <div className="crm-actions-bar">
        <h1 className="crm-main-title" style={{ border: 'none', margin: 0 }}>Inbox Triage (Soporte)</h1>
        <button onClick={fetchMails} className="crm-btn-border">Actualizar Bandeja</button>
      </div>

      <div className="crm-card-paper">
        <div className="crm-table-container">
          <table className="crm-table-data">
            <thead>
              <tr>
                <th>Estado</th>
                <th>Remitente</th>
                <th>Asunto</th>
                <th>Fecha de Recepción</th>
              </tr>
            </thead>
            <tbody>
              {mails.length === 0 ? (
                <tr><td colSpan="4" className="crm-text-muted" style={{ textAlign: 'center' }}>Bandeja vacía. Todo al día.</td></tr>
              ) : (
                mails.map(mail => (
                  <tr 
                    key={mail.id} 
                    className="crm-table-row-interactive" 
                    style={{ cursor: 'pointer', fontWeight: mail.status === 'UNREAD' ? 'bold' : 'normal' }}
                    onClick={() => navigate(`/admin/mails/${mail.id}`)}
                  >
                    <td>
                      <span className="crm-badge" style={{ backgroundColor: mail.status === 'UNREAD' ? '#111' : '#ebe9e4', color: mail.status === 'UNREAD' ? '#fff' : '#111' }}>
                        {mail.status === 'UNREAD' ? 'NUEVO' : 'LEÍDO'}
                      </span>
                    </td>
                    <td>{mail.sender}</td>
                    <td>{mail.subject}</td>
                    <td>{new Date(mail.received_at).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default MailsList;   