const { sequelize } = require('../models');

async function syncAll() {
    try {
        await sequelize.authenticate();
        console.log('--- Database Connected Successfully ---');
        
        // This will create any missing tables and add missing columns
        // For MySQL, we use alter: true to ensure all model changes are reflected
        await sequelize.sync({ alter: true });
        console.log('--- Database Sync Complete ---');
        
        const tables = await sequelize.getQueryInterface().showAllTables();
        console.log('Total Tables now:', tables.length);
        
    } catch (err) {
        console.error('Sync Error:', err.message);
    } finally {
        await sequelize.close();
        process.exit();
    }
}

syncAll();
