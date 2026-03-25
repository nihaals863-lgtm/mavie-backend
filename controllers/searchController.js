const { Product, SalesOrder, Customer, ProductionOrder } = require('../models');
const { Op } = require('sequelize');

const LIMIT = 5;

/**
 * GET /api/search?q=term
 * Global search: orders (orderNumber, referenceNumber), products (name, sku, barcode), customers (name, email, code), production (orderNumber)
 */
async function search(req, res, next) {
    try {
        const q = (req.query.q || '').trim();
        if (!q) {
            return res.json({ success: true, data: { orders: [], products: [], customers: [], productionOrders: [] } });
        }
        const companyId = req.user?.companyId;
        const whereCompany = companyId != null ? { companyId } : {};

        const term = `%${q}%`;

        const [orders, products, customers, productionOrders] = await Promise.all([
            SalesOrder.findAll({
                where: {
                    ...whereCompany,
                    [Op.or]: [
                        { orderNumber: { [Op.like]: term } },
                        { referenceNumber: { [Op.like]: term } },
                    ],
                },
                limit: LIMIT,
                order: [['createdAt', 'DESC']],
                attributes: ['id', 'orderNumber', 'referenceNumber', 'status', 'totalAmount'],
            }),
            Product.findAll({
                where: {
                    ...whereCompany,
                    [Op.or]: [
                        { name: { [Op.like]: term } },
                        { sku: { [Op.like]: term } },
                        { barcode: { [Op.like]: term } },
                    ],
                },
                limit: LIMIT,
                attributes: ['id', 'name', 'sku', 'barcode'],
            }),
            Customer.findAll({
                where: {
                    ...whereCompany,
                    [Op.or]: [
                        { name: { [Op.like]: term } },
                        { email: { [Op.like]: term } },
                        { code: { [Op.like]: term } },
                    ],
                },
                limit: LIMIT,
                attributes: ['id', 'name', 'email', 'code'],
            }),
            ProductionOrder.findAll({
                where: {
                    ...whereCompany,
                    [Op.or]: [
                        { orderNumber: { [Op.like]: term } },
                    ],
                },
                limit: LIMIT,
                attributes: ['id', 'orderNumber', 'status'],
            }),
        ]);

        // Prioritize exact matches in products (SKU or Barcode)
        const sortedProducts = products.sort((a, b) => {
            const aExact = (a.sku && a.sku.toLowerCase() === q.toLowerCase()) || (a.barcode && a.barcode === q);
            const bExact = (b.sku && b.sku.toLowerCase() === q.toLowerCase()) || (b.barcode && b.barcode === q);
            if (aExact && !bExact) return -1;
            if (!aExact && bExact) return 1;
            return 0;
        });

        return res.json({
            success: true,
            data: {
                orders: orders.map((o) => ({ id: o.id, orderNumber: o.orderNumber, referenceNumber: o.referenceNumber, status: o.status, totalAmount: o.totalAmount })),
                products: sortedProducts.map((p) => ({ id: p.id, name: p.name, sku: p.sku, barcode: p.barcode })),
                customers: customers.map((c) => ({ id: c.id, name: c.name, email: c.email, code: c.code })),
                productionOrders: productionOrders.map((p) => ({ id: p.id, orderNumber: p.orderNumber, status: p.status })),
            },
        });
    } catch (err) {
        next(err);
    }
}

module.exports = { search };
