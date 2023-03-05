import { getCurrentMoment, printMoment, toNumericOrZero, toFixedFloat, printToFixedFloat, safeEval } from '../util/util.mjs';
import { TextContainer } from '../util/text/textContainers.mjs';

import { Config } from '../app/config.mjs'

import { Food } from './foodData.mjs';
import { FoodsDb } from './foodsDb.mjs';
import { processQuantity } from './foodsLang.mjs';

import { TextareaExt } from '../views/textareaExt.mjs';
import { TextareaHighlight } from '../views/textareaHighlight.mjs';

export { MealListLang };

class MealListLang
{
    dayParts =
    [{ pattern: '  |          |***(reggeli,tízórai)***', kcal: 0, g:0 },
     { pattern: '  |          |***(ebéd,uzsonna)***', kcal:0, g:0 },
     { pattern: '  |          |***(vacsora,nasik)***', kcal:0, g:0 },
     { pattern: '  |          |', kcal: 0, g: 0 }];
    mdHeader = '  | kCal     |  Idő    | Kaja típusa  \n  | -------- | ------- | -----------  \n';

    /* Output text generation */
    /** @type { Number } */
    currentDayPart = 0;
    /** @type { String } */
    foodOutputStr = '';
    /** @type { String[] } */
    foodSourceModifiedOutput = [];


    /**
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

    /**
     * @param { TextContainer ?} logText 
     */
    processInput(logText)
    {
        if (!logText)
            logText = this.mealLogText;

        let currentSummaryStr = '';
        let currentSummaryKCal = 0;
        /** @type Map<string, (Number|undefined)[]> */
        let lastFoodAmounts = new Map();

        this.mealLogHighlight.htmlBuffer.clear();

        for (let iCurrentRow = 0; iCurrentRow < (logText?.getRowCount() || 0); iCurrentRow++)
        {
            // foodLine: "10:25 apple 10g, banana 20g"
            let foodLine = logText?.getRow(iCurrentRow) || '';

            // print summary
            if (foodLine.startsWith('---'))
            {
                this.appendSeparator();
                this.recordHighlightedInput(iCurrentRow, 0, 0, foodLine);
                continue;
            }

            // parse time stamp (@ beginning of the string)
            let timeSepCol = 0, timestampStr = null;
            if (foodLine.length > 5 && ((foodLine[1] == ':' && foodLine[timeSepCol = 4] == ' ') || (foodLine[2] == ':' && foodLine[timeSepCol = 5] == ' ')))
            {
                timestampStr = foodLine.substring(0, timeSepCol);
                foodLine = foodLine.substring(timeSepCol + 1);
            }
            else
                timeSepCol = 0;

            // parse food (name, quantity, unit)
            /** @type {Food[]} */
            let foodParts = [];
            let foodNamePrefixStr = '';
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

                for (let j = 0; j < foodPartArr.length; j++)
                {
                    let foodPartNameStrRaw = foodPartArr[j];
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
                        foodNamePrefixStr = `___${foodPartNameStr.replaceAll('_', ' ')}___ `;
                        continue;
                    }

                    // test if this part is a quantity
                    let unit = '', units = [ 'g', 'db', 'kc', 'kcal', 'kc/', 'kcal/' ], quantity = NaN;
                    for (let unitsIdx = 0; unitsIdx < units.length; unitsIdx++)
                    {
                        if (foodPartNameStr.endsWith(units[unitsIdx]))
                        {
                            unit = units[unitsIdx];
                            let foodPartNameWOUnitStr = foodPartNameStr.replaceAll(unit, '');
                            console.log(`foodPartNameWOUnitStr: "${foodPartNameWOUnitStr}"`);
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
                        if (unit == 'g' || unit == 'db')
                        {
                            newFoodPart.quantity = quantity;
                            if (unit == 'g')
                                newFoodPart.quantityunit = 'g';
                            //? without quantityunit the default is now always 'db' (unit)
                            else if (unit == 'db')
                                newFoodPart.quantityunit = 'db';
                        }
                        else if (unit == 'kc' || unit == 'kcal')
                        {
                            newFoodPart.kcalunit = 'kcal';
                            newFoodPart.kcal = quantity;
                        }
                        else if (unit == 'kc/' || unit == 'kcal/')
                        {
                            newFoodPart.kcalunit = 'kcal/100g';
                            newFoodPart.kcal = quantity;
                        }
                    }
                    else {
                        if (!processQuantity(foodPartNameStr, newFoodPart))
                        {
                            if (newFoodPart.name == null)
                                newFoodPart.name = foodPartNameStr;
                            else {
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
                if (newFoodPart.name != null && newFoodPart.name != '') {
                    if (newFoodPart.quantity == null)
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
                    let kcalPerGrams = undefined;
                    if (newFoodPart.kcalunit == 'kcal/100g')
                        kcalPerGrams = newFoodPart.kcal;
                    lastFoodAmounts.set(newFoodPart.name, [ newFoodPart.leftoverQuantity, kcalPerGrams ] );
                }

                foodParts.push(newFoodPart);
            }

            // print the currently processed food
            let mdFoodOutputLineStr = '',
                htmlfoodOutputLineStr = '';
            let foodKCal = 0, foodG = 0;
            for (let iPart = 0; iPart < foodParts.length; iPart++)
            {
                let foodPart = foodParts[iPart];
                this.foodPartColored = foodPart.origText;
                let partOrigTextColor = 'black';
                if (foodPart.isInvalid != true)
                {
                    let partKCal = 0;
                    if (foodPart.kcalunit == 'kcal')
                        partKCal = toNumericOrZero(foodPart.kcal ?? 0);
                    if (partKCal == 0) {
                        if (foodPart.kcalunit == 'kcal/100g' && foodPart.quantityunit == 'g') {
                            let quant = this.simulateScaleMeasurement(foodPart.quantity);
                            partKCal = (toNumericOrZero(this.roundKCalMeasurement(quant, 100, foodPart.kcal)));
                        }
                    }
                    if (partKCal == 0)
                        partKCal = this.calcFoodKcal(foodPart);
                    foodKCal += toFixedFloat(partKCal);
                    if (foodPart.quantityunit == 'g')
                        foodG += toFixedFloat(foodPart.quantity);

                    // add new row after labels
                    if (mdFoodOutputLineStr.length > 0) {
                        mdFoodOutputLineStr += '  \n  |          |         | ';
                        htmlfoodOutputLineStr += '\n';
                    }
                    // indent when adding multiple food parts
                    if (foodNamePrefixStr != null && foodNamePrefixStr.length > 0) {
                        if (iPart == 0)
                            mdFoodOutputLineStr += '  \n  |          |         | * ';
                        else
                            mdFoodOutputLineStr += '* ';

                        htmlfoodOutputLineStr += '  ';
                    }

                    foodPart.computedkcal = partKCal;

                    if (partKCal == 0) {
                        mdFoodOutputLineStr += '<font color="red">';
                        htmlfoodOutputLineStr += '<font color="red">';
                        partOrigTextColor = 'red';
                    }

                    // update textbox to have syntax highlighted output
                    let sectionName = this.recordHighlightedInput(iCurrentRow, iPart, foodPart.startTextCol || 0, foodPart.origText, partOrigTextColor, { foodPart: foodPart }, timestampStr);
                    foodPart.highlighterClass = (sectionName ? `class=${sectionName}` : '');

                    if (foodPart && foodPart.name)
                    {
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

                    if (partKCal == 0) {
                        mdFoodOutputLineStr += '</font>';
                        htmlfoodOutputLineStr += '</font>';
                    }
                    if (foodPart.unprocessed != null) {
                        mdFoodOutputLineStr += ` ***${foodPart.unprocessed}***`;
                        htmlfoodOutputLineStr += ` <font ${foodPart.highlighterClass} color="#f00000"><b><i>${foodPart.unprocessed}</i></b></font>`;
                    }
                }
            }

            this.dayParts[this.currentDayPart].kcal += foodKCal;
            this.dayParts[this.currentDayPart].g += foodG;
            let foodKCalStr = printToFixedFloat(foodKCal, 1, true);

            // update the 'current line' field
            let currentOutputLine = this.formatFoodData(foodKCalStr, timestampStr, foodNamePrefixStr + mdFoodOutputLineStr) + '  \n';

            // append this line to the table output
            let foodKCalStrFormatted = foodKCalStr.replace(/(..)$/, '<span style="font-size:0.85em;">$1</span>');  // decimal characters are smaller
            // calculate prefix
            foodNamePrefixStr = foodNamePrefixStr || '';
            if (foodNamePrefixStr.length > 0)
            {
                foodNamePrefixStr = foodNamePrefixStr.replaceAll('___', '').replaceAll(/ $/g, '');
                foodNamePrefixStr = `<u><b>${foodNamePrefixStr}</b></u>`;
                foodNamePrefixStr += ` (${printToFixedFloat(foodG, 1, true)}g, ${printToFixedFloat(foodKCal/(foodG/100), 1, true)}kc/)\n`
            }
            foodNamePrefixStr = !foodNamePrefixStr ? '' : foodNamePrefixStr.replaceAll('___', ''); 
            let currTableRowStr =
                `<tr id="tr${iCurrentRow}" class="mealRow">` +
                `<td style="text-align:right;" class="preBold kcalBg effectSmallerLast" value="${toFixedFloat(foodKCal, 1)}">${foodKCalStrFormatted}</td>` +
                `<td style="text-align:right; font-size:0.85em;" class="preBold timeBg">${timestampStr?timestampStr:''}</td>` +
                `<td class="preReg">${foodNamePrefixStr + htmlfoodOutputLineStr}</td></tr>`;
            if (this.mealLogText)
            {
                if (this.mealLogText.mealLineFirst == -1)
                    this.mealLogText.mealLineFirst = iCurrentRow;
                this.mealLogText.mealLineLast = iCurrentRow;
            }

            /** @type { HTMLTableElement? } */
            let domTableOutBody = document.querySelector('#tableOut>tbody');
            if (domTableOutBody)
            {
                let newRow = domTableOutBody.insertRow();
                newRow.outerHTML = currTableRowStr;
            }

            // append this line to the main output (and optionally to the summary text)
            this.foodOutputStr += currentOutputLine;
            if (this.mealLogText && iCurrentRow == this.mealLogText.cursorPos[1]) {
                currentSummaryStr += foodNamePrefixStr + htmlfoodOutputLineStr;
                currentSummaryKCal = foodKCal;
            }
        }

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
        MealListLang.domSetHtml('#lbCurrentLineKCal', `${Math.round(currentSummaryKCal)}kc`);

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
     * 
     * @param {Number} iRow 
     * @param {Number} _iPart 
     * @param {Number} iCol
     * @param {String} currPartHtmlText 
     * @param {String?} color
     * @param {{ foodPart: Object }? } metadata
     * @param {String?} _timeStamp
     */
    recordHighlightedInput(iRow, _iPart, iCol, currPartHtmlText, color = null, metadata = null, _timeStamp = null)
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
        let foodKCalStr = printToFixedFloat(this.dayParts[this.currentDayPart].kcal, 1, true);
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
                if (foodPart.quantityunit == 'g') {
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
        let resultStr = "  |"
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

