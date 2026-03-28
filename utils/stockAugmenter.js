const { Bundle, BundleItem, ProductStock, ProductionFormula, ProductionFormulaItem } = require('../models');

async function augmentProductStocks(products, companyId) {
    if (!companyId || !products || products.length === 0) return products;

    try {
        // 1. Identify types
        const bundleProducts = products.filter(p => (p.productType === 'BUNDLE' || p.productType === 'MULTICOMBO') && !p.isPhysicalBundle);
        const formulaProducts = products.filter(p => p.productType !== 'BUNDLE' && p.productType !== 'MULTICOMBO'); // Could check for hasFormula too but simpler to check all

        // 2. Bulk Fetch Bundles for these products
        const bundleSkus = bundleProducts.map(p => p.sku).filter(Boolean);
        let bundlesMap = {};
        if (bundleSkus.length > 0) {
            const bundles = await Bundle.findAll({
                where: { sku: bundleSkus, companyId },
                include: [{ model: BundleItem }]
            });
            bundles.forEach(b => { bundlesMap[b.sku] = b; });
        }

        // 3. Bulk Fetch Formulas for these products
        const productIds = products.map(p => p.id);
        const formulas = await ProductionFormula.findAll({
            where: { productId: productIds, companyId, isDefault: true },
            include: [{ model: ProductionFormulaItem }]
        });
        let formulaMap = {};
        formulas.forEach(f => { formulaMap[f.productId] = f; });

        // 4. Build Stock Map (productId -> totalQty) for components efficiently
        const [componentStocks] = await ProductStock.sequelize.query(
            `SELECT ps.product_id, SUM(ps.quantity) - SUM(ps.reserved) as total 
             FROM product_stocks ps
             INNER JOIN products p ON p.id = ps.product_id
             WHERE p.company_id = ? AND ps.status = 'ACTIVE' 
             GROUP BY ps.product_id`,
            { replacements: [companyId] }
        );
        const stockLookup = {};
        if (Array.isArray(componentStocks)) {
            componentStocks.forEach(s => { stockLookup[s.product_id] = parseFloat(s.total) || 0; });
        }

        // 5. Augment
        for (const p of products) {
            let minAssembly = Infinity;
            let hasFormulaOrBundle = false;

            // Handle Bundle
            if (bundlesMap[p.sku]) {
                const b = bundlesMap[p.sku];
                hasFormulaOrBundle = true;
                for (const item of b.BundleItems) {
                    const avail = stockLookup[item.productId] || 0;
                    const possible = Math.floor(avail / Number(item.quantity || 1));
                    if (possible < minAssembly) minAssembly = possible;
                }
            } 
            // Handle Formula (if not a bundle)
            else if (formulaMap[p.id]) {
                const f = formulaMap[p.id];
                hasFormulaOrBundle = true;
                for (const item of f.ProductionFormulaItems) {
                    const avail = stockLookup[item.productId] || 0;
                    const possible = Math.floor(avail / Number(item.quantityPerUnit || 1));
                    if (possible < minAssembly) minAssembly = possible;
                }
            }

            if (hasFormulaOrBundle && minAssembly !== Infinity) {
                const stocks = Array.isArray(p.ProductStocks) ? p.ProductStocks : [];
                
                // [REVERT] Physical stock should NOT be capped by virtual capacity.
                // 335 remains 335, even if components only allow 157.
                // The virtual record will still show 157.

                const virtualStockExists = stocks.some(s => s.isVirtual);
                if (!virtualStockExists) {
                    stocks.push({ 
                        quantity: Math.max(0, minAssembly), 
                        warehouseId: null, 
                        isVirtual: true,
                        computedAt: new Date()
                    });
                    p.ProductStocks = stocks;
                }
            }
        }
    } catch (err) {
        console.error('[stockAugmenter] Error:', err);
    }

    return products;
}

module.exports = { augmentProductStocks };
