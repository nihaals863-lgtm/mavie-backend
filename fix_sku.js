
const { Bundle, Product } = require('./models');

async function test() {
  try {
    const bundle = await Bundle.findOne({ where: { sku: 'sk-01' } });
    if (bundle) {
      console.log('Found bundle with SKU sk-01. Updating to Bu-01...');
      await bundle.update({ sku: 'Bu-01' });
      console.log('Update successful');
    } else {
      console.log('Bundle sk-01 not found');
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

test();
