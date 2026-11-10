// Estilos de badges con color
export const getPlanBadgeStyle = (plan) => {
  switch(plan) {
    case 'GROWTH':
      return { backgroundColor: '#f3e8ff', color: '#6b21a8', border: '1px solid #d8b4fe' };
    case 'ESCALE':
    case 'SCALE':
      return { backgroundColor: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe' };
    case 'SCALE_PLUS':
      return { backgroundColor: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' };
    default: // GO
      return { backgroundColor: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' };
  }
};

export const getStatusBadgeStyle = (status) => {
  const isOnline = status === 'ONLINE';
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '3px 8px',
    borderRadius: '9999px',
    fontSize: '10px',
    fontWeight: '700',
    letterSpacing: '0.5px',
    backgroundColor: isOnline ? '#ecfdf5' : '#fef2f2',
    color: isOnline ? '#065f46' : '#991b1b',
    border: `1px solid ${isOnline ? '#a7f3d0' : '#fecaca'}`
  };
};
