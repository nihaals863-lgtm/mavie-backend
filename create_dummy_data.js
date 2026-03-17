const { Product, Bundle, BundleItem, Warehouse, ProductStock, Company } = require('./models');
const { sequelize } = require('./config/db');

async function createDummyData() {
  try {
    console.log('--- Updating Dummy Data to Match Client Setup (Bundle with Static Stock) ---');

    // 1. Find a Company
    const company = await Company.findOne();
    const companyId = company ? company.id : 1;

    // 2. Find Warehouses
    const warehouses = await Warehouse.findAll({ limit: 2 });
    if (warehouses.length < 1) {
      console.error('This test scenario requires at least 1 warehouse.');
      process.exit(1);
    }
    const wh1 = warehouses[0];

    // 3. Cleanup existing dummy data
    const existingBundle = await Bundle.findOne({ where: { sku: 'd-bundle-xyz' } });
    if (existingBundle) {
      await BundleItem.destroy({ where: { bundleId: existingBundle.id } });
      await existingBundle.destroy();
    }
    await Product.destroy({ where: { sku: ['d-comp-a', 'd-comp-b'] } });

    console.log('Cleanup old dummy data complete.');

    // 4. Create Components
    const compA = await Product.create({
      companyId: companyId,
      name: 'Dummy Component A',
      sku: 'd-comp-a',
      barcode: 'bc-comp-a',
      status: 'ACTIVE'
    });

    const compB = await Product.create({
      companyId: companyId,
      name: 'Dummy Component B',
      sku: 'd-comp-b',
      barcode: 'bc-comp-b',
      status: 'ACTIVE'
    });

    // 5. Create Bundle Product Item
    const bundleProduct = await Product.create({
      companyId: companyId,
      name: 'Dummy Bundle XYZ',
      sku: 'd-bundle-xyz',
      barcode: 'bc-bundle-xyz',
      productType: 'BUNDLE',
      status: 'ACTIVE'
    });

    // 6. Create Bundle mapping
    const bundle = await Bundle.create({
      companyId: companyId,
      name: 'Dummy Bundle XYZ',
      sku: 'd-bundle-xyz',
      barcode: 'bc-bundle-xyz',
      description: 'Test Bundle including Comp A and B',
      status: 'ACTIVE'
    });

    // 7. Link Components
    await BundleItem.create({ bundleId: bundle.id, productId: compA.id, quantity: 1 });
    await BundleItem.create({ bundleId: bundle.id, productId: compB.id, quantity: 1 });

    // 8. Initialize Stock:
    await ProductStock.destroy({ where: { productId: [compA.id, compB.id, bundleProduct.id] } });

    await ProductStock.bulkCreate([
      { productId: compA.id, warehouseId: wh1.id, quantity: 10 },
      { productId: compB.id, warehouseId: wh1.id, quantity: 10 },
      // 🌟 [NEW] STATIC STOCK FOR THE BUNDLE PRODUCT ITSELF 🌟
      { productId: bundleProduct.id, warehouseId: wh1.id, quantity: 8 }
    ]);

    console.log('\n--- DUMMY DATA SETUP COMPLETE ---');
    console.log(`Bundle: "Dummy Bundle XYZ"`);
    console.log(`- Bundle Item static Stock: 8 in ${wh1.name}`);
    console.log(`- Component A Stock: 10 in ${wh1.name}`);
    console.log(`- Component B Stock: 10 in ${wh1.name}`);

    console.log('\nSteps to verify behavior with client setup:');
    console.log(`1. Go to Stock Out screen.`);
    console.log(`2. Select Bundle: "Dummy Bundle XYZ" (Current Balance: 8)`);
    console.log(`3. Select Warehouse: "${wh1.name}"`);
    console.log(`4. Try Stock Out quantity = 1`);
    console.log(`5. Expected Behavior: Components will drop to 9, but the Bundle Product Row balance stays at 8!`);

    process.exit(0);
  } catch (err) {
    console.error('Error creating dummy data:', err);
    process.exit(1);
  }
}

createDummyData();
