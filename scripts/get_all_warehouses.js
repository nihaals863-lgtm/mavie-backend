const { Warehouse } = require('../models');

async function check() {
  try {
    const list = await Warehouse.findAll({ order: [['id', 'ASC']] });
    console.log(JSON.stringify(list.map(w => ({ id: w.id, name: w.name, code: w.code }))));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
check();
