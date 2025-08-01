import { isError, copyText2Clipboard } from './util/util.mjs';

import { nodeXHRComm } from './comm/comm.mjs';
import { LocalStorage } from "./comm/localStorage.mjs";
import { FoodsDb } from './data/foodsDb.mjs';

import { Config } from './app/config.mjs';

import { Controller } from './controller.mjs';
import { TextareaExt } from './views/textareaExt.mjs';
import { TextareaHighlight } from './views/textareaHighlight.mjs';
import { OutputTable } from './views/outputTable.mjs';
import { MealListLang } from './data/mealListLang.mjs';

import { g_config, g_appState, AppState, FoodLogEntry } from "./app/states.mjs";

import { traceMethodCalls, enableCallTracker } from './util/callTracker.mjs'

import { CountdownButton } from './util/ui/countdownButton.mjs';

import { SSEClient } from './net/sseClient.mjs';

import { coolMessage } from './views/uiHelper.mjs';

const HEROKU_CLOUD_URL = 'limeat.herokuapp.com';

/** @type { TextareaExt } */
// @ts-ignore:next-line (Type '{}' is missing the following properties from type 'TextareExt'... (Proxy type problem))
//var g_mealsDiaryText = new TextareaExt();
const g_mealsDiaryText = traceMethodCalls(new TextareaExt(), false);

/** @type { TextareaHighlight } */
// @ts-ignore:next-line (Type '{}' is missing the following properties from type 'TextareaHighlight'... (Proxy type problem))
const g_mealsDiaryTextHighlight = traceMethodCalls(new TextareaHighlight(g_mealsDiaryText), false);

/** @type { OutputTable } */
// @ts-ignore:next-line (Type '{}' is missing the following properties from type 'OutputTable'... (Proxy type problem))
const g_outputTable = traceMethodCalls(new OutputTable(), false);

/** @type { MealListLang } */
// @ts-ignore:next-line (Type '{}' is missing the following properties from type 'MealListLang'... (Proxy type problem))
g_appState.mealListLang = traceMethodCalls(new MealListLang(g_config, g_mealsDiaryText, g_mealsDiaryTextHighlight), false);

/** @type { Controller } */
// @ts-ignore:next-line (Type '{}' is missing the following properties from type 'Controller'... (Proxy type problem))
const g_controller = traceMethodCalls(new Controller(g_mealsDiaryText, g_mealsDiaryTextHighlight, g_outputTable, g_appState.mealListLang), false);

let g_mobileMode = null;

let g_saveButton = new CountdownButton('#btSave', 'SAVED!', 'SAVE', 3, onSaveButtonPressed, null);

let g_sseClient = new SSEClient(g_config);
// assemble local backend URL (for fetch() calls)
const g_serverUrl = `${window.location.protocol}//${window.location.host}`;
let g_currentVersion = '';

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
    }
}

/**
 * EVENT: Save button clicked or ctrl-s pressed
 */
function onSaveButtonPressed()
{
    $('#btSave').html('SAVING...');
    // pre-process the current kcal data to be saved (all edit buffer)
    g_mealsDiaryText.updateRowsStr();

    // update localStorage (DB save)
    const logEntry = LocalStorage.updateEntryObj( g_appState.actFoodEntry );
    LocalStorage.saveEntry(logEntry, 3)

    // save to Mongo DB
    nodeXHRComm('node_api/save_foodrowdb', logEntry, onSaveFinished);
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

        // saved successfully => remove unsaved changes backup for the day being saved recently
        //?works without this? useLocalStorage('delete');

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
        $('.header1,.header2,.header3').css('font-size', '12px');
        $('.header1,.header2,.header3').css('padding-top', '4px');
        $('.header1,.header2,.header3').css('padding-bottom', '4px');
        $('.topContent').css('padding-right', '12px');
        $('#tableOut').css('font-size', '110%');
    }
    else {
        $('body').css('width', '640px');
        $('.header1,.header2,.header3').css('width', '616px');
    }
}

function placementCorrections()
{
    /** @type { HTMLElement | null } */
    let header1 = document.querySelector('.header1');
    /** @type { HTMLElement | null } */
    let header2 = document.querySelector('.header2');
    /** @type { HTMLElement | null } */
    let header3 = document.querySelector('.header3');
    if (header1 && header2 && header3)
    {
        header2.style.top = header1.offsetHeight + 'px';
        header3.style.top = header1.offsetHeight + header2.offsetHeight + 'px';
    }
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
    let domLEDs = document.getElementsByClassName('btRefreshBg');
    if (domLEDs != null && domLEDs.length > 0)
    {
        if (status == 'OPENED')
            // @ts-ignore:next-line (Property 'style' does not exist on type 'Element')
            domLEDs[0].style.background = 'olivedrab';
        else if (status == 'CLOSED' || status == 'DISCONNECTED')
            // @ts-ignore:next-line (Property 'style' does not exist on type 'Element')
            domLEDs[0].style.background = 'indianred';
        else if (status == 'CLOSED' || status == 'CONNECTING')
            // @ts-ignore:next-line (Property 'style' does not exist on type 'Element')
            domLEDs[0].style.background = 'gold';
        else
            // @ts-ignore:next-line (Property 'style' does not exist on type 'Element')
            domLEDs[0].style.background = 'slategray';
    }
}

/**
 * Init/reinit the SSE client
 */
function initSseClient()
{
    sseStateUpdateCB(null);
    g_sseClient.init(g_controller.refreshDayFoods.bind(g_controller), sseStateUpdateCB, console.log);
}

async function onPageLoaded()
{
    // reload the latest settings, state of the widgets (their scope is local, they can be different on the browsers the user uses)
    if (window.localStorage != null) {
        if (window.localStorage.optUserName != null) {
            $('#tUser').val(window.localStorage.optUserName);
        }
        if (window.localStorage.optTimePeriod != null)
            $('#searchDays').val(window.localStorage.optTimePeriod);
    }

    enableCallTracker(false);

    window.onerror = onUnhandledError.bind('window.onerror');
    /// @ts-ignore
	window.addEventListener('abort', onUnhandledError);
    /// @ts-ignore
	window.addEventListener('error', onUnhandledError);
    /// @ts-ignore
	window.addEventListener('unhandledrejection', onUnhandledError);

    g_mealsDiaryText.initialize(`#${Config.TEXTAREA_ID}`);
    g_mealsDiaryTextHighlight.initialize(`#${Config.TEXTAREA_ID}`);

    g_outputTable.initialize('#tableOut');
    g_mealsDiaryText.on('input', g_controller.onFoodInputChanged.bind(g_controller));
    g_mealsDiaryText.on('cursor', g_controller.onCursorMoved.bind(g_controller));

    // TODO: from settings: 1. threshold time 2. use current date or the previously saved one 3. add day of week postfix . date format 5. weekday abbreviation
    $('#lSaveErrorMsg').hide();
    $('#btRefresh').click(() =>
    {
        // reset idle timer
        let currentTime = Number(new Date());
        console.log(`UI: Refresh button pressed. Resetting current idle timer (${(currentTime - g_controller.lastDbUpdate)/1000} s)`);
        g_controller.lastDbUpdate = currentTime;

        // disable the meal log textarea and initiate the refresh
        g_mealsDiaryTextHighlight.setUiEnabled(false);
        $('.btRefreshBg').addClass('led-loading');
        g_controller.refreshDayFoods();

        // re-init SSE if needed
        if (g_sseClient.status != 'OPENED')
            initSseClient();
    });

    // initiate DB reload
    nodeXHRComm('/node_api/read_calcdb', null, onCalcDbArrived)
    $('#tUser').on('input', () => g_controller.onUserOrDateChanged());
    //$('#tDate').on('input', onUserOrDateChanged);
    $('#btDateUp').on('click', () => g_controller.onPrevNextDay(false));
    $('#btDateDown').on('click', () => g_controller.onPrevNextDay(true));
    $('#btNextMeal').on('click', () => g_controller.onPrevNextMeal(true));
    $('#btPrevMeal').on('click', () => g_controller.onPrevNextMeal(false));
    $('#btAddMeal').on('click', () => g_controller.onAddMeal());
    $('#tDate').on('change', () => g_controller.onDateEntered());

    $('#searchDays').on('change', () => g_controller.searchTools.onSearchOptionsChanged('daysChanged'));
    $('#searchDays').on('click', () => g_controller.searchTools.onSearchOptionsChanged('daysClicked'));
    $('#searchResultFormat').on('change', () => g_controller.searchTools.onSearchOptionsChanged('resultChanged'));
    $('#searchResultFormat').on('click', () => g_controller.searchTools.onSearchOptionsChanged('resultClicked'));
    $('#tSearch').on('keydown', (event) => { if (event.which == 13) g_controller.searchTools.onSearchStarted() });
    $('#btSearch').on('click', () => g_controller.searchTools.onSearchStarted());
    $('#searchMealsResult').on('click', g_controller.searchTools.onSearchResultClicked.bind(g_controller.searchTools));

    $('input[type=radio][name=txtMealsModes]').change((e) => {
        // memo: How to get the current value of the radio button
        let selectedMode = ($(e.target).attr('id') ?? '').replace(/^txtMeals/, '').replace(/Mode$/, '');
        g_mealsDiaryText.onDisplayModeChanged(selectedMode.toLowerCase());
        //todo ? (previously it failed as onDisplayModeChanged() is not yet implemented) g_mealsDiaryTextHighlight.onDisplayModeChanged(selectedMode.toLowerCase());
    });


    /** Developer options section for experimental features: Controls init (hide section by default, fill options) */
    $('#optsDevSection').hide();
    await setupFrontendVersions();
    $('#devMode').change( function(){
        //? $('#devMode').detach().appendTo('#optsDev');
        // @ts-ignore:next-line (Property name 'checked' does not exist on type 'HTMLInputElement')
        if (this.checked)
            $('#optsDevSection').slideDown(150);
        else
            $('#optsDevSection').slideUp(100);
    });
    // support for emergency disablement of highlighting (for the case of layering problems, when it's hard to read the text)
    $('#syntaxHighlight').change(function ()
    {
        // @ts-ignore:next-line (Property name 'checked' does not exist on type 'HTMLInputElement')
        if (this.checked) {
            $('.textarea_editor').css('color', 'rgba(93, 96, 109, 0.692)');
            $('.textarea_editor').css('background', 'transparent');
            $('.textarea_highlighter').css('opacity', 1);
        }
        else {
            $('.textarea_editor').css('color', 'rgb(0, 0, 0)');
            $('.textarea_editor').css('background', 'white');
            $('.textarea_highlighter').css('opacity', 0);
        }
    });

    $('#optScaleType,.scaleOpts').change(() => {
        // @ts-ignore:next-line (<multiple types> cannot set to 'string')
        g_config.scaleType = ($('#optScaleType :selected').val());
        $('.scaleOpts').toggle(g_config.scaleType != 'barista');
    });
    $('.scaleOpts').hide();

    // Apply button action
    $('#btApplySettings').on('click', async () => {
        /** @type {string} */
        let clientId = $('#optClientId').val()?.toString() || '';
        if (clientId != null && clientId != '') {
            localStorage.optClientId = g_config.finalClientId = g_config.clientId = clientId;
            g_sseClient.init(g_controller.refreshDayFoods.bind(g_controller), sseStateUpdateCB, console.log);
        }
        // another version selected? => redirect browser to that client
        const optVersion = document.getElementById('optClientVersion');
        var targetVersion = optVersion.options[optVersion.selectedIndex].value;
        const strSavedMsg = 'Changes have been applied and saved!';
        if (targetVersion != g_currentVersion) {
            console.log(`Client version change requested: ${g_currentVersion} => ${targetVersion}`);
            let targetVersionUrl = '';
            if (targetVersion != 'latest') {
                targetVersionUrl = `/client_versions/${targetVersion}/main.html`;
            }
            // redirect to the new URL
            await coolMessage('success', 'Changes applied', strSavedMsg + `<br>UI version <b>${targetVersion}</b> will be loaded in <strong/>`, null, 5000, () => {
                console.log(`TRACE: Redirecting browser to ${g_serverUrl + targetVersionUrl}...`);
                window.location.href = g_serverUrl + targetVersionUrl;
            });
        } else {
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
    if (location.hostname != HEROKU_CLOUD_URL)
    {
        let headersDiv = document.getElementById(Config.TEXTAREA_ID);
        if (headersDiv != null)
            headersDiv.style.outline = '4px dashed rgba(255, 165, 18, 0.9)';
    }

    /** Button, feature: Export MD output to the clipboard */
    $('#btCopyMD').on('click', () => {
        copyText2Clipboard(g_appState.mealListLang.foodOutputStr);
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
    $('#tableOut').on('click', g_controller.onTableRowChange.bind(g_controller));

    $('#searchToggle').on('click', () => { g_controller.searchTools.onSearchToolsToggle(); });
    $('#searchClear').on('click', () => { g_controller.searchTools.onSearchClear(); });

    handleMobileMode();
    placementCorrections();

    initSseClient();
}

// Developer feature: fetch local frontend's accessible versions (and fill the option list!)
async function setupFrontendVersions() {
    const response = await fetch(`${g_serverUrl}/node_api/client_versions`);
    if (!response.ok) {
        return;
    }
    const clientFolderVersions = await response.json();
    const sortedFolderVersionNames = [ 'latest' ];
    clientFolderVersions.sort((a, b) => b.name.localeCompare(a.name));
    clientFolderVersions.forEach(folder => { sortedFolderVersionNames.push(folder.name); })

    // enumerate all versions and fill options list
    let currentVersionEl = null;
    sortedFolderVersionNames.forEach(folderName => {
        const optionEl = document.createElement('option');
        optionEl.value = folderName;
        optionEl.innerText = folderName;

        // select the currently active version
        if (window.location.href.includes(`/${folderName}/`) || folderName.localeCompare('latest') == 0) {
            currentVersionEl = optionEl;
        }
        document.getElementById('optClientVersion').appendChild(optionEl);
    })
    currentVersionEl.setAttribute("selected", "selected");
    g_currentVersion = currentVersionEl.value;
}

/**
 * @param {string | Object | PromiseRejectionEvent | ErrorEvent | null} errMsg
 * @param {string | undefined} url
 * @param {number | undefined} lineNumber
 */
function onUnhandledError(errMsg, url, lineNumber /*, colno, error*/)
{
    console.error("ERROR:: onUnhandled() called");
	// 1. errMsg is an Event
	if (errMsg != null && errMsg instanceof PromiseRejectionEvent && errMsg.reason != null) {
		console.error(`ERROR: Unhandled Promise exception occured: ${errMsg} (reason: ${errMsg.reason})\r\nStack:\r\n${errMsg.reason.stack}`);
		errMsg.preventDefault();
	}
	// 2. errMsg is an Error obj
	else if (errMsg != null && errMsg instanceof ErrorEvent) {
		console.error("ERROR:: Unhandled exception occured at file: " + errMsg.filename + ", line: " + errMsg.lineno + ", msg: " + errMsg.message); // log error obj
	}
	// 3. errMsg is a String
	else console.error(null, "ERROR:: Unhandled exception occured at url: " + url + ", line: " + lineNumber + ", msg: " + errMsg); // log parametrized error message
	return true;
}

window.addEventListener("load", onPageLoaded);
