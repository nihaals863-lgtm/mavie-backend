const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const ProductionArea = sequelize.define('ProductionArea', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  companyId: { type: DataTypes.INTEGER, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  code: { type: DataTypes.STRING, allowNull: false },
  prefix: { type: DataTypes.STRING, allowNull: false, defaultValue: 'P' },
  status: { type: DataTypes.STRING, defaultValue: 'ACTIVE' },
}, {
  tableName: 'production_areas',
  timestamps: true,
  underscored: true,
});

module.exports = ProductionArea;
