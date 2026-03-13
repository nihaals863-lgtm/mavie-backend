
const { Product, Bundle, BundleItem } = require('./models');
const { Op } = require('sequelize');

async function test() {
  try {
    const productName = 'Bund';
    const product = await Product.findOne({
      where: { name: { [Op.like]: `%${productName}%` } }
    });

    if (!product) {
      console.log('Product not found');
      return;
    }

    console.log('Product Found:', JSON.stringify(product.toJSON(), null, 2));

    const bundle = await Bundle.findOne({
      where: { sku: product.sku, companyId: product.companyId },
      include: [{ model: BundleItem }]
    });

    if (!bundle) {
      console.log('Bundle linking NOT FOUND in bundles table for SKU:', product.sku);
    } else {
      console.log('Bundle Found:', JSON.stringify(bundle.toJSON(), null, 2));
      console.log('BundleItems length:', bundle.BundleItems?.length || 0);
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

test();
