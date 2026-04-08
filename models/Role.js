const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Role = sequelize.define('Role', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING, allowNull: false, unique: true },
  roleKey: { type: DataTypes.STRING, allowNull: false, unique: true }, // e.g., 'warehouse_manager'
  description: { type: DataTypes.TEXT, allowNull: true },
  warehouseAccess: { 
    type: DataTypes.STRING, 
    defaultValue: 'assigned', 
    validate: { isIn: [['all', 'assigned', 'none']] } 
  },
  permissions: { type: DataTypes.JSON, allowNull: true }, // Array of permission strings/objects
  isSystem: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'is_system' },
  companyId: { type: DataTypes.INTEGER, allowNull: true, field: 'company_id' }
}, {
  tableName: 'roles',
  timestamps: true,
  underscored: true,
});

module.exports = Role;
