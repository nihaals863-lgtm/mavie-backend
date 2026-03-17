const { Product, Bundle, BundleItem, ProductStock, Movement } = require('../models');

async function create() {
  try {
    // 1. Get first companyId
    const firstProduct = await Product.findOne({ order: [['id', 'ASC']] });
    if (!firstProduct) { console.log('No products found'); process.exit(0); }
    const companyId = firstProduct.companyId;

    // 2. Create Component Item
    const compPayload = {
      companyId,
      name: 'Test Cable Component',
      sku: `T-CABLE-${Date.now()}`,
      barcode: `comp-${Date.now()}`,
      productType: 'SIMPLE',
      unitOfMeasure: 'EACH',
      price: 15,
      costPrice: 5,
      status: 'ACTIVE'
    };
    const compProduct = await Product.create(compPayload);
    console.log('Created Component:', compProduct.sku);

    // 3. Add Component Stock (e.g. 100 on warehouse 7)
    await ProductStock.create({
      productId: compProduct.id,
      warehouseId: 7, 
      quantity: 100,
      reserved: 0,
      status: 'ACTIVE'
    });
    console.log('Added 100 stock to component');

    // 4. Create Bundle Item
    const bundlePayload = {
      companyId,
      name: 'Test Setup Kit (5x)',
      sku: `T-KIT-${Date.now()}`,
      barcode: `kit-${Date.now()}`,
      productType: 'BUNDLE',
      unitOfMeasure: 'EACH',
      price: 120,
      costPrice: 25,
      status: 'ACTIVE'
    };
    const bundleProduct = await Product.create(bundlePayload);
    console.log('Created bundle payload SKU:', bundleProduct.sku);

    // 5. Connect to Bundle backend service rules
    const b = await Bundle.create({
      companyId,
      sku: bundleProduct.sku,
      barcode: bundleProduct.barcode,
      name: bundleProduct.name,
      costPrice: compProduct.costPrice * 5,
      sellingPrice: bundleProduct.price,
      status: 'ACTIVE'
    });
    await BundleItem.create({
      bundleId: b.id,
      productId: compProduct.id,
      quantity: 5 // each bundle requires 5 component lines
    });
    console.log('Bundle items linked successfully.');

    console.log('\n--- VERIFICATION TASK ---');
    console.log(`Step 1: Go to Live Stock Dashboard or Products List.`);
    console.log(`Step 2: Component SKU: [${compProduct.sku}] quantity should show 100.`);
    console.log(`Step 3: Bundle SKU: [${bundleProduct.sku}] quantity Virtual should automatically show 20 (since 100 / 5 = 20 batches).`);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

create();
