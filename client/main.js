var optScaleType = 'barista';

/** @type { TextAreaExt } */
var g_mealsDiaryText = null;

function isNumeric(str) {
    if (typeof str != "string")
        return false;
    return !isNaN(str) && !isNaN(parseFloat(str));
}

function toNumericOrZero(str)
{
    try {
        let retVal = toFixedFloat(str);
        if (isNaN(retVal))
            retVal = 0;
        return retVal;
    }
    catch {
        return 0;
    }
}

function toFixedFloat(num, decimals) {
    if (decimals == null)
        decimals = 1;
    let realNum = num;
    if (typeof (num) == 'string')
        realNum = parseFloat(num);
    let decimalPower = Math.pow(10, decimals);
    //debug console.log(`decimalPower: ${decimalPower}`);
    return Math.round(realNum * decimalPower) / decimalPower;
}

function printToFixedFloat(num, decimals, padDecimals) {
    if (decimals == null)
        decimals = 0;
    let numStr = toFixedFloat(num, decimals).toString();
    if (padDecimals == true) {
        let decimalPointPos = numStr.search('\\.');
        let paddingNeeded = (decimalPointPos >= 0 ? (numStr.length - decimalPointPos - 1) - decimals : decimals + 1);
        //debug console.log(`numStr: ${numStr}, decimals: ${decimals}, paddingNeeded: ${paddingNeeded}, decimalpointpos: ${decimalPointPos}`);
        numStr += ' '.repeat(paddingNeeded);
    }
    return numStr;
}

let dayParts =
    [{ pattern: '  |          |***(reggeli,tízórai)***', kcal: 0, g:0 },
     { pattern: '  |          |***(ebéd,uzsonna)***', kcal:0, g:0 },
     { pattern: '  |          |***(vacsora,nasik)***', kcal:0, g:0 },
     { pattern: '  |          |', kcal:0, g:0 }];
let mdHeader = '  | kCal     |  Idő    | Kaja típusa  \n  | -------- | ------- | -----------  \n';

let currentDayMoment = null;
let currentDayPart;
let foodOutputStr;
var g_mobileMode = null;
var g_savedFoodInput = null;

function initCounters()
{
    for (let i = 0; i < dayParts.length; i++) {
        dayParts[i].kcal = 0;
        dayParts[i].g = 0;
    }
    currentDayPart = 0;
    foodOutputStr = `### ${printMoment(currentDayMoment).slice(8)}  \n` + mdHeader;
    $('.mealRow').remove();
}

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
            let newFoodPart = { };

            for (let j = 0; j < foodPartArr.length; j++)
            {
                let foodPartNameStrRaw = foodPartArr[j];
                // foodPartNameStr: first run: "apple" (or a label: "fish_n_chips:") second run: "40g"
                let foodPartNameStr = foodPartNameStrRaw.trim();

                // Skip empty strings. They are not 'parts'. Wrong input, effect of String.split() - duplicate separators result empty values, e.g '40g  apple'.
                if (foodPartNameStr.length == 0)
                    continue;

                // handling labels (e.g "fish_n_chips:")
                if (foodPartNameStr.endsWith(':'))
                {
                    foodNamePrefixStr = `___${foodPartNameStr.replaceAll('_', ' ')}___ `;
                    continue;
                }

                // test if this part is a gram-based quantity
                let foodPartUnitGramCalcStr = foodPartNameStr.replaceAll('g', '').replaceAll('db', '');
                let foodPartNameISQuantity = /^[.*/+-0123456789()]+$/.test(foodPartUnitGramCalcStr);
                let u = 0, op;
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
                foodParts.push(newFoodPart);
            }
        });

        // print the currently processed food
        if (foodParts.length > 0) {
            let mdFoodOutputLineStr = '',
                htmlfoodOutputLineStr = '';
            let foodKCal = 0, foodG = 0;
            let firstRow = true;
            foodParts.forEach(foodPart => {
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
                    if (firstRow)
                        mdFoodOutputLineStr += '  \n  |          |         | * ';
                    else
                        mdFoodOutputLineStr += '* ';

                    htmlfoodOutputLineStr += '  ';
                }
                firstRow = false;

                if (partKCal == 0) {
                    mdFoodOutputLineStr += '<font color="red">';
                    htmlfoodOutputLineStr += '<font color="red">';
                }
                if (foodPart.kcal != null) {
                    if (foodPart.kcalunit != 'kcal') {
                        mdFoodOutputLineStr += `${foodPart.name.replaceAll('_', ' ')} (${foodPart.quantity}${foodPart.quantityunit}, ${foodPart.kcal}${foodPart.kcalunit}, =${Math.round(partKCal)}kc)`;
                        htmlfoodOutputLineStr += `<span style="font-weight:600">${foodPart.name.replaceAll('_', ' ')}</span> (${foodPart.quantity}${foodPart.quantityunit}, ${foodPart.kcal}${foodPart.kcalunit}, =${Math.round(partKCal)}kc)`;
                    }
                    else {
                        mdFoodOutputLineStr += `${foodPart.name.replaceAll('_', ' ')} (${foodPart.quantity}${foodPart.quantityunit}, ${foodPart.kcal}${foodPart.kcalunit})`;
                        htmlfoodOutputLineStr += `<span style="font-weight:600">${foodPart.name.replaceAll('_', ' ')}</span> (${foodPart.quantity}${foodPart.quantityunit}, ${foodPart.kcal}${foodPart.kcalunit})`;
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
                }
            });

            dayParts[currentDayPart].kcal += foodKCal;
            dayParts[currentDayPart].g += foodG;
            let foodKCalStr = printToFixedFloat(foodKCal, 1, true);

            // update the 'current line' field
            let currentOutputLine = formatFoodData(foodKCalStr, timestampStr, foodNamePrefixStr + mdFoodOutputLineStr) + '  \n';

            // append this line to the table output
            let foodKCalStrFormatted = foodKCalStr.replace(/(..)$/, '<span style="font-size:0.85em;">$1</span>');  // decimal characters are smaller
            let currTableRowStr =
                `<tr id="tr${iCurrentRow}" class="mealRow">` +
                `<td style="text-align:right;" class="preBold kcalBg effectSmallerLast" value="${toFixedFloat(foodKCal, 1)}">${foodKCalStrFormatted}</td>` +
                `<td style="text-align:right; font-size:0.85em;" class="preBold timeBg">${timestampStr?timestampStr:''}</td>` +
                `<td class="preReg">${(foodNamePrefixStr ? `<u><b>${foodNamePrefixStr.replaceAll('___', '')}</b></u>\n` : '') + htmlfoodOutputLineStr}</td></tr>`;
            if (g_mealsDiaryText.mealLineFirst == -1)
                g_mealsDiaryText.mealLineFirst = iCurrentRow;
            g_mealsDiaryText.mealLineLast = iCurrentRow;
            $('#tableOut tr:last').after(currTableRowStr);

            // append this line to the main output (and optionally to the summary text)
            foodOutputStr += currentOutputLine;
            if (iCurrentRow == g_mealsDiaryText.cursorPos[1]) {
                currentSummaryStr += foodNamePrefixStr + htmlfoodOutputLineStr;
                currentSummaryKCal = foodKCal;
            }
        }
    }

    // add the last separators...
    while(currentDayPart < dayParts.length -1)
        appendSeparator();
    // ...and add the summary (same appendSeparator() is used as before)
    if (currentDayPart == dayParts.length -1) {
        let allKCal = 0;
        let allG = 0;
        for (let i = 0; i < dayParts.length; i++) {
            allKCal += dayParts[i].kcal;
            allG += dayParts[i].g;
        }
        dayParts[currentDayPart].kcal = allKCal;
        dayParts[currentDayPart].g = allG;
        appendSeparator();
    }

    $('#tCurrentLine').html(`${currentSummaryStr}`);
    $('#lbCurrentAllKCal').html(`<b>${Math.round(dayParts[currentDayPart - 1].kcal)}kc</b>`);
    $('#lbCurrentKCal').html(`${Math.round(currentSummaryKCal)}kc`);

    // display the result
    $('#divOutput').html('<pre>' + foodOutputStr + '</pre>');
}

function processQuantity(quantityStr, foodObj)
{
    let u = 0, unit = null;
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
            foodObj.quantity = quantityNumStr;
            foodObj.quantityunit = (unit != null ? unit : 'db');
            return true;
    }
    return false;
}

function roundKCalMeasurement(quant, dbFoodQuant, dbFoodKcal)
{
    return (quant * dbFoodKcal / dbFoodQuant);
}

/**
 * Adjust the measured weight simulating the selected kitchen scale.
 * @param {num} quant
 */
function simulateScaleMeasurement(quant)
{
    if (optScaleType != 'barista') {
        if (optScaleType == 'kitchen')
        {
            /** @type {String} */
            let minWeightStr = $('#minimalWeight').val();
            /** @type {String} */
            let corrWeightStr = $('#minimalWeightCorrection').val();
            let minWeight = (isNaN(minWeightStr) ? 3 : parseFloat(minWeightStr)), 
                corrWeight = (isNaN(corrWeightStr) ? 0 : parseFloat(corrWeightStr)); 
            quant = (quant < minWeight ? corrWeight : quant);

            quant = Math.round(quant);
        }
    }
    return quant;
}

function appendSeparator() {
    let outputKCal = `***${Math.round(dayParts[currentDayPart].kcal)}***`;
    outputKCal = ' '.repeat(10 - outputKCal.length) + outputKCal;
    let pattern = dayParts[currentDayPart].pattern;
    foodOutputStr += `${pattern.slice(0, 3) + outputKCal + pattern.slice(13)} ${Math.round(dayParts[currentDayPart].g)}g  \n`;

    // HTML separator
    let foodKCalStr = printToFixedFloat(dayParts[currentDayPart].kcal, 1, true);
    let foodKCalStrFormatted = foodKCalStr.replace(/(..)$/, '<span style="font-size:0.85em;">$1</span>');  // decimal characters are smaller
    let sHtmlSeparator =
        '<tr class="mealRow trSep">' +
            `<td style="text-align:right;" class="preBold kcalSepBg"><u>${foodKCalStrFormatted}</u></td>` +
            `<td style="text-align:right;" class="preBold timeSepBg"></td>` +
            `<td class="preBold foodSepBg"><u>${Math.round(dayParts[currentDayPart].g)}g ${pattern.slice(14).replaceAll('***', '')}</u></td>` +
        '</tr>';
    $('#tableOut tr:last').after(sHtmlSeparator);

    currentDayPart++;
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
 * @param {string} kcalStr 
 * @param {string} timestamp 
 * @param {string} foodDetails 
 * @returns 
 */
function formatFoodData(kcalStr, timestamp, foodDetails)
{
    let COL_KCAL_END = 10, COL_TIMESTAMP_END = 19;
    let resultStr = "  |"
    timestamp = (timestamp == null) ? "" : timestamp;
    // Column: kCal
    resultStr += " ".repeat(COL_KCAL_END - kcalStr.length - resultStr.length);
    resultStr += kcalStr + "   |";
    // Column: timeStamp
    resultStr += " ".repeat(COL_TIMESTAMP_END - timestamp.length - resultStr.length);
    resultStr += timestamp + "    | ";
    // Column: foodDetails
    resultStr += foodDetails;
    return resultStr;
}

function selectFoodRow(row) {
    if (selectedFoodRow != null)
        selectedFoodRow.removeClass('selectedFoodRow');
    selectedFoodRow = row;
    selectedFoodRow.addClass('selectedFoodRow');
}

/**
 * Communication
 * @param {XMLHttpRequest} xhr 
 * @param {XMLHttpRequestEventTarget} ev 
 */
function onCalcDbArrived(xhr, ev)
{
    if (ev.type == 'load') {
        let content = xhr.responseText;
        FoodsDb.getInstance().processDbFile(content);
        onUserOrDateChanged();
        onFoodInputChanged();
    }
}

/**
 * Do XML HTTP request communication
 * @param {string} path 
 * @param {string[]} params 
 * @param {function(string, Object, function)} cb 
 */
function nodeXHRComm(path, params, cb)
{
    if (params != null)
    {
        var paramNames = Object.keys(params);
        if (paramNames.length > 0)
        {
            let paramStr = '';
            paramNames.forEach(paramName =>
            {
                if (paramStr.length > 0)
                    paramStr += '&';
                paramStr += paramName + '=' + encodeURIComponent(params[paramName]);
            });
            path += `?${paramStr}`;
        }
    }
    try {
        let xhr = new XMLHttpRequest();
        xhr.addEventListener('load', (e) => {
            console.log(`XHR result: OK, URL: ${xhr.responseURL} - Response length: ${xhr.responseText.length}`);
            cb(xhr, e);
        });
        xhr.addEventListener('error', (e) => {
            console.log(`XHR result: ERROR!, URL: ${xhr.responseURL} - Response length: ${xhr.responseText.length}`);
            cb(xhr, e);
        });

        xhr.open("GET", path);
        xhr.send();
    } catch (e) {
        onSaveResultArrived(e);
    }
}

/**
 * Server/Client communication
 * @param {string} path 
 * @param {XMLHttpRequest} reqObj 
 * @param {function} cb 
 */
function nodeXHRPost(path, reqObj, cb) {
    let xhr = new XMLHttpRequest();
    xhr.open("POST", path, true);
    xhr.setRequestHeader('Content-Type', 'application/json;charset=UTF-8');
    xhr.addEventListener("load", function xhrCB() {
        if (cb != null)
            cb(this.responseText);
    });
    xhr.send(JSON.stringify(reqObj));

}

/**
 * @return string
 */
function getCurrentTimeStr()
{
    let date = new Date();
    date = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
    let currentTimeStr = date.toISOString().slice(11, 16);
    return currentTimeStr;
}

function getCurrentMoment(thresholdTime)
{
    moment.locale('hu');

    // Switch to yesterday if needed (based on thresholdTime)
    let currMoment = moment();
    if (currMoment.format('HH:mm') < thresholdTime)
        currMoment.milliseconds(currMoment.milliseconds() - 24 * 60*60 * 1000);

    return currMoment;
}

function printMoment(currMoment)
{
     // Field: WeekdaysMin
    let weekDayMin = moment.localeData().weekdaysMin(currMoment);
    weekDayMin = weekDayMin.charAt(0).toUpperCase() + weekDayMin.slice(1);

    // Result
    return `${currMoment.format('YYYY-MM-DD')}.${weekDayMin}`;
}

//todo Option for auto cleanup (?)
function onAddMeal()
{
    g_mealsDiaryText.appendNewText(`${getCurrentTimeStr()} KV`);
    onFoodInputChanged();
    if (g_mealsDiaryText.focusedMode)
    {
        g_mealsDiaryText.selectedLine = g_mealsDiaryText.mealLineLast;
        g_mealsDiaryText.jqItem.val(g_mealsDiaryText.rows[g_mealsDiaryText.selectedLine]);
    }
    updateAll_FocusedMode();
    updatePrevNextMealButtons();
}

function onFoodInputChanged()
{
    g_mealsDiaryText.mealLineFirst = g_mealsDiaryText.mealLineLast = -1;
    initCounters();
    onFoodsSaved(null);
    processInput();
    updateAll_FocusedMode();
    updatePrevNextMealButtons();
}

function onCursorMoved()
{
    g_mealsDiaryText.selectedLine = g_mealsDiaryText.cursorPos[1];
    updateAll_FocusedMode();
    updatePrevNextMealButtons();
}

function onUserOrDateChanged()
{
    if (window.localStorage != null) {
        window.localStorage.currentUser = $('#tUser').val();
    }

    let currentDayFormattedStr = printMoment(currentDayMoment);
    $('#tDate').val(currentDayFormattedStr);

    let currentDayStr = currentDayMoment.format('YYYY-MM-DD');
    nodeXHRComm('node_api/read_foodrowdb', { user: $('#tUser').val(), date: currentDayStr }, onFoodRecordRowArrived);
}

/**
 * Switch to the next or previous DAY
 * @param {bool} nextDay true - next day, false - previous day 
 */
function onPrevNextDay(nextDay)
{
    if (g_mealsDiaryText.focusedMode) {
        $('#focusedMode').prop('checked', false);
        g_mealsDiaryText.switchMode(false);
        updateAll_FocusedMode();
    }

    const ONE_DAY_MILLIS = 24 * 60 * 60 * 1000;
    const currentMoment = currentDayMoment.milliseconds();

    currentDayMoment.milliseconds(nextDay ? currentMoment + ONE_DAY_MILLIS : currentMoment - ONE_DAY_MILLIS);
    onUserOrDateChanged();

    checkPrevNextMeal.selectedLine = checkPrevNextMeal(null);
    updatePrevNextMealButtons();
}

/**
 * Switch to the next or previous MEAL
 * @param {bool} nextMeal true - next meal, false - previous meal
 */
function onPrevNextMeal(nextMeal)
{
    let mealIdx_checked = checkPrevNextMeal(nextMeal);
    if (mealIdx_checked != g_mealsDiaryText.selectedLine)
    {
        // select the next meal
        g_mealsDiaryText.selectedLine = mealIdx_checked;
        // move the cursor to the end of the selected meal's line
        //@todo skipped, because it brings back the virtual keyboard on Android
        //if (!g_mobileMode)
            g_mealsDiaryText.moveCursorTo(g_mealsDiaryText.rows[mealIdx_checked].length, mealIdx_checked);
        updateAll_FocusedMode();
    }
    //g_mealsDiaryText.updateUi();
    updatePrevNextMealButtons();
}

function updatePrevNextMealButtons()
{
    let prevMealIdx_checked = checkPrevNextMeal(false);
    let nextMealIdx_checked = checkPrevNextMeal(true);
    $('#btPrevMeal').prop('disabled', prevMealIdx_checked == g_mealsDiaryText.selectedLine);
    $('#btNextMeal').prop('disabled', nextMealIdx_checked == g_mealsDiaryText.selectedLine);
}

/**
 * Check for the next or previous MEAL's index
 * @param {bool} nextMeal true - next meal, false - previous meal, null - don't change the focused item, just check
 * @returns {Number} index of the prev/next meal (equals to 'selectedLine' if there is no more valid meal)
 */
function checkPrevNextMeal(nextMeal)
{
    // check the range first: are we the OUTSIDE of it? (e.g after changing the current day) => return to the range for the first step
    if (g_mealsDiaryText.selectedLine < g_mealsDiaryText.mealLineFirst)
        return g_mealsDiaryText.mealLineFirst;
    if (g_mealsDiaryText.selectedLine > g_mealsDiaryText.mealLineLast)
        return g_mealsDiaryText.mealLineLast;

    // caller don't want to move the selected line - so we're returning with the current index
    if (nextMeal == null)
        g_mealsDiaryText.selectedLine;

    // start to search from the INSIDE of the range
    let mealIdx_toCheck = g_mealsDiaryText.selectedLine + (nextMeal ? 1 : -1);
    while (mealIdx_toCheck >= g_mealsDiaryText.mealLineFirst && mealIdx_toCheck <= g_mealsDiaryText.mealLineLast)
    {
        if ($(`#tableOut #tr${mealIdx_toCheck}`).length > 0)
        {
            return mealIdx_toCheck;
        }
        else
            mealIdx_toCheck += (nextMeal ? 1 : -1);
    }
    return g_mealsDiaryText.selectedLine;
}


function onFoodRecordRowArrived(xhr, ev)
{
    if (ev.type == 'load') {
        content = xhr.responseText;
        console.log('foodRecordRowArrived: ' + content);
        g_mealsDiaryText.changeText(content.replaceAll('\\n', '\n'), true);
        onFoodInputChanged();
        onFoodsSaved(true);
    }
}

/**
 * Save button handling - countdown timer, 'unsaved' flag
 */
var saveButtonUpdateTimer = null;
var saveButtonUpdateMsg = null;
var saveButtonNormalMsg = "SAVE";
var saveButtonUpdateCounter = 0;

/**
 * EVENT: Save button clicked or ctrl-s pressed
 */
function onSave()
{
    $('#btSave').html("SAVING...");
    let currentDayStr = currentDayMoment.format('YYYY-MM-DD');
    g_mealsDiaryText.updateRowsStr();
    nodeXHRComm('node_api/save_foodrowdb', { user: $('#tUser').val(), date: currentDayStr, food_data: g_mealsDiaryText.rowsStr.replaceAll('\n', '\\n') }, onSaveResultArrived);
}

/** UI: Update the 'unsaved' flag */
function onFoodsSaved(isSaved)
{
    g_mealsDiaryText.updateRowsStr();
    let foodEditBoxContent = g_mealsDiaryText.rowsStr;
    if (isSaved == null || isSaved == undefined)
        isSaved = (foodEditBoxContent.localeCompare(g_savedFoodInput) == 0);

    if (isSaved == true) {
        $('#btSave').html(saveButtonNormalMsg);
        $('#btSave').removeClass('unsaved');
        g_savedFoodInput = foodEditBoxContent;
    }
    else {
        $('#btSave').html('<font color="darkred">SAVE &#x25CF;</font>');
        $('#btSave').addClass('unsaved');
    }
}

/** UI: Start the countdown after the Save operation is done */
function showSaveButtonMsg(updateMsg, normalMsg, timeoutSecs)
{
    clearInterval(saveButtonUpdateTimer);
    saveButtonUpdateMsg = updateMsg;
    saveButtonNormalMsg = normalMsg;
    saveButtonUpdateCounter = timeoutSecs;
    onShowSaveButtonMsgUpdate();
    saveButtonUpdateTimer = setInterval(onShowSaveButtonMsgUpdate, 1000);
}

/** Countdown functionality for a button (currently specific to the save button) */
function onShowSaveButtonMsgUpdate()
{
    $('#btSave').html(`${saveButtonUpdateMsg} (${saveButtonUpdateCounter})`);
    saveButtonUpdateCounter--;
    if (saveButtonUpdateCounter < 0) {
        clearInterval(saveButtonUpdateTimer);
        onFoodsSaved();
    }
}

function onSaveResultArrived(xhr, ev)
{
    if (ev.type == 'load') {
        console.log(`XHR communication result: ${xhr.responseText}`);
        showSaveButtonMsg('<span style="color: darkgreen"><b>SAVED!</b></span>', 'SAVE', 3);
        g_mealsDiaryText.updateRowsStr();
        g_savedFoodInput = g_mealsDiaryText.rowsStr;
    } else if (ev.type == 'error') {
        showSaveButtonMsg('<span style="color: darkred"><b>ERROR!</b></span>', 'SAVE', 8);
        $('#lSaveErrorMsg').html('ERROR: Unable to access server and to save data!').slideDown().delay(7800).slideUp();
    }
}

function handleMobileMode() {
    md = new MobileDetect(window.navigator.userAgent);
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

/**
 * Copies a string to the clipboard
 * It uses the execCommand() method, because writeText works only on localhost
 * @param {String} text The string to copy
 */
function copyText2Clipboard(text)
{
    $('#txtCopyHelper').val(text);
    $('#txtCopyHelper').show();
    $('#txtCopyHelper')[0].select();
    let retVal = document.execCommand('copy');
    $('#txtCopyHelper').hide();
    return retVal;
}

function onPageLoaded()
{
    if (window.localStorage != null) {
        if (window.localStorage.currentUser != null) {
            $('#tUser').val(window.localStorage.currentUser);
        }
    }

    g_mealsDiaryText = new TextAreaExt('#txtMealsDiary');
    g_mealsDiaryText.on('input', onFoodInputChanged);
    g_mealsDiaryText.on('cursor', onCursorMoved);

    // TODO: from settings: 1. threshold time 2. use current date or the previously saved one 3. add day of week postfix 4. date format 5. weekday abbreviation
    currentDayMoment = getCurrentMoment('04:00');
    onUserOrDateChanged();
    $('#lSaveErrorMsg').hide();

    // initiate DB reload
    nodeXHRComm("node_api/read_calcdb", null, onCalcDbArrived);
    $('#tUser').on('input', onUserOrDateChanged);
    //$('#tDate').on('input', onUserOrDateChanged);
    $('#btDateUp').on('click', () => onPrevNextDay(false));
    $('#btDateDown').on('click', () => onPrevNextDay(true));
    $('#btNextMeal').on('click', () => onPrevNextMeal(true));
    $('#btPrevMeal').on('click', () => onPrevNextMeal(false));
    $('#btSave').on('click', onSave);
    $('#btAddMeal').on('click', onAddMeal);

    /** Developer options: Section, controls, experimental features */
    $('#optsDevSection').hide();
    $('#devMode').change(function(){
        //? $('#devMode').detach().appendTo('#optsDev');
        if (this.checked)
            $('#optsDevSection').slideDown(150);
        else
            $('#optsDevSection').slideUp(100);
    });
    $('#optScaleType,.scaleOpts').change(() => {
        optScaleType = ($('#optScaleType :selected').val());
        $('.scaleOpts').toggle(optScaleType != 'barista');
        onFoodInputChanged();
    });
    $('.scaleOpts').hide();

    $('#devModeOutputs').change(function(){
        //? $('#devMode').detach().appendTo('#optsDev');
        if (this.checked)
            $('#devOutputs').slideDown(150);
        else
            $('#devOutputs').slideUp(100);
    });
    $('#devOutputs').hide();

    /** Button, feature: Export MD output to the clipboard */
    $('#btCopyMD').on('click', () => { 
        copyText2Clipboard(foodOutputStr);
    });

    // shortcuts (only ctrl-s is supported by now)
    $(window).keydown(function (event) {
        if (event.ctrlKey && event.keyCode == 83) {
            console.log('Event: ctrl-S has been pressed');
            event.preventDefault();
            onSave();
        }
    });

    $('#focusedMode').change(function (e)
    {
        // only handle user triggered events! (to prevent infinite loops)
        if (e.originalEvent != null) {
            g_mealsDiaryText.switchMode(this.checked);
            updateAll_FocusedMode(this.checked);
        }
    });

    $('#tableOut').click(onRowChange);

    handleMobileMode();
}

/**
 * Event: User changes the active row of the output table
 * @param {Event} event 
 */
function onRowChange(event)
{
    let targetRowId = $(event.target).closest('tr')[0].id;
    let targetRowNum = Number.parseInt(targetRowId.substr(2));
    if (!Number.isNaN(targetRowNum))
        selectRow(targetRowNum);
}

/**
 * Select the current row of the output table
 * @param {Number} iRow 
 */
function selectRow(iRow)
{
    $('#focusedMode').prop('checked', true);   //.is(":checked"))
    g_mealsDiaryText.switchMode(true, iRow);
    updateAll_FocusedMode(true);
}

function updateAll_FocusedMode()
{
    // are we in focused mode?
    let focusedMode = g_mealsDiaryText.focusedMode;
    // change UI's focused mode on/off
    $('#tableOut').toggleClass('focusedMode', focusedMode);
    $('#txtMealsDiary').toggleClass('focusedMode', focusedMode);
}

function updateTableOut_SelectedLine()
{
    if (g_mealsDiaryText.selectedLine != -1) 
    {
        let jqRow = $(`#tableOut #tr${g_mealsDiaryText.selectedLine}`);
        // only check the table's current row if it is not empty
        if (jqRow.length > 0)
        {
            // scroll to the line to select
            let rowPos = jqRow.position();
            $('#tableOut')[0].scrollTo({ top: $('#tableOut')[0].scrollTop + rowPos.top - 70, behavior: 'smooth' });
            // unselect all lines and then select the current one
            $(`#tableOut tr`).removeClass('selectedRow');
            $(`#tableOut #tr${g_mealsDiaryText.selectedLine}`).addClass('selectedRow');
            // update headers (table => header): copy the kcal value from the table to the header kcal field
            let firstColumnVal = $(`#tableOut #tr${g_mealsDiaryText.selectedLine} td:nth-child(1)`).attr('value');
            let secondColumnVal = $(`#tableOut #tr${g_mealsDiaryText.selectedLine} td:nth-child(2)`).html();
            $('#lbCurrentKCal').html(`${firstColumnVal} kc`);
            $('#lMealTime').html(secondColumnVal);
        }
        else
        {
            $('#lbCurrentKCal').html(`- kc`);
            $('#lMealTime').html('--:--');
        }
    }
}

window.addEventListener("load", onPageLoaded);
