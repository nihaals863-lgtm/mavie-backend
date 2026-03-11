const { Product, ProductStock, Warehouse } = require('./models');

async function debugStock(productId) {
  const product = await Product.findByPk(productId);
  if (!product) {
    console.log('Product not found');
    return;
  }
  console.log(`Product: ${product.name} (ID: ${product.id})`);
  
  const stocks = await ProductStock.findAll({
    where: { productId },
    include: [{ model: Warehouse }]
  });
  
  console.log('Stock Records:');
  stocks.forEach(s => {
    console.log(`- Warehouse: ${s.Warehouse?.name} (ID: ${s.warehouseId}), Qty: ${s.quantity}, Status: ${s.status}`);
  });
  
  const total = await ProductStock.sum('quantity', { where: { productId, status: 'ACTIVE' } });
  console.log(`Total Active Stock (All Warehouses): ${total}`);
}

// Search for "Palm Heights" product first
async function run() {
  const p = await Product.findOne({ where: { name: { [require('sequelize').Op.like]: '%Palm Heights%' } } });
  if (p) {
    await debugStock(p.id);
  } else {
    console.log('Palm Heights product not found');
  }
  process.exit();
}

run();
