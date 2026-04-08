const { User, Product, Warehouse, Category, ProductStock, Supplier, sequelize } = require('../models');

async function seedReorderTest() {
    console.log('--- Seeding specific data for Reorder Test ---');
    const transaction = await sequelize.transaction();
    try {
        const user = await User.findOne({ where: { email: 'admin@gmail.com' } });
        const companyId = user.companyId;

        const warehouse = await Warehouse.findOne({ where: { companyId } });
        const category = await Category.findOne({ where: { companyId } });

        // Create a product specifically designed to trigger a REORDER recommendation
        const reorderProduct = await Product.create({
            name: 'TEST REORDER PRODUCT (OLED)',
            sku: 'REORDER-TEST-001',
            price: 499.99,
            costPrice: 250.0,
            categoryId: category.id,
            companyId,
            status: 'ACTIVE',
            reorderLevel: 20,    // High threshold
            reorderQty: 50,      // Recommended buy quantity
            lowStockThreshold: 15
        }, { transaction });

        // Set stock well below the reorder level to ensure it shows up as "High/Critical"
        await ProductStock.create({
            productId: reorderProduct.id,
            warehouseId: warehouse.id,
            quantity: 5,         // Very low stock
            reserved: 0,
            status: 'ACTIVE'
        }, { transaction });

        await transaction.commit();
        console.log('--- Test Product Created: REORDER-TEST-001 ---');
        console.log('Stock: 5, Reorder Level: 20. It will now show a green "Create Reorder" button.');
        process.exit(0);
    } catch (err) {
        if (transaction) await transaction.rollback();
        console.error('--- Test Seed Failed ---');
        console.error(err);
        process.exit(1);
    }
}

seedReorderTest();
