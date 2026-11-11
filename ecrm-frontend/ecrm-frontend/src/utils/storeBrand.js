// Primera palabra del nombre de la tienda: "Kuna Chile" → "kuna".
// Sirve para sugerir las tiendas de la misma marca (Kuna Perú, Kuna Chile, Kuna WW...).
export const brandOf = (store) => String(store?.name || store?.id || '')
  .toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .split(/[\s\-_.]+/)[0] || '';
