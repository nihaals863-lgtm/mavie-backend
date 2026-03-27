const { sequelize } = require('../config/db');

async function fixSchema() {
  try {
    console.log('Checking purchase_orders table...');
    const [results] = await sequelize.query("SHOW COLUMNS FROM purchase_orders LIKE 'warehouse_id'");
    
    if (results.length === 0) {
      console.log('Adding warehouse_id column to purchase_orders...');
      await sequelize.query('ALTER TABLE purchase_orders ADD COLUMN warehouse_id INT NULL AFTER supplier_id');
      console.log('Column added successfully.');
    } else {
      console.log('warehouse_id column already exists.');
    }

    // Check products table
    console.log('Checking products table...');
    const [prodResults] = await sequelize.query("SHOW COLUMNS FROM products LIKE 'warehouse_id'");
    if (prodResults.length === 0) {
       console.log('Adding warehouse_id to products...');
       await sequelize.query('ALTER TABLE products ADD COLUMN warehouse_id INT NULL AFTER supplier_id');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error fixing schema:', error);
    process.exit(1);
  }
}

fixSchema();
