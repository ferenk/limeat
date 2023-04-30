export { Meal, Food }

class Meal
{
    /** @type { Food[] } */
    foodParts = [];
    /** @type { Food } */
    foodSum = new Food();
    /** @type {string} */
    timeStampPrefix = '';
    /** @type {string} the name of the meal */
    mealNamePrefix = '';
    /** @type {string} the unprocessed part of the input row */
    leftoverText = '';
    /** @type {string} the whole input string */
    inputLine = '';
}

class Food
{
    constructor()
    {
        this.origText = '';
        this.isContinuation = false;
    }
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
}
