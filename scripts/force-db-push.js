const { sequelize } = require('../models');

async function pushDatabaseChanges() {
    try {
        console.log('🚀 Starting manual database push to Railway...');
        
        // Check if is_system exists, if not add it
        const [isSystemCols] = await sequelize.query("SHOW COLUMNS FROM roles LIKE 'is_system'");
        if (isSystemCols.length === 0) {
            console.log('➕ Adding column: is_system');
            await sequelize.query("ALTER TABLE roles ADD COLUMN is_system TINYINT(1) DEFAULT 0 AFTER permissions");
        } else {
            console.log('✅ Column is_system already exists.');
        }

        // Check if company_id exists, if not add it
        const [companyIdCols] = await sequelize.query("SHOW COLUMNS FROM roles LIKE 'company_id'");
        if (companyIdCols.length === 0) {
            console.log('➕ Adding column: company_id');
            await sequelize.query("ALTER TABLE roles ADD COLUMN company_id INT AFTER is_system");
            // Add foreign key constraint
            await sequelize.query("ALTER TABLE roles ADD CONSTRAINT fk_roles_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL ON UPDATE CASCADE");
        } else {
            console.log('✅ Column company_id already exists.');
        }

        console.log('✨ Database push successful! Railway tables are updated.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Database push failed:', err.message);
        process.exit(1);
    }
}

pushDatabaseChanges();
