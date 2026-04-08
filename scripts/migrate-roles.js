const { sequelize } = require('../models');
const Role = require('../models/Role');

async function migrate() {
    console.log('--- Starting Role Migration ---');
    try {
        await sequelize.authenticate();
        console.log('Database connected.');

        const queryInterface = sequelize.getQueryInterface();
        
        // 1. Create Roles table if not exists
        console.log('Ensuring roles table exists...');
        await Role.sync({ alter: true });
        console.log('Roles table ready.');

        // 2. Default Roles to Seed
        const defaultRoles = [
            { 
                name: 'Super Admin', 
                roleKey: 'super_admin', 
                description: 'Full system access', 
                warehouseAccess: 'all', 
                isSystem: true,
                permissions: ['all']
            },
            { 
                name: 'Company Admin', 
                roleKey: 'company_admin', 
                description: 'Company-wide management', 
                warehouseAccess: 'all', 
                isSystem: true,
                permissions: ['dashboard', 'inventory', 'orders', 'users']
            },
            { 
                name: 'Warehouse Manager', 
                roleKey: 'warehouse_manager', 
                description: 'Full warehouse operations control', 
                warehouseAccess: 'assigned', 
                isSystem: true,
                permissions: ['inventory', 'orders', 'picking', 'packing']
            },
            { 
                name: 'Inventory Manager', 
                roleKey: 'inventory_manager', 
                description: 'Stock and catalog control', 
                warehouseAccess: 'assigned', 
                isSystem: true,
                permissions: ['inventory', 'replenishment']
            },
            { 
                name: 'Picker', 
                roleKey: 'picker', 
                description: 'Order fulfillment - picking', 
                warehouseAccess: 'assigned', 
                isSystem: true,
                permissions: ['picking']
            },
            { 
                name: 'Packer', 
                roleKey: 'packer', 
                description: 'Order fulfillment - packing', 
                warehouseAccess: 'assigned', 
                isSystem: true,
                permissions: ['packing']
            },
            { 
                name: 'Viewer', 
                roleKey: 'viewer', 
                description: 'Read-only access', 
                warehouseAccess: 'assigned', 
                isSystem: true,
                permissions: ['dashboard', 'inventory_view']
            },
            { 
                name: 'Production', 
                roleKey: 'production', 
                description: 'Manufacturing and Production Orders', 
                warehouseAccess: 'assigned', 
                isSystem: true,
                permissions: ['production', 'inventory']
            }
        ];

        // 3. Seed roles
        for (const r of defaultRoles) {
            const [role, created] = await Role.findOrCreate({
                where: { roleKey: r.roleKey },
                defaults: r
            });
            if (created) {
                console.log(`Created default role: ${r.name}`);
            } else {
                console.log(`Role ${r.name} already exists.`);
            }
        }

        console.log('--- Role Migration Completed Successfully ---');
        process.exit(0);
    } catch (err) {
        console.error('--- Role Migration Failed ---');
        console.error(err);
        process.exit(1);
    }
}

migrate();
