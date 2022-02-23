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

function toFixedFloat(num) {
    let realNum = num;
    if (typeof (num) == 'string')
        realNum = parseFloat(num);
    return Math.round(realNum * 10) / 10;
}

let dayParts =
    [{ pattern: '  |          |***(reggeli,tízórai)***', kcal: 0, g:0 },
     { pattern: '  |          |***(ebéd,uzsonna)***', kcal:0, g:0 },
     { pattern: '  |          |***(vacsora,nasik)***', kcal:0, g:0 },
     { pattern: '  |          |', kcal:0, g:0 }];

let currentDayPart;
let foodOutputStr;

function initCounters()
{
    for (let i = 0; i < dayParts.length; i++) {
        dayParts[i].kcal = 0;
        dayParts[i].g = 0;
    }
    currentDayPart = 0;
    foodOutputStr = '';
}

/* Process entered text*/
function processInput()
{
    let mainTextArea = $('#tDayFoodsRaw');
    let currentTextLines = mainTextArea.val().substr(0, mainTextArea[0].selectionStart).split("\n");
    let currentRowNum = currentTextLines.length;
    let currentRowCol = currentTextLines[currentRowNum - 1].length;

    let currentSummaryStr = '';
    let currentSummaryKCal = 0;

    let foodLines = $('#tDayFoodsRaw').val().split('\n');
    
    for (let i = 0; i < foodLines.length; i++)
    {
        // foodLine: "10:25 apple 10g, banana 20g"
        let foodLine = foodLines[i];

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
            let foodOutputLineStr = '';
            let foodKCal = 0, foodG = 0;
            foodParts.forEach(foodPart => {
                let partKCal = 0;
                if (foodPart.kcalunit == 'kcal')
                    partKCal = toNumericOrZero(foodPart.kcal);
                if (partKCal == 0) {
                    if (foodPart.kcalunit == 'kcal/100g' && foodPart.quantityunit == 'g') {
                        partKCal = (toNumericOrZero(foodPart.kcal) * foodPart.quantity) / 100;
                    }
                }
                if (partKCal == 0)
                    partKCal = calcFoodKcal(foodPart);
                foodKCal += toFixedFloat(partKCal);
                if (foodPart.quantityunit == 'g')
                    foodG += toFixedFloat(foodPart.quantity);

                if (foodOutputLineStr.length > 0)
                    foodOutputLineStr += ', ';

                if (partKCal == 0) foodOutputLineStr += '<font color="red">';
                if (foodPart.kcal != null) {
                    if (foodPart.kcalunit != 'kcal')
                        foodOutputLineStr += `${foodPart.name.replaceAll('_', ' ')} (${foodPart.quantity}${foodPart.quantityunit}, ${foodPart.kcal}${foodPart.kcalunit}, =${Math.round(partKCal)}kc)`;
                    else
                        foodOutputLineStr += `${foodPart.name.replaceAll('_', ' ')} (${foodPart.quantity}${foodPart.quantityunit}, ${foodPart.kcal}${foodPart.kcalunit})`;
                }
                else {
                    foodOutputLineStr += `${foodPart.name.replaceAll('_', ' ')} (${foodPart.quantity}${foodPart.quantityunit}, =${Math.round(partKCal)}kc)`;
                }
                if (partKCal == 0) foodOutputLineStr += '</font>';
                if (foodPart.unprocessed != null)
                    foodOutputLineStr += ` ***${foodPart.unprocessed}***`;
            });

            dayParts[currentDayPart].kcal += foodKCal;
            dayParts[currentDayPart].g += foodG;

            // append this line to the main output (and optionally to the summary text)
            let foodDetails = foodNamePrefixStr + foodOutputLineStr;
            let currentOutputLine = formatFoodData(foodKCal, timestampStr, foodDetails) + '  \n';
            foodOutputStr += currentOutputLine;
            if (i == Math.round(currentRowNum) - 1) {
                currentSummaryStr += foodDetails;
                currentSummaryKCal = foodKCal;
            }
        }
    }

    // day part separator handling
    appendSeparator();
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

    $('#currentLine').html(`${currentSummaryStr}`);
    $('#currentAllKCal').html(`<b>${Math.round(dayParts[currentDayPart - 1].kcal)}kc |</b>`);
    $('#currentKCal').html(`${Math.round(currentSummaryKCal)}kc`);

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

function appendSeparator() {
    let outputKCal = `***${Math.round(dayParts[currentDayPart].kcal)}***`;
    outputKCal = ' '.repeat(10 - outputKCal.length) + outputKCal;
    let pattern = dayParts[currentDayPart].pattern;
    foodOutputStr += `${pattern.slice(0, 3) + outputKCal + pattern.slice(13)} ${Math.round(dayParts[currentDayPart].g)}g  \n`;
    currentDayPart++;
}

function calcFoodKcal(foodPart)
{
    let foodPartNameLower = foodPart.name.toLowerCase();
    for (let i = 0; i < calcDb.length; i++) {
        let dbFood = calcDb[i];
        if (dbFood.name == foodPartNameLower && dbFood.quantityunit == foodPart.quantityunit) {
            return ((foodPart.quantity / dbFood.quantity) * dbFood.kcal);
        }
    }
    return 0;
}

function formatFoodData(kcal, timestamp, foodDetails)
{
    let COL_KCAL_END = 10, COL_TIMESTAMP_END = 19;
    let resultStr = "  |"
    timestamp = (timestamp == null) ? "" : timestamp;
    // Column: kCal
    let kcalStr = Math.round(kcal).toString();
    resultStr += " ".repeat(COL_KCAL_END - kcalStr.length - resultStr.length);
    resultStr += kcalStr + "   |";
    // Column: timeStamp
    resultStr += " ".repeat(COL_TIMESTAMP_END - timestamp.length - resultStr.length);
    resultStr += timestamp + "    | ";
    // Column: foodDetails
    resultStr += foodDetails;
    return resultStr;
}


/* Process DB file */
let calcDb = [];
function processDbFile(content)
{
    let str = '';
    let dbLines = content.split('\r\n');
    dbLines.forEach(element => {
        dbLineParts = element.split('|');
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
                calcDb.push(foodDbEntry);
            }
        }
    });
    calcDb.forEach((dbItem) => {
        let kcal2ndPart = (dbItem.quantity == 100 && dbItem.quantityunit == 'g' ? '' : `${dbItem.quantity}${dbItem.quantityunit}`);
        str += `${dbItem.name}: ${dbItem.kcal} kCal/${kcal2ndPart}\n`;
    } );

    $('#divDbContent').html('<pre>' + str + '</pre>');
}

/* Communication */
function onCalcDbArrived(content)
{
    processDbFile(content);
    onUserOrDateChanged();
    onFoodInputChanged();
}

function nodeXHRComm(path, params, cb)
{
    let xhr = new XMLHttpRequest();
    xhr.addEventListener("load", function xhrCB() {
        if (cb != null)
            cb(this.responseText);
    });
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
    xhr.open("GET", path);
    xhr.send();
}

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

function getCurrentTimeStr()
{
    let date = new Date();
    date = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
    let currentTimeStr = date.toISOString().slice(11, 16);
    return currentTimeStr;
}

function getCurrentDateStr(thresholdTime)
{
    let weekdayAbbrs = ['V', 'H', 'K', 'Sze', 'Cs', 'P', 'Szo'];
    let date = new Date();
    date = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
    let currentTimeStr = date.toISOString().slice(11, 16);
    if (currentTimeStr < thresholdTime)
        date.setDate(date.getDate() - 1);
    let currentDateStr = `${date.toISOString().slice(0, 10)}.${weekdayAbbrs[date.getDay()]}`;
    return currentDateStr;
}

//todo Option for auto cleanup (?)
function onAddMeal() {
    let wMealEditor = $('#tDayFoodsRaw');
    let wMealEditorText = wMealEditor.val();
    // auto cleanup
    let currentMealTextRows = wMealEditorText.split('\n');
    // remove the last empty lines
    let lastRow = '';
    while (currentMealTextRows.length >= 1) {
        lastRow = currentMealTextRows.pop();
        if (lastRow.length != 0)
            break;
    }
    lastRow += `${lastRow.length > 0 ? '\n' : ''}${getCurrentTimeStr()} `;
    currentMealTextRows.push(lastRow);

    // show the new, extended meal text
    wMealEditorText = currentMealTextRows.join('\n')
    wMealEditor.val(wMealEditorText);
    wMealEditor[0].selectionStart = wMealEditor[0].selectionEnd = wMealEditorText.length;
    wMealEditor[0].focus();
}

function onPageLoaded()
{
    if (window.localStorage != null) {
        if (window.localStorage.currentUser != null) {
            $('#tUser').val(window.localStorage.currentUser);
        }
    }

    // TODO: from settings: 1. threshold time 2. use current date or the previously saved one 3. add day of week postfix 4. date format 5. weekday abbreviation
    $('#tDate').val(getCurrentDateStr('04:00'));

    // initiate DB reload
    nodeXHRComm("node_api/read_calcdb", null, onCalcDbArrived);
    $('#tDayFoodsRaw').on('input', onFoodInputChanged);
    $('#tUser').on('input', onUserOrDateChanged);
    $('#tDate').on('input', onUserOrDateChanged);
    $('#btSave').on('click', onSave);
    $('#btAddMeal').on('click', onAddMeal);
}

function onFoodInputChanged()
{
    initCounters();
    processInput();
}

function onUserOrDateChanged()
{
    if (window.localStorage != null) {
        window.localStorage.currentUser = $('#tUser').val();
    }

    nodeXHRComm('node_api/read_foodrowdb', { user: $('#tUser').val(), date: $('#tDate').val() }, onFoodRecordRowArrived);
}

function onFoodRecordRowArrived(content)
{
    console.log('foodRecordRowArrived: ' + content);
    $('#tDayFoodsRaw').val(content.replaceAll('\\n', '\n'));
    onFoodInputChanged();
}

function onSave()
{
    nodeXHRComm('node_api/save_foodrowdb', { user: $('#tUser').val(), date: $('#tDate').val(), food_data: $('#tDayFoodsRaw').val().replaceAll('\n', '\\n') }, onSaveResultArrived);
}

function onSaveResultArrived(content)
{
    $('#tSaveMsg').fadeOut(0);
    if (content != '')
        $('#tSaveMsg').html("ERROR: " + content);
    else
        $('#tSaveMsg').html("SAVED!");
    $('#tSaveMsg').fadeIn(100).delay(2000).fadeOut(500);
}

window.addEventListener("load", onPageLoaded);
