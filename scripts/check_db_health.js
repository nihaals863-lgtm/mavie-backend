const { sequelize } = require('../config/db');

async function checkAllTables() {
  const tables = ['purchase_orders', 'purchase_order_items', 'sales_orders', 'order_items', 'products', 'product_stocks'];
  
  for (const table of tables) {
    try {
      console.log(`\nTable: ${table}`);
      const [columns] = await sequelize.query(`SHOW COLUMNS FROM ${table}`);
      console.table(columns.map(c => ({ Field: c.Field, Type: c.Type, Null: c.Null })));
    } catch (err) {
      console.error(`Error checking ${table}:`, err.message);
    }
  }
  process.exit(0);
}

checkAllTables();
