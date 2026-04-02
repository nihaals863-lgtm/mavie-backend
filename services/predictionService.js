const { Product, SalesOrder, OrderItem, ProductStock, ProductionFormula, sequelize } = require('../models');
const { Op } = require('sequelize');
const dayjs = require('dayjs');

async function getPredictionData(companyId) {
    // 1. Fetch all active products
    let products = await Product.findAll({
        where: { companyId, status: 'ACTIVE' },
        include: [
            { model: ProductStock, as: 'ProductStocks' },
            { 
                model: ProductionFormula, 
                where: { isDefault: true, companyId },
                required: false
            }
        ]
    });

    // [NEW] Augment with virtual stock (Bundles/Formulas)
    const { augmentProductStocks } = require('../utils/stockAugmenter');
    products = await augmentProductStocks(products, companyId);

    // [NEW] Fetch Pending Purchase Orders to mark "Already Ordered" items
    const [pendingOrders] = await sequelize.query(
        `SELECT poi.product_id, SUM(poi.quantity) as total 
         FROM purchase_order_items poi 
         INNER JOIN purchase_orders po ON po.id = poi.purchase_order_id
         WHERE po.company_id = ? AND po.status IN ('pending', 'draft', 'approved', 'sent', 'confirmed')
         GROUP BY poi.product_id`,
        { replacements: [companyId] }
    );
    const pendingPoMap = {};
    if (Array.isArray(pendingOrders)) {
        pendingOrders.forEach(row => {
            pendingPoMap[row.product_id] = parseFloat(row.total) || 0;
        });
    }

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
        let physicalStock = (p.ProductStocks || []).filter(s => !s.isVirtual).reduce((sum, s) => sum + Number(s.quantity), 0);
        const virtualRecord = (p.ProductStocks || []).find(s => s.isVirtual);
        const virtualStock = virtualRecord ? Number(virtualRecord.quantity) : Infinity;

        // [REVERT] If physical exists, use it. Don't cap with virtual. 
        // Virtual is a "Potential" added only if physical is 0. 
        const currentStock = virtualRecord ? Math.max(physicalStock, virtualStock) : physicalStock;

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

        // Status based on thresholds
        let status = 'HEALTHY';
        const reorderLevel = Number(p.reorderLevel) || 0;
        const reorderQty = Number(p.reorderQty) || 0;
        const lowThreshold = Number(p.lowStockThreshold) || 0;
        const mediumThreshold = Number(p.mediumStockThreshold) || 0;

        if (currentStock < reorderLevel || currentStock === 0) {
            status = 'CRITICAL';
        } else if (lowThreshold > 0 && currentStock <= lowThreshold) {
            status = 'LOW';
        } else if (mediumThreshold > 0 && currentStock <= mediumThreshold) {
            status = 'MEDIUM';
        } else if (daysUntilStockout !== null) {
            // Velocity-based fallback if thresholds aren't aggressive enough
            if (daysUntilStockout < leadTime) {
                status = 'CRITICAL';
            } else if (daysUntilStockout < (leadTime + safetyStockDays)) {
                if (status === 'HEALTHY' || status === 'MEDIUM') status = 'LOW';
            }
        }

        // Use reorderQty if it's set and higher than suggested
        if (reorderQty > suggestedReorder && status !== 'HEALTHY') {
            suggestedReorder = reorderQty;
        }

        // Get formula-related defaults
        const formula = p.ProductionFormulas && p.ProductionFormulas.length > 0 ? p.ProductionFormulas[0] : null;

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
            warehouseId: p.warehouseId || (formula ? formula.warehouseId : null),
            supplierId: p.supplierId,
            productionAreaId: formula ? formula.productionAreaId : null,
            hasFormula: !!formula,
            pendingOrderQty: pendingPoMap[p.id] || 0,
            isOrdered: (pendingPoMap[p.id] || 0) > 0
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
