const PLAYBOOKS = {
  shopify: {
    label: 'Shopify',
    saas: true,
    limits: 'Plataforma SaaS: no hay acceso a servidor, PHP, base de datos, .htaccess ni logs de servidor. Solo se puede actuar sobre el Admin, el tema (Liquid/CSS/JS), las apps instaladas y la configuración. Los fallos de infraestructura, checkout o rendimiento del servidor los resuelve Shopify Support.',
    where: [
      'Admin > Tienda online > Temas > Personalizar (editor del tema, incluye Incrustaciones de apps)',
      'Admin > Tienda online > Temas > ... > Editar código (Liquid, CSS, JS)',
      'Admin > Tienda online > Temas > ... > Duplicar (copia de seguridad antes de editar)',
      'Admin > Configuración > Apps y canales de venta (apps instaladas y permisos)',
      'Admin > Configuración > Pagos / Envíos y entrega / Dominios / Pago (checkout) / Notificaciones',
      'Admin > Tienda online > Navegación / Preferencias',
      'Admin > Análisis > Informes (ventas, sesiones, velocidad)'
    ],
    common: [
      'Apps que inyectan scripts: desactivar la incrustación en el editor del tema antes de desinstalar',
      'Código residual de apps desinstaladas en theme.liquid',
      'Imágenes sin optimizar y secciones con demasiados bloques',
      'Cambios de checkout limitados por la edición del plan'
    ]
  },
  woocommerce: {
    label: 'WooCommerce',
    saas: false,
    limits: 'Plataforma autoalojada: hay acceso a WordPress, plugins, hosting, PHP, logs y base de datos. Cualquier cambio en producción requiere copia de seguridad previa y, si es posible, prueba en staging.',
    where: [
      'wp-admin > Plugins > Plugins instalados (activar, desactivar, actualizar)',
      'wp-admin > WooCommerce > Estado > Informe del sistema (versiones, PHP, memoria, plugins)',
      'wp-admin > WooCommerce > Estado > Registros (logs de WooCommerce y pasarelas)',
      'wp-admin > WooCommerce > Estado > Acciones programadas (Action Scheduler)',
      'wp-admin > WooCommerce > Ajustes > Pagos / Envío / Productos / Avanzado',
      'wp-admin > Herramientas > Salud del sitio',
      'wp-admin > Ajustes > Enlaces permanentes (guardar para regenerar reglas)',
      'Panel del hosting: versión de PHP, límites de memoria, error_log, caché del servidor',
      'wp-config.php: WP_DEBUG y WP_DEBUG_LOG'
    ],
    common: [
      'Conflicto entre plugins o con el tema tras una actualización',
      'Caché (plugin y servidor) sirviendo contenido viejo',
      'Versión de PHP o memoria insuficiente',
      'Plugins inactivos o abandonados con vulnerabilidades',
      'Pasarela de pago con credenciales o webhooks mal configurados'
    ]
  },
  vtex: {
    label: 'VTEX',
    saas: true,
    limits: 'Plataforma SaaS: no hay acceso a infraestructura. Solo se puede actuar sobre el Admin de VTEX, el CMS/Site Editor, apps de VTEX IO, configuración de checkout y Master Data. Los problemas de plataforma se escalan a VTEX Support con el ID de cuenta y el workspace.',
    where: [
      'Admin VTEX > Storefront > Site Editor / Layout (contenido y bloques)',
      'Admin VTEX > Apps > Mis apps (apps de VTEX IO instaladas)',
      'Admin VTEX > Configuración de la tienda > Checkout',
      'Admin VTEX > Configuración de la tienda > Pagos',
      'Admin VTEX > Pedidos (estado y detalle de órdenes)',
      'Admin VTEX > Master Data',
      'CLI de VTEX IO: vtex workspace list, vtex logs, vtex list'
    ],
    common: [
      'Cambios publicados desde un workspace sin probar',
      'Apps de VTEX IO desactualizadas o con conflicto de versiones',
      'Reglas de checkout, promociones o logística mal configuradas'
    ]
  },
  magento: {
    label: 'Magento',
    saas: false,
    limits: 'Plataforma autoalojada (o Adobe Commerce Cloud): hay acceso a servidor, CLI y logs según el plan de hosting. Cualquier cambio en producción requiere copia de seguridad y modo de despliegue correcto.',
    where: [
      'Admin > Sistema > Herramientas > Gestión de caché',
      'Admin > Sistema > Herramientas > Gestión de índices',
      'Admin > Tiendas > Configuración',
      'Admin > Stores > Configuration > Advanced > Developer',
      'Servidor: var/log/exception.log y var/log/system.log',
      'CLI: bin/magento cache:flush, bin/magento indexer:reindex'
    ],
    common: [
      'Índices desactualizados',
      'Caché sin limpiar tras un despliegue',
      'Extensiones de terceros en conflicto'
    ]
  },
  prestashop: {
    label: 'PrestaShop',
    saas: false,
    limits: 'Plataforma autoalojada: hay acceso a back office, módulos, hosting y logs. Cualquier cambio en producción requiere copia de seguridad previa.',
    where: [
      'Back office > Módulos > Gestor de módulos',
      'Back office > Parámetros avanzados > Rendimiento',
      'Back office > Parámetros avanzados > Registros',
      'Back office > Diseño > Tema y logotipo',
      'Servidor: var/logs y panel del hosting'
    ],
    common: [
      'Módulos en conflicto tras actualizar',
      'Caché y Smarty sin limpiar',
      'Overrides desactualizados'
    ]
  },
  custom: {
    label: 'E-commerce a medida',
    saas: false,
    limits: 'Desarrollo propio o plataforma no identificada: antes de proponer cambios hay que confirmar stack, repositorio, hosting y acceso a logs.',
    where: [
      'Repositorio del proyecto y rama de producción',
      'Panel del hosting o proveedor cloud',
      'Logs de aplicación y del servidor web',
      'Consola del navegador (pestañas Console y Network)'
    ],
    common: [
      'Despliegue reciente sin pruebas',
      'Variables de entorno o credenciales vencidas',
      'Dependencias externas caídas'
    ]
  }
};

function normalizeTech(raw) {
  const t = String(raw || '').toLowerCase();
  if (!t.trim()) return null;
  if (t.includes('shopify')) return 'shopify';
  if (t.includes('woo') || t.includes('wordpress') || t.includes('wp')) return 'woocommerce';
  if (t.includes('vtex')) return 'vtex';
  if (t.includes('magento') || t.includes('adobe commerce')) return 'magento';
  if (t.includes('prestashop')) return 'prestashop';
  if (t.includes('custom') || t.includes('medida')) return 'custom';
  return null;
}

function techLabel(key) {
  return PLAYBOOKS[key] ? PLAYBOOKS[key].label : 'Desconocida';
}

function isSaas(key) {
  return Boolean(PLAYBOOKS[key] && PLAYBOOKS[key].saas);
}

function playbookText(key) {
  const p = PLAYBOOKS[key];
  if (!p) return '';
  return [
    `### ${p.label}${p.saas ? ' (SaaS)' : ' (autoalojado)'}`,
    `Límites: ${p.limits}`,
    'Dónde mirar:',
    ...p.where.map((w) => `- ${w}`),
    'Causas frecuentes:',
    ...p.common.map((c) => `- ${c}`)
  ].join('\n');
}

function allPlaybooksText() {
  return Object.keys(PLAYBOOKS).map(playbookText).join('\n\n');
}

function constraintText(key) {
  const p = PLAYBOOKS[key];
  if (!p) return 'Tecnología no identificada: no asumas acceso a servidor ni a la plataforma.';
  return `${p.label}: ${p.limits}`;
}

module.exports = {
  PLAYBOOKS,
  normalizeTech,
  techLabel,
  isSaas,
  playbookText,
  allPlaybooksText,
  constraintText
};
