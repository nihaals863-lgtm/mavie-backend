const { Shipment, SalesOrder, OrderItem, PickList, ProductStock, User, Company, Warehouse, Product, Bundle, BundleItem } = require('../models');
const { Op } = require('sequelize');

async function list(reqUser, query = {}) {
  const where = {};
  if (reqUser.role !== 'super_admin') where.companyId = reqUser.companyId;
  else if (query.companyId) where.companyId = query.companyId;
  if (query.deliveryStatus) where.deliveryStatus = query.deliveryStatus;
  const shipments = await Shipment.findAll({
    where,
    order: [['createdAt', 'DESC']],
    include: [
      { association: 'SalesOrder', attributes: ['id', 'orderNumber', 'status'], include: ['Customer'] },
      { association: 'Company', attributes: ['id', 'name', 'code'] },
      { association: 'User', attributes: ['id', 'name', 'email'], required: false },
    ],
  });
  return shipments;
}

async function getById(id, reqUser) {
  const shipment = await Shipment.findByPk(id, {
    include: [
      { association: 'SalesOrder', include: ['Customer', 'OrderItems'] },
      { association: 'Company' },
      { association: 'User', attributes: { exclude: ['passwordHash'] }, required: false },
    ],
  });
  if (!shipment) throw new Error('Shipment not found');
  if (reqUser.role !== 'super_admin' && shipment.companyId !== reqUser.companyId) throw new Error('Shipment not found');
  return shipment;
}

async function create(data, reqUser) {
  const order = await SalesOrder.findByPk(data.salesOrderId);
  if (!order) throw new Error('Order not found');
  if (order.status !== 'PACKED') throw new Error('Order must be packed first');
  if (reqUser.role !== 'super_admin' && order.companyId !== reqUser.companyId) throw new Error('Order not found');

  const existing = await Shipment.findOne({ where: { salesOrderId: data.salesOrderId } });
  if (existing) throw new Error('This order already has a shipment. Use the existing shipment and update its status (e.g. Mark as Shipped).');

  const shipment = await Shipment.create({
    salesOrderId: order.id,
    companyId: order.companyId,
    packedBy: reqUser.id,
    courierName: data.courierName || null,
    trackingNumber: data.trackingNumber || null,
    weight: data.weight || null,
    dispatchDate: data.dispatchDate || new Date().toISOString().slice(0, 10),
    deliveryStatus: 'READY_TO_SHIP',
  });

  // Requirement: READY_TO_SHIP -> Sales Order = PACKED (No change needed)
  await order.update({ status: 'PACKED' });

  return getById(shipment.id, reqUser);
}

async function update(id, data, reqUser) {
  const shipment = await Shipment.findByPk(id);
  if (!shipment) throw new Error('Shipment not found');
  if (reqUser.role !== 'super_admin' && shipment.companyId !== reqUser.companyId) throw new Error('Shipment not found');

  const oldStatus = (shipment.deliveryStatus || '').toUpperCase();
  const newStatus = (data.deliveryStatus ?? shipment.deliveryStatus ?? '').toUpperCase();
  const becomesShippedOrDelivered = ['SHIPPED', 'IN_TRANSIT', 'DELIVERED'].includes(newStatus) && !['SHIPPED', 'IN_TRANSIT', 'DELIVERED'].includes(oldStatus);

  await shipment.update({
    courierName: data.courierName ?? shipment.courierName,
    trackingNumber: data.trackingNumber ?? shipment.trackingNumber,
    weight: data.weight !== undefined ? data.weight : shipment.weight,
    dispatchDate: data.dispatchDate ?? shipment.dispatchDate,
    deliveryStatus: data.deliveryStatus ?? shipment.deliveryStatus,
  });

  const order = await SalesOrder.findByPk(shipment.salesOrderId);
  if (!order) return getById(id, reqUser);

  if (data.deliveryStatus === 'SHIPPED' || data.deliveryStatus === 'IN_TRANSIT') {
    await order.update({ status: 'SHIPPED' });
  } else if (data.deliveryStatus === 'DELIVERED') {
    await order.update({ status: 'DELIVERED' });
  } else if (data.deliveryStatus === 'FAILED' || data.deliveryStatus === 'RETURNED') {
    await order.update({ status: 'SHIPPED' });
  }

  // Shipped/Delivered hone ke baad inventory & product stock se quantity minus (sirf ek hi bar)
  if (becomesShippedOrDelivered && !shipment.stockDeducted) {
    const orderItems = await OrderItem.findAll({ where: { salesOrderId: order.id } });
    let deductionCount = 0;

    for (const item of orderItems) {
      const pid = Number(item.productId) || 0;
      const qty = Number(item.quantity) || 0;
      if (!pid || qty <= 0) continue;

      try {
        const product = await Product.findByPk(pid);
        if (!product) continue;

        // Deduct stock (Hybrid logic inside deductProductStock handles regular, virtual, and physical bundles)
        const success = await deductProductStock(pid, qty, order.companyId, order.id);
        if (success) deductionCount++;
      } catch (err) {
        console.error('Shipment stock deduct failed for product', pid, err.message);
      }
    }

    if (deductionCount > 0) {
      await shipment.update({ stockDeducted: true });
    }
  }

  return getById(id, reqUser);
}

async function deductStockForShipment(shipmentId, reqUser) {
  const shipment = await Shipment.findByPk(Number(shipmentId) || shipmentId);
  if (!shipment) throw new Error('Shipment not found');
  if (reqUser.role !== 'super_admin' && shipment.companyId !== reqUser.companyId) throw new Error('Shipment not found');

  if (shipment.stockDeducted) {
    throw new Error('Stock already deducted for this shipment');
  }

  const st = (shipment.deliveryStatus || '').toUpperCase();
  if (!['SHIPPED', 'IN_TRANSIT', 'DELIVERED'].includes(st)) throw new Error('Only shipped/delivered shipments can deduct stock');

  const order = await SalesOrder.findByPk(shipment.salesOrderId);
  if (!order) throw new Error('Order not found');

  const orderItems = await OrderItem.findAll({ where: { salesOrderId: order.id } });
  if (!orderItems || orderItems.length === 0) throw new Error('No order items found for this shipment. Add products to the sales order first.');

  let deducted = 0;
  for (const item of orderItems) {
    const pid = Number(item.productId ?? item.product_id) || 0;
    const qty = Number(item.quantity) || 0;
    if (!pid || qty <= 0) continue;

    try {
      const product = await Product.findByPk(pid);
      if (!product) continue;

      const success = await deductProductStock(pid, qty, order.companyId, order.id);
      if (success) deducted += 1;
    } catch (err) {
      console.error('Deduct stock failed for product', pid, err.message);
    }
  }

  if (deducted > 0) {
    await shipment.update({ stockDeducted: true });
  }

  return { message: deducted > 0 ? `Stock deducted for ${deducted} product(s). Refresh Inventory/Products.` : 'No stock records found. Ensure products have inventory (Stock).', deducted };
}

async function prepareShipment(data, reqUser) {
  const { orderNumber } = data;
  if (!orderNumber) throw new Error('Order number required');

  const order = await SalesOrder.findOne({
    where: {
      orderNumber: orderNumber.trim(),
      companyId: reqUser.companyId || { [Op.ne]: null }
    },
    include: ['Shipment']
  });

  if (!order) throw new Error('Order not found');
  if (reqUser.role !== 'super_admin' && order.companyId !== reqUser.companyId) throw new Error('Order not found');

  // If shipment doesn't exist, create it (assuming it's PACKED)
  let shipment = order.Shipment;
  if (!shipment) {
    if (order.status !== 'PACKED' && order.status !== 'PICKED') {
      throw new Error(`Order ${orderNumber} is in status ${order.status}. It must be PACKED or PICKED to ship.`);
    }
    shipment = await create({ salesOrderId: order.id }, reqUser);
  }

  // Update status to SHIPPED
  return update(shipment.id, { deliveryStatus: 'SHIPPED' }, reqUser);
}

async function remove(id, reqUser) {
  const shipment = await Shipment.findByPk(id);
  if (!shipment) throw new Error('Shipment not found');
  if (reqUser.role !== 'super_admin' && shipment.companyId !== reqUser.companyId) throw new Error('Shipment not found');

  const order = await SalesOrder.findByPk(shipment.salesOrderId);

  // Revert stock if deducted
  if (shipment.stockDeducted && order) {
    const orderItems = await OrderItem.findAll({ where: { salesOrderId: order.id } });

    const recursiveRevertShipmentStock = async (pid, targetQty) => {
      const part = await Product.findByPk(pid);
      if (!part) return;

      if (part.productType === 'BUNDLE' || part.productType === 'MULTICOMBO') {
        const subBundle = await Bundle.findOne({
          where: { sku: part.sku, companyId: part.companyId },
          include: [{ model: BundleItem }]
        });
        if (subBundle && subBundle.BundleItems?.length) {
          for (const sItem of subBundle.BundleItems) {
            await recursiveRevertShipmentStock(sItem.productId, Number(sItem.quantity) * targetQty);
          }
        }
      } else {
        const stock = await ProductStock.findOne({ where: { productId: pid } });
        if (stock) {
          await stock.increment('quantity', { by: targetQty });
          await stock.increment('reserved', { by: targetQty });
        }
      }
    };

    for (const item of orderItems) {
      await recursiveRevertShipmentStock(item.productId, Number(item.quantity));
    }
  }

  if (order) {
    await order.update({ status: 'PACKED' });
  }

  await shipment.destroy();
  return { message: 'Shipment deleted and order reverted' };
}

async function deductProductStock(pid, qty, companyId, salesOrderId) {
  const product = await Product.findByPk(pid);
  if (!product || qty <= 0) return false;

  let finalSuccess = false;
  const isBundle = (product.productType === 'BUNDLE' || product.productType === 'MULTICOMBO');
  const isPhysical = !!product.isPhysicalBundle;

  // 1. If it's a REGULAR product or a PHYSICAL bundle, deduct its own physical stock
  if (!isBundle || isPhysical) {
    let stock = null;
    const pickList = await PickList.findOne({ where: { salesOrderId }, attributes: ['warehouseId'] });
    if (pickList && pickList.warehouseId) {
      stock = await ProductStock.findOne({ where: { productId: pid, warehouseId: pickList.warehouseId } });
    }
    if (!stock && companyId) {
      const companyWarehouses = await Warehouse.findAll({ where: { companyId }, attributes: ['id'] });
      const warehouseIds = (companyWarehouses || []).map((w) => w.id);
      if (warehouseIds.length > 0) {
        stock = await ProductStock.findOne({ where: { productId: pid, warehouseId: { [Op.in]: warehouseIds } } });
      }
    }
    if (!stock) stock = await ProductStock.findOne({ where: { productId: pid } });
    
    if (stock) {
      const prevQty = Number(stock.quantity) || 0;
      const prevRes = Number(stock.reserved) || 0;
      const deductQty = Math.min(qty, prevQty);
      if (deductQty > 0) {
        await stock.decrement('quantity', { by: deductQty });
        await stock.update({ updatedAt: new Date() });
        const newRes = Math.max(0, prevRes - deductQty);
        if (newRes !== prevRes) await stock.update({ reserved: newRes });
        finalSuccess = true;
      }
    }
  }

  // 2. If it's ANY bundle (Virtual or Physical), ALSO deduct components
  if (isBundle) {
    const bundle = await Bundle.findOne({
      where: { sku: product.sku, companyId: product.companyId },
      include: [{ model: BundleItem }]
    });
    if (bundle && bundle.BundleItems?.length) {
      for (const bItem of bundle.BundleItems) {
        const partPid = bItem.productId;
        const partQty = Number(bItem.quantity) * qty;
        // Recursive call (which will handle sub-bundles too)
        await deductProductStock(partPid, partQty, companyId, salesOrderId);
      }
      // If it's a virtual bundle (not physical), the deduction is considered successful based on components
      if (!isPhysical) finalSuccess = true;
    }
  }

  return finalSuccess;
}

module.exports = { list, getById, create, update, deductStockForShipment, prepareShipment, remove, deductProductStock };
