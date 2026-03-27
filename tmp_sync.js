const { sequelize } = require('./config/db');
require('./models');

async function sync() {
  try {
    await sequelize.authenticate();
    console.log('Connection has been established successfully.');
    // Using alter: true will add missing columns
    await sequelize.sync({ alter: true });
    console.log('Database synced successfully (columns added).');
    process.exit(0);
  } catch (error) {
    console.error('Unable to sync database:', error);
    process.exit(1);
  }
}

sync();
