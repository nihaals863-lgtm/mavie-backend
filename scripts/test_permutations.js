const { listProducts } = require('../services/inventoryService');

async function test() {
  try {
    const list1 = await listProducts({ id: 1, companyId: 1, role: 'company_admin' }, {});
    console.log('Test 1 Passed:', list1.length);

    const list2 = await listProducts({ id: 1, companyId: '1', role: 'company_admin' }, {});
    console.log('Test 2 Passed:', list2.length);

    const list3 = await listProducts({ id: 1, role: 'super_admin' }, { companyId: 1 });
    console.log('Test 3 Passed:', list3.length);

    console.log('ALL PASSED');
    process.exit(0);
  } catch (err) {
    console.error('CRASHED WITH:');
    console.error(err);
    process.exit(1);
  }
}

test();
