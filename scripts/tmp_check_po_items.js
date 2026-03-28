const { sequelize } = require('../config/db');

async function checkSchema() {
  try {
    const [results] = await sequelize.query("DESCRIBE purchase_order_items");
    console.log('Columns in purchase_order_items:', results);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkSchema();
