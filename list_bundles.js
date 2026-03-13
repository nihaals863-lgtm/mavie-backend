
const { Bundle } = require('./models');

async function test() {
  try {
    const list = await Bundle.findAll();
    console.log('Bundles in DB:', JSON.stringify(list.map(b => b.toJSON()), null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

test();
