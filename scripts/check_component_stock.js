const { Product, ProductStock, Warehouse } = require('../models');

async function check() {
  try {
    const comp = await Product.findOne({
      where: { name: 'Cover Plexy PLS' }
    });

    if (!comp) {
      console.log('Component not found');
      return;
    }

    console.log(`Found Component: ${comp.name} (ID: ${comp.id})`);

    const stocks = await ProductStock.findAll({
      where: { productId: comp.id },
      include: [{ model: Warehouse }]
    });

    console.log('\n--- STOCK LOCATIONS ---');
    stocks.forEach(s => {
      console.log(`Warehouse: ${s.Warehouse?.name || 'Unknown'} (ID: ${s.warehouseId}) | Quantity: ${s.quantity} | Reserved: ${s.reserved}`);
    });

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

check();
