const { User, Product, Warehouse, Category, ProductStock, sequelize } = require('../models');

async function seedWarehouseTest() {
    console.log('--- Seeding Secondary Warehouse and Product for Testing ---');
    const transaction = await sequelize.transaction();
    try {
        const user = await User.findOne({ where: { email: 'admin@gmail.com' } });
        const companyId = user.companyId;
        const category = await Category.findOne({ where: { companyId } });

        // 1. Create a SECONDARY Warehouse
        const secondWarehouse = await Warehouse.create({
            name: 'Secondary Warehouse (East)',
            code: 'SW-EAST-01',
            companyId,
            warehouseType: 'NON_BONDED',
            status: 'ACTIVE',
            isProduction: false
        }, { transaction });
        console.log('Created Secondary Warehouse: SW-EAST-01');

        // 2. Create a product assigned ONLY to this secondary warehouse
        const product = await Product.create({
            name: 'WIDGET-X (Secondary WH Only)',
            sku: 'WIDGET-X-001',
            price: 25.00,
            costPrice: 10.0,
            categoryId: category.id,
            companyId,
            status: 'ACTIVE',
            reorderLevel: 100,
            reorderQty: 200,
            lowStockThreshold: 50
        }, { transaction });

        // 3. Set stock in the SECONDARY warehouse
        await ProductStock.create({
            productId: product.id,
            warehouseId: secondWarehouse.id,
            quantity: 10, // Very low compared to reorderLevel 100
            reserved: 0,
            status: 'ACTIVE'
        }, { transaction });

        await transaction.commit();
        console.log('--- Test Setup Complete ---');
        console.log('Product WIDGET-X-001 is ONLY in "Secondary Warehouse (East)".');
        console.log('When you click "Create Reorder", it should automatically select "Secondary Warehouse (East)".');
        process.exit(0);
    } catch (err) {
        if (transaction) await transaction.rollback();
        console.error('--- Test Seed Failed ---');
        console.error(err);
        process.exit(1);
    }
}

seedWarehouseTest();
