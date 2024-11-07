export { TextareaExt };

import { TextContainer } from '../util/text/textContainers.mjs';
import { replaceTextInTextarea } from '../util/util.mjs';


class TextareaExt extends TextContainer {
    /** @type {String} The whole text of the textarea, separated by '\n's (WARNING: not updated automatically, you need to call updateRowStr()!)  */
    rowsStr = '';
    /** @type {String[]} All rows of the textarea */
    rows = [];
    /** @type {HTMLTextAreaElement} DOM object of our textarea's widget */
    domItem = document.createElement("textarea");
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
     * @param {number[]?} prevCursorPos previous cursor position
     * @returns {void}
     */

    /** @type {OnUserInputCB?} User changed the text box */
    onTextChangedCB = null;
    /** @type {OnUserInputCB?} User moved the cursor */
    onCursorMovedCB = null;
    /** @type {OnUserInputCB?} User moved the cursor to a different row */
    onCursorRowMovedCB = null;

    /**
     * Creates a new editor widget
     */
    constructor()
    {
        super();
        this.resetState();
    }

    /**
     * Sets the JQuery selector and initializes event subscriptions
     * @param {String} htmlSelector selector for a textarea HTML widget
     */
    initialize(htmlSelector)
    {
        // @ts-ignore:next-line (HTMLElement is not an HTMLInputElement, some properties are missing)
        this.domItem = document.querySelector(htmlSelector);

        let self = this;

        this.domItem.addEventListener('input', () => { self.onTextChanged(); return true; });

        this.domItem.addEventListener('keydown', () => { self.onCursorMoved('keydown'); return true; });
        this.domItem.addEventListener('keyup',   () => { self.onCursorMoved('keyup'); return true; });
        this.domItem.addEventListener('click',   () => { self.onCursorMoved('click'); return true; });
        this.domItem.addEventListener('focusin', () => { self.onCursorMoved('focus in'); return true; });

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
        else if (eventName == 'cursorRow') {
            this.onCursorRowMovedCB = callback;
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
        $(this.domItem).toggleClass('focusedMode', setToFocused);
    }

    /**
     * Handle the input event of the text box
     */
    onTextChanged()
    {
        if (this.focusedMode)
        {
            this.rows[this.selectedLine] = this.domItem.value;
            // this.updateRowsStr(); - this field will not updated automatically (it is rarely used)
        }
        else
        {
            this.rowsStr = this.domItem.value;
            this.updateRows();
        }

        this.onCursorMoved();

        if (this.onTextChangedCB != null)
        {
            this.onTextChangedCB(false, this.cursorPos);
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
                this.domItem.value = this.rowsStr;
                this.onCursorMoved();

                let refreshEvent = new Event('input');
                this.domItem.dispatchEvent(refreshEvent);
            }
        }
    }

    /**
     * @override
     * @param {number} iRow
     */
    getRow(iRow)
    {
        return this.rows[iRow];
    }

    /**
     * @override
     */
    getRowCount()
    {
        return this.rows.length;
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
     * @param {String} eventName the DOM event currently handled
     */
    onCursorMoved(eventName = 'unknown')
    {
        console.log(`textAreaExt.onCursorMoved(eventName='${eventName}')`);
        // WHY? Probably object copy // let prevCursorPos = JSON.parse(JSON.stringify(this.cursorPos));
        let prevCursorPos = this.cursorPos;
        // @ts-ignore:next-line (selectionStart does not exist on HTMLElement)
        this.cursorPos = this.selectionPosToCursorPos(this.domItem.selectionStart);

        if (this.onCursorRowMovedCB != null && prevCursorPos[1] != this.cursorPos[1])
            this.onCursorRowMovedCB(false, prevCursorPos);

        if (this.onCursorMovedCB != null)
            this.onCursorMovedCB(false, prevCursorPos);
    }

    /**
     * @param { Number } selectionStart property of the textarea DOM
     * @return { Number[] } cursor position array
     */
    selectionPosToCursorPos(selectionStart)
    {
        // @ts-ignore:next-line (selectionStart does not exist on HTMLElement)
        let textBufferTillTheCursorStr = this.rowsStr.substr(0, selectionStart).split('\n');
        let cursorPos = [0, 0];
        //?this.moveCursorToPos(this.domItem, selectionStart);
        cursorPos[1] = textBufferTillTheCursorStr.length - 1;
        cursorPos[0] = textBufferTillTheCursorStr[cursorPos[1]].length;
        return cursorPos;
    }

    /**
     * @param { Number[] } cursorPos cursor position array
     * @return { Number } selectionStart property of the textarea DOM
     */
    cursorPosToDomPos(cursorPos)
    {
        let aggregatedPosN = 0;
        for (let yCurr = 0; yCurr < this.rows.length; yCurr++)
        {
            if (yCurr >= cursorPos[1])
            {
                aggregatedPosN += cursorPos[0];
                break;
            }
            aggregatedPosN += this.rows[yCurr].length + 1;
        }
        return aggregatedPosN;
    }

    /**
     * Move the cursor to the given position
     * @param {Number} x
     * @param {Number} y
     */
    moveCursorTo(x, y)
    {
        let newPos = [x, y];
        let selectionStart = this.cursorPosToDomPos(newPos);
        console.log(`TRACE:: moveCursorTo(x:${x}, y:${y}), selectionStart: ${selectionStart}`);
        this.moveCursorToPos(this.domItem, selectionStart);
        this.cursorPos = newPos;
    }

    /**
     * Move the cursor to the given character-based position (inside the textarea)
     * @param {HTMLTextAreaElement} element
     * @param {Number} pos
     */
    moveCursorToPos(element, pos)
    {
        this.setInputSelectionRange(element, pos, pos);
    }

    /**
     *
     * @param {HTMLTextAreaElement} element
     * @param {Number} selectionStart
     * @param {Number} selectionEnd
     */
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
        if (selectedLine == null || isNaN(selectedLine))
            selectedLine = -1;

        if (this.focusedMode == focusedMode && this.selectedLine == selectedLine)
            return;

        // add empty rows if needed
        if (focusedMode)
            while (selectedLine >= this.rows.length)
                this.rows.push('');

        this.focusedMode = focusedMode;
        if (selectedLine != -1)
            this.selectedLine = selectedLine;
        if (focusedMode) {
            if (this.selectedLine != -1)
                this.domItem.value = this.rows[this.selectedLine];
        }
        else
            this.domItem.value = this.rowsStr;
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
        this.domItem.value = this.rowsStr;
        this.focusToTheEnd();
    }

    /**
     * Focus to the last row of the textarea
     */
    focusToTheEnd()
    {
        this.domItem.selectionStart = this.domItem.selectionEnd = this.rowsStr.length;
        this.domItem.focus();
        //qTask? onCursorPositionChanged()
    }

    /**
     * Add NEW text to the textarea.
     * @description Feature: If it is the same as the last line, the textarea will be unchanged.
     * Note: Useful when using multiple events leading to redundant text additions. (e.g time stamps within the same minute)
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
     * Insert text into the textarea at the current cursor position
     * @param {String} text - the text to insert into the textarea
     * @param {boolean} updateUi - update the UI (DOM) after adding the text (default: true)
     */
    // insertText(text, updateUi = false)
    // {
    //     let rowStr = this.cursorPos[1] < this.rows.length ? this.rows[this.cursorPos[1]] : null;
    //     if (rowStr != null && this.cursorPos[0] <= rowStr.length)
    //     {
    //         rowStr;
    //         let rowStrLeft = rowStr.substring(0, this.cursorPos[0]);
    //         let rowStrRight = rowStr.substring(this.cursorPos[0]);
    //         rowStr = rowStrLeft + text + rowStrRight;
    //         this.rows[this.cursorPos[1]] = rowStr;
    //         this.moveCursorTo(this.cursorPos[0] + text.length, this.cursorPos[1]);
    //     }

    //     // option: Update the UI
    //     if (updateUi != false)
    //         this.updateUi();
    // }

    /**
     * Replace text with the given text
     * @param {String} text
     * @param {Number} startPos - the first character to remove (inclusive)
     * @param {Number} endPos - the last character to remove (exclusive)
     */
    replaceText(text, startPos, endPos)
    {
        let lineStartPos = this.cursorPosToDomPos([0, this.cursorPos[1]]);
        replaceTextInTextarea(this.domItem, text, lineStartPos + startPos, lineStartPos + endPos);
    }

    /**
     * Very similar to insertText() but it removes the given range first (begin, end is inclusive) - the cursor moves to the place where the word was deleted
     * @param {String} text - the text to insert into the textarea
     * @param {Number} begin - the first character to remove (inclusive)
     * @param {Number} end - the last character to remove (exclusive)
     * @param {boolean} updateUi - update the UI (DOM) after adding the text (default: true)
     */
    // replaceText(text, begin, end, updateUi = false)
    // {
    //     let rowStr = this.cursorPos[1] < this.rows.length ? this.rows[this.cursorPos[1]] : null;
    //     if (rowStr != null && begin < end && 0 <= begin && end <= rowStr.length)
    //     {
    //         // remove the unneeded part (given as a [begin, end] range)
    //         rowStr = rowStr.replace(rowStr.substring(begin, end), '');
    //         this.rows[this.cursorPos[1]] = rowStr;
    //         this.moveCursorTo(begin, this.cursorPos[1]);

    //         // unneeded part was removed, insert the new text
    //         return this.replaceText(text, updateUi);
    //     }

    //     console.log('replaceText() failed');
    // }


    /**
     * Update the DOM textarea
     * @param {boolean} focusToTheEnd - Move the cursor to the end of the input
     */
    updateUi(focusToTheEnd = false)
    {
        if (this.focusedMode)
        {
            this.domItem.value = this.rows[this.selectedLine];
        }
        else
        {
            this.updateRowsStr();
            //let cursorPosCpy = this.domItem.selectionStart;
            //let insertedChars = this.rowsStr.length - this.domItem.value.length;
            this.domItem.value = this.rowsStr;
            //this.domItem.selectionStart = this.domItem.selectionEnd = cursorPosCpy + insertedChars;
        }

        if (focusToTheEnd != false)
            this.focusToTheEnd();
    }
}