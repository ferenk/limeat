import { getCurrentMoment, isNumeric, toNumericOrZero, toFixedFloat, printToFixedFloat, isError, copyText2Clipboard } from './util/util.js';
import { nodeXHRComm } from './data/comm.js';
import { processQuantity } from './data/foodsLang.js';
import { FoodsDb } from './data/foodsDb.js';
import { Controller } from './controller.js';
import { TextareaExt } from './views/textareaExt.js';
import { TextareaHighlight } from './views/textareaHighlight.js';
import { OutputTable } from './views/outputTable.js';
import { CountdownButton } from './util/ui/countdownButton.js';

var optScaleType = 'barista';

/** @type { TextareaExt } */
var g_mealsDiaryText = new TextareaExt();
var g_mealsDiaryTextHighlight = new TextareaHighlight();
/** @type { OutputTable } */
var g_outputTable = new OutputTable();
/** @type { Controller } */
var g_controller = new Controller(g_mealsDiaryText, g_mealsDiaryTextHighlight, g_outputTable, processInput);

var g_mobileMode = null;

let g_saveButton = new CountdownButton('#btSave', 'SAVED!', 'SAVE', 3, onSaveButtonPressed, null);

/* Process entered text*/
function processInput()
{
    let foodLines = g_mealsDiaryText.rows;

    let currentSummaryStr = '';
    let currentSummaryKCal = 0;


    for (let iCurrentRow = 0; iCurrentRow < foodLines.length; iCurrentRow++)
    {
        // foodLine: "10:25 apple 10g, banana 20g"
        let foodLine = foodLines[iCurrentRow];

        // print summary
        if (foodLine.startsWith('---'))
        {
            appendSeparator();
            recordHighlightedInput(iCurrentRow, 0, foodLine);
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
        let foodParts = [];
        let foodNamePrefixStr = '';
        let foodPartOrigIdx = 0;
        // foodPartStrs: ["apple 40g", "banana 20g"]
        let foodPartStrs = foodLine.split(',');
        foodPartStrs.forEach(foodPartStr => {
            // foodPartStr: "apple 40g"
            let foodPartArr = foodPartStr.split(/[' ']+/);
            // foodPartArr: ["apple", "40g"]
            let foodName = null,
                foodQuantity = null,
                foodQuantityUnit = null,
                foodKCal = null;
            let newFoodPart = {};

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

                // test if this part is a gram-based quantity
                let foodPartUnitGramCalcStr = foodPartNameStr.replaceAll('g', '').replaceAll('db', '');
                let foodPartNameISQuantity = /^[.*/+-0123456789()]+$/.test(foodPartUnitGramCalcStr);
                let u = '', op;
                if (foodPartNameISQuantity) {
                    try {
                        let foodQuantity = toFixedFloat(eval(foodPartUnitGramCalcStr));
                        newFoodPart.quantity = foodQuantity;
                        // without quantityunit the default is now always 'db' (unit)
                        if (foodPartNameStr.includes('g'))
                            newFoodPart.quantityunit = 'g';
                        else if (foodPartNameStr.includes('db'))
                            newFoodPart.quantityunit = 'db';
                    } catch (e) {
                        console.log(`Error: Invalid input: ${e}`);
                    }
                }
                else {
                    let foodPartNameBEGINSWITHQuantity = /^[.0123456789]+/.test(foodPartNameStr);
                    if (foodPartNameBEGINSWITHQuantity && (foodPartNameStr.endsWith(u = 'kc') || foodPartNameStr.endsWith(u = 'kcal'))) {
                        newFoodPart.kcalunit = 'kcal';
                        newFoodPart.kcal = foodPartNameStr.substring(0, foodPartNameStr.length - u.length);
                    }
                    else if (foodPartNameBEGINSWITHQuantity && (foodPartNameStr.endsWith(u = 'kc/') || foodPartNameStr.endsWith(u = 'kcal/'))) {
                        newFoodPart.kcalunit = 'kcal/100g';
                        newFoodPart.kcal = foodPartNameStr.substring(0, foodPartNameStr.length - u.length);
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
                            }
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
        });

        // print the currently processed food
        let mdFoodOutputLineStr = '',
            htmlfoodOutputLineStr = '';
        let foodKCal = 0, foodG = 0;
        let isFirstPart = true;
        for (let iPart = 0; iPart < foodParts.length; iPart++)
        {
            let foodPart = foodParts[iPart];
            this.foodPartColored = foodPart.origText;
            let partOrigTextColor = 'black';
            if (foodPart.isInvalid != true)
            {
                let partKCal = 0;
                if (foodPart.kcalunit == 'kcal')
                    partKCal = toNumericOrZero(foodPart.kcal);
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

                if (partKCal == 0) {
                    mdFoodOutputLineStr += '<font color="red">';
                    htmlfoodOutputLineStr += '<font color="red">';
                    partOrigTextColor = 'red';
                }
                if (foodPart.kcal != null) {
                    let kcalunitPrinted = foodPart.kcalunit == 'kcal/100g' ? 'kc/' : foodPart.kcalunit;
                    if (foodPart.kcalunit != 'kcal') {
                        mdFoodOutputLineStr += `${foodPart.name.replaceAll('_', ' ')} (${foodPart.quantity}${foodPart.quantityunit}, ${foodPart.kcal}${kcalunitPrinted}, =${Math.round(partKCal)}kc)`;
                        htmlfoodOutputLineStr += `<span style="font-weight:600">${foodPart.name.replaceAll('_', ' ')}</span> (${foodPart.quantity}${foodPart.quantityunit}, ${foodPart.kcal}${kcalunitPrinted}, =${Math.round(partKCal)}kc)`;
                    }
                    else {
                        mdFoodOutputLineStr += `${foodPart.name.replaceAll('_', ' ')} (${foodPart.quantity}${foodPart.quantityunit}, ${foodPart.kcal}${kcalunitPrinted})`;
                        htmlfoodOutputLineStr += `<span style="font-weight:600">${foodPart.name.replaceAll('_', ' ')}</span> (${foodPart.quantity}${foodPart.quantityunit}, ${foodPart.kcal}${kcalunitPrinted})`;
                    }
                }
                else {
                    mdFoodOutputLineStr += `${foodPart.name.replaceAll('_', ' ')} (${foodPart.quantity}${foodPart.quantityunit}, =${Math.round(partKCal)}kc)`;
                    htmlfoodOutputLineStr += `<span style="font-weight:600">${foodPart.name.replaceAll('_', ' ')}</span> (${foodPart.quantity}${foodPart.quantityunit}, =${Math.round(partKCal)}kc)`;
                }
                if (partKCal == 0) {
                    mdFoodOutputLineStr += '</font>';
                    htmlfoodOutputLineStr += '</font>';
                }
                if (foodPart.unprocessed != null) {
                    mdFoodOutputLineStr += ` ***${foodPart.unprocessed}***`;
                    htmlfoodOutputLineStr += ` <font color="#f00000"><b><i>${foodPart.unprocessed}</i></b></font>`;
                    partOrigTextColor = '#f00000';
                }
            }

            // update textbox to have syntax highlighted output
            recordHighlightedInput(iCurrentRow, iPart, foodPart.origText, partOrigTextColor, timestampStr);
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
    $('#lbCurrentKCal').html(`${Math.round(currentSummaryKCal)}kc`);

    // display the result
    $('#divOutput').html('<pre>' + g_controller.foodOutputStr + '</pre>');
}

/**
 * 
 * @param {Number} iRow 
 * @param {Number} iPart 
 * @param {String} htmlText 
 * @param {String?} color
 * @param {String?} timeStamp
 */
function recordHighlightedInput(iRow, iPart, htmlText, color = null, timeStamp = null)
{
    // update textbox to have syntax highlighted input
    if (iPart == 0 && iRow > 0)
        g_controller.foodSourceModifiedOutputStr += '\n';
    if (iPart == 0 && timeStamp != null)
        g_controller.foodSourceModifiedOutputStr += timeStamp + ' ';
    else if (iPart > 0)
        g_controller.foodSourceModifiedOutputStr += ',';

    if (color != null)
        g_controller.foodSourceModifiedOutputStr += `<font color="${color}">${htmlText}</font>`;
    else
        g_controller.foodSourceModifiedOutputStr += htmlText;
}

function roundKCalMeasurement(quant, dbFoodQuant, dbFoodKcal)
{
    return (quant * dbFoodKcal / dbFoodQuant);
}

/**
 * Adjust the measured weight simulating the selected kitchen scale.
 * @param {Number} quant
 */
function simulateScaleMeasurement(quant)
{
    if (optScaleType != 'barista') {
        if (optScaleType == 'kitchen')
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
 * @param {Object} foodPart
 */
function calcFoodKcal(foodPart)
{
    let foodPartNameLower = foodPart.name.toLowerCase();
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
 * @param {ProgressEvent<XMLHttpRequestEventTarget>} ev 
 */
function onCalcDbArrived(xhr, ev)
{
    if (ev.type == 'load') {
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
    nodeXHRComm('node_api/save_foodrowdb', { user: $('#tUser').val(), date: currentDayStr, food_data: preprocessedFoodInputText }, onSaveFinished);
}

/** Countdown functionality for a button (currently specific to the save button) */
function onSaveFinished(xhr, ev)
{
    if (!isError(ev) && ev.type == 'load') {
        console.log(`XHR communication result: ${xhr.responseText}`);
        g_controller.savedFoodInput = g_mealsDiaryText.rowsStr;
        g_saveButton.startCountdown('<span style="color: darkgreen"><b>SAVED!</b></span>', 3);
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
    //if (g_mobileMode || true) {           // mobile layout on browser, too
        $('body').css('margin', '0px');
        let screenScale = document.documentElement.clientWidth / 640;
        $('head').append(`<meta name="viewport" content="width=640px">`);
        $('body div').css('padding', '1em');
    }
    else
        $('body').css('width', '640px');
}

function onPageLoaded()
{
    if (window.localStorage != null) {
        if (window.localStorage.currentUser != null) {
            $('#tUser').val(window.localStorage.currentUser);
        }
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
    $('#tUser').on('input', g_controller.onUserOrDateChanged);
    //$('#tDate').on('input', onUserOrDateChanged);
    $('#btDateUp').on('click', () => g_controller.onPrevNextDay(false));
    $('#btDateDown').on('click', () => g_controller.onPrevNextDay(true));
    $('#btNextMeal').on('click', () => g_controller.onPrevNextMeal(true));
    $('#btPrevMeal').on('click', () => g_controller.onPrevNextMeal(false));
    $('#btAddMeal').on('click', () => g_controller.onAddMeal());

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
        optScaleType = ($('#optScaleType :selected').val());
        $('.scaleOpts').toggle(optScaleType != 'barista');
        g_controller.onFoodInputChanged();
    });
    $('.scaleOpts').hide();

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
}

window.addEventListener("load", onPageLoaded);
