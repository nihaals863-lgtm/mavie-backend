const {
    ProductionOrder,
    ProductionOrderItem,
    Product,
    ProductStock,
    ProductionFormula,
    ProductionFormulaItem,
    InventoryAdjustment,
    Movement,
    Warehouse,
    sequelize
} = require('../models');
const { Op } = require('sequelize');
const { convert } = require('../utils/unitConverter');
const notificationService = require('./notificationService');

async function list(user, query = {}) {
    const { status, productionAreaId } = query;
    const where = { companyId: user.companyId };
    if (status) where.status = status;
    if (productionAreaId) where.productionAreaId = productionAreaId;

    return await ProductionOrder.findAll({
        where,
        include: [
            { model: Product },
            { model: ProductionFormula },
            {
                model: ProductionOrderItem,
                include: [{ model: Product }]
            }
        ],
        order: [['createdAt', 'DESC']]
    });
}

/**
 * 4️⃣ Automatic Raw Material Calculation Engine
 * Create Order: Links formula and calculates required materials
 */
async function create(data, user) {
    const { productId, warehouseId, formulaId, quantityGoal, productionAreaId, notes } = data;

    return await sequelize.transaction(async (t) => {
        const product = await Product.findByPk(productId);
        if (!product) throw new Error('Product not found');

        // Find Formula (Default if not specified)
        let formula;
        if (formulaId) {
            formula = await ProductionFormula.findByPk(formulaId, {
                include: [{ model: ProductionFormulaItem }]
            });
        } else {
            // 1st: exact match — default formula for this company
            formula = await ProductionFormula.findOne({
                where: { productId, companyId: user.companyId, isDefault: true },
                include: [{ model: ProductionFormulaItem }]
            });
            // 2nd: any formula for this company
            if (!formula) {
                formula = await ProductionFormula.findOne({
                    where: { productId, companyId: user.companyId },
                    include: [{ model: ProductionFormulaItem }]
                });
            }
            // 3rd (last resort): any formula for this product regardless of company
            if (!formula) {
                formula = await ProductionFormula.findOne({
                    where: { productId },
                    include: [{ model: ProductionFormulaItem }]
                });
            }
        }

        if (!formula) throw new Error(
            `No formula found for product #${productId}. ` +
            `Please go to Manufacturing → Formulas and create a formula for this product first.`
        );

        // 1. Generate Order Number based on Area
        // Default to formula's area/warehouse if not provided
        const finalAreaId = Number(productionAreaId) || Number(formula.productionAreaId) || 1;
        const finalWarehouseId = warehouseId || formula.warehouseId;

        if (!finalWarehouseId) throw new Error('No target warehouse specified for production.');

        let prefix = 'PROD';
        if (finalAreaId === 1) prefix = 'P';
        else if (finalAreaId === 2) prefix = 'C';
        else if (finalAreaId === 3) prefix = 'L';

        const count = await ProductionOrder.count({ where: { companyId: user.companyId, orderNumber: { [Op.like]: `${prefix}-%` } } });
        const orderNumber = `${prefix}-${String(count + 1).padStart(3, '0')}`;

        const order = await ProductionOrder.create({
            companyId: user.companyId,
            productId,
            formulaId: formula.id,
            warehouseId: finalWarehouseId, // Target Warehouse for finished goods
            targetWarehouseId: finalWarehouseId,
            quantityGoal,
            productionAreaId: finalAreaId,
            notes,
            status: 'DRAFT',
            orderNumber: orderNumber
        }, { transaction: t });

        // Calculate and create required items
        const items = formula.ProductionFormulaItems.map(fItem => ({
            productionOrderId: order.id,
            productId: fItem.productId,
            // Required Qty = qty_per_unit * production_quantity
            quantityRequired: parseFloat(fItem.quantityPerUnit) * parseFloat(quantityGoal),
            quantityPicked: 0,
            unit: fItem.unit,
            warehouseId: fItem.warehouseId || warehouseId // Fallback to order warehouse
        }));

        await ProductionOrderItem.bulkCreate(items, { transaction: t });

        return order;
    });
}

/**
 * 5️⃣ Stock Validation Before Production
 */
async function validateStock(orderId, user, transaction = null) {
    const order = await ProductionOrder.findByPk(orderId, {
        include: [{ model: ProductionOrderItem }],
        transaction
    });

    if (!order) {
        console.error(`[validateStock] Order ${orderId} NOT FOUND`);
        throw new Error('Production Order not found');
    }

    console.log(`[validateStock] Checking Order #${orderId} (Current Status: ${order.status})`);

    const stockChecks = [];
    for (const item of order.ProductionOrderItems) {
        // Find product to get its base unit
        const product = await Product.findByPk(item.productId, { transaction });
        const productUnit = product?.unitOfMeasure || 'units';

        const targetWarehouseId = item.warehouseId || order.warehouseId;
        const stock = await ProductStock.sum('quantity', {
            where: {
                productId: item.productId,
                warehouseId: targetWarehouseId,
                status: 'ACTIVE'
            },
            transaction
        }) || 0;

        // Convert stock to requirement unit for comparison
        const availableInReqUnit = convert(parseFloat(stock), productUnit, item.unit);

        stockChecks.push({
            productId: item.productId,
            name: product?.name || 'Unknown',
            required: parseFloat(item.quantityRequired),
            available: availableInReqUnit,
            availableOriginal: parseFloat(stock),
            unit: item.unit,
            productUnit: productUnit,
            warehouseId: targetWarehouseId,
            isAvailable: availableInReqUnit >= parseFloat(item.quantityRequired)
        });
    }

    const allAvailable = stockChecks.every(c => c.isAvailable);

    const currentStatus = (order.status || 'DRAFT').toUpperCase();
    console.log(`[validateStock] allAvailable: ${allAvailable}, currentStatus: ${currentStatus}`);

    if (allAvailable && currentStatus === 'DRAFT') {
        console.log(`[validateStock] Updating status of #${orderId} to STOCK_READY`);
        order.status = 'STOCK_READY';
        await order.save({ transaction });
        // Force refresh if no transaction (to be safe for immediate fetch)
        if (!transaction) await order.reload();
    }

    return { allAvailable, stockChecks };
}

/**
 * Helper to adjust stock for production movements
 */
/**
 * Helper to adjust stock for production movements
 * @param {number} qty - Quantity in specified unit
 * @param {string} unit - Unit of the quantity parameter
 */
async function adjustStock(companyId, userId, productId, warehouseId, qty, unit, reason, orderId, transaction) {
    const product = await Product.findByPk(productId, { transaction });
    if (!product) throw new Error('Product not found');
    const productUnit = product.unitOfMeasure || 'units';

    // Convert qty from specified unit to product base unit
    const convertedQty = convert(qty, unit, productUnit);

    const isIncrease = convertedQty > 0;
    const absQty = Math.abs(convertedQty);
    const originalAbsQty = Math.abs(qty); // For logging in original unit if needed

    const adjustmentReason = `${reason} (${originalAbsQty} ${unit})`;

    // 1. Create Adjustment Record
    await InventoryAdjustment.create({
        referenceNumber: `PROD-${orderId}`,
        companyId,
        productId,
        warehouseId,
        type: isIncrease ? 'INCREASE' : 'DECREASE',
        quantity: absQty,
        reason: adjustmentReason,
        status: 'COMPLETED',
        createdBy: userId
    }, { transaction });

    // 2. Update ProductStock
    if (isIncrease) {
        let stock = await ProductStock.findOne({ where: { productId, warehouseId }, transaction });
        if (stock) {
            await stock.increment('quantity', { by: absQty, transaction });
        } else {
            await ProductStock.create({
                productId,
                warehouseId,
                quantity: absQty,
                status: 'ACTIVE'
            }, { transaction });
        }
    } else {
        const stocks = await ProductStock.findAll({
            where: { productId, warehouseId, status: 'ACTIVE' },
            order: [['quantity', 'DESC']], // Consume from larger batches to avoid fragments
            transaction
        });

        const totalAvailable = stocks.reduce((sum, s) => sum + parseFloat(s.quantity || 0), 0);
        if (totalAvailable < absQty) {
            throw new Error(`Insufficient stock for ${product.name} in warehouse ${warehouseId}. Required: ${absQty} ${productUnit}, Available: ${totalAvailable} ${productUnit}`);
        }

        let remainingToDeduct = absQty;
        for (const s of stocks) {
            if (remainingToDeduct <= 0) break;
            const currentQty = parseFloat(s.quantity || 0);
            if (currentQty <= 0) continue;

            const deductFromThis = Math.min(currentQty, remainingToDeduct);
            await s.decrement('quantity', { by: deductFromThis, transaction });
            remainingToDeduct -= deductFromThis;
        }

        if (remainingToDeduct > 0) {
            throw new Error(`Deduction failed for ${product.name}: Could not exhaust required quantity from layout rows.`);
        }
    }

    // 3. Movement Record
    await Movement.create({
        companyId,
        type: isIncrease ? 'INCREASE' : 'DECREASE',
        productId,
        warehouseId,
        quantity: absQty,
        reason: adjustmentReason,
    }, { transaction });

    // 4. Update Low Stock Notification (Real-time)
    await notificationService.checkSingleProductLowStockAndNotify(companyId, productId, transaction);
}

async function startProduction(orderId, user) {
    return await sequelize.transaction(async (t) => {
        const order = await ProductionOrder.findByPk(orderId, {
            include: [{ model: ProductionOrderItem }],
            transaction: t
        });

        if (!order) throw new Error('Order not found');

        let currentStatus = (order.status || 'DRAFT').toUpperCase();

        // AUTO-VALIDATE: If still in DRAFT, try to validate now
        if (currentStatus === 'DRAFT') {
            const stockCheck = await validateStock(orderId, user, t);
            if (stockCheck.allAvailable) {
                order.status = 'VALIDATED';
                await order.save({ transaction: t });
                currentStatus = 'VALIDATED';
            } else {
                throw new Error('Cannot start production: Insufficient stock for one or more ingredients.');
            }
        }

        if (currentStatus !== 'ACCEPTED' && currentStatus !== 'VALIDATED') {
            console.error(`[startProduction] Invalid status for #${orderId}: ${currentStatus}`);
            throw new Error(`Order must be in ACCEPTED status to start production (Current: ${currentStatus}). Please click Accept Validation first.`);
        }

        console.log(`[startProduction] Proceeding with production for Order #${orderId}`);

        // STEP: Deduct Raw Materials (STOCK OUT)
        for (const item of order.ProductionOrderItems) {
            await adjustStock(
                user.companyId,
                user.id,
                item.productId,
                item.warehouseId,
                -parseFloat(item.quantityRequired),
                item.unit,
                `Consumed for Production Order #${order.id}`,
                order.id,
                t
            );
        }

        console.log(`[startProduction] Setting status to IN_PRODUCTION for #${orderId}`);
        order.status = 'IN_PRODUCTION';
        order.startDate = new Date();
        await order.save({ transaction: t });

        return order;
    });
}

async function complete(orderId, user) {
    return await sequelize.transaction(async (t) => {
        const order = await ProductionOrder.findByPk(orderId, {
            include: [{ model: ProductionOrderItem }],
            transaction: t
        });

        if (!order) throw new Error('Production order not found');
        if (order.status === 'COMPLETED') throw new Error('Order already completed');

        // FOOLPROOF: If production was never officially "STARTED", deduct materials now
        if (order.status !== 'IN_PRODUCTION') {
            const stockCheck = await validateStock(orderId, user, t);
            if (!stockCheck.allAvailable) {
                throw new Error('Cannot complete: Insufficient stock for materials and production was not "Started".');
            }
            // Deduct Raw Materials now
            for (const item of order.ProductionOrderItems) {
                await adjustStock(
                    user.companyId,
                    user.id,
                    item.productId,
                    item.warehouseId,
                    -parseFloat(item.quantityRequired || 0),
                    item.unit,
                    `Consumed for Production Order #${order.id} (Auto-deducted at completion)`,
                    order.id,
                    t
                );
            }
        }

        // STEP: Add Finished Product (STOCK IN)
        await adjustStock(
            user.companyId,
            user.id,
            order.productId,
            order.warehouseId,
            parseFloat(order.quantityGoal),
            order.Product?.unitOfMeasure || 'PCS',
            `Produced from Production Order #${order.id}`,
            order.id,
            t
        );

        order.status = 'COMPLETED';
        order.quantityProduced = order.quantityGoal;
        order.completionDate = new Date();
        await order.save({ transaction: t });

        return order;
    });
}

async function acceptValidation(orderId, user) {
    const order = await ProductionOrder.findByPk(orderId);
    if (!order) throw new Error('Order not found');
    if (order.companyId !== user.companyId) throw new Error('Unauthorized');

    if (order.status !== 'STOCK_READY' && order.status !== 'DRAFT' && order.status !== 'VALIDATED') {
        throw new Error(`Only Stock Ready or Draft orders can be accepted. Current: ${order.status}`);
    }

    order.status = 'ACCEPTED';
    await order.save();
    return order;
}

async function remove(orderId, user) {
    const order = await ProductionOrder.findByPk(orderId);
    if (!order) throw new Error('Production order not found');
    if (order.companyId !== user.companyId) throw new Error('Unauthorized');

    // Disallow deleting completed orders to maintain inventory integrity
    if (order.status === 'COMPLETED') {
        throw new Error('Completed orders cannot be deleted. If you need to fix stock, use Inventory Adjustments.');
    }

    return await sequelize.transaction(async (t) => {
        // Delete all items first
        await ProductionOrderItem.destroy({
            where: { productionOrderId: orderId },
            transaction: t
        });

        // Delete the order
        await order.destroy({ transaction: t });
        return { success: true };
    });
}

module.exports = {
    list,
    create,
    validateStock,
    acceptValidation,
    startProduction,
    complete,
    remove
};
