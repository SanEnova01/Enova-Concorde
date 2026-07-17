exports.up = function(knex) {
  return knex.schema.table('tickets', table => {
    // Añadimos el campo descripción/nota como TEXT (permite textos largos) y opcional
    table.text('description'); 
  });
};

exports.down = function(knex) {
  return knex.schema.table('tickets', table => {
    table.dropColumn('description');
  });
};