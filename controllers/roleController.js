const { Role } = require('../models');
const { Op } = require('sequelize');

async function list(req, res, next) {
    try {
        const query = {
            where: {
                [Op.or]: [
                    { isSystem: true },
                    { companyId: req.user.companyId }
                ]
            },
            order: [['id', 'ASC']]
        };
        const roles = await Role.findAll(query);
        res.json({ success: true, data: roles });
    } catch (err) {
        next(err);
    }
}

async function create(req, res, next) {
    try {
        // Enforce companyId from token
        const payload = {
            ...req.body,
            companyId: req.user.companyId,
            isSystem: false // Users can only create non-system roles
        };
        const role = await Role.create(payload);
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

        // Only owner or super_admin can update
        if (role.companyId !== req.user.companyId && req.user.role !== 'super_admin') {
            return res.status(403).json({ success: false, message: 'Access denied to this role' });
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

        // Only owner or super_admin can delete
        if (role.companyId !== req.user.companyId && req.user.role !== 'super_admin') {
            return res.status(403).json({ success: false, message: 'Access denied to this role' });
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
