export { processQuantity }

import { isNumeric } from '../util/util.mjs';
import { FoodsDbItem } from './foodsDb.mjs';

/**
 *
 * @param {String} quantityStr
 * @param {FoodsDbItem} foodObj
 * @returns
 */
function processQuantity(quantityStr, foodObj)
{
    let u = '', unit = null;
    let quantityNumStr = quantityStr;
    if (quantityStr.endsWith(u = 'g') || quantityStr.endsWith(u = 'ml') || quantityStr.endsWith(u = 'l') || quantityStr.endsWith(u = 'db')) {
        quantityNumStr = quantityStr.substring(0, quantityStr.length - u.length);
        unit = u;
    }
    if (quantityNumStr.length == 0)
        quantityNumStr = '1';
    if (unit == null)
        unit = 'db';

    if (isNumeric(quantityNumStr)) {
            foodObj.quantity = Number.parseFloat(quantityNumStr);
            foodObj.quantityunit = (unit != null ? unit : 'db');
            return true;
    }
    return false;
}
