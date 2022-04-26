class FoodsDb
{
    /** @type {FoodsDb?} */
    static instance = null;

    constructor()
    {
        /** @type {Object[]} */
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
        dbLines.forEach(element => {
            let dbLineParts = element.split('|');
            if (dbLineParts.length >= 3) {
                //str += 'LINE: ' + element + '\n';  // orig line
                let foodName = dbLineParts[1].trim();
                let foodInfo = dbLineParts[2].trim();
                let foodInfoParts = foodInfo.split(' ');
                if (foodInfoParts.length >= 2) {
                    let foodDbEntry = { name: foodName.toLowerCase(), kcal: foodInfoParts[0], quantity: 100, quantityunit: 'g' };
                    if (foodInfoParts[1].startsWith('kcal')) {
                        if (foodInfoParts[1][4] == '/') {
                            processQuantity(foodInfoParts[1].slice(5), foodDbEntry);
                        }
                    }
                    this.items.push(foodDbEntry);
                }
            }
        });
        this.items.forEach((dbItem) => {
            let kcal2ndPart = (dbItem.quantity == 100 && dbItem.quantityunit == 'g' ? '' : `${dbItem.quantity}${dbItem.quantityunit}`);
            str += `${dbItem.name}: ${dbItem.kcal} kCal/${kcal2ndPart}\n`;
        } );

        $('#divDbContent').html('<pre>' + str + '</pre>');
    }
}

//export { FoodsDb };