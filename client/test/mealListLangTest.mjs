import { jest } from '@jest/globals';
jest.useFakeTimers();

import { TextContainer } from '../src/util/text/textContainers.mjs';
import { MealListLang } from '../src/data/mealListLang.mjs';
import { HtmlBuffer } from '../src/util/text/htmlBuffer.mjs';
import { TextareaHighlight } from '../src/views/textareaHighlight.mjs';

import moment from '../src/3rdparty/moment-with-locales.js';
// /** @type { Moment } */
global.moment = moment;

import jsdom from 'jsdom';
import { Config } from '../src/app/config.mjs';
const { JSDOM } = jsdom;
const jsdomInst = new JSDOM('<html></html>');

global.document = jsdomInst.window.document;

class TestLogText extends TextContainer
{
    /**
     * @param {string[]} inputLines
     */
    constructor(inputLines)
    {
        super();
        this.inputLines = inputLines;
    }

    /**
     * @override
     * @param {number} row
     */
    getRow(row)
    {
        return this.inputLines[row];
    }

    /**
     * @override
     */
    getRowCount()
    {
        return this.inputLines.length;
    }
}

class TestResult
{
    /**
     * @param {HtmlBuffer} highlightedText
     * @param {String} mdOutput
     */
    constructor(highlightedText, mdOutput)
    {
        this.highlightedText = highlightedText;
        this.mdOutput = mdOutput;
    }
}

/**
 * @param { string[] } inputLines
 * @returns { TestResult }
 */
function doTest(inputLines)
{
    let inputTextContainer = new TestLogText(inputLines);
    //@ts-ignorets-ignore
    let highlighter = new TextareaHighlight(inputTextContainer);
    let mealLangParser = new MealListLang(Config.getInstance(), null, highlighter);
    mealLangParser.initCounters();
    mealLangParser.processInput(inputTextContainer);
    return new TestResult(highlighter.htmlBuffer, mealLangParser.foodOutputStr);
}

test('Process input: Known food with some additional text', () =>
{
    var inputText =
    [
        'apple 35kc/ 100g additional_text'
    ];

    let testResult = doTest(inputText);

    // output contains the input food
    expect(testResult.highlightedText.getRow(0).indexOf('apple')).toBeGreaterThan(-1);
});

test('Process input: Known/unknown food differences', () =>
{
    var inputText =
    [
        'apple         35kc/ 100g additional_text',
        'special_fruit       100g additional_text'
    ];

    let testResult = doTest(inputText);

    // secondLine is longer, about 8-10 chars added because of the unknown food (no kcal/ value for the 2nd 'apple') is highlighted
    expect(testResult.highlightedText.getRow(0).indexOf('<font color="black">apple')).toBeGreaterThan(-1);

    // stripped version doesn't contain colors, now the first string is longer (with the additional '35kc/ ')
    expect(testResult.highlightedText.getRow(1).indexOf('<font color="red">special_fruit')).toBeGreaterThan(-1);
});

test('Process input: Processing bug in line 4: replaceAll Regexp problem', () =>
{
    var inputText =
    [
        '10:16 soup 83kc/ 54g [it_was_good!]'
    ];

    let testResult = doTest(inputText);

    // secondLine is longer, about 8-10 chars added because of the unknown food (no kcal/ value for the 2nd 'apple') is highlighted
    expect(testResult.highlightedText.getRow(0).indexOf('[it_was_good!]')).toBeGreaterThan(-1);
});

test('Process input: Wrong (incomplete) timestamp at the beginning of the line', () =>
{
    var inputText =
    [
        '10:0 Coffee'
    ];

    let testResult = doTest(inputText);

    // secondLine is longer, about 8-10 chars added because of the unknown food (no kcal/ value for the 2nd 'apple') is highlighted
    expect(inputText[0]).toBe(HtmlBuffer.stripHtml( testResult.highlightedText.getRow(0)));
});

test('Process input: Meal continuation', () =>
{
    var inputText =
    [
        '10:00 special_fruit 35kc/ 100-70g',
        '10:30 special_fruit -10g',
    ];

    let testResult = doTest(inputText);

    // The second meal has to start from +50g (-20g == 30g), and its kcal has to be 35kc/ (as the firest meal).
    expect(testResult.mdOutput.indexOf('special fruit (60g, 35kc/, =21kc)')).toBeGreaterThan(-1);
});
