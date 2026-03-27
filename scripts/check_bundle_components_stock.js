const { Product, ProductStock, Warehouse, BundleItem, Bundle } = require('../models');

async function check() {
  try {
    const bundle = await Product.findOne({
      where: { name: 'Cavo Rosa' }
    });

    if (!bundle) {
      console.log('Bundle not found');
      return;
    }

    const bItems = await BundleItem.findAll({
      where: { bundleId: bundle.id },
      include: [{ model: Product, as: 'Product' }]
    });

    console.log('\n--- COMPONENTS STOCK ---');
    for (const item of bItems) {
      const comp = item.Product;
      console.log(`\nComponent: ${comp.name} (ID: ${comp.id})`);
      const stocks = await ProductStock.findAll({
        where: { productId: comp.id },
        include: [{ model: Warehouse }]
      });
      stocks.forEach(s => {
        console.log(`  Warehouse: ${s.Warehouse?.name || 'Unknown'} (ID: ${s.warehouseId}) | Qty: ${s.quantity}`);
      });
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

check();
