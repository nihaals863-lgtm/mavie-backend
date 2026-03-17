const { Warehouse, Location } = require('../models');

async function check() {
  try {
    const wh = await Warehouse.findOne({ order: [['id', 'ASC']] });
    if (!wh) { console.log('No warehouse found'); process.exit(0); }
    const loc = await Location.findOne({ where: { zoneId: { [require('sequelize').Op.ne]: null } } });
    console.log(JSON.stringify({ warehouseId: wh.id, locationId: loc?.id }));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
check();
