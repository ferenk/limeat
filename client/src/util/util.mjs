export {
    getCurrentMoment, getCurrentRawMoment, getCurrentTimeStr, printMoment, parseIsoDate, isNumeric, isError,
    toNumericOrZero, toFixedFloat, printToFixedFloat, safeEval,
    copyText2Clipboard, replaceTextInTextarea, jsonStringifyCircular
};

//import Duration from '../3rdparty/moment-with-locales.js';
//!TMP import Moment from '../3rdparty/moment-with-locales.js';

function getCurrentRawMoment()
{
    return moment();
}

/**
 *
 * @param {String} thresholdTime
 * @returns {typeof Moment.prototype }
 */
function getCurrentMoment(thresholdTime)
{
    moment.locale('hu');

    // Switch to yesterday if needed (based on thresholdTime)
    let currMoment = moment();
    if (currMoment.format('HH:mm') < thresholdTime)
        currMoment.milliseconds(currMoment.milliseconds() - 24 * 60*60 * 1000);

    return currMoment;
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

/**
 *
 * @param {typeof Moment.prototype} currMoment
 * @throws {TypeError} if the input moment is invalid
 * @returns
 */
function printMoment(currMoment)
{
     // Field: WeekdaysMin
    let weekDayPrintedShort = moment.localeData().weekdaysMin(currMoment);
    weekDayPrintedShort = weekDayPrintedShort.charAt(0).toUpperCase() + weekDayPrintedShort.slice(1);

    // Result
    return `${currMoment.format('YYYY-MM-DD')}.${weekDayPrintedShort}`;
}

/**
 *
 * @param {String} isoDate
 * @returns {typeof Moment.prototype?}
 */
function parseIsoDate(isoDate)
{
    //let parsedMoment = moment(isoDate, 'en', false);
    let parsedMoment = moment(new Date(isoDate));
    return parsedMoment;
}

/**
 * Check a string if it contains only numbers
 * @param {String} str
 * @returns boolean
 */
function isNumeric(str) {
    if (typeof str != "string")
        return false;
    return !isNaN(Number(str)) && !isNaN(parseFloat(str));
}

/**
 *
 * @param {String | Number} str
 * @returns {Number}
 */
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

/**
 * Convert the num parameter to a fixed float number.
 * If num is:
 *      - a string: it will be parsed to a float number.
 *      - null or undefined: it will be converted to 0.
 * @param {Number | String} num
 * @param {Number} decimals
 * @returns {Number}
 */
function toFixedFloat(num = 0, decimals = 1) {
    /** @type {Number} */
    let realNum;
    if (typeof (num) == 'string')
        try
        {
            realNum = parseFloat(num);
        }
        catch(_err)
        {
            realNum = 0;
        }
    else
        realNum = num;
    let decimalPower = Math.pow(10, decimals);
    //debug console.log(`decimalPower: ${decimalPower}`);
    return Math.round(realNum * decimalPower) / decimalPower;
}

/**
 *
 * @param {Number} num
 * @param {Number} decimals
 * @param {string?} paddingChar
 * @returns the number as a string
 */
function printToFixedFloat(num, decimals = 1, paddingChar = null) {
    if (decimals == null)
        decimals = 0;
    let numStr = toFixedFloat(num, decimals).toString();
    if (paddingChar != null) {
        let decimalPointPos = numStr.search('\\.');
        if (decimalPointPos < 0)
        {
            // can cause 'index out of bounds' like situation - works for the ' ' padding, '1' -> '1  '
            decimalPointPos = numStr.length;
            if (paddingChar == '0')  // additional '.' is needed
                numStr += '.';
        }
        let fractionPartChars = numStr.length - decimalPointPos - 1;
        // debug
        //!TODO log console.log(`numStr: ${numStr}, decimals: ${decimals}, paddingChar: ${paddingChar}, decimalpointpos: ${decimalPointPos}, fractionPartChars: ${fractionPartChars}`);
        numStr += paddingChar.repeat(decimals - fractionPartChars);
    }
    return numStr;
}

/**
 *
 * @param {string} str
 * @returns { Number }
 */
function safeEval(str)
{
    try
    {
        return eval(str);
    }
    catch (_err) {
        return 0;
    }
}

/**
 * Detect if the given object is an error
 * @param {Object | Error} e
 * @returns true if the object is an Error
 */
const isError = function (e)
{
    return e && e instanceof Error && e.stack != null && e.message != null &&
        typeof e.stack === 'string' && typeof e.message === 'string';
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
    // @ts-ignore:next-line (HTMLElement.select is not assignable)
    $('#txtCopyHelper')[0].select();
    $('#txtCopyHelper')[0].focus();
    let retVal = document.execCommand('copy');
    $('#txtCopyHelper').hide();
    return retVal;
}

/**
 *
 * @param {HTMLTextAreaElement} domWidget
 * @param {String} text
 * @param {Number} startPos
 * @param {Number} endPos
 */
function replaceTextInTextarea(domWidget, text, startPos, endPos)
{
    $(domWidget).focus();
    domWidget.selectionStart = startPos;
    domWidget.selectionEnd = endPos;
    document.execCommand('insertText', false, text);
}

/**
 *
 * @param {HTMLElement?} textarea
 * @param {string} text
 */
function insertText2TextArea(textarea, text) {      // @ts-ignore
    if (textarea != null && textarea instanceof HTMLTextAreaElement)
    {
        textarea?.setRangeText(
            text,
            textarea.selectionStart,
            textarea.selectionEnd,
            'end'
        );
    }
}

function jsonStringifyCircular(obj)
{
    let cache = [];
    const stringified = JSON.stringify(obj, (_key, value) => {
        if (value !== null && typeof value === 'object') {
            if (cache?.includes(value)) {
                // Circular reference found, discard key
                return '';
            }
            // Store value in our collection
            cache?.push(value);
        }
        return value;
    }, 4);
    cache = null;
    return stringified;
}
