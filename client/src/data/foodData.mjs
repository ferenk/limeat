class Food
{
/* jshint ignore:start */
    /** @type { String | undefined } */
    name;
    /** @type { Number } */
    quantity = 0;
    /** @type { Number | undefined } */
    leftoverQuantity;
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
    /** @type { Number } */
    computedkcal = 0;
    /** @type { Number } */
    rankingPoints = 0.0;
    /* jshint ignore:end */

    constructor()
    {
        this.origText = '';
        this.isContinuation = false;
    }
}

class Meal
{
    /* jshint ignore:start */
    /** @type { Food[] } */
    foodParts = [];
    /** @type { Food } */
    foodSum;
    /** @type { String | null } */
    date = null;
    /** @type {string} */
    timeStampPrefix = '';
    /** @type {string} the name of the meal */
    mealNamePrefix = '';
    /** @type {string} the unprocessed part of the input row */
    leftoverText = '';
    /** @type {string} the whole input string */
    inputLine = '';
    /* jshint ignore:end */

    constructor() {     // jshint ignore:line
        this.foodSum = new Food();
    }
}

export { Meal, Food };
