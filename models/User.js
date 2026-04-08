const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  passwordHash: { type: DataTypes.STRING, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  role: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  companyId: { type: DataTypes.INTEGER, allowNull: true },
  warehouseId: { type: DataTypes.INTEGER, allowNull: true },
  status: { type: DataTypes.STRING, defaultValue: 'ACTIVE', validate: { isIn: [['ACTIVE', 'SUSPENDED']] } },
}, {
  tableName: 'users',
  timestamps: true,
  underscored: true,
});

module.exports = User;
