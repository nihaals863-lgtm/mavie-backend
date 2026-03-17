const { Bundle, BundleItem, Product } = require('../models');

async function clean() {
  try {
    const list = await Bundle.findAll();
    console.log(`Checking ${list.length} bundle rules for orphans...`);
    
    for (const b of list) {
       const hasProduct = await Product.findOne({ where: { sku: b.sku, productType: 'BUNDLE' } });
       if (!hasProduct) {
          console.log(`Orphan Bundle Found for SKU: ${b.sku}. Cleaning up items and deleting Bundle record.`);
          await BundleItem.destroy({ where: { bundleId: b.id } });
          await b.destroy();
       }
    }
    console.log('Cleanup complete!');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
clean();
