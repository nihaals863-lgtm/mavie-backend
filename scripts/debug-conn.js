const { sequelize } = require('../models');

async function debugConnection() {
    try {
        const [dbName] = await sequelize.query('SELECT DATABASE() as db');
        const [user] = await sequelize.query('SELECT USER() as user');
        console.log(`📡 Connected to DB: ${dbName[0].db}`);
        console.log(`👤 Connected as User: ${user[0].user}`);
        
        const [tables] = await sequelize.query('SHOW TABLES');
        console.log('📚 Tables in this DB:');
        console.table(tables);

        process.exit(0);
    } catch (err) {
        console.error('❌ Debug failed:', err.message);
        process.exit(1);
    }
}

debugConnection();
