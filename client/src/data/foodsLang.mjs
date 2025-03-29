(function () {
    'use strict';
    // this function is strict...
}());

export { processQuantity };

import { isNumeric } from '../util/util.mjs';
import { FoodsDbItem } from './foodsDb.mjs';        // jshint ignore:line


/**
 *
 * @param {string} quantityStr
 * @param {FoodsDbItem} foodObj
 * @returns
 */
function processQuantity(quantityStr, foodObj)
{
    /** @type { string | null} */
    let u, unit;
    let quantityNumStr = quantityStr;
    if (quantityStr.endsWith(u = 'g') || quantityStr.endsWith(u = 'ml') || quantityStr.endsWith(u = 'l') || quantityStr.endsWith(u = 'db')) {
        quantityNumStr = quantityStr.substring(0, quantityStr.length - u.length);
        unit = u;
    }
    if (quantityNumStr.length === 0)
        quantityNumStr = '1';
    if (unit == null)
        unit = 'db';

    if (isNumeric(quantityNumStr)) {
            foodObj.quantity = Number.parseFloat(quantityNumStr);
            foodObj.quantityunit = unit;
            return true;
    }
    return false;
}
