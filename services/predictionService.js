const { Product, SalesOrder, OrderItem, ProductStock, sequelize } = require('../models');
const { Op } = require('sequelize');
const dayjs = require('dayjs');

async function getPredictionData(companyId) {
    // 1. Fetch all active products
    let products = await Product.findAll({
        where: { companyId, status: 'ACTIVE' },
        include: [{ model: ProductStock, as: 'ProductStocks' }]
    });

    // [NEW] Augment with virtual stock (Bundles/Formulas)
    const { augmentProductStocks } = require('../utils/stockAugmenter');
    products = await augmentProductStocks(products, companyId);

    // 2. Define date range for historical sales (last 30 days)
    const daysBytes = 30;
    const startDate = dayjs().subtract(daysBytes, 'days').startOf('day').toDate();

    // 3. Fetch sales data (Aggregated by DB)
    const [salesData] = await sequelize.query(
        `SELECT oi.product_id, SUM(oi.quantity) as total 
         FROM order_items oi
         INNER JOIN sales_orders so ON so.id = oi.sales_order_id
         WHERE so.company_id = ? 
           AND so.status IN ('CONFIRMED', 'PICKING_IN_PROGRESS', 'PICKED', 'PACKING_IN_PROGRESS', 'PACKED', 'SHIPPED', 'DELIVERED')
           AND so.created_at >= ?
         GROUP BY oi.product_id`,
        { replacements: [companyId, startDate] }
    );

    const salesMap = {};
    if (Array.isArray(salesData)) {
        salesData.forEach(row => {
            salesMap[row.product_id] = parseFloat(row.total) || 0;
        });
    }

    // 5. Build prediction array
    const predictions = products.map(p => {
        // Current Stock Calculation
        let physicalStock = (p.ProductStocks || []).reduce((sum, s) => sum + Number(s.quantity), 0);
        const virtualStock = (p.ProductStocks || []).find(s => s.isVirtual)?.quantity || 0;
        const currentStock = Math.max(physicalStock, virtualStock);

        // [NEW] Bundle/Formula Awareness
        // If it's a bundle (virtual), compute its potential stock from components
        if (p.productType === 'BUNDLE' || p.productType === 'MULTICOMBO') {
             // For virtual bundles (not physical), the stock is based on components
        }
        

        // Velocity (Units per Day)
        const totalSold = salesMap[p.id] || 0;
        const velocity = totalSold / daysBytes; // e.g. 10 sold in 30 days = 0.33 per day

        // Days until Stockout
        // If velocity is 0, infinite days (or null)
        let daysUntilStockout = null;
        if (velocity > 0) {
            daysUntilStockout = currentStock / velocity;
        }

        // Suggested Reorder
        // Formula: (Velocity * LeadTime) + (Velocity * SafetyStock) - CurrentStock
        // Defaults: LeadTime = 14 days, SafetyStock = 7 days -- eventually make these configurable per product
        const leadTime = 14;
        const safetyStockDays = 7;
        const needed = (velocity * (leadTime + safetyStockDays));
        let suggestedReorder = Math.ceil(needed - currentStock);
        if (suggestedReorder < 0) suggestedReorder = 0;

        // Status prioritized by manual reorder point
        let status = 'HEALTHY';
        const reorderLevel = Number(p.reorderLevel) || 0;
        const reorderQty = Number(p.reorderQty) || 0;

        if (reorderLevel > 0 && currentStock <= reorderLevel) {
            status = 'CRITICAL';
        } else if (daysUntilStockout !== null) {
            if (daysUntilStockout < leadTime) {
                status = 'CRITICAL'; // Will run out before new stock arrives
            } else if (daysUntilStockout < (leadTime + safetyStockDays)) {
                status = 'LOW'; // Dipping into safety stock
            }
        } else if (currentStock === 0) {
            status = 'CRITICAL'; // No stock, no sales (or sales 0)
        }

        // Use reorderQty if it's set and higher than suggested
        if (reorderQty > suggestedReorder && status !== 'HEALTHY') {
            suggestedReorder = reorderQty;
        }

        return {
            id: p.id,
            sku: p.sku,
            name: p.name,
            image: p.images ? (Array.isArray(p.images) ? p.images[0] : p.images) : null,
            currentStock,
            totalSoldLast30d: totalSold,
            velocity: Number(velocity.toFixed(2)),
            daysUntilStockout: daysUntilStockout === null ? 9999 : Number(daysUntilStockout.toFixed(1)),
            suggestedReorder,
            status,
            costPrice: p.costPrice,
            warehouseId: p.warehouseId,
            supplierId: p.supplierId
        };
    });

    // Sort: Critical first, then Low, then Healthy. Then by Days Left ascending.
    predictions.sort((a, b) => {
        const statusOrder = { 'CRITICAL': 0, 'LOW': 1, 'HEALTHY': 2 };
        if (statusOrder[a.status] !== statusOrder[b.status]) {
            return statusOrder[a.status] - statusOrder[b.status];
        }
        return a.daysUntilStockout - b.daysUntilStockout;
    });

    return predictions;
}

module.exports = {
    getPredictionData
};
