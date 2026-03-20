const { sequelize, Product, ProductStock, Warehouse, Notification } = require('./models');
const notificationService = require('./services/notificationService');
const { Op } = require('sequelize');

async function test() {
    try {
        await sequelize.authenticate();
        console.log('Connected to Database');

        // Check if there are ANY notifications
        const alerts = await Notification.findAll({
            limit: 5,
            order: [['createdAt', 'DESC']]
        });

        console.log(`\nFound ${alerts.length} Notifications total in the database.`);
        alerts.forEach(n => {
            console.log(`- ID: ${n.id} | Read: ${n.isRead} | Message: "${n.message}" | Created: ${n.createdAt}`);
        });

        // Find a product with reorderLevel > total Quantity
        const products = await Product.findAll({
            where: { reorderLevel: { [Op.gt]: 0 } },
            limit: 5
        });

        console.log(`\nChecking ${products.length} Products with reorder levels:`);
        for (const p of products) {
            const warehouses = await Warehouse.findAll({ where: { companyId: p.companyId } });
            const whIds = warehouses.map(w => w.id);
            const totalQty = await ProductStock.sum('quantity', {
                where: { productId: p.id, warehouseId: { [Op.in]: whIds } }
            }) || 0;

            console.log(`- Name: ${p.name} | Total stock: ${totalQty} | Min: ${p.reorderLevel}`);
            if (totalQty < p.reorderLevel) {
                 console.log(`  -> Trigerring notification setup...`);
                 await notificationService.checkSingleProductLowStockAndNotify(p.companyId, p.id);
                 console.log('  -> Done.');
            }
        }

        console.log('\n✅ Test execution completed.');
        process.exit(0);

    } catch (err) {
        console.error('Test Failed:', err);
        process.exit(1);
    }
}

test();
