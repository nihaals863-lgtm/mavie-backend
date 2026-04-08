const express = require('express');
const router = express.Router();
const roleController = require('../controllers/roleController');
const { authenticate, requireRole } = require('../middlewares/auth');

router.use(authenticate);

// Client wants to manage roles even if not super_admin. 
// We allow 'company_admin' and 'super_admin' to manage roles.
const allowedManagers = ['super_admin', 'company_admin'];

router.get('/', requireRole(...allowedManagers, 'warehouse_manager', 'inventory_manager', 'viewer'), roleController.list);
router.post('/', requireRole(...allowedManagers), roleController.create);
router.put('/:id', requireRole(...allowedManagers), roleController.update);
router.delete('/:id', requireRole(...allowedManagers), roleController.remove);

module.exports = router;
