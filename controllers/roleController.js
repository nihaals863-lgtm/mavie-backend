const { Role } = require('../models');

async function list(req, res, next) {
    try {
        const roles = await Role.findAll({ order: [['id', 'ASC']] });
        res.json({ success: true, data: roles });
    } catch (err) {
        next(err);
    }
}

async function create(req, res, next) {
    try {
        const role = await Role.create(req.body);
        res.status(201).json({ success: true, data: role });
    } catch (err) {
        next(err);
    }
}

async function update(req, res, next) {
    try {
        const { id } = req.params;
        const role = await Role.findByPk(id);
        if (!role) return res.status(404).json({ success: false, message: 'Role not found' });
        
        if (role.isSystem) {
            return res.status(403).json({ success: false, message: 'System roles cannot be modified' });
        }

        await role.update(req.body);
        res.json({ success: true, data: role });
    } catch (err) {
        next(err);
    }
}

async function remove(req, res, next) {
    try {
        const { id } = req.params;
        const role = await Role.findByPk(id);
        if (!role) return res.status(404).json({ success: false, message: 'Role not found' });

        if (role.isSystem) {
            return res.status(403).json({ success: false, message: 'System roles cannot be deleted' });
        }

        await role.destroy();
        res.json({ success: true, message: 'Role deleted' });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    list,
    create,
    update,
    remove
};
