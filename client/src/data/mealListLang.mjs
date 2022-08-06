import { getCurrentMoment, toNumericOrZero, toFixedFloat, printToFixedFloat, isError, copyText2Clipboard } from './util/util.mjs';
import { nodeXHRComm } from './data/comm.mjs';
import { processQuantity } from './data/foodsLang.mjs';
import { FoodsDb } from './data/foodsDb.mjs';
import { Controller } from './controller.mjs';
import { TextareaExt } from './views/textareaExt.mjs';
import { TextareaHighlight } from './views/textareaHighlight.mjs';
import { OutputTable } from './views/outputTable.mjs';
import { traceMethodCalls } from './util/callTracker.mjs'
import { CountdownButton } from './util/ui/countdownButton.mjs';

import { SSEClient } from './net/sseClient.mjs';

import { coolConfirm, coolMessage } from './views/uiHelper.mjs';

var g_config =
{
    scaleType: 'barista',
    clientId: window.localStorage.optClientId || 'myPC/Phone',
    finalClientId: window.localStorage.optClientId || 'myPC/Phone'
};

/** @type { TextareaExt } */
// @ts-ignore:next-line (Type '{}' is missing the following properties from type 'TextareExt'... (Proxy type problem))
var g_mealsDiaryText = traceMethodCalls(new TextareaExt(), false);

/** @type { TextareaHighlight } */
// @ts-ignore:next-line (Type '{}' is missing the following properties from type 'TextareaHighlight'... (Proxy type problem))
var g_mealsDiaryTextHighlight = traceMethodCalls(new TextareaHighlight(g_mealsDiaryText), false);

/** @type { OutputTable } */
// @ts-ignore:next-line (Type '{}' is missing the following properties from type 'OutputTable'... (Proxy type problem))
var g_outputTable = traceMethodCalls(new OutputTable(), false);

/** @type { Controller } */
// @ts-ignore:next-line (Type '{}' is missing the following properties from type 'Controller'... (Proxy type problem))
var g_controller = traceMethodCalls(new Controller(g_mealsDiaryText, g_mealsDiaryTextHighlight, g_outputTable, processInput), false);

var g_mobileMode = null;

let g_saveButton = new CountdownButton('#btSave', 'SAVED!', 'SAVE', 3, onSaveButtonPressed, null);

let g_sseClient = new SSEClient(g_config);

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
}

/* Process entered text*/
function processInput()
{
    let foodLines = g_mealsDiaryText.rows;

    let currentSummaryStr = '';
    let currentSummaryKCal = 0;

    g_mealsDiaryTextHighlight.tempHtmlBuffer.clear();


    for (let iCurrentRow = 0; iCurrentRow < foodLines.length; iCurrentRow++)
    {
        // foodLine: "10:25 apple 10g, banana 20g"
        let foodLine = foodLines[iCurrentRow];

        // print summary
        if (foodLine.startsWith('---'))
        {
            appendSeparator();
            recordHighlightedInput(iCurrentRow, 0, 0, foodLine);
            continue;
        }

        // parse time stamp (@ beginning of the string)
        let timeSepCol = 0, timestampStr = null;
        if (foodLine.length > 5 && ((foodLine[1] == ':' && foodLine[timeSepCol = 4] == ' ') || (foodLine[2] == ':' && foodLine[timeSepCol = 5] == ' ')))
        {
            timestampStr = foodLine.substring(0, timeSepCol);
            foodLine = foodLine.substring(timeSepCol + 1);
        }

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
                        if (/^[.*/+-0123456789()]+$/.test(foodPartNameWOUnitStr))
                            quantity = toFixedFloat(eval(foodPartNameWOUnitStr));
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
                        let quant = simulateScaleMeasurement(foodPart.quantity);
                        partKCal = (toNumericOrZero(roundKCalMeasurement(quant, 100, foodPart.kcal)));
                    }
                }
                if (partKCal == 0)
                    partKCal = calcFoodKcal(foodPart);
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
                let sectionName = recordHighlightedInput(iCurrentRow, iPart, foodPart.startTextCol, foodPart.origText, partOrigTextColor, { foodPart: foodPart }, timestampStr);
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

        g_controller.dayParts[g_controller.currentDayPart].kcal += foodKCal;
        g_controller.dayParts[g_controller.currentDayPart].g += foodG;
        let foodKCalStr = printToFixedFloat(foodKCal, 1, true);

        // update the 'current line' field
        let currentOutputLine = formatFoodData(foodKCalStr, timestampStr, foodNamePrefixStr + mdFoodOutputLineStr) + '  \n';

        // append this line to the table output
        let foodKCalStrFormatted = foodKCalStr.replace(/(..)$/, '<span style="font-size:0.85em;">$1</span>');  // decimal characters are smaller
        // calculate prefix
        foodNamePrefixStr ??= '';
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
        if (g_mealsDiaryText.mealLineFirst == -1)
            g_mealsDiaryText.mealLineFirst = iCurrentRow;
        g_mealsDiaryText.mealLineLast = iCurrentRow;
        $('#tableOut tr:last').after(currTableRowStr);

        // append this line to the main output (and optionally to the summary text)
        g_controller.foodOutputStr += currentOutputLine;
        if (iCurrentRow == g_mealsDiaryText.cursorPos[1]) {
            currentSummaryStr += foodNamePrefixStr + htmlfoodOutputLineStr;
            currentSummaryKCal = foodKCal;
        }
    }

    // add the last separators...
    while(g_controller.currentDayPart < g_controller.dayParts.length -1)
        appendSeparator();
    // ...and add the summary (same appendSeparator() is used as before)
    if (g_controller.currentDayPart == g_controller.dayParts.length -1) {
        let allKCal = 0;
        let allG = 0;
        for (let i = 0; i < g_controller.dayParts.length; i++) {
            allKCal += g_controller.dayParts[i].kcal;
            allG += g_controller.dayParts[i].g;
        }
        g_controller.dayParts[g_controller.currentDayPart].kcal = allKCal;
        g_controller.dayParts[g_controller.currentDayPart].g = allG;
        appendSeparator();
    }

    $('#tCurrentLine').html(`${currentSummaryStr}`);
    $('#lbCurrentAllKCal').html(`<b>${Math.round(g_controller.dayParts[g_controller.currentDayPart - 1].kcal)}kc</b>`);
    $('#lbCurrentLineKCal').html(`${Math.round(currentSummaryKCal)}kc`);

    // display the result
    $('#divOutput').html('<pre>' + g_controller.foodOutputStr + '</pre>');
}

/**
 * 
 * @param {Number} iRow 
 * @param {Number} iPart 
 * @param {String} currPartHtmlText 
 * @param {String?} color
 * @param {Object?} metadata
 * @param {String?} timeStamp
 */
function recordHighlightedInput(iRow, iPart, iCol, currPartHtmlText, color = null, metadata = null, timeStamp = null)
{
    // add prefix
    let currPartBeginStr = ''
    //if (iPart == 0 && timeStamp != null)
        //currPartBeginStr += timeStamp + ' ';
    //else if (iPart > 0)
        //currPartBeginStr += ',';

    //g_mealsDiaryTextHighlight.tempHtmlBuffer.appendToLine(iRow, iCol, currPartBeginStr);

    // colorize this part, if needed
    if (color != null)
        currPartHtmlText = `<font color="${color}">${currPartHtmlText}</font>`;

    let sectionName = g_mealsDiaryTextHighlight.tempHtmlBuffer.appendToLine(iRow, iCol, currPartHtmlText, metadata, true);

    return sectionName;
}

/**
 * 
 * @param {Number} quant 
 * @param {Number} dbFoodQuant 
 * @param {Number} dbFoodKcal 
 * @returns 
 */
function roundKCalMeasurement(quant = 0, dbFoodQuant = 1, dbFoodKcal = 0)
{
    return (quant * dbFoodKcal / dbFoodQuant);
}

/**
 * Adjust the measured weight simulating the selected kitchen scale.
 * @param {Number} quant
 * @returns {Number}
 */
function simulateScaleMeasurement(quant = 0)
{
    if (g_config.scaleType != 'barista') {
        if (g_config.scaleType == 'kitchen')
        {
            /** @type {any} */
            let minWeightStr = $('#minimalWeight').val();
            /** @type {any} */
            let corrWeightStr = $('#minimalWeightCorrection').val();
            let minWeight = (isNaN(Number(minWeightStr)) ? 3 : parseFloat(minWeightStr)), 
                corrWeight = (isNaN(Number(corrWeightStr)) ? 0 : parseFloat(corrWeightStr)); 
            quant = (quant < minWeight ? corrWeight : quant);

            quant = Math.round(quant);
        }
    }
    return quant;
}

function appendSeparator() {
    let outputKCal = `***${Math.round(g_controller.dayParts[g_controller.currentDayPart].kcal)}***`;
    outputKCal = ' '.repeat(10 - outputKCal.length) + outputKCal;
    let pattern = g_controller.dayParts[g_controller.currentDayPart].pattern;
    g_controller.foodOutputStr += `${pattern.slice(0, 3) + outputKCal + pattern.slice(13)} ${Math.round(g_controller.dayParts[g_controller.currentDayPart].g)}g  \n`;

    // HTML separator
    let foodKCalStr = printToFixedFloat(g_controller.dayParts[g_controller.currentDayPart].kcal, 1, true);
    let foodKCalStrFormatted = foodKCalStr.replace(/(..)$/, '<span style="font-size:0.85em;">$1</span>');  // decimal characters are smaller
    let sHtmlSeparator =
        '<tr class="mealRow trSep">' +
            `<td style="text-align:right;" class="preBold kcalSepBg"><u>${foodKCalStrFormatted}</u></td>` +
            `<td style="text-align:right;" class="preBold timeSepBg"></td>` +
            `<td class="preBold foodSepBg"><u>${Math.round(g_controller.dayParts[g_controller.currentDayPart].g)}g ${pattern.slice(14).replaceAll('***', '')}</u></td>` +
        '</tr>';
    $('#tableOut tr:last').after(sHtmlSeparator);

    g_controller.currentDayPart++;
}

/**
 * @param {Food} foodPart
 */
function calcFoodKcal(foodPart)
{
    let foodPartNameLower = foodPart.name?.toLowerCase();
    let foodItems = FoodsDb.getInstance().items;
    for (let i = 0; i < foodItems.length; i++) {
        let dbFood = foodItems[i];
        if (dbFood.name == foodPartNameLower && dbFood.quantityunit == foodPart.quantityunit) {
            let quant = foodPart.quantity;
            if (foodPart.quantityunit == 'g') {
                quant = simulateScaleMeasurement(quant);
            }
            return roundKCalMeasurement(quant, dbFood.quantity, dbFood.kcal);
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
function formatFoodData(kcalStr, timestampStr, foodDetails)
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

/**
 * Communication
 * @param {XMLHttpRequest} xhr 
 * @param {ProgressEvent<XMLHttpRequestEventTarget> | Error} ev 
 */
function onCalcDbArrived(xhr, ev)
{
    // @ts-ignore:next-line (dynamic type check)
    if (!isError(ev) && ev.type == 'load') {
        let content = xhr.responseText;
        FoodsDb.getInstance().processDbFile(content);
        g_controller.onUserOrDateChanged();
        g_controller.onFoodInputChanged();
    }
}

/**
 * EVENT: Save button clicked or ctrl-s pressed
 */
function onSaveButtonPressed()
{
    $('#btSave').html('SAVING...');
    // save current day's food text to the DB
    let currentDayStr = g_controller.currentDayMoment.format('YYYY-MM-DD');
    // pre-process the current kcal data to be saved (all edit buffer)
    g_mealsDiaryText.updateRowsStr();
    let preprocessedFoodInputText = g_mealsDiaryText.rowsStr.replaceAll('\n', '\\n')
    nodeXHRComm('node_api/save_foodrowdb',
        {
            user: $('#tUser').val(),
            date: currentDayStr,
            food_data: preprocessedFoodInputText,
            clientId: g_config.finalClientId
        }, onSaveFinished);
}

/**
 * Countdown functionality for a button (currently specific to the save button)
 * @param {XMLHttpRequest} xhr 
 * @param {ProgressEvent<XMLHttpRequestEventTarget> | Error} ev 
 */
function onSaveFinished(xhr, ev)
{
    // @ts-ignore:next-line (dynamic type check)
    if (!isError(ev) && ev.type == 'load') {
        console.log(`XHR communication result: ${xhr.responseText}`);
        g_controller.savedFoodInput = g_mealsDiaryText.rowsStr;
        g_controller.savedFoodDate = new Date();
        g_saveButton.startCountdown('<span style="color: darkgreen"><b>SAVED!</b></span>', 3);
    // @ts-ignore:next-line (dynamic type check)
    } else if (isError(ev) || ev.type == 'error') {
        g_saveButton.startCountdown('<span style="color: darkred"><b>ERROR!</b></span>', 8);
        $('#lSaveErrorMsg').html('ERROR: Unable to access server and to save data!').slideDown().delay(7800).slideUp();
    }
}

function handleMobileMode() {
    // @ts-ignore:next-line (Cannot find name 'MobileDetect')
    let md = new MobileDetect(window.navigator.userAgent);
    g_mobileMode = md.mobile() != null;
    if (g_mobileMode) {
        //if (g_mobileMode || true) {           // use mobile layout on browser, too
        $('html').css('max-width', '56em');
        $('body').css('width', '100%');
        $('body').css('margin', '0px');
        $('body > div').css('padding', '1em');
        $('#tableOut').css('font-size', '110%');
    }
    else {
        $('body').css('width', '640px');
        $('.header').css('width', '616px');
    }
}

function sseStateUpdateCB(status)
{
    console.log(`SSE state changed: ${status}`);
    if (status == 'OPENED')
        document.getElementById('lbStatusLED').style.color = 'olivedrab';
    else if (status == 'CLOSED' || status == 'DISCONNECTED')
        document.getElementById('lbStatusLED').style.color = 'darkred';
    else if (status == 'CLOSED' || status == 'CONNECTING')
        document.getElementById('lbStatusLED').style.color = 'gold';
    else
        document.getElementById('lbStatusLED').style.color = 'slategray';
}

async function onPageLoaded()
{
    if (window.localStorage != null) {
        if (window.localStorage.optUserName != null) {
            $('#tUser').val(window.localStorage.optUserName);
        }
        $('#optClientId').val(g_config.clientId);
    }

    g_mealsDiaryText.initialize('#txtMealsDiary');
    g_mealsDiaryTextHighlight.initialize('#txtMealsDiary');

    g_outputTable.initialize('#tableOut');
    g_mealsDiaryText.on('input', g_controller.onFoodInputChanged.bind(g_controller));
    g_mealsDiaryText.on('cursor', g_controller.onCursorMoved.bind(g_controller));

    // TODO: from settings: 1. threshold time 2. use current date or the previously saved one 3. add day of week postfix 4. date format 5. weekday abbreviation
    g_controller.currentDayMoment = getCurrentMoment('04:00');
    g_controller.onUserOrDateChanged();
    $('#lSaveErrorMsg').hide();

    // initiate DB reload
    nodeXHRComm("node_api/read_calcdb", null, onCalcDbArrived);
    $('#tUser').on('input', () => g_controller.onUserOrDateChanged());
    //$('#tDate').on('input', onUserOrDateChanged);
    $('#btDateUp').on('click', () => g_controller.onPrevNextDay(false));
    $('#btDateDown').on('click', () => g_controller.onPrevNextDay(true));
    $('#btNextMeal').on('click', () => g_controller.onPrevNextMeal(true));
    $('#btPrevMeal').on('click', () => g_controller.onPrevNextMeal(false));
    $('#btAddMeal').on('click', () => g_controller.onAddMeal());

    $('input[type=radio][name=txtMealsModes]').change((e) => {
        // memo: How to get the current value of the radio button
        let selectedMode = ($(e.target).attr('id') ?? '').replace(/^txtMeals/, '').replace(/Mode$/, '');
        g_mealsDiaryText.onDisplayModeChanged(selectedMode.toLowerCase());
        g_mealsDiaryTextHighlight.onDisplayModeChanged(selectedMode.toLowerCase());
    });


    /** Developer options: Section, controls, experimental features */
    $('#optsDevSection').hide();
    $('#devMode').change( function(){
        //? $('#devMode').detach().appendTo('#optsDev');
        // @ts-ignore:next-line (Property name 'checked' does not exist on type 'HTMLInputElement')
        if (this.checked)
            $('#optsDevSection').slideDown(150);
        else
            $('#optsDevSection').slideUp(100);
    });

    $('#optScaleType,.scaleOpts').change(() => {
        // @ts-ignore:next-line (<multiple types> cannot set to 'string')
        g_config.scaleType = ($('#optScaleType :selected').val());
        $('.scaleOpts').toggle(g_config.scaleType != 'barista');
        g_controller.onFoodInputChanged();
    });
    $('.scaleOpts').hide();

    $('#btApplySettings').on('click', () =>
    {
        localStorage.optClientId = g_config.finalClientId = g_config.clientId = $('#optClientId').val();
        g_sseClient.init(g_controller.refreshDayFoods.bind(g_controller), sseStateUpdateCB, console.log);
        coolMessage('success', 'Changes applied', 'Changes have been applied and saved!');
    });

    $('#devModeOutputs').change(function(){
        //? $('#devMode').detach().appendTo('#optsDev');
        // @ts-ignore:next-line (Property name 'checked' does not exist on type 'HTMLInputElement')
        if (this.checked)
            $('#devOutputs').slideDown(150);
        else
            $('#devOutputs').slideUp(100);
    });
    $('#devOutputs').hide();

    /** Button, feature: Export MD output to the clipboard */
    $('#btCopyMD').on('click', () => { 
        copyText2Clipboard(g_controller.foodOutputStr);
    });

    // shortcuts (only ctrl-s is supported by now)
    $(window).keydown(function (event) {
        if (event.ctrlKey && event.keyCode == 83) {
            console.log('Event: ctrl-S has been pressed');
            event.preventDefault();
            onSaveButtonPressed();
        }
    });

    // @ts-ignore:next-line (callback is not assignable)
    $('#tableOut').click(g_controller.onTableRowChange.bind(g_controller));

    handleMobileMode();

    sseStateUpdateCB(null);
    g_sseClient.init(g_controller.refreshDayFoods.bind(g_controller), sseStateUpdateCB, console.log);
}

window.addEventListener("load", onPageLoaded);
