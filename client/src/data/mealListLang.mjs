import { getCurrentMoment, printMoment, toNumericOrZero, toFixedFloat, printToFixedFloat, safeEval } from '../util/util.mjs';
import { TextContainer } from '../util/text/textContainers.mjs';    // jshint ignore:line

import { Config } from '../app/config.mjs';

import { Meal, Food } from './foodData.mjs';
import { FoodsDb } from './foodsDb.mjs';
import { processQuantity } from './foodsLang.mjs';

/* jshint ignore:start */ /* Classes are used as a class property */
import { TextareaExt } from '../views/textareaExt.mjs';
import { TextareaHighlight } from '../views/textareaHighlight.mjs';
/* jshint ignore:end */

class MealListLang
{
    dayParts =
    [{ pattern: '  |          |***(reggeli,tízórai)***', kcal: 0, g:0 },
     { pattern: '  |          |***(ebéd,uzsonna)***', kcal:0, g:0 },
     { pattern: '  |          |***(vacsora,nasik)***', kcal:0, g:0 },
     { pattern: '  |          |', kcal: 0, g: 0 }];
    mdHeader = '  | kCal     |  Idő    | Kaja típusa  \n  | -------- | ------- | -----------  \n';

    /* Input text processor */
    /* jshint ignore:start */
    /** @type {TextareaExt | null} */
    mealLogText = null;

    /* Output text generation */
    /** @type { Number } */
    currentDayPart = 0;
    /** @type { String } */
    foodOutputStr = '';
    /** @type { String[] } */
    foodSourceModifiedOutput = [];
    /* jshint ignore:end */

    /**
     * Create a food diary processor
     * @param {Config} config
     * @param {TextareaExt | null} mealLogText
     * @param {TextareaHighlight} mealLogHighlight
     */
    constructor(config, mealLogText, mealLogHighlight)
    {
        ///todo: make this configurable!!
        this.config = config;

        /* Time management */
        this.currentDayMoment = getCurrentMoment('04:00');

        this.mealLogText = mealLogText;
        this.mealLogHighlight = mealLogHighlight;

        this.initCounters();
    }

    /* Process entered text*/

    initCounters()
    {
        for (let i = 0; i < this.dayParts.length; i++) {
            this.dayParts[i].kcal = 0;
            this.dayParts[i].g = 0;
        }
        this.currentDayPart = 0;
        this.foodOutputStr = `### ${printMoment(this.currentDayMoment).slice(8)}  \n` + this.mdHeader;
        this.foodSourceModifiedOutput = [];
        // remove each meal row
        [].forEach.call(document.querySelectorAll('.mealRow'), (/** @type {Element} */ el) =>
        {
            el?.parentNode?.removeChild(el);
        });

    }

    currentSummaryStr = '';              // jshint ignore:line
    currentSummaryKCal = 0              // jshint ignore:line

    /**
     * @param { TextContainer | null } logText
     */
    processInput(logText)
    {
        if (!logText)
            logText = this.mealLogText;

        /** @type { Map<string, [Number|undefined, number|undefined]> } */
        let lastFoodAmounts = new Map();
        this.currentSummaryStr = '';
        this.currentSummaryKCal = 0;

        this.mealLogHighlight.htmlBuffer.clear();

        /** @type { Meal[] } */
        let dailyMealLog = [];

        for (let iCurrentRow = 0; iCurrentRow < (logText?.getRowCount() || 0); iCurrentRow++)
        {
            let foodLine = logText?.getRow(iCurrentRow) || '';
            let processedMeal = this.parseMeal(foodLine, lastFoodAmounts);
            this.calculateMeal(processedMeal);
            dailyMealLog.push(processedMeal);
            console.log(`processedMeal: ${processedMeal}`);
        }

        for (let iCurrentRow = 0; iCurrentRow < dailyMealLog.length; iCurrentRow++)
        {
            let processedMeal = dailyMealLog[iCurrentRow];
            this.displayMealInTable(iCurrentRow, processedMeal);
            console.log(`processedMeal: ${processedMeal}`);
        }
        this.addTableTrailer();
    }

     // * @param {number} iCurrentRow
    /**
     * @param {string} foodLine
     * @param {Map<string, [Number|undefined, number|undefined]>} lastFoodAmounts
     * @returns {Meal} the processed line
     */
    parseMeal(foodLine, lastFoodAmounts = new Map())
    {
        let meal = new Meal();
        meal.inputLine = foodLine;
        // foodLine: "10:25 apple 10g, banana 20g"

        // print summary
        if (foodLine.startsWith('---'))
        {
            //@todo move -> print
            //! this.recordHighlightedInput(iCurrentRow, 0, 0, foodLine);

            meal.leftoverText = foodLine;
            return meal;
        }

        // parse time stamp (@ beginning of the string)
        let timeSepCol;
        if (foodLine.length > 5 && ((foodLine[1] === ':' && foodLine[timeSepCol = 4] === ' ') || (foodLine[2] === ':' && foodLine[timeSepCol = 5] === ' ')))
        {
            meal.timeStampPrefix = foodLine.substring(0, timeSepCol);
            foodLine = foodLine.substring(timeSepCol + 1);
        }
        else
            timeSepCol = 0;

        // parse food (name, quantity, unit)
        // foodPartStrs: ["apple 40g", "banana 20g"]
        let foodPartStrs = foodLine.split(',');
        let nextFoodPartCol = 0;
        for (let iPart = 0; iPart < foodPartStrs.length; iPart++)
        {
            let foodPartStr = foodPartStrs[iPart];

            // foodPartStr: "apple 40g"
            let foodPartArr = foodPartStr.split(/[' ']+/);
            // foodPartArr: ["apple", "40g"]
            let newFoodPart = new Food();

            // calculate & store current text column
            newFoodPart.startTextCol = nextFoodPartCol > 0 ? nextFoodPartCol : 0;
            nextFoodPartCol += foodPartStr.length + 1;
            if (iPart == 0 && timeSepCol > 0)
            {
                newFoodPart.startTextCol += timeSepCol + 1;
                nextFoodPartCol += timeSepCol + 1;
            }

            newFoodPart.origText = foodPartStr;

            for (let jWord = 0; jWord < foodPartArr.length; jWord++)
            {
                let foodPartNameStrRaw = foodPartArr[jWord];
                // foodPartNameStr: first run: "apple" (or a label: "fish_n_chips:") second run: "40g"
                let foodPartNameStr = foodPartNameStrRaw.trim();

                // Skip empty strings. They are not 'parts'. Wrong input, effect of String.split() - duplicate separators result empty values, e.g '40g  apple'.
                if (foodPartNameStr.length == 0)
                {
                    continue;
                }

                // handling labels (e.g "fish_n_chips:")
                if (foodPartNameStr.endsWith(':'))
                {
                    meal.mealNamePrefix = `___${foodPartNameStr.replaceAll('_', ' ')}___ `;
                    continue;
                }

                // test if this part is a quantity
                /** @type { string | number } */
                let unit = '', units = [ 'g', 'db', 'kc', 'kcal', 'kc/', 'kcal/', ], quantity = NaN;
                for (let unitsIdx = 0; unitsIdx < units.length; unitsIdx++)
                {
                    if (foodPartNameStr.endsWith(units[unitsIdx]))
                    {
                        unit = 5;
                        unit = units[unitsIdx];
                        let foodPartNameWOUnitStr = foodPartNameStr.replaceAll(unit, '');
                        //!TODO log console.log(`foodPartNameWOUnitStr: "${foodPartNameWOUnitStr}"`);
                        if (/^ *[/\+\-\*\/\.0123456789()]+$/.test(foodPartNameWOUnitStr))
                        {
                            quantity = toFixedFloat(safeEval(foodPartNameWOUnitStr));
                        }
                        // handle leftover food
                        let leftoverAmountStr = foodPartNameWOUnitStr.replace(/.*-/, '-');
                        if (/^-[\.0123456789]+$/.test(leftoverAmountStr))
                        {
                            newFoodPart.leftoverQuantity = toFixedFloat(- safeEval(leftoverAmountStr));
                        }
                        // handle continued meals
                        if (unit == 'g' && foodPartNameWOUnitStr.startsWith('-'))
                            newFoodPart.isContinuation = true;
                        break;
                    }
                }
                if (!isNaN(quantity))
                {
                    if (unit === 'g' || unit === 'db')
                    {
                        newFoodPart.quantity = quantity;
                        if (unit === 'g')
                            newFoodPart.quantityunit = 'g';
                        //? without quantityunit the default is now always 'db' (unit)
                        else if (unit === 'db')
                            newFoodPart.quantityunit = 'db';
                    }
                    else if (unit === 'kc' || unit === 'kcal')
                    {
                        newFoodPart.kcalunit = 'kcal';
                        newFoodPart.kcal = quantity;
                    }
                    else if (unit === 'kc/' || unit === 'kcal/')
                    {
                        newFoodPart.kcalunit = 'kcal/100g';
                        newFoodPart.kcal = quantity;
                    }
                }
                else
                {
                    if (!processQuantity(foodPartNameStr, newFoodPart))
                    {
                        if (newFoodPart.name == null)
                            newFoodPart.name = foodPartNameStr;
                        else
                        {
                            // not processed input
                            if (newFoodPart.unprocessed == null)
                                newFoodPart.unprocessed = '';
                            else
                                newFoodPart.unprocessed += ' ';
                            newFoodPart.unprocessed += `<font color="peru">${foodPartNameStr}</font>`;
                            newFoodPart.origText = newFoodPart.origText.replaceAll(foodPartNameStr, `<font color="peru">${foodPartNameStr}</font>`);
                        }
                    }
                }
            }
            if (newFoodPart.name != null && newFoodPart.name != '')
            {
                if (newFoodPart.quantity == 0)
                    newFoodPart.quantity = 1;
                if (newFoodPart.quantityunit == null)
                    newFoodPart.quantityunit = 'db';
            }
            else
                newFoodPart.isInvalid = true;

            if (!newFoodPart.isInvalid && newFoodPart.name != null && newFoodPart.name != '')
            {
                let foodPartPrevState = lastFoodAmounts.get(newFoodPart.name);
                if (foodPartPrevState != null)
                {
                    if (newFoodPart.kcal == null && foodPartPrevState[1] != null)
                    {
                        newFoodPart.kcal = foodPartPrevState[1];
                        newFoodPart.kcalunit = 'kcal/100g';
                    }

                    if (newFoodPart.isContinuation && newFoodPart.quantity != null && foodPartPrevState[0] != null && foodPartPrevState[0] != 0)
                    {
                        newFoodPart.quantity = toFixedFloat(newFoodPart.quantity + foodPartPrevState[0]);
                    }
                }

                // store current food part
                let kcalPerGrams;
                if (newFoodPart.kcalunit === 'kcal/100g')
                    kcalPerGrams = newFoodPart.kcal;
                lastFoodAmounts.set(newFoodPart.name, [newFoodPart.leftoverQuantity, kcalPerGrams, ]);
            }

            meal.foodParts.push(newFoodPart);
        }
        return meal;
    }

    /**
     * @param {Meal} meal
     * @param {boolean} calculateSummary calculate summary, too
     */
    calculateMeal(meal, calculateSummary = true)
    {
        for (let iPart = 0; iPart < meal.foodParts.length; iPart++)
        {
            let foodPart = meal.foodParts[iPart];

            if (foodPart.isInvalid != true)
            {
                let partKCal = 0;
                if (foodPart.kcalunit == 'kcal')
                    partKCal = toNumericOrZero(foodPart.kcal ?? 0);
                if (partKCal == 0)
                {
                    if (foodPart.kcalunit == 'kcal/100g' && foodPart.quantityunit == 'g')
                    {
                        let quant = this.simulateScaleMeasurement(foodPart.quantity);
                        partKCal = (toNumericOrZero(this.roundKCalMeasurement(quant, 100, foodPart.kcal)));
                    }
                }
                if (partKCal == 0)
                    partKCal = this.calcFoodKcal(foodPart);
                meal.foodSum.computedkcal += toFixedFloat(partKCal);
                if (foodPart.quantityunit == 'g')
                    meal.foodSum.quantity += toFixedFloat(foodPart.quantity);

                foodPart.computedkcal = partKCal;
            }
        }
        if (calculateSummary)
        {
            this.dayParts[this.currentDayPart].kcal += meal.foodSum.computedkcal;
            this.dayParts[this.currentDayPart].g += meal.foodSum.quantity;
        }
    }

    /**
     *
     * @param {number} iCurrentRow
     * @param {Meal} meal
     */
    displayMealInTable(iCurrentRow, meal)
    {
        if (meal.leftoverText.startsWith('---'))
        {
            this.appendSeparator();
            return;
        }

        // print the currently processed food
        let mdFoodOutputLineStr = '',
            htmlfoodOutputLineStr = '';
        for (let iPart = 0; iPart < meal.foodParts.length; iPart++)
        {
            let foodPart = meal.foodParts[iPart];
            this.foodPartColored = foodPart.origText;
            let partOrigTextColor = 'black';

            if (foodPart.isInvalid != true)
            {
                // add new row after labels
                if (mdFoodOutputLineStr.length > 0) {
                    mdFoodOutputLineStr += '  \n  |          |         | ';
                    htmlfoodOutputLineStr += '\n';
                }
                // indent when adding multiple food parts
                if (meal.mealNamePrefix.length > 0) {
                    if (iPart == 0)
                        mdFoodOutputLineStr += '  \n  |          |         | * ';
                    else
                        mdFoodOutputLineStr += '* ';

                    htmlfoodOutputLineStr += '  ';
                }

                if (foodPart.computedkcal == 0) {
                    mdFoodOutputLineStr += '<font color="red">';
                    htmlfoodOutputLineStr += '<font color="red">';
                    partOrigTextColor = 'red';
                }

                // update textbox to have syntax highlighted output
                let sectionName = this.recordHighlightedInput(iCurrentRow, iPart, foodPart.startTextCol || 0, foodPart.origText, partOrigTextColor, { foodPart: foodPart, }, meal.timeStampPrefix);
                foodPart.highlighterClass = (sectionName ? `class=${sectionName}` : '');

                if (foodPart && foodPart.name)
                {
                    let partKCal = foodPart.computedkcal ?? 0;
                    if (foodPart.kcal != null) {
                        let kcalunitPrinted = foodPart.kcalunit == 'kcal/100g' ? 'kc/' : foodPart.kcalunit;
                        if (foodPart.kcalunit != 'kcal') {
                            mdFoodOutputLineStr += `${foodPart.name.replaceAll('_', ' ')} (${foodPart.quantity}${foodPart.quantityunit}, ${foodPart.kcal}${kcalunitPrinted}, =${Math.round(partKCal)}kc)`;
                            htmlfoodOutputLineStr += `<span ${foodPart.highlighterClass} style="font-weight:600">${foodPart.name.replaceAll('_', ' ')} (${foodPart.quantity}${foodPart.quantityunit}, ${foodPart.kcal}${kcalunitPrinted}, =${Math.round(partKCal)}kc)</span>`;
                        }
                        else {
                            mdFoodOutputLineStr += `${foodPart.name.replaceAll('_', ' ')} (${foodPart.quantity}${foodPart.quantityunit}, ${foodPart.kcal}${kcalunitPrinted})`;
                            htmlfoodOutputLineStr += `<span ${foodPart.highlighterClass} style="font-weight:600">${foodPart.name.replaceAll('_', ' ')} (${foodPart.quantity}${foodPart.quantityunit}, ${foodPart.kcal}${kcalunitPrinted})</span>`;
                        }
                    }
                    else {
                        mdFoodOutputLineStr += `${foodPart.name.replaceAll('_', ' ')} (${foodPart.quantity}${foodPart.quantityunit}, =${Math.round(partKCal)}kc)`;
                        htmlfoodOutputLineStr += `<span ${foodPart.highlighterClass} style="font-weight:600">${foodPart.name.replaceAll('_', ' ')} (${foodPart.quantity}${foodPart.quantityunit}, =${Math.round(partKCal)}kc)</span>`;
                    }
                }

                if (foodPart.computedkcal == 0) {
                    mdFoodOutputLineStr += '</font>';
                    htmlfoodOutputLineStr += '</font>';
                }
                if (foodPart.unprocessed != null) {
                    mdFoodOutputLineStr += ` ***${foodPart.unprocessed}***`;
                    htmlfoodOutputLineStr += ` <font ${foodPart.highlighterClass} color="#f00000"><b><i>${foodPart.unprocessed}</i></b></font>`;
                }
            }
        }

        let foodKCalStr = printToFixedFloat(meal.foodSum.computedkcal, 1, '0');

        // update the 'current line' field
        let currentOutputLine = this.formatFoodData(foodKCalStr, meal.timeStampPrefix, meal.mealNamePrefix + mdFoodOutputLineStr) + '  \n';

        // append this line to the table output
        let foodKCalStrFormatted = foodKCalStr.replace(/(..)$/, '<span style="font-size:0.85em;">$1</span>');  // decimal characters are smaller
        // calculate prefix
        let displayedFoodNamePrefixStr = meal.mealNamePrefix;
        if (displayedFoodNamePrefixStr.length > 0)
        {
            displayedFoodNamePrefixStr = displayedFoodNamePrefixStr.replaceAll('___', '').replaceAll(/ $/g, '');
            displayedFoodNamePrefixStr = `<u><b>${displayedFoodNamePrefixStr}</b></u>`;
            const foodSumGrams = printToFixedFloat(meal.foodSum.quantity, 1, '0');
            const foodSumKCals = printToFixedFloat(meal.foodSum.computedkcal/(meal.foodSum.quantity/100), 1, '0');
            displayedFoodNamePrefixStr += ` (${foodSumGrams}g, ${foodSumKCals}kc/)\n`;
        }
        displayedFoodNamePrefixStr = !displayedFoodNamePrefixStr ? '' : displayedFoodNamePrefixStr.replaceAll('___', '');
        let currTableRowStr =
            `<tr id="tr${iCurrentRow}" class="mealRow">` +
            `<td style="text-align:right;" class="preBold kcalBg effectSmallerLast" value="${toFixedFloat(meal.foodSum.computedkcal, 1)}">${foodKCalStrFormatted}</td>` +
            `<td style="text-align:right; font-size:0.85em;" class="preBold timeBg">${meal.timeStampPrefix}</td>` +
            `<td class="preReg">${displayedFoodNamePrefixStr + htmlfoodOutputLineStr}</td></tr>`;
        if (this.mealLogText)
        {
            if (this.mealLogText.mealLineFirst == -1)
                this.mealLogText.mealLineFirst = iCurrentRow;
            this.mealLogText.mealLineLast = iCurrentRow;
        }

        /** @type { HTMLTableElement | null } */
        let domTableOutBody = document.querySelector('#tableOut>tbody');
        if (domTableOutBody)
        {
            let newRow = domTableOutBody.insertRow();
            newRow.outerHTML = currTableRowStr;
        }

        // append this line to the main output (and optionally to the summary text)
        this.foodOutputStr += currentOutputLine;
        if (this.mealLogText && iCurrentRow == this.mealLogText.cursorPos[1]) {
            this.currentSummaryStr += displayedFoodNamePrefixStr + htmlfoodOutputLineStr;
            this.currentSummaryKCal = meal.foodSum.computedkcal;
        }
    }

    addTableTrailer()
    {
        // add the last separators...
        while(this.currentDayPart < this.dayParts.length -1)
            this.appendSeparator();
        // ...and add the summary (same this.appendSeparator() is used as before)
        if (this.currentDayPart == this.dayParts.length -1) {
            let allKCal = 0;
            let allG = 0;
            for (let i = 0; i < this.dayParts.length; i++) {
                allKCal += this.dayParts[i].kcal;
                allG += this.dayParts[i].g;
            }
            this.dayParts[this.currentDayPart].kcal = allKCal;
            this.dayParts[this.currentDayPart].g = allG;
            this.appendSeparator();
        }

        //? MealListLang.domSetHtml('#tCurrentLine', currentSummaryStr);
        MealListLang.domSetHtml('#lbCurrentAllKCal', `<b>${Math.round(this.dayParts[this.currentDayPart - 1].kcal)}kc</b>`);
        MealListLang.domSetHtml('#lbCurrentLineKCal', `${Math.round(this.currentSummaryKCal)}kc`);

        // display the result
        MealListLang.domSetHtml('#divOutput', `<pre>${this.foodOutputStr}</pre>`);
    }

    /**
     * @param {string} queryStr
     * @param {string} htmlStr
     * @param {boolean} htmlStr
     */
    static domSetHtml(queryStr, htmlStr, outerHTML = false)
    {
        let domItem = document.querySelector(queryStr);
        if (domItem)
        {
            if (outerHTML)
                domItem.outerHTML = htmlStr;
            else
                domItem.innerHTML = htmlStr;
        }
    }

    /**
     * @param {Number} iRow
     * @param {Number} _iPart
     * @param {Number} iCol
     * @param {String} currPartHtmlText
     * @param {String | null} color
     * @param {{ foodPart: Object } | null } metadata
     * @param {String | null} _timeStamp
     */
    recordHighlightedInput(iRow, _iPart, iCol, currPartHtmlText, color = null, metadata = null, _timeStamp = null) // jshint ignore:line
    {
        // add prefix
        //let currPartBeginStr = ''
        //if (iPart == 0 && timeStamp != null)
            //currPartBeginStr += timeStamp + ' ';
        //else if (iPart > 0)
            //currPartBeginStr += ',';

        //this.mealLogHighlight.tempHtmlBuffer.appendToLine(iRow, iCol, currPartBeginStr);

        // colorize this part, if needed
        if (color != null)
            currPartHtmlText = `<font color="${color}">${currPartHtmlText}</font>`;

        let sectionName = this.mealLogHighlight.htmlBuffer.appendToLine(iRow, iCol, currPartHtmlText, metadata, true);

        return sectionName;
    }

    /**
     *
     * @param {Number} quant
     * @param {Number} dbFoodQuant
     * @param {Number} dbFoodKcal
     * @returns
     */
    roundKCalMeasurement(quant = 0, dbFoodQuant = 1, dbFoodKcal = 0)
    {
        return (quant * dbFoodKcal / dbFoodQuant);
    }

    /**
     * Adjust the measured weight simulating the selected kitchen scale.
     * @param {Number} quant
     * @returns {Number}
     */
    simulateScaleMeasurement(quant = 0)
    {
        if (Config.getInstance().scaleType != 'barista') {
            if (Config.getInstance().scaleType == 'kitchen')
            {
                /** @type {any} */
                let minWeightStr = document.querySelector('#minimalWeight')?.nodeValue;
                /** @type {any} */
                let corrWeightStr = document.querySelector('#minimalWeightCorrection')?.nodeValue;
                let minWeight = (isNaN(Number(minWeightStr)) ? 3 : parseFloat(minWeightStr)),
                    corrWeight = (isNaN(Number(corrWeightStr)) ? 0 : parseFloat(corrWeightStr));
                quant = (quant < minWeight ? corrWeight : quant);

                quant = Math.round(quant);
            }
        }
        return quant;
    }

    appendSeparator()
    {
        let outputKCal = `***${Math.round(this.dayParts[this.currentDayPart].kcal)}***`;
        outputKCal = ' '.repeat(10 - outputKCal.length) + outputKCal;
        let pattern = this.dayParts[this.currentDayPart].pattern;
        this.foodOutputStr += `${pattern.slice(0, 3) + outputKCal + pattern.slice(13)} ${Math.round(this.dayParts[this.currentDayPart].g)}g  \n`;

        // HTML separator
        let foodKCalStr = printToFixedFloat(this.dayParts[this.currentDayPart].kcal, 1, '0');
        let foodKCalStrFormatted = foodKCalStr.replace(/(..)$/, '<span style="font-size:0.85em;">$1</span>');  // decimal characters are smaller
        let sHtmlSeparator =
            '<tr class="mealRow trSep">' +
                `<td style="text-align:right;" class="preBold kcalSepBg"><u>${foodKCalStrFormatted}</u></td>` +
                `<td style="text-align:right;" class="preBold timeSepBg"></td>` +
                `<td class="preBold foodSepBg"><u>${Math.round(this.dayParts[this.currentDayPart].g)}g ${pattern.slice(14).replaceAll('***', '')}</u></td>` +
            '</tr>';
        /** @type { HTMLTableElement? } */
        let domTableOutBody = document.querySelector('#tableOut>tbody');
        if (domTableOutBody)
        {
            let newRow = domTableOutBody.insertRow();
            newRow.classList.add('mealRow', 'trSep');
            newRow.innerHTML = sHtmlSeparator;
        }

        this.currentDayPart++;
    }

    /**
     * @param {Food} foodPart
     */
    calcFoodKcal(foodPart)
    {
        let foodPartNameLower = foodPart.name?.toLowerCase();
        let foodItems = FoodsDb.getInstance().items;
        for (let i = 0; i < foodItems.length; i++) {
            let dbFood = foodItems[i];
            if (dbFood.name == foodPartNameLower && dbFood.quantityunit == foodPart.quantityunit) {
                let quant = foodPart.quantity;
                if (foodPart.quantityunit === 'g') {
                    quant = this.simulateScaleMeasurement(quant);
                }
                return this.roundKCalMeasurement(quant, dbFood.quantity, dbFood.kcal);
            }
        }

        return 0;
    }

    /**
     *
     * @param {String} kcalStr
     * @param {String?} timestampStr
     * @param {String} foodDetails
     * @returns
     */
    formatFoodData(kcalStr, timestampStr, foodDetails)
    {
        let COL_KCAL_END = 10, COL_TIMESTAMP_END = 19;
        let resultStr = "  |";
        timestampStr = (timestampStr == null) ? "" : timestampStr;
        // Column: kCal
        resultStr += " ".repeat(COL_KCAL_END - kcalStr.length - resultStr.length);
        resultStr += kcalStr + "   |";
        // Column: timeStamp
        resultStr += " ".repeat(COL_TIMESTAMP_END - timestampStr.length - resultStr.length);
        resultStr += timestampStr + "    | ";
        // Column: foodDetails
        resultStr += foodDetails;
        return resultStr;
    }
}

export { MealListLang };
