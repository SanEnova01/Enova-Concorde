// Copia al portapapeles la plantilla de respuesta rápida para el cliente (HTML + texto plano)
export const handleCopyEmailTemplate = () => {
    const htmlContent = `
      <div style="background-color: #F1F0EA; padding: 20px; font-family: Arial, Helvetica, sans-serif; color: #111111;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; background-color: #FFFFFF; border: 3px solid #000000; box-shadow: 5px 5px 0px #000000; border-collapse: collapse;">
          <!-- ENCABEZADO CONCORDE -->
          <tr>
            <td style="padding: 16px 20px; border-bottom: 3px solid #000000; background-color: #F1F0EA;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="left" valign="middle">
                    <h2 style="margin: 0; font-size: 18px; font-weight: 900; text-transform: uppercase; letter-spacing: -0.5px; color: #000000;">ENOVA AGENCY</h2>
                    <p style="margin: 2px 0 0 0; font-size: 10px; color: #555555; text-transform: uppercase; letter-spacing: 1px; font-weight: bold;">Soporte Web // Concorde Radar</p>
                  </td>
                  <td align="right" valign="middle">
                    <span style="background-color: #000000; color: #FFFFFF; padding: 4px 8px; font-size: 10px; font-weight: 900; text-transform: uppercase; display: inline-block;">TICKET GENERADO</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CUERPO DEL MENSAJE -->
          <tr>
            <td style="padding: 24px 20px;">
              <p style="margin: 0 0 12px 0; font-size: 14px; font-weight: bold;">Buenos días,</p>
              <p style="margin: 0 0 12px 0; font-size: 13.5px; line-height: 1.5;">Se creó un ticket de atención para este requerimiento.</p>
              <p style="margin: 0 0 16px 0; font-size: 13.5px; line-height: 1.5;">Les avisaré apenas tengamos alguna actualización.</p>

              <!-- CAJA DE REQUISITO DE CORREOS -->
              <div style="background-color: #F1F0EA; border: 2px solid #000000; padding: 14px; margin-bottom: 20px; box-shadow: 3px 3px 0px #000000;">
                <p style="margin: 0 0 10px 0; font-size: 11px; font-weight: 900; text-transform: uppercase; color: #000000;">Recordar enviarnos siempre las solicitudes a estos correos:</p>

                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 12.5px;">
                  <tr>
                    <td style="padding-bottom: 6px; font-weight: bold;">• Atención General:</td>
                    <td style="padding-bottom: 6px; text-align: right;">
                      <a href="mailto:soporte@enova.agency" style="color: #000000; font-weight: 900; text-decoration: underline;">soporte@enova.agency</a>
                    </td>
                  </tr>
                  <tr>
                    <td style="font-weight: bold;">• Jefatura de Área:</td>
                    <td style="text-align: right;">
                      <a href="mailto:santiago@enova.agency" style="color: #000000; font-weight: 900; text-decoration: underline;">santiago@enova.agency</a>
                    </td>
                  </tr>
                </table>
              </div>

              <p style="margin: 0; font-size: 13.5px; font-weight: bold;">Saludos,</p>
              <p style="margin: 2px 0 0 0; font-size: 12px; font-weight: 900; text-transform: uppercase;">Equipo de Soporte // ENOVA AGENCY</p>
            </td>
          </tr>
        </table>
      </div>
    `;

    const plainText = `Hola!,\n\nSe creó un ticket de atención para este requerimiento.\n\nLes avisare apenas tengamos alguna actualización.\n\nRecordar enviarnos siempre las solicitudes a estos correos:\n\n• Atención General: soporte@enova.agency\n• Jefatura de Área: santiago@enova.agency\n\nSaludos!\nENOVA AGENCY`;

    try {
      const blobHtml = new Blob([htmlContent], { type: 'text/html' });
      const blobText = new Blob([plainText], { type: 'text/plain' });
      const item = new ClipboardItem({
        'text/html': blobHtml,
        'text/plain': blobText
      });

      navigator.clipboard.write([item])
        .then(() => alert('¡Plantilla copiada en formato HTML Concorde! 📧'))
        .catch(() => {
          navigator.clipboard.writeText(plainText);
          alert('Copiado en texto plano.');
        });
    } catch (e) {
      navigator.clipboard.writeText(plainText);
      alert('Copiado en texto plano.');
    }
  };

export default handleCopyEmailTemplate;
