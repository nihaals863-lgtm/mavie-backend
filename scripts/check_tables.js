const { sequelize } = require('./models');

async function checkTables() {
    try {
        await sequelize.authenticate();
        console.log('--- Database Connected ---');
        console.log('Dialect:', sequelize.getDialect());
        
        const tables = await sequelize.getQueryInterface().showAllTables();
        console.log('Current Database Tables (Count:', tables.length, '):');
        console.log(tables);
        
        const models = Object.keys(sequelize.models);
        console.log('\nModels Defined in Sequelize (Count:', models.length, '):');
        console.log(models);
        
        const missing = models.filter(m => {
            const tableName = sequelize.models[m].tableName;
            return !tables.some(t => {
                const tName = typeof t === 'string' ? t : t.tableName;
                return tName === tableName;
            });
        });
        
        if (missing.length > 0) {
            console.log('\nMissing Tables (Might need sync):');
            missing.forEach(m => console.log(`- ${m} (expected table: ${sequelize.models[m].tableName})`));
        } else {
            console.log('\nAll models have corresponding tables.');
        }

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await sequelize.close();
        process.exit();
    }
}

checkTables();
