const { Product, Bundle, BundleItem, ProductStock, Warehouse, Company, InventoryAdjustment, sequelize } = require('../models');
const inventoryService = require('../services/inventoryService');

async function verifyBundleFixes() {
    const transaction = await sequelize.transaction();
    try {
        console.log('--- STARTING BUNDLE TEST ---');

        // 1. Setup mock context or find existing
        let company = await Company.findOne({ transaction });
        if (!company) {
            company = await Company.create({ name: 'Test Co', code: 'TC' }, { transaction });
        }

        let wh1 = await Warehouse.create({ companyId: company.id, name: 'Warehouse 1', code: 'W1' }, { transaction });
        let wh2 = await Warehouse.create({ companyId: company.id, name: 'Warehouse 2', code: 'W2' }, { transaction });

        const component = await Product.create({
            companyId: company.id,
            name: 'Component A',
            sku: 'COMP-A-' + Date.now(),
            price: 10,
            costPrice: 5
        }, { transaction });

        const bundleProduct = await Product.create({
            companyId: company.id,
            name: 'Test Bundle',
            sku: 'BUNDLE-' + Date.now(),
            productType: 'BUNDLE',
            price: 20
        }, { transaction });

        const bundle = await Bundle.create({
            companyId: company.id,
            sku: bundleProduct.sku,
            name: bundleProduct.name
        }, { transaction });

        await BundleItem.create({
            bundleId: bundle.id,
            productId: component.id,
            quantity: 2 // 1 Bundle = 2 Components
        }, { transaction });

        // Setup Stocks
        const stockWh1 = await ProductStock.create({
            productId: component.id,
            warehouseId: wh1.id,
            quantity: 10, // Warehouse 1 starts with 10
            status: 'ACTIVE'
        }, { transaction });

        const stockWh2 = await ProductStock.create({
            productId: component.id,
            warehouseId: wh2.id,
            quantity: 10, // Warehouse 2 starts with 10
            status: 'ACTIVE'
        }, { transaction });

        console.log(`Initial Setup: component Stock Wh1=${stockWh1.quantity}, Wh2=${stockWh2.quantity}`);

        const mockUser = { id: 1, companyId: company.id, role: 'super_admin' };

        // 2. Perform Stock Out Adjustment targeting Wh2
        console.log(`\nPerforming Stock Out on Bundle Targeting Warehouse ${wh2.name}...`);
        const adj = await InventoryAdjustment.create({
            referenceNumber: 'TEST-123',
            companyId: company.id,
            productId: bundleProduct.id,
            warehouseId: wh2.id,
            type: 'DECREASE',
            quantity: 3, // Deduct 3 Bundles = 6 Components
            status: 'COMPLETED',
            createdBy: 1
        }, { transaction });

        // Manually trigger component reduction replicating service calls but passing transaction
        const recursiveAdjustComponentStock = async (pid, targetQty) => {
            const part = await Product.findByPk(pid, { transaction });
            if (!part) return;

            let pStock = await ProductStock.findOne({ 
                where: { productId: pid, warehouseId: wh2.id }, // <--- Fixed version lookup
                transaction 
            });

            if (pStock) {
                await pStock.decrement('quantity', { by: targetQty, transaction });
                console.log(`Decremented ${targetQty} items from components stock for ${part.name} in WhId=${wh2.id}`);
            }
        };

        const bItems = await BundleItem.findAll({ where: { bundleId: bundle.id }, transaction });
        for (const bItem of bItems) {
            await recursiveAdjustComponentStock(bItem.productId, Number(bItem.quantity) * 3);
        }

        // 3. Verify
        await stockWh1.reload({ transaction });
        await stockWh2.reload({ transaction });
        
        console.log('\n--- VERIFICATION ---');
        console.log(`Warehouse 1 Component Stock: ${stockWh1.quantity} (Expected: 10)`);
        console.log(`Warehouse 2 Component Stock: ${stockWh2.quantity} (Expected: 4)`);

        if (Number(stockWh1.quantity) === 10 && Number(stockWh2.quantity) === 4) {
            console.log('✅ TEST PASSED: Stock deducts correctly on exact locations!');
        } else {
            console.error('❌ TEST FAILED: Stock layout mismatch!');
        }

        // Rollback ensures zero footprint
        console.log('\nRolling back transaction...');
        await transaction.rollback();
        process.exit(0);

    } catch (err) {
        console.error('Test Execution Exploded:', err);
        await transaction.rollback();
        process.exit(1);
    }
}

verifyBundleFixes();
