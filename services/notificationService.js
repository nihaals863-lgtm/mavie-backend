const { Notification, Product, ProductStock, Warehouse } = require('../models');
const { Op } = require('sequelize');

async function list(user, query = {}) {
    const { isRead, type, limit = 50 } = query;
    const where = { companyId: user.companyId };

    // Show user-specific notifications or company-wide ones (userId is null)
    where[Op.or] = [
        { userId: user.id },
        { userId: null }
    ];

    if (isRead !== undefined) where.isRead = isRead === 'true';
    if (type) where.type = type;

    return await Notification.findAll({
        where,
        limit: parseInt(limit, 10),
        order: [['createdAt', 'DESC']]
    });
}

async function create(data, transaction = null) {
    return await Notification.create(data, { transaction });
}

async function markAsRead(id, user) {
    const notification = await Notification.findOne({
        where: { id, companyId: user.companyId }
    });
    if (!notification) throw new Error('Notification not found');

    return await notification.update({ isRead: true });
}

async function markAllAsRead(user) {
    return await Notification.update(
        { isRead: true },
        {
            where: {
                companyId: user.companyId,
                [Op.or]: [{ userId: user.id }, { userId: null }],
                isRead: false
            }
        }
    );
}

/**
 * Checks low stock for a single product and creates/updates/clears notifications.
 */
async function checkProductLowStock(companyId, p, whIds, transaction = null) {
    const totalQty = await ProductStock.sum('quantity', {
        where: { productId: p.id, warehouseId: { [Op.in]: whIds } },
        transaction
    }) || 0;

    const reorderLevel = p.reorderLevel || 0;

    if (totalQty < reorderLevel) {
        // Check if an unread notification already exists for this product alert
        const existing = await Notification.findOne({
            where: {
                companyId,
                userId: null, // Company-wide alerts
                type: 'warning',
                isRead: false,
                title: 'Low Stock Alert',
                message: { [Op.like]: `%(${p.sku})%` }
            },
            transaction
        });

        const newMessage = `Product ${p.name} (${p.sku}) is below reorder level. Current: ${totalQty}, Min: ${reorderLevel}`;

        if (!existing) {
            await create({
                companyId,
                title: 'Low Stock Alert',
                message: newMessage,
                type: 'warning',
                priority: 'high',
                link: `/products?highlight=${p.id}`
            }, transaction);
        } else {
            // Update the message so it shows the CURRENT stock
            if (existing.message !== newMessage) {
                await existing.update({ message: newMessage }, { transaction });
            }
        }
    } else {
        // Stock is sufficient. Absolute guarantee to clear stale alerts for this SKU
        await Notification.update(
            { isRead: true },
            {
                where: {
                    companyId,
                    userId: null,
                    type: 'warning',
                    isRead: false,
                    title: 'Low Stock Alert',
                    message: { [Op.like]: `%(${p.sku})%` }
                },
                transaction
            }
        );
    }
}

/**
 * Scans all products for a company and generates notifications if stock is below reorder level.
 */
async function checkLowStockAndNotify(companyId) {
    console.log(`[NotificationService] Checking low stock for company: ${companyId}`);
    const products = await Product.findAll({
        where: { companyId, status: 'ACTIVE' },
        attributes: ['id', 'name', 'sku', 'reorderLevel']
    });

    const warehouses = await Warehouse.findAll({ where: { companyId }, attributes: ['id'] });
    const whIds = warehouses.map(w => w.id);

    if (whIds.length === 0) return;

    for (const p of products) {
        await checkProductLowStock(companyId, p, whIds);
    }
}

async function checkSingleProductLowStockAndNotify(companyId, productId, transaction = null) {
    const p = await Product.findByPk(productId, {
        attributes: ['id', 'name', 'sku', 'reorderLevel', 'companyId'],
        transaction
    });
    if (!p) return;

    const warehouses = await Warehouse.findAll({ 
        where: { companyId: p.companyId }, 
        attributes: ['id'],
        transaction 
    });
    const whIds = warehouses.map(w => w.id);

    if (whIds.length === 0) return;

    await checkProductLowStock(p.companyId, p, whIds, transaction);
}

module.exports = {
    list,
    create,
    markAsRead,
    markAllAsRead,
    checkLowStockAndNotify,
    checkSingleProductLowStockAndNotify
};
