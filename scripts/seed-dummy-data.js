const { User, Company, Product, Warehouse, SalesOrder, OrderItem, PurchaseOrder, PurchaseOrderItem, Category, ProductStock, Location, Zone, Supplier } = require('../models');
const { sequelize } = require('../models');

async function seed() {
    console.log('--- Starting Dummy Data Seed for admin@gmail.com ---');
    const transaction = await sequelize.transaction();
    try {
        // 1. Find or Create Company and User
        let company = await Company.findOne({ where: { name: 'Local Test Company' } });
        if (!company) {
            company = await Company.create({
                name: 'Local Test Company',
                code: 'LTC-01',
                status: 'ACTIVE'
            }, { transaction });
            console.log('Created Company: Local Test Company');
        }

        let user = await User.findOne({ where: { email: 'admin@gmail.com' } });
        if (!user) {
            user = await User.create({
                name: 'Company Admin',
                email: 'admin@gmail.com',
                passwordHash: '$2b$10$YourHashedPasswordHere', // This is just dummy, they should reset it or use existing login logic
                role: 'company_admin',
                companyId: company.id,
                status: 'ACTIVE'
            }, { transaction });
            console.log('Created User: admin@gmail.com');
        }
        
        const companyId = company.id;
        console.log(`Using User: ${user.name}, Company: ${company.name} (ID: ${companyId})`);

        // 2. Ensure a Warehouse exists
        let warehouse = await Warehouse.findOne({ where: { companyId } });
        if (!warehouse) {
            warehouse = await Warehouse.create({
                name: 'Main Distribution Center',
                code: 'MDC-01',
                companyId,
                warehouseType: 'BONDED',
                status: 'ACTIVE',
                isProduction: true
            }, { transaction });
            console.log('Created Warehouse.');
        }

        // 3. Ensure a Category exists
        let category = await Category.findOne({ where: { companyId } });
        if (!category) {
            category = await Category.create({
                name: 'General Electronics',
                description: 'Consumer electronic goods',
                companyId
            }, { transaction });
            console.log('Created Category.');
        }

        // 4. Create Dummy Products
        const productsData = [
            { name: 'Ultra HD Monitor 27"', sku: 'MON-27-UHD', price: 299.99, costPrice: 150.0 },
            { name: 'Mechanical Keyboard RGB', sku: 'KB-RGB-01', price: 89.99, costPrice: 40.0 },
            { name: 'Wireless Pro Mouse', sku: 'MSE-WL-PRO', price: 59.99, costPrice: 25.0 },
            { name: 'Thunderbolt 4 Dock', sku: 'DOCK-TB4', price: 199.99, costPrice: 100.0 },
            { name: 'Noise Cancelling Headphones', sku: 'HP-NC-X5', price: 249.99, costPrice: 120.0 }
        ];

        const products = [];
        for (const p of productsData) {
            const [product] = await Product.findOrCreate({
                where: { sku: p.sku, companyId },
                defaults: {
                    ...p,
                    categoryId: category.id,
                    status: 'ACTIVE'
                },
                transaction
            });
            products.push(product);
        }
        console.log(`Ensured ${products.length} products exist.`);

        // 5. Create some Stock
        for (const p of products) {
            await ProductStock.findOrCreate({
                where: { productId: p.id, warehouseId: warehouse.id },
                defaults: {
                    quantity: Math.floor(Math.random() * 100) + 10,
                    reservedQuantity: 0
                },
                transaction
            });
        }
        console.log('Added initial stock levels.');

        // 6. Create Sales Orders
        const statuses = ['CONFIRMED', 'PICKING_IN_PROGRESS', 'SHIPPED', 'DELIVERED'];
        for (let i = 1; i <= 8; i++) {
            const status = statuses[i % statuses.length];
            const order = await SalesOrder.create({
                orderNumber: `SO-DUMMY-${Date.now()}-${i}`,
                companyId,
                warehouseId: warehouse.id,
                status,
                totalAmount: 0, 
                orderDate: new Date(Date.now() - (i * 24 * 60 * 60 * 1000))
            }, { transaction });

            const item = products[i % products.length];
            const qty = Math.floor(Math.random() * 3) + 1;
            await OrderItem.create({
                salesOrderId: order.id,
                productId: item.id,
                quantity: qty,
                unitPrice: item.price,
                totalPrice: item.price * qty
            }, { transaction });

            await order.update({ totalAmount: item.price * qty }, { transaction });
        }
        console.log('Created 8 dummy Sales Orders.');

        // 7. Create Purchase Orders
        let supplier = await Supplier.findByPk(1);
        if (!supplier) {
            supplier = await Supplier.create({
                name: 'Main Supplier Co.',
                code: 'SUP-001',
                contactName: 'John Supplier',
                email: 'john@supplier.com',
                phone: '123456789',
                address: '123 Supplier St',
                companyId
            }, { transaction });
        }

        for (let i = 1; i <= 3; i++) {
            const po = await PurchaseOrder.create({
                poNumber: `PO-DUMMY-${Date.now()}-${i}`,
                companyId,
                warehouseId: warehouse.id,
                supplierId: supplier.id,
                status: 'pending',
                orderDate: new Date()
            }, { transaction });

            const item = products[(i + 2) % products.length];
            const qty = 50;
            await PurchaseOrderItem.create({
                purchaseOrderId: po.id,
                productId: item.id,
                quantity: qty,
                unitPrice: item.costPrice
            }, { transaction });
        }
        console.log('Created 3 dummy Purchase Orders.');

        await transaction.commit();
        console.log('--- Dummy Data Seed Completed Successfully ---');
        process.exit(0);
    } catch (err) {
        if (transaction) await transaction.rollback();
        console.error('--- Dummy Data Seed Failed ---');
        console.error(err);
        process.exit(1);
    }
}

seed();
