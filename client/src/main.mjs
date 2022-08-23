import { isError, copyText2Clipboard } from './util/util.mjs';
import { nodeXHRComm } from './data/comm.mjs';

import { Config } from './app/config.mjs'
import { FoodsDb } from './data/foodsDb.mjs';
import { Controller } from './controller.mjs';
import { TextareaExt } from './views/textareaExt.mjs';
import { TextareaHighlight } from './views/textareaHighlight.mjs';
import { OutputTable } from './views/outputTable.mjs';
import { MealListLang } from './data/mealListLang.mjs';

import { traceMethodCalls } from './util/callTracker.mjs'
import { CountdownButton } from './util/ui/countdownButton.mjs';

import { SSEClient } from './net/sseClient.mjs';

import { coolMessage } from './views/uiHelper.mjs';

var g_config = Config.getInstance(
    {
        scaleType: 'barista',
        clientId: window.localStorage.optClientId,
        finalClientId: window.localStorage.optClientId
    }
);

/** @type { TextareaExt } */
// @ts-ignore:next-line (Type '{}' is missing the following properties from type 'TextareExt'... (Proxy type problem))
var g_mealsDiaryText = traceMethodCalls(new TextareaExt(), false);

/** @type { TextareaHighlight } */
// @ts-ignore:next-line (Type '{}' is missing the following properties from type 'TextareaHighlight'... (Proxy type problem))
var g_mealsDiaryTextHighlight = traceMethodCalls(new TextareaHighlight(g_mealsDiaryText), false);

/** @type { OutputTable } */
// @ts-ignore:next-line (Type '{}' is missing the following properties from type 'OutputTable'... (Proxy type problem))
var g_outputTable = traceMethodCalls(new OutputTable(), false);

/** @type { MealListLang } */
// @ts-ignore:next-line (Type '{}' is missing the following properties from type 'MealListLang'... (Proxy type problem))
var g_mealListLang = traceMethodCalls(new MealListLang(g_config, g_mealsDiaryText, g_mealsDiaryTextHighlight), false);

/** @type { Controller } */
// @ts-ignore:next-line (Type '{}' is missing the following properties from type 'Controller'... (Proxy type problem))
var g_controller = traceMethodCalls(new Controller(g_mealsDiaryText, g_mealsDiaryTextHighlight, g_outputTable, g_mealListLang), false);

var g_mobileMode = null;

let g_saveButton = new CountdownButton('#btSave', 'SAVED!', 'SAVE', 3, onSaveButtonPressed, null);

let g_sseClient = new SSEClient(g_config);

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
    let currentDayStr = g_mealListLang.currentDayMoment.format('YYYY-MM-DD');
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
        g_controller.lastDbFoodInput = g_mealsDiaryText.rowsStr;
        g_controller.lastDbUpdate = Number(new Date());
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
        $('.header1,.header2').css('font-size', '12px');
        $('.header1,.header2').css('padding-top', '4px');
        $('.header1,.header2').css('padding-bottom', '4px');
        $('.topContent').css('padding-right', '12px');
        $('#tableOut').css('font-size', '110%');
    }
    else {
        $('body').css('width', '640px');
        $('.header1,.header2').css('width', '616px');
    }
}

function placementCorrections()
{
    /** @type { HTMLElement | null } */
    let header1 = document.querySelector('.header1');
    /** @type { HTMLElement | null } */
    let header2 = document.querySelector('.header2');
    if (header1 && header2)
        header2.style.top = header1.offsetHeight + 'px';
    let elPlacement = header2?.getBoundingClientRect();
    let elTitlePlaceholder = document.getElementById('titleBg');
    if (elTitlePlaceholder)
        elTitlePlaceholder.style.height = `${elPlacement?.bottom ?? 100}px`;

}

/**
 * @param {string | null} status
 */
function sseStateUpdateCB(status)
{
    console.log(`SSE state changed: ${status}`);
    let domLED = document.getElementById('btRefresh');
    if (domLED != null)
    {
        if (status == 'OPENED')
            domLED.style.background = 'olivedrab';
        else if (status == 'CLOSED' || status == 'DISCONNECTED')
            domLED.style.background = 'darkred';
        else if (status == 'CLOSED' || status == 'CONNECTING')
            domLED.style.background = 'gold';
        else
            domLED.style.background = 'slategray';
    }
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
    g_controller.onUserOrDateChanged();
    $('#lSaveErrorMsg').hide();
    $('#btRefresh').click(() => { g_mealsDiaryText.changeText('', true); g_controller.refreshDayFoods(); });

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
        //todo ? (previously it failed as onDisplayModeChanged() is not yet implemented) g_mealsDiaryTextHighlight.onDisplayModeChanged(selectedMode.toLowerCase());
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
        /** @type {string} */
        let clientId = $('#optClientId').val()?.toString() || '';
        if (clientId != null && clientId != '')
        {
            localStorage.optClientId = g_config.finalClientId = g_config.clientId = clientId;
            g_sseClient.init(g_controller.refreshDayFoods.bind(g_controller), sseStateUpdateCB, console.log);
            coolMessage('success', 'Changes applied', 'Changes have been applied and saved!');
        }
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
        copyText2Clipboard(g_mealListLang.foodOutputStr);
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
    placementCorrections();

    sseStateUpdateCB(null);
    g_sseClient.init(g_controller.refreshDayFoods.bind(g_controller), sseStateUpdateCB, console.log);
}

window.addEventListener("load", onPageLoaded);
