const { sequelize, Notification, ProductionArea } = require('../models');

async function syncMissing() {
    try {
        await sequelize.authenticate();
        console.log('--- Database Connected ---');
        
        console.log('Syncing Notification table...');
        await Notification.sync();
        
        console.log('Syncing ProductionArea table...');
        await ProductionArea.sync();
        
        console.log('--- Selective Sync Complete ---');
        
        const tables = await sequelize.getQueryInterface().showAllTables();
        console.log('Total Tables now:', tables.length);
        
    } catch (err) {
        console.error('Sync Error:', err.message);
    } finally {
        await sequelize.close();
        process.exit();
    }
}

syncMissing();
