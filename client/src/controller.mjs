export { Controller };

import { nodeXHRComm } from './data/comm.mjs';
import { printMoment, toFixedFloat, getCurrentTimeStr, isError } from './util/util.mjs';
import { TextareaExt } from './views/textareaExt.mjs';
import { TextareaHighlight } from './views/textareaHighlight.mjs';
import { OutputTable } from './views/outputTable.mjs';
import { coolConfirm } from './views/uiHelper.mjs';

class Controller
{
    dayParts =
    [{ pattern: '  |          |***(reggeli,tízórai)***', kcal: 0, g:0 },
     { pattern: '  |          |***(ebéd,uzsonna)***', kcal:0, g:0 },
     { pattern: '  |          |***(vacsora,nasik)***', kcal:0, g:0 },
     { pattern: '  |          |', kcal: 0, g: 0 }];
    mdHeader = '  | kCal     |  Idő    | Kaja típusa  \n  | -------- | ------- | -----------  \n';

    /* Output text generation */
    /** @type { Number } */
    currentDayPart = 0;
    /** @type { String } */
    foodOutputStr = '';
    /** @type { String[] } */
    foodSourceModifiedOutput = [];

    /* Time management */

    /** @type {any ?} */
    currentDayMoment = null;

    savedFoodInput = '';
    saveButtonNormalMsg = "SAVE";

    /** @type {String | null} */
    currentCursorSection = null;


    /**
     * XML HTTP communication: Callback for the received message
     *
     * @callback ProcessInputCallBack
     */

    /**
     * Creates a new output table widget
     * @param { TextareaExt } mealsDiaryText
     * @param { TextareaHighlight } mealsDiaryTextHighlight
     * @param { OutputTable } outputTable
     * @param { ProcessInputCallBack } processInputCB
     */
    constructor(mealsDiaryText, mealsDiaryTextHighlight, outputTable,  processInputCB)
    {
        this.mealsDiaryText = mealsDiaryText;
        this.mealsDiaryTextHighlight = mealsDiaryTextHighlight;
        this.outputTable = outputTable;
        this.processInputCB = processInputCB;
        this.mainHeaderIsOnTop = true;
    }

    /**
     * Sets the JQuery selector and initializes event subscriptions
     */
    initialize()
    {
    }

    /* ------------------------
       HIGH LEVEL logic
    */
    initCounters()
    {
        for (let i = 0; i < this.dayParts.length; i++) {
            this.dayParts[i].kcal = 0;
            this.dayParts[i].g = 0;
        }
        this.currentDayPart = 0;
        this.foodOutputStr = `### ${printMoment(this.currentDayMoment).slice(8)}  \n` + this.mdHeader;
        this.foodSourceModifiedOutput = [];
        $('.mealRow').remove();
    }

    onFoodInputChanged()
    {
        this.mealsDiaryText.mealLineFirst = this.mealsDiaryText.mealLineLast = -1;
        this.initCounters();
        this.updateSavedStateLight();
        //! Currently in main.js, move it the data module!
        // @ts-ignore:next-line (Cannot find name 'MobileDetect')
        this.processInputCB();
        this.updateUi_FocusedMode();
        this.updatePrevNextMealButtons();
        // recheck the server version - did it change (and we didn't receive an SSE notification somehow) - so should we update?
        if (new Date() - this.savedFoodDate > 60000)
            this.refreshDayFoods(true);
        ///!!!
        this.mealsDiaryTextHighlight.render(this.mealsDiaryText.cursorPos[1]);
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
            this.selectRow(cursorPos[1], isUserEvent == true);
            this.mealsDiaryTextHighlight.render(cursorPos[1]);
            //? this.updateUi_FocusedMode();
            this.updatePrevNextMealButtons();
        }

        // add extra dark background color to the current food
        let thisRowSections = this.mealsDiaryTextHighlight.tempHtmlBuffer.bufferSectionsByRow.get(cursorPos[1]);
        if (thisRowSections)
            for (let i = 0; i < thisRowSections.length; i++)
            {
                if (thisRowSections[i][0] <= cursorPos[0] && cursorPos[0] <= thisRowSections[i][1] + 1)
                {
                    if (thisRowSections[i][2])
                    {
                        this.changeHighlightedFoodPart(`.${thisRowSections[i][2]}`);

                        let foodPart = thisRowSections[i][3]?.foodPart;
                        document.querySelector('#lbCurrentFoodPartKCal').textContent = `${ toFixedFloat(foodPart?.computedkcal) || 0} kc`; 
                        break;
                    }
                }
            }
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

        let currentDayFormattedStr = printMoment(this.currentDayMoment);
        $('#tDate').val(currentDayFormattedStr);

        this.refreshDayFoods();
    }

    refreshDayFoods(justCompare = false)
    {
        console.log(`refreshDayFoods(justCompare: ${justCompare})...`);
        let currentDayStr = this.currentDayMoment.format('YYYY-MM-DD');
        let self = this;
        nodeXHRComm(
            'node_api/read_foodrowdb',
            {
                user: $('#tUser').val(),
                date: currentDayStr
            },
            (!justCompare ? self.onDailyFoodRecordArrived.bind(self) : self.onDailyFoodRecordArrived2.bind(self))
        );
    }

    //todo Option for auto cleanup (?)
    onAddMeal()
    {
        this.mealsDiaryText.appendNewText(`${getCurrentTimeStr()} `);
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
        const currentMoment = this.currentDayMoment.milliseconds();

        this.currentDayMoment.milliseconds(nextDay ? currentMoment + ONE_DAY_MILLIS : currentMoment - ONE_DAY_MILLIS);
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

    /**
     * Communication handler: Incoming whole daily food record
     * @param {XMLHttpRequest} xhr 
     * @param {ProgressEvent<XMLHttpRequestEventTarget> | Error} ev 
     */    onDailyFoodRecordArrived(xhr, ev)
    {
        // @ts-ignore:next-line (dynamic type check)
        if (!isError(ev) && ev.type == 'load') {
            let content = xhr.responseText;
            content = content.replaceAll('\\n', '\n');
            console.log('foodRecordRowArrived: ' + content);

            this.mealsDiaryText.changeText(content, true);
            this.savedFoodInput = content;      // it is the 'changed' text, so the 'unsaved' light will not be active
            this.savedFoodDate = new Date();
            this.onFoodInputChanged();
            this.updateSavedStateLight();
        }
    }

    async onDailyFoodRecordArrived2(xhr, ev)
    {
        if (!isError(ev) && ev.type == 'load')
        {
            let content = xhr.responseText;
            content = content.replaceAll('\\n', '\n');

            this.savedFoodDate = new Date();
            let isServerSideChanged = (this.savedFoodInput.localeCompare(content) != 0);
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
            isSaved = (this.mealsDiaryText.rowsStr.localeCompare(this.savedFoodInput) == 0);

        if (isSaved == true) {
            //! TODO: move the save button logics to a separate class
            $('#btSave').html(this.saveButtonNormalMsg);
            $('#btSave').removeClass('unsaved');
        }
        else {
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

        this.savedFoodInput = this.mealsDiaryText.rowsStr;
        this.savedFoodDate = new Date();
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
        //! Recheck!
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
