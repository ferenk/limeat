export { Controller };

import { nodeXHRComm } from './data/comm.js';
import { printMoment, getCurrentTimeStr } from './util/util.js';
import { TextAreaExt } from './views/textAreaExt.js';
import { OutputTable } from './views/outputTable.js';

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

    /* Time management */

    /** @type {any ?} */
    currentDayMoment = null;

    savedFoodInput = '';
    saveButtonNormalMsg = "SAVE";


    /**
     * Creates a new output table widget
     * @param { TextAreaExt } mealsDiaryText
     * @param { OutputTable } outputTable
     */
    constructor(mealsDiaryText, outputTable,  processInputCB)
    {
        this.mealsDiaryText = mealsDiaryText;
        this.outputTable = outputTable;
        this.processInputCB = processInputCB;
    }

    /**
     * Sets the JQuery selector and initializes event subscriptions
     * @param {String} jqSelector selector for a textarea HTML widget 
     */
    initialize(jqSelector)
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
    }

    onCursorMoved(userEvent)
    {
        this.mealsDiaryText.selectedLine = this.mealsDiaryText.cursorPos[1];
        this.selectRow(this.mealsDiaryText.selectedLine, userEvent);
        this.updateUi_FocusedMode();
        this.updatePrevNextMealButtons();
    }

    onUserOrDateChanged() {
        if (window.localStorage != null) {
            window.localStorage.currentUser = $('#tUser').val();
        }

        let currentDayFormattedStr = printMoment(this.currentDayMoment);
        $('#tDate').val(currentDayFormattedStr);

        let currentDayStr = this.currentDayMoment.format('YYYY-MM-DD');
        let self = this;
        nodeXHRComm('node_api/read_foodrowdb', { user: $('#tUser').val(), date: currentDayStr }, self.onDailyFoodRecordArrived.bind(self));
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
            this.mealsDiaryText.selectedLine = this.mealsDiaryText.mealLineLast;
            this.mealsDiaryText.jqItem.val(this.mealsDiaryText.rows[this.mealsDiaryText.selectedLine]);
        }
        this.updateUi_FocusedMode();
        this.updatePrevNextMealButtons();
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

        this.mealsDiaryText.selectedLine = this.outputTable.checkPrevNextMeal(null,
            this.mealsDiaryText.selectedLine, this.mealsDiaryText.mealLineFirst, this.mealsDiaryText.mealLineLast);
        //! refactor?
        this.updatePrevNextMealButtons();
    }

    updatePrevNextMealButtons()
    {
        let txt = this.mealsDiaryText;
        let prevMealIdx_checked = this.outputTable.checkPrevNextMeal(false, txt.selectedLine, txt.mealLineFirst, txt.mealLineLast);
        let nextMealIdx_checked = this.outputTable.checkPrevNextMeal(true, txt.selectedLine, txt.mealLineFirst, txt.mealLineLast);
        $('#btPrevMeal').prop('disabled', prevMealIdx_checked == this.mealsDiaryText.selectedLine);
        $('#btNextMeal').prop('disabled', nextMealIdx_checked == this.mealsDiaryText.selectedLine);
    }


    /* ------------------------
       DATABASE communication
    */

    /**
     * Communication handler: Incoming whole daily food record
     * @param {XMLHttpRequest} xhr 
     * @param {ProgressEvent<XMLHttpRequestEventTarget>} ev 
     */
    onDailyFoodRecordArrived(xhr, ev)
    {
        if (ev.type == 'load') {
            let content = xhr.responseText;
            content = content.replaceAll('\\n', '\n');
            console.log('foodRecordRowArrived: ' + content);

            this.mealsDiaryText.changeText(content, true);
            this.savedFoodInput = content;      // it is the 'changed' text, so the 'unsaved' light will not be active
            this.onFoodInputChanged();
            this.updateSavedStateLight();
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
    }



    /**
     * Event: User changes the active row of the output table
     * @param {Event} event 
     */
    onTableRowChange(event)
    {
        //! RECHECK!
        if (event.target != null) {
            // JQuery type magic, hopefully works
            // @ts-ignore:next-line (Cannot find name 'MobileDetect')
            let targetRowId = ($(event.target)).closest('tr')[0].id;
            let targetRowNum = Number.parseInt(targetRowId.substr(2));
            if (!Number.isNaN(targetRowNum))
                this.selectRow(targetRowNum, true);
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
                this.mealsDiaryText.selectedLine,this.mealsDiaryText.mealLineFirst, this.mealsDiaryText.mealLineLast);
        if (mealIdx_checked != this.mealsDiaryText.selectedLine)
        {
            // select the next meal
            this.mealsDiaryText.selectedLine = mealIdx_checked;
            // move the cursor to the end of the selected meal's line
            //@todo skipped, because it brings back the virtual keyboard on Android
            //if (!g_mobileMode)
            this.mealsDiaryText.moveCursorTo(this.mealsDiaryText.rows[mealIdx_checked].length, mealIdx_checked);
            this.outputTable.selectRow(mealIdx_checked);
            //this.updateUi_FocusedMode();
        }
        //! Recheck!
        this.mealsDiaryText.updateUi();
        this.updatePrevNextMealButtons();
    }

    /**
     * Select the current row of the output table
     * @param {Number} iRow 
     * @param {boolean} isUserEvent true if the event comes directly from the user
     */
    selectRow(iRow, isUserEvent)
    {
        this.mealsDiaryText.selectedLine = iRow;
        this.outputTable.selectRow(iRow);
        if (isUserEvent)
        {
            this.mealsDiaryText.moveCursorTo(0, iRow);
        }
        this.updatePrevNextMealButtons();
    }

    focusRow(iRow)
    {
        $('#outTabFocusedMode').prop('checked', true);   //.is(":checked"))
        this.mealsDiaryText.switchMode(true, iRow);
        this.updateUi_FocusedMode();
        this.selectRow(this.mealsDiaryText.selectedLine, false);
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
