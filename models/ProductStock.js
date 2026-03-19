const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const ProductStock = sequelize.define('ProductStock', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    productId: { type: DataTypes.INTEGER, allowNull: false },
    warehouseId: { type: DataTypes.INTEGER, allowNull: false },
    locationId: { type: DataTypes.INTEGER, allowNull: true },
    quantity: { type: DataTypes.DECIMAL(12, 3), defaultValue: 0 },
    reserved: { type: DataTypes.DECIMAL(12, 3), defaultValue: 0 },
    status: { type: DataTypes.STRING, defaultValue: 'ACTIVE' },
    lotNumber: { type: DataTypes.STRING, allowNull: true },
    batchNumber: { type: DataTypes.STRING, allowNull: true },
    serialNumber: { type: DataTypes.STRING, allowNull: true },
    bestBeforeDate: { type: DataTypes.DATEONLY, allowNull: true },
}, {
    tableName: 'product_stocks',
    timestamps: true,
    underscored: true,
});

// Hooks to trigger low stock check on quantities changes
ProductStock.addHook('afterSave', async (instance, options) => {
    try {
        const { checkSingleProductLowStockAndNotify } = require('../services/notificationService');
        const Product = require('./Product');
        const p = await Product.findByPk(instance.productId, { attributes: ['companyId'] });
        if (p) {
            await checkSingleProductLowStockAndNotify(p.companyId, instance.productId);
        }
    } catch (err) {
        console.error('[ProductStock Hook] Error in afterSave:', err.message);
    }
});

ProductStock.addHook('afterDestroy', async (instance, options) => {
    try {
        const { checkSingleProductLowStockAndNotify } = require('../services/notificationService');
        const Product = require('./Product');
        const p = await Product.findByPk(instance.productId, { attributes: ['companyId'] });
        if (p) {
            await checkSingleProductLowStockAndNotify(p.companyId, instance.productId);
        }
    } catch (err) {
        console.error('[ProductStock Hook] Error in afterDestroy:', err.message);
    }
});

module.exports = ProductStock;
