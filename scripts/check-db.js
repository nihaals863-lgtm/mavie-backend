const { sequelize } = require('../models');

async function checkTable() {
    try {
        const [results] = await sequelize.query('DESCRIBE roles');
        console.log('📋 Roles Table Structure:');
        console.table(results);
        process.exit(0);
    } catch (err) {
        console.error('❌ Failed to describe table:', err);
        process.exit(1);
    }
}

checkTable();
