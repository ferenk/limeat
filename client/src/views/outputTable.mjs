export { OutputTable };

class OutputTable
{
    /** @type {JQuery} jQuery object of our textarea's widget */
    jqItem = $('html');

    /**
     * Creates a new output table widget
     * @param {String} jqSelector for the table widget
     */
    constructor(jqSelector = '')
    {
        if (jqSelector.length > 0)
            this.initialize(jqSelector);
    }

    /**
     * Sets the JQuery selector and initializes event subscriptions
     * @param {String} jqSelector selector for a textarea HTML widget
     */
    initialize(jqSelector)
    {
        if (jqSelector) {
            this.jqItem = $(jqSelector);
        }

        this.jqItem.on('click', () => {
            //this.onTextChanged();
        });

        $('input[type=radio][name=outTabModes]').change((e) => {
            // memo: How to get the current value of the radio button
            let selectedMode = ($(e.target).attr('id') ?? '').replace(/^outTab/, '').replace(/Mode$/, '');
            this.onModeChange(selectedMode.toLowerCase());
        });
    }


    /**
     * Selects a row in the table (and unselects all others)
     * @param { Number } rowIdx the original textarea index (the row's id maps each row to a textarea index via its id, eg 'tr22')
     * @returns { boolean } true if the row was found and selected successfully, false otherwise
     */
    selectRow(rowIdx)
    {
        if (rowIdx != -1)
        {
            let jqRow = this.jqItem.find(`#tr${rowIdx}`);
            // only check the table's current row if it is not empty
            if (jqRow.length > 0)
            {
                // scroll to the line to select
                let rowPos = jqRow.position();
                this.jqItem[0].scrollTo({ top: this.jqItem[0].scrollTop + rowPos.top - 70, behavior: 'smooth' });
                // unselect all lines and then select the current one
                this.jqItem.find('tr').removeClass('selectedRow');
                this.jqItem.find(`#tr${rowIdx}`).addClass('selectedRow');

                let rowInfo = this.getRowInfo(rowIdx);
                $('#lbCurrentLineKCal').html(`${rowInfo.kCal} kc`);
                $('#lMealTime').html(`${rowInfo.mealTime}`);
            }
            else
            {
                $('#lbCurrentLineKCal').html(`- kc`);
                $('#lMealTime').html('--:--');
                return false;
            }
        }
        //! CHECK
        return false;
    }

    /**
     * Get the row info for the specified line
     * @param { Number } rowIdx the original textarea index (the row's id maps each row to a textarea index via its id, eg 'tr22')
     * @returns { OutputTableRowInfo } the selected item's info
     */
    getRowInfo(rowIdx)
    {
        // update headers (table => header): copy the kcal value from the table to the header kcal field
        /*
        $('#lbCurrentLineKCal').html(`${firstColumnVal} kc`);
        $('#lMealTime').html(secondColumnVal);*/
        let result = new OutputTableRowInfo();
        result.mealTime = this.jqItem.find(`#tr${rowIdx} td:nth-child(2)`).html() ?? '';
        result.kCal = parseFloat(this.jqItem.find(`#tr${rowIdx} td:nth-child(1)`).attr('value') ?? '0');

        return result;
    }

    /**
     * Check for the next or previous MEAL's index
     * @param {boolean?} nextMeal true - next meal, false - previous meal, null - don't change the focused item, just check
     * @param {Number} currIdx the current index
     * @param {Number} minIdx the minimal index of the range
     * @param {Number} maxIdx the maximal index of the range
     * @returns {Number} index of the prev/next meal (equals to 'selectedLine' if there is no more valid meal)
     */
    checkPrevNextMeal(nextMeal, currIdx, minIdx, maxIdx)
    {
        // check the range first: are we the OUTSIDE of it? (e.g after changing the current day) => return to the range for the first step
        if (currIdx < minIdx)
            return minIdx;
        if (currIdx > maxIdx)
            return maxIdx;

        // caller don't want to move the selected line - so we're returning with the current index
        if (nextMeal == null)
            currIdx;

        // start to search from the INSIDE of the range
        let mealIdx_toCheck = currIdx + (nextMeal ? 1 : -1);
        while (mealIdx_toCheck >= minIdx && mealIdx_toCheck <= maxIdx)
        {
            if ($(`#tableOut #tr${mealIdx_toCheck}`).length > 0)
            {
                return mealIdx_toCheck;
            }
            else
                mealIdx_toCheck += (nextMeal ? 1 : -1);
        }
        return currIdx;
    }

    /**
     *
     * @param {String} mode The mode selected by the user (possible values: 'normal', 'scrolled', 'focused')
     */
    onModeChange(mode)
    {
        // only handle user triggered events! (to prevent infinite loops)
            // @ts-ignore:next-line (Property name 'checked' does not exist on type 'HTMLInputElement')
            // g_mealsDiaryText.switchMode(this.checked);
        let setToFocused = (mode != 'normal');
        $(this.jqItem).toggleClass('focusedMode', setToFocused);
            //? g_controller.updateUi_FocusedMode();
    }

    /**
     * Test a current instance in a living environment
     */
    test()
    {

    }
}

class OutputTableRowInfo
{
    /** @type {Number} the overall calculated kcal for that row*/
    kCal = 0;
    /** @type {String} in the format of 'HH:mm' */
    mealTime = '';
}