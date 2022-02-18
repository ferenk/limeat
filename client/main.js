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
    let currentRowNum = mainTextArea.val().substr(0, mainTextArea[0].selectionStart).split("\n").length;
    let currentSummaryStr = '';

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
        let foodPartStrs = foodLine.replaceAll("(", "").replaceAll(")", "").split(',');
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

                let foodPartNameISQuantity = foodPartNameStr[0] >= '0' && foodPartNameStr[0] <= '9';
                let u = 0, op;
                if (foodPartNameISQuantity && (op = foodPartNameStr.search(/[\+-]/)) > 0) {
                    let foodPartGramCalcStr = foodPartNameStr.replaceAll('g', '');
                    if (/^[0-9\+\.-]+$/.test(foodPartGramCalcStr)) {
                        try
                        {
                            let foodGrams = toFixedFloat(eval(foodPartGramCalcStr));
                            newFoodPart.quantity = foodGrams;
                            newFoodPart.quantityunit = 'g';
                        } catch (e) {
                            console.log(`Error: Invalid input: ${e}`);
                        }
                    }
                }
                else if (foodPartNameISQuantity && (foodPartNameStr.endsWith(u = 'kc') || foodPartNameStr.endsWith(u = 'kcal'))) {
                    newFoodPart.kcalunit = 'kcal';
                    newFoodPart.kcal = foodPartNameStr.substring(0, foodPartNameStr.length - u.length);
                }
                else if (foodPartNameISQuantity && (foodPartNameStr.endsWith(u = 'kc/') || foodPartNameStr.endsWith(u = 'kcal/'))) {
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
            if (newFoodPart.name != null && newFoodPart.name != '') {
                //if (foodQuantity == null && foodKCal == null) {
                    //foodQuantity = 1;
                    //foodQuantityUnit = 'db';
                //}
                if (newFoodPart.quantity == null) {
                    newFoodPart.quantity = 1;
                    newFoodPart.quantityunit = 'db';
                }
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
            let currentOutputLine = formatFoodData(foodKCal, timestampStr, foodNamePrefixStr + foodOutputLineStr) + '  \n';
            foodOutputStr += currentOutputLine;
            if (i == Math.round(currentRowNum) - 1)
                currentSummaryStr += currentOutputLine;
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

    $('#currentLine').html(`<pre><b>${dayParts[currentDayPart-1].kcal} kcal</b>  ${currentSummaryStr}</pre>`);

    // display the result
    $('#divOutput').html('<pre>' + foodOutputStr + '</pre>');
}

function processQuantity(quantityStr, foodObj)
{
    let foodPartNameISQuantity = quantityStr >= '0' && quantityStr <= '9';
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

function onPageLoaded()
{
    // initiate DB reload
    nodeXHRComm("node_api/read_calcdb", null, onCalcDbArrived);
    $('#tDayFoodsRaw').on('input', onFoodInputChanged);
    $('#tUser').on('input', onUserOrDateChanged);
    $('#tDate').on('input', onUserOrDateChanged);
    $('#btSave').on('click', onSave);
}

function onFoodInputChanged()
{
    initCounters();
    processInput();
}

function onUserOrDateChanged()
{
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
