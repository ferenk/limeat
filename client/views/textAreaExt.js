class TextAreaExt {
    /** @type {String} */
    rowsStr = '';
    /** @type {String[]} */
    rows = [];
    /** @type {jQuery} jQuery object of our textarea's widget */
    jqItem = null;
    /** @type {Number} The current row number of the cursor */
    cursorPosY = -1;

    /**
     * Creates a new editor widget
     * @param {String} jqSelector selector for a textarea widget 
     */
    constructor(jqSelector)
    {
        if (jqSelector) {
            this.jqItem = $(jqSelector);
        }

        this.jqItem.on('input', () => { this.onTextChanged(); });
    }

    /**
     * Updates the parsed internal representation of the textarea with or without changing its value
     * @param {String} newText 
     * @param {boolean?} updateHtmlItem 
     */
    onTextChanged(newText, updateHtmlItem)
    {
        if (newText != null)
            this.rowsStr = newText;
        else
            this.rowsStr = this.jqItem.val();

        this.rows = this.rowsStr.split('\n');

        if (newText != null && updateHtmlItem == true)
            this.jqItem.val(this.rowsStr);

        this.onCursorPositionChanged();
    }

    onCursorPositionChanged()
    {
        let arrCurrentTextLines = this.rowsStr.substr(0, this.jqItem[0].selectionStart).split('\n');
        this.cursorPosY = arrCurrentTextLines.length - 1;
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
        focusToTheEnd();
    }

    /**
     * Focus to the last row of the textarea
     */
    focusToTheEnd()
    {
        this.jqItem[0].selectionStart = this.jqItem[0].selectionEnd = this.rowsStr.length;
        this.jqItem[0].focus();
        onCursorPositionChanged()
    }

    /**
     * Add NEW text to the textarea. If it is the same as the last line, the textarea will be unchanged.
     * @description Note: Useful when using multiple events leading to redundant text additions.
     * @param {String} newText - the text to add to the textarea
     */
    appendNewText(newText)
    {
        // append text (COND: if the text buffer is empty or it ends with a different text)
        if (this.rows.length == 0 || this.rows[this.rows.length - 1].localeCompare(newText) != 0)
        {
            this.rows.push(newText);
            this.rowsStr = this.rows.join('\n');
            this.jqItem.val(this.rowsStr);
        }

        this.focusToTheEnd();
    }
}