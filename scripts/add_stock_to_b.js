const { Product, ProductStock } = require('../models');

async function create() {
  try {
    const component = await Product.findOne({
      where: { sku: { [require('sequelize').Op.like]: 'T-CABLE-%' } },
      order: [['createdAt', 'DESC']]
    });

    if (!component) {
       console.log('Component not found to link again.');
       process.exit(0);
    }
    console.log('Component Found:', component.sku, 'ID:', component.id);

    // Create stock strictly on Warehouse ID 8 ("b")
    const existing = await ProductStock.findOne({ where: { productId: component.id, warehouseId: 8 } });
    if (existing) {
       console.log('Stock already exists on Warehouse 8. Updating count to 100.');
       await existing.update({ quantity: 100 });
    } else {
       await ProductStock.create({
         productId: component.id,
         warehouseId: 8, // Warehouse B
         quantity: 100,
         reserved: 0,
         status: 'ACTIVE'
       });
       console.log('Added 100 stock to component for Warehouse B (ID: 8)');
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

create();
