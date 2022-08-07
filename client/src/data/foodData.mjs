export { Food }

class Food
{
    constructor()
    {
        this.origText = '';
    }
    /** @type { String | undefined } */
    name;
    /** @type { Number | undefined } */
    quantity;
    /** @type { Number | undefined } */
    kcal;
    /** @type { String | undefined } */
    kcalunit;
    /** @type { String | undefined } */
    quantityunit;
    /** @type { boolean | undefined } */
    isInvalid;
    /** @type { String | undefined } */
    unprocessed;
    /** @type { String | undefined } */
    highlighterClass;

    // helper properties
    /** @type { Number | undefined } */
    startTextCol;
    /** @type { Number | undefined } */
    computedkcal;
}
