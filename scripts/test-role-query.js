const { Role } = require('../models');

async function testFetch() {
    try {
        console.log('🧪 Testing Role.findAll()...');
        const roles = await Role.findAll({ limit: 1 });
        console.log('✅ Found roles:', roles.length);
        console.log('📄 Data:', JSON.stringify(roles[0], null, 2));
        process.exit(0);
    } catch (err) {
        console.error('❌ Query failed:', err.message);
        console.error('Full Error:', err);
        process.exit(1);
    }
}

testFetch();
