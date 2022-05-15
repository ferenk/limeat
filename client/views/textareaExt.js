export { TextareaExt };

class TextareaExt {
    /** @type {String} The whole text of the textarea, separated by '\n's (WARNING: not updated automatically, you need to call updateRowStr()!)  */
    rowsStr = '';
    /** @type {String[]} All rows of the textarea */
    rows = [];
    /** @type {JQuery} jQuery object of our textarea's widget */
    jqItem = $('html');
    /** @type {Number[]} The current row number of the cursor */
    cursorPos = [-1, -1];
    /** @type {boolean} Focused mode is enabled */
    focusedMode = false;
    /** @type {Number} Index of the focused line (within the rows array) */
    selectedLine = -1;
    /** @type {Number} The first line which contained a parsable meal */
    mealLineFirst = -1;
    /** @type {Number} The last line which contained a parsable meal */
    mealLineLast = -1;
    /**
     * Callback for the textarea's input event
     * @callback OnUserInputCB
     * @param {boolean?} userEvent True if this is a real user event (and not a call from another part of the system)
     * @returns {void}
     */

    /** @type {OnUserInputCB?} User changed the text box */
    onTextChangedCB = null;
    /** @type {OnUserInputCB?} User moved the cursor */
    onCursorMovedCB = null;

    /**
     * Creates a new editor widget
     */
    constructor()
    {
        this.resetState();
    }

    /**
     * Sets the JQuery selector and initializes event subscriptions
     * @param {String} jqSelector selector for a textarea HTML widget 
     */
    initialize(jqSelector)
    {
        this.jqItem = $(jqSelector);

        this.jqItem.on('input', () => {
            this.onTextChanged();
        });

        this.jqItem.on('keydown keyup click focusin', () => {
            this.onCursorMoved();
        });

        $('input[type=radio][name=txtMealsModes]').change((e) => {
            // memo: How to get the current value of the radio button
            let selectedMode = ($(e.target).attr('id') ?? '').replace(/^txtMeals/, '').replace(/Mode$/, '');
            this.onDisplayModeChanged(selectedMode.toLowerCase());
        });
    }

    /**
     * Register a callback
     * @param {String} eventName 
     * @param {OnUserInputCB} callback 
     */
    on(eventName, callback) {
        if (eventName == 'input') {
            this.onTextChangedCB = callback;
        }
        else if (eventName == 'cursor') {
            this.onCursorMovedCB = callback;
        }
    }

    /**
     * 
     * @param {String} mode The mode selected by the user (possible values: 'normal', 'scrolled', 'focused')
     */
    onDisplayModeChanged(mode)
    {
        // only handle user triggered events! (to prevent infinite loops)
        let setToFocused = (mode != 'normal');
        $(this.jqItem).toggleClass('focusedMode', setToFocused);
    }

    /**
     * Handle the input event of the text box
     * @param {Event?} event 
     */
    onTextChanged(event = null)
    {
        if (this.focusedMode)
        {
            // @ts-ignore:next-line (<multiple types> cannot set to 'string')
            this.rows[this.selectedLine] = this.jqItem.val();
            // this.updateRowsStr(); - this field will not updated automatically (it is rarely used)
        }
        else
        {
            // @ts-ignore:next-line (<multiple types> cannot set to 'string')
            this.rowsStr = this.jqItem.val();
            this.updateRows();
        }

        this.onCursorMoved();

        if (this.onTextChangedCB != null)
        {
            this.onTextChangedCB(false);
        }
    }

    /**
     * Updates the parsed internal representation of the textarea with or without changing its value
     * @param {String} newText 
     * @param {boolean?} updateHtmlItem 
     */
    changeText(newText, updateHtmlItem)
    {
        if (newText != null && this.focusedMode)
            // @ts-ignore:next-line (Cannot find name 'Exception')
            throw new Exception('Cannot replace the whole text while in focused mode!');

        if (newText != null)
        {
            this.rowsStr = newText;
            this.updateRows();

            if (updateHtmlItem == true)
            {
                this.jqItem.val(this.rowsStr);
                this.onCursorMoved();

                let refreshEvent = new Event('input');
                this.jqItem[0].dispatchEvent(refreshEvent);
            }
        }
    }

    updateRows()
    {
        this.rows = this.rowsStr.split('\n');
    }

    updateRowsStr()
    {
        this.rowsStr = this.rows.join('\n');
    }

    /**
     * Update the current cursor position
     */
    onCursorMoved()
    {
        // @ts-ignore:next-line (selectionStart does not exist on HTMLElement)
        let textBufferTillTheCursorStr = this.rowsStr.substr(0, this.jqItem[0].selectionStart).split('\n');
        this.cursorPos[1] = textBufferTillTheCursorStr.length - 1;
        this.cursorPos[0] = textBufferTillTheCursorStr[this.cursorPos[1]].length;
        if (this.onCursorMovedCB != null)
            this.onCursorMovedCB(false);
    }

    /**
     * Move the cursor to the given position
     * @param {Number} x
     * @param {Number} y
     */
    moveCursorTo(x, y)
    {
        let aggregatedPosN = 0;
        for (let yCurr = 0; yCurr < this.rows.length; yCurr++)
        {
            if (yCurr >= y)
            {
                aggregatedPosN += x;
                break;
            }
            aggregatedPosN += this.rows[yCurr].length + 1;
        }
        //this.jqItem[0].selectionStart = this.jqItem[0].selectionEnd = aggregatedPosN;
        this.moveCursorToPos(this.jqItem[0], aggregatedPosN);
        //alert(`move cursor to ${x}, ${y}, aggregated: ${aggregatedPosN}`);
    }

    moveCursorToPos(element, pos)
    {
        this.setInputSelectionRange(element, pos, pos);
    }

    setInputSelectionRange(element, selectionStart, selectionEnd)
    {
        setTimeout(() =>
        {
            element.selectionStart = selectionStart;
            element.selectionEnd = selectionEnd;
        });
    }

    /**
     * Resets all the internal/statistical counters
     */
    resetState() {
        this.mealLineFirst = this.mealLineLast = -1;
        this.selectedLine = 0;
    }

    /**
     * Switch to focused mode or back to normal mode
     * @param {boolean} focusedMode 
     * @param {Number?} selectedLine 
     * @returns 
     */
    switchMode(focusedMode, selectedLine = null) {
        if (selectedLine == null || selectedLine == NaN)
            selectedLine = -1;

        if (this.focusedMode == focusedMode && this.selectedLine == selectedLine)
            return;

        // add empty rows if needed
        while (focusedMode && !(selectedLine < this.rows.length))
            this.rows.push('');

        this.focusedMode = focusedMode;
        if (selectedLine != -1)
            this.selectedLine = selectedLine;
        if (focusedMode) {
            if (this.selectedLine != -1)
                this.jqItem.val(this.rows[this.selectedLine]);
        }
        else
            this.jqItem.val(this.rowsStr);
    }

    /**
     * Remove last lines from the textarea. Useful before extending it
     */
    removeLastEmptyLines()
    {
        // remove the last empty lines
        let lastRow = '';
        while (this.rows.length >= 1) {
            lastRow = this.rows[this.rows.length - 1];          
            if (lastRow.length == 0)
                this.rows.pop();
            else
                break;
        }

        // show the new, extended meal text
        this.rowsStr = this.rows.join('\n');
        this.jqItem.val(this.rowsStr);
        this.focusToTheEnd();
    }

    /**
     * Focus to the last row of the textarea
     */
    focusToTheEnd()
    {
        /** @type {HTMLInputElement} */
        // @ts-ignore:next-line (HTMLElement is not an HTMLInputElement, some properties are missing)
        let textInputElement = this.jqItem[0];
        textInputElement.selectionStart = textInputElement.selectionEnd = this.rowsStr.length;
        this.jqItem[0].focus();
        //qTask? onCursorPositionChanged()
    }

    /**
     * Add NEW text to the textarea.
     * @description Feature: If it is the same as the last line, the textarea will be unchanged.
     * Note: Useful when using multiple events leading to redundant text additions.
     * @param {boolean} updateUi - update the UI (DOM) after adding the text (default: true)
     * @param {String} newText - the text to add to the textarea
     */
    appendNewText(newText, updateUi = false)
    {
        // append text (COND: if the text buffer is empty or it ends with a different text)
        if (this.rows.length == 0 || this.rows[this.rows.length - 1].localeCompare(newText) != 0)
        {
            this.rows.push(newText);
        }

        if (this.focusedMode)
            this.selectedLine = this.rows.length - 1;

        // option: Update the UI
        if (updateUi != false)
            this.updateUi();
    }

    /**
     * Update the DOM textarea
     * @param {boolean} focusToTheEnd - Move the cursor to the end of the input
     */
    updateUi(focusToTheEnd = false)
    {
        if (this.focusedMode)
        {
            this.jqItem.val(this.rows[this.selectedLine]);
        }
        else
        {
            this.updateRowsStr();
            this.jqItem.val(this.rowsStr);
        }

        if (focusToTheEnd != false)
            this.focusToTheEnd();
    }
}