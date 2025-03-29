import { processQuantity } from './foodsLang.mjs';

class FoodsDbItem
{
    /* jshint ignore:start */

    /** @type { Number | undefined } */
    quantity;
    /** @type { Number | undefined } */
    kcal;
    /** @type { String | undefined } */
    quantityunit;
    /** @type { String | undefined } */
    name;
    /** @type { boolean | undefined } */

    /* jshint ignore:end */
}


class FoodsDb
{
    /* jshint ignore:start */
    /** @type { FoodsDb | null } */
    static instance = null;
    /* jshint ignore:end */

    constructor()
    {
        /** @type {FoodsDbItem[]} */
        this.items = [];
    }

    static getInstance()
    {
        if (!FoodsDb.instance) {
            FoodsDb.instance = new FoodsDb();
        }
        return FoodsDb.instance;
    }

    /**
     * Process DB file
     * @param {string} content Full content of the config DB file
     */
    processDbFile(content)
    {
        let str = '';
        let dbLines = content.split('\r\n');
        if (dbLines.length === 1)
            dbLines = content.split('<NL/>');
        dbLines.forEach(element => {
            let dbLineParts = element.split('|');
            if (dbLineParts.length >= 3) {
                //str += 'LINE: ' + element + '\n';  // orig line
                let foodName = dbLineParts[1].trim();
                let foodInfo = dbLineParts[2].trim();
                let foodInfoParts = foodInfo.split(' ');
                let foodDbEntry = new FoodsDbItem();
                if (foodInfoParts.length >= 2) {
                    foodDbEntry.name = foodName.toLowerCase();
                    foodDbEntry.kcal = Number.parseFloat(foodInfoParts[0]);
                    foodDbEntry.quantity = 100;
                    foodDbEntry.quantityunit = 'g';
                }
                if (foodInfoParts[1]?.startsWith('kcal')) {
                    if (foodInfoParts[1][4] === '/') {
                        processQuantity(foodInfoParts[1].slice(5), foodDbEntry);
                    }
                }
                this.items.push(foodDbEntry);
            }
        });
        this.items.forEach((dbItem) => {
            let kcal2ndPart = (dbItem.quantity === 100 && dbItem.quantityunit === 'g' ? '' : `${dbItem.quantity}${dbItem.quantityunit}`);
            str += `${dbItem.name}: ${dbItem.kcal} kCal/${kcal2ndPart}\n`;
        } );

        $('#divDbContent').html('<pre>' + str + '</pre>');
    }
}

export { FoodsDb, FoodsDbItem };
