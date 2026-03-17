const { listProducts } = require('../services/inventoryService');

async function test() {
  try {
    const mockUser = { id: 1, companyId: 1, role: 'company_admin' }; // using standard companyId
    const res = await listProducts(mockUser, {});
    console.log('SUCCESS: List products responded with', res.length, 'items');
    process.exit(0);
  } catch (err) {
    console.error('ERROR TRACE:');
    console.error(err);
    process.exit(1);
  }
}

test();
