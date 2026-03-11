/**
 * Unit Converter Utility
 * Handles conversions between KG/g and L/ml
 */

const CONVERSION_FACTORS = {
    // To Base (g or ml)
    toBase: {
        'kg': 1000,
        'kilogram': 1000,
        'kilograms': 1000,
        'g': 1,
        'gram': 1,
        'grams': 1,
        'l': 1000,
        'litre': 1000,
        'litres': 1000,
        'liter': 1000,
        'liters': 1000,
        'ml': 1,
        'millilitre': 1,
        'millilitres': 1,
        'milliliter': 1,
        'milliliters': 1,
    }
};

/**
 * Normalizes unit string for lookup
 */
function normalizeUnit(unit) {
    if (!unit) return '';
    return unit.toLowerCase().trim();
}

/**
 * Converts a quantity from one unit to another
 * @param {number} value 
 * @param {string} fromUnit 
 * @param {string} toUnit 
 * @returns {number}
 */
function convert(value, fromUnit, toUnit) {
    const from = normalizeUnit(fromUnit);
    const to = normalizeUnit(toUnit);

    if (from === to) return value;

    // Weight conversion (KG <-> g)
    const isWeightFrom = ['kg', 'kilogram', 'kilograms', 'g', 'gram', 'grams'].includes(from);
    const isWeightTo = ['kg', 'kilogram', 'kilograms', 'g', 'gram', 'grams'].includes(to);

    if (isWeightFrom && isWeightTo) {
        const factorFrom = CONVERSION_FACTORS.toBase[from] || 1;
        const factorTo = CONVERSION_FACTORS.toBase[to] || 1;
        return (value * factorFrom) / factorTo;
    }

    // Volume conversion (L <-> ml)
    const isVolFrom = ['l', 'litre', 'litres', 'ml', 'millilitre', 'millilitres', 'liter', 'liters', 'milliliter', 'milliliters'].includes(from);
    const isVolTo = ['l', 'litre', 'litres', 'ml', 'millilitre', 'millilitres', 'liter', 'liters', 'milliliter', 'milliliters'].includes(to);

    if (isVolFrom && isVolTo) {
        const factorFrom = CONVERSION_FACTORS.toBase[from] || 1;
        const factorTo = CONVERSION_FACTORS.toBase[to] || 1;
        return (value * factorFrom) / factorTo;
    }

    // Default: No conversion possible/needed
    return value;
}

module.exports = {
    convert,
    normalizeUnit
};
