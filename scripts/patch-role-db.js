const { Role, sequelize } = require('../models');

async function patchRoleTable() {
    try {
        console.log('🔄 Checking role table schema...');
        
        // This will add missing columns safely using ALTER TABLE
        await Role.sync({ alter: true });
        console.log('✅ Role table schema updated successfully.');

        // Initialize system roles if needed
        const systemRoles = ['super_admin', 'company_admin', 'warehouse_manager', 'inventory_manager', 'admin', 'manager', 'picker', 'packer', 'warehouse_staff', 'viewer'];
        
        for (const rKey of systemRoles) {
            const role = await Role.findOne({ where: { roleKey: rKey } });
            if (role && !role.isSystem) {
                console.log(`🛠️ Marking ${rKey} as system role...`);
                await role.update({ isSystem: true });
            }
        }
        
        console.log('✨ Database patch completed.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    }
}

patchRoleTable();
