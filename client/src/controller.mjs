import { traceMethodCalls } from './util/callTracker.mjs'

import { nodeXHRComm } from './comm/comm.mjs';
import { printMoment, parseIsoDate, toFixedFloat, getCurrentTimeStr, isError } from './util/util.mjs';
import { LocalStorage } from "./comm/localStorage.mjs";

import { showMessage } from './util/ui/uiUtils.mjs';

import { TextareaExt } from './views/textareaExt.mjs';
import { TextareaHighlight } from './views/textareaHighlight.mjs';
import { OutputTable } from './views/outputTable.mjs';
import { Food } from './data/foodData.mjs';
import { MealListLang } from './data/mealListLang.mjs';
import { SearchTools } from './views/tools/search.mjs';
import { AutoCompleteUi } from './views/tools/autoComplete.mjs';
import { UserLogSync} from "./views/tools/userLogSync.mjs";

import { coolConfirm, coolMessage } from './views/uiHelper.mjs';
import { g_appState, FoodLogEntry } from "./app/states.mjs";

class Controller
{
    saveButtonNormalMsg = "SAVE";
    //conflictCheck = traceMethodCalls(new UserLogSync(), false);
    conflictCheck = new UserLogSync();

    /** @type {String | null} */
    currentCursorSection = null;

    lastDbFoodInput = '';
    /** @type {number} */
    lastDbUpdate = Number(new Date());


    /**
     * Creates a new output table widget
     * @param { TextareaExt } mealsDiaryText
     * @param { TextareaHighlight } mealsDiaryTextHighlight
     * @param { OutputTable } outputTable
     * @param { MealListLang } mealListLang
     */
    constructor(mealsDiaryText, mealsDiaryTextHighlight, outputTable, mealListLang)
    {
        this.mealsDiaryText = mealsDiaryText;
        this.mealsDiaryTextHighlight = mealsDiaryTextHighlight;
        this.outputTable = outputTable;
        this.mealListLang = mealListLang;
        this.searchTools = traceMethodCalls(new SearchTools(this, this.onAutoCompleteActivated.bind(this)), false);
        this.mainHeaderIsOnTop = true;

        // initialize autocomplete
        let acCurrent = document.getElementById('autoCompleteCurrentWord');
        let acProgress = document.getElementById('autoCompleteProgress');
        let acResult = document.getElementById('autoCompleteResult');
        let acStartSearchCB = this.searchTools.autoCompleteSearchStart.bind(this.searchTools);
        this.autoComplete = traceMethodCalls(new AutoCompleteUi(this, acCurrent, acProgress, acResult, acStartSearchCB), false);

        // show welcome message
        showMessage('Welcome to LimEat!', 5000);
    }

    /* ------------------------
        HIGH LEVEL logic
    */
    onFoodInputChanged()
    {
        console.log('TRACE: onFoodInputChanged()');
        this.mealsDiaryText.mealLineFirst = this.mealsDiaryText.mealLineLast = -1;
        this.mealListLang.initCounters();
        this.updateSavedStateLight();
        //! Currently in main.js, move it the data module!
        // @ts-ignore:next-line (Cannot find name 'MobileDetect')
        this.mealListLang.processInput();
        this.updateUi_FocusedMode();
        this.updatePrevNextMealButtons();
        // recheck the server version - did it change (and we didn't receive an SSE notification somehow) - so should we update?
        if (Number(new Date()) - this.lastDbUpdate > 60000)
            this.refreshDayFoods(true);
        ///!!!
        this.mealsDiaryTextHighlight.render(this.mealsDiaryText.cursorPos[1]);
        this.autoComplete.updateInput(this.mealsDiaryText.rows[this.mealsDiaryText.cursorPos[1]], this.mealsDiaryText.cursorPos[0]);

        // refresh local storage
        const logEntryObj = LocalStorage.updateEntryObj( g_appState.actFoodEntry );
        LocalStorage.saveEntry(logEntryObj, 1);
    }

    /**
     * Event handler for cursor move events
     * @param {boolean?} isUserEvent true if the event comes directly from the user
     * @param {number[]?} prevCursorPos previous cursor position
     */
    onCursorMoved(isUserEvent, prevCursorPos) {
        let cursorPos = this.mealsDiaryText.cursorPos;

        if (prevCursorPos == null || prevCursorPos[1] != cursorPos[1])
        {
            this.selectRow(cursorPos[1], isUserEvent ?? false);
            this.mealsDiaryTextHighlight.render(cursorPos[1]);
            //? this.updateUi_FocusedMode();
            this.updatePrevNextMealButtons();
        }

        // add extra dark background color to the current food
        let thisRowSections = this.mealsDiaryTextHighlight.htmlBuffer.outBufferSectionsByRow.get(cursorPos[1]);
        if (thisRowSections)
            for (let thisRowSectionIter of thisRowSections)
            {
                if (thisRowSectionIter.startPos <= cursorPos[0] && cursorPos[0] <= thisRowSectionIter.endPos + 1)
                {
                    if (thisRowSectionIter.sectionName)
                    {
                        this.changeHighlightedFoodPart(`.${thisRowSectionIter.sectionName}`);

                        /** @type { Food | undefined } */
                        // @ts-ignore:next-line ('Object' is not assignable to type 'Food')
                        let foodPart = thisRowSectionIter.metadata?.foodPart;
                        let allKCalLabel = document.querySelector('#lbCurrentFoodPartKCal')
                        if (allKCalLabel)
                            allKCalLabel.textContent = `${ toFixedFloat(foodPart?.computedkcal) || 0} kc`;

                        break;
                    }
                }
            }

        this.autoComplete.updateInput(this.mealsDiaryText.rows[cursorPos[1]], cursorPos[0]);
    }

    /**
     *
     * @param {String} newSelector
     */
    changeHighlightedFoodPart(newSelector)
    {
        if (this.currentCursorSection != null)
            this.modifySelectorsBgColor(this.currentCursorSection, null, false);
        this.modifySelectorsBgColor(this.currentCursorSection = newSelector, 'hsla(78, 38%, 44%, 0.55)', true);
    }

    /**
     *
     * @param {String} query
     * @param {String | null} color
     * @param {boolean} add
     */
    modifySelectorsBgColor(query, color, add)
    {
        if (query == null || query.length == 0)
            return;

        try
        {
            /** @type {NodeListOf<HTMLElement>} */
            let selectorItems = document.querySelectorAll(query);

            selectorItems.forEach((selectorItem) => {
                if (add)
                    selectorItem.style.setProperty('background-color', color ?? 'hsla(78, 38%, 44%, 0.55)');
                else
                    selectorItem.style.removeProperty('background-color');
            });
        }
        catch(e)
        {
            console.log(`Error while trying to evaluate selector: '${query}'\nException: ${e}`)
        }
    }

    onUserOrDateChanged() {
        if (window.localStorage != null) {
            window.localStorage.optUserName = $('#tUser').val();
        }

        let currentDayFormattedStr = printMoment(this.mealListLang.currentDayMoment);
        $('#tDate').val(currentDayFormattedStr);

        this.refreshDayFoods();
    }

    onDateEntered()
    {
        // get the date part of the entered text
        const domEl = document.getElementById('tDate');
        const domDateInput = (domEl instanceof HTMLInputElement ? domEl : null);
        // date input field has to contain an ISO based date field at least (e.g 2024-12-31)
        if ((domDateInput?.value?.length ?? 0) < 10)
            return;

        // process the date: convert to moment and complete it
        let enteredDateStr = (domDateInput ? domDateInput.value || '' : '');
        enteredDateStr = enteredDateStr.trim().substring(0, 10);
        /// TODO Format error handling
        let enteredMoment = parseIsoDate(enteredDateStr);
        if (enteredMoment != null)
        {
            this.mealListLang.currentDayMoment = enteredMoment;
            this.onUserOrDateChanged();
        }
    }

    //todo check usages. applySettings seem strange for example!
    refreshDayFoods(justCompare = false)
    {
        let self = this;
        let conflictCheck = this.conflictCheck;
        console.log(`refreshDayFoods(justCompare: ${justCompare})...`);

        // load daily log entry from the DB
        let appState = { ...g_appState };
        const paramLogEntry = LocalStorage.updateEntryObj( new FoodLogEntry() );
        nodeXHRComm(
            'node_api/read_foodrowdb',
            paramLogEntry,
            (!justCompare ? self.onDailyFoodRecordArrived.bind(self, appState, self) : self.onDailyFoodRecordArrived2.bind(self, appState))
        );
    }

    //todo Option for auto cleanup (?)
    onAddMeal()
    {
        this.mealsDiaryText.appendNewText(`${getCurrentTimeStr()} `);
        this.onTextUpdated();
    }

    onTextUpdated()
    {
        this.mealsDiaryText.updateRowsStr();
        this.mealsDiaryText.updateUi();
        this.onFoodInputChanged();
        if (this.mealsDiaryText.focusedMode)
        {
            this.mealsDiaryText.cursorPos[1] = this.mealsDiaryText.mealLineLast;
            this.mealsDiaryText.domItem.value = this.mealsDiaryText.rows[this.mealsDiaryText.cursorPos[1]];
        }
        this.updateUi_FocusedMode();
        this.updatePrevNextMealButtons();
        this.mealsDiaryText.domItem.blur();
        this.mealsDiaryText.domItem.focus();
    }

    /**
     * @param {string} text
     */
    onAutoCompleteActivated(text)
    {
        let textarea = this.mealsDiaryText;
        let autoComp = this.autoComplete;
        if (autoComp.currentWordEndIndex >= textarea.rows[textarea.cursorPos[1]].length || textarea.rows[textarea.cursorPos[1]][autoComp.currentWordEndIndex] != ' ')
            text += ' ';

        this.mealsDiaryText.replaceText(text, this.autoComplete.currentWordBeginIndex, this.autoComplete.currentWordEndIndex);
        this.onTextUpdated();
    }

    /**
     * Switch to the next or previous DAY
     * @param {boolean} nextDay true - next day, false - previous day
     */
    onPrevNextDay(nextDay)
    {
        // automatically DISABLE focused mode on day change (todo: is it a workaround?)
        if (this.mealsDiaryText.focusedMode) {
            $('#outputTableModes #focused').prop('checked', false);
            this.mealsDiaryText.switchMode(false);
            this.updateUi_FocusedMode();
        }

        // calculate timestamp
        const ONE_DAY_MILLIS = 24 * 60 * 60 * 1000;
        const currentMoment = this.mealListLang.currentDayMoment.milliseconds();

        this.onSpecificDay(nextDay ? currentMoment + ONE_DAY_MILLIS : currentMoment - ONE_DAY_MILLIS);
    }

    /**
     * Switch to the specified day
     * @param {number} dayMoment
     */
    onSpecificDay(dayMoment)
    {
        this.mealListLang.currentDayMoment.milliseconds(dayMoment);
        this.onUserOrDateChanged();

        let newSelectedLine = this.outputTable.checkPrevNextMeal(null,
            this.mealsDiaryText.cursorPos[1], this.mealsDiaryText.mealLineFirst, this.mealsDiaryText.mealLineLast);
        this.selectRow(newSelectedLine, true);
        //! refactor?
        this.updatePrevNextMealButtons();
    }

    updatePrevNextMealButtons()
    {
        let txt = this.mealsDiaryText;
        let prevMealIdx_checked = this.outputTable.checkPrevNextMeal(false, txt.cursorPos[1], txt.mealLineFirst, txt.mealLineLast);
        let nextMealIdx_checked = this.outputTable.checkPrevNextMeal(true, txt.cursorPos[1], txt.mealLineFirst, txt.mealLineLast);
        $('#btPrevMeal').prop('disabled', prevMealIdx_checked == txt.cursorPos[1]);
        $('#btNextMeal').prop('disabled', nextMealIdx_checked == txt.cursorPos[1]);
    }


    /* ------------------------
       DATABASE communication
    */
    async onDailyFoodRecordArrived(appState, controller, xhr, ev) {
        // @ts-ignore:next-line (dynamic type check)
        if (!isError(ev) && ev.type == 'load') {
            let selEntry = null;
            let remoteEntry = null;
            try {
                remoteEntry = JSON.parse(xhr.responseText);
                remoteEntry.food_data = remoteEntry.food_data.replaceAll('\\n', '\n');
            } catch (e) {
                // try to handle the result as an old log, load it as a plain text response
                const selEntry = LocalStorage.updateEntryObj(new FoodLogEntry());
                selEntry.food_data = xhr.responseText;
                console.log(`Warning: While parsing the response from the server! - ${e}\r\nJSON data (length: ${xhr.responseText.length}): ${xhr.responseText}`);
                console.log(`Warning: onDailyFoodRecordArrived(): old log format detected for day: ${selEntry.date}`);
            }

            //??? safety check - we can't suppose more as log can be even '' if the user pushed "Save" with an empty editor
            //g_appState.jobsRunning.delete('updatingFoodLogs');

            // check cache for the latest food logs version
            const paramsEntry = LocalStorage.updateEntryObj(new FoodLogEntry());
            const cachedEntry = LocalStorage.loadEntry(paramsEntry);

            this.conflictCheck.checkForConflicts(appState, controller, remoteEntry, cachedEntry);
        }
    }



    /**
     * Communication handler: Incoming whole daily food record
     * @param {XMLHttpRequest} xhr
     * @param {ProgressEvent<XMLHttpRequestEventTarget> | Error} ev
     */
    async onDailyFoodRecordArrived2(appState, xhr, ev)
    {
        // @ts-ignore (Property 'type' does not exist on type 'ProgressEvent<XMLHttpRequestEventTarget> | Error'.)
        if (!isError(ev) && ev.type == 'load')
        {
            try {
                const remoteEntry = JSON.parse(xhr.responseText);
                let content = remoteEntry.food_data.replaceAll('\\n', '\n');

                this.lastDbUpdate = Number(new Date());
                let isServerSideChanged = (this.lastDbFoodInput.localeCompare(content) != 0);
                if (isServerSideChanged)
                {
                    let reloadAnswer = await coolConfirm(
                        'warning',
                        'Update detected',
                        `Your food records has been updated on the server.<br>Refresh here, too?`,
                        null,
                        'Refresh',
                        'Skip',
                        true);
                    if (reloadAnswer)
                        this.refreshDayFoods();
                }

                setTimeout(() => { $('.btRefreshBg').removeClass('led-loading'); }, 200);
                this.mealsDiaryTextHighlight.setUiEnabled(true);
            } catch (e) {
                console.log(`Warning: While parsing the response from the server! - ${e}\r\nJSON data (length: ${xhr.responseText.length}): ${xhr.responseText}`);
            }
        }
    }


    /**
     * UI: Update the 'unsaved' light on the save button
     * @param {boolean} updateTextView if true, then the text box will be updated first
     * @param {boolean} isSaved force the status to 'saved', skip check
     */
    updateSavedStateLight(updateTextView = true, isSaved = false)
    {
        if (updateTextView)
            this.mealsDiaryText.updateRowsStr();

        if (!isSaved)
            isSaved = (this.mealsDiaryText.rowsStr.localeCompare(this.lastDbFoodInput) == 0);

        if (isSaved == true) {
            //?? remove food data from the local cache
            //! TODO: move the save button logics to a separate class
            $('#btSave').html(this.saveButtonNormalMsg);
            $('#btSave').removeClass('unsaved');
        }
        else {
            // add food data to the local cache
            //?unneded? updateLocalStorage('change');
            // update save button
            $('#btSave').html('<font color="darkred">SAVE &#x25CF;</font>');
            $('#btSave').addClass('unsaved');
        }
    }

    /**
     * Set text box to 'saved' state
     * @param {boolean} updateTextView - if true, then the text box will be updated first
     */
    setSavedState(updateTextView = true)
    {
        if (updateTextView)
            this.mealsDiaryText.updateRowsStr();

        this.lastDbFoodInput = this.mealsDiaryText.rowsStr;
        this.lastDbUpdate = Number(new Date());
    }



    /**
     * Event: User changes the active row of the output table
     * @param {Event} event
     */
    onTableRowChange(event)
    {
        //! RECHECK!
        if (event.target != null) {
            let targetSpan = ($(event.target)).closest('span');
            let resTextCursorMoved = false;
            /** @type {String | null | undefined } */
            let targetSpanClass = null;
            if (targetSpan.length > 0) {
                targetSpanClass = targetSpan.attr('class');
                if (targetSpanClass && targetSpanClass.startsWith('section_'))
                {
                    // move cursor to the selected food part's last character
                    let highlightClassNameParts = targetSpanClass.split('_');
                    let highlightClassNamePartsCols = highlightClassNameParts[2].split('-');
                    if (highlightClassNamePartsCols && highlightClassNamePartsCols.length > 1)
                    {
                        this.selectRow(Number.parseInt(highlightClassNameParts[1]), false);
                        this.mealsDiaryText.moveCursorTo(Number.parseInt(highlightClassNamePartsCols[1]), Number.parseInt(highlightClassNameParts[1]));
                        resTextCursorMoved = true;
                    }
                    // highlight food part
                    this.changeHighlightedFoodPart(`.${targetSpanClass}`);
                }
            }
            if (!resTextCursorMoved)
            {
                // JQuery type magic, hopefully works
                // @ts-ignore:next-line (Cannot find name 'MobileDetect')
                let targetRowId = ($(event.target)).closest('tr')[0].id;
                let targetRowNum = Number.parseInt(targetRowId.substr(2));
                if (!Number.isNaN(targetRowNum))
                    this.selectRow(targetRowNum, true);
            }
        }
        else console.log('ERROR: onTableRowChange(): event.target is null!');
    }

    /**
     * Switch to the next or previous MEAL
     * @param {boolean} nextMeal true - next meal, false - previous meal
     */
    onPrevNextMeal(nextMeal)
    {
        let mealIdx_checked =
            this.outputTable.checkPrevNextMeal(nextMeal,
                this.mealsDiaryText.cursorPos[1],this.mealsDiaryText.mealLineFirst, this.mealsDiaryText.mealLineLast);
        if (mealIdx_checked != this.mealsDiaryText.cursorPos[1])
        {
            // move the cursor to the end of the selected meal's line
            //@todo skipped, because it brings back the virtual keyboard on Android
            //if (!g_mobileMode)
            // select the next meal and move cursor to that meal
            this.mealsDiaryText.moveCursorTo(this.mealsDiaryText.rows[mealIdx_checked].length, mealIdx_checked);
            this.outputTable.selectRow(mealIdx_checked);
        }
        //!TODO Recheck!
        this.mealsDiaryText.updateUi();
        this.updatePrevNextMealButtons();

        this.mealsDiaryTextHighlight.render(this.mealsDiaryText.cursorPos[1]);
        this.mealsDiaryText.domItem.focus();
        this.mealsDiaryText.domItem.blur();
    }

    /**
     * Select the current row of the output table
     * @param {boolean} isUserEvent true if the event comes directly from the user
     * @param {Number} iRow
     */
    selectRow(iRow, isUserEvent)
    {
        this.mealsDiaryText.cursorPos[1] = iRow;
        this.outputTable.selectRow(iRow);
        if (isUserEvent)
        {
            this.mealsDiaryText.moveCursorTo(0, iRow);
        }
        this.updatePrevNextMealButtons();
        this.mealsDiaryTextHighlight.render(this.mealsDiaryText.cursorPos[1]);
    }

    /**
     *
     * @param {Number} iRow
     */
    focusRow(iRow)
    {
        $('#outTabFocusedMode').prop('checked', true);   //.is(":checked"))
        this.mealsDiaryText.switchMode(true, iRow);
        this.updateUi_FocusedMode();
        this.selectRow(this.mealsDiaryText.cursorPos[1], false);
    }

    updateUi_FocusedMode()
    {
        // are we in focused mode?
        let focusedMode = this.mealsDiaryText.focusedMode;
        // change UI's focused mode on/off
        //!moved! $('#tableOut').toggleClass('outTabFocusedMode', focusedMode);
        $('#txtMealsDiary').toggleClass('focusedMode', focusedMode);
    }
}

export { Controller };
