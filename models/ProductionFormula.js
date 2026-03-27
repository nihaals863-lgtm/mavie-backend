const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const ProductionFormula = sequelize.define('ProductionFormula', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    companyId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'company_id'
    },
    productId: {
        type: DataTypes.INTEGER, // The finished product this formula makes
        allowNull: true,
        field: 'product_id'
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    isDefault: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        field: 'is_default'
    },
    status: {
        type: DataTypes.STRING,
        defaultValue: 'ACTIVE'
    },
    isTemplate: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'is_template'
    },
    productionAreaId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'production_area_id'
    },
    warehouseId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'warehouse_id'
    }
}, {
    tableName: 'production_formulas',
    timestamps: true,
    underscored: true
});

module.exports = ProductionFormula;
