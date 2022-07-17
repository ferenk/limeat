export { TextareaHighlight };

import { TextareaExt } from './textareaExt.js';

class TextColor
{
    /** @type {Number} */
    lineNo = 0;
    /** @type {Number} */

}

class TextareaHighlight
{
    /**
     * 
     * @param {TextareaExt} textareaExt 
     */
    constructor(textareaExt)
    {
        /** @type { TextColor[] } */
        this.lineColors = [];
        this.textareaExt = textareaExt;
        this.tempHtmlBuffer = new TempHtmlBuffer(this);
    }

    /**
     * Sets the JQuery selector and initializes event subscriptions
     * @param {String} selector selector for a textarea HTML widget 
     */
    initialize(selector)
    {
        /** @type {HTMLTextAreaElement?} */
        this.domText = document.querySelector(selector);
        if (this.domText)
        {
            // add the highlighter layer
            if (this.domText.parentElement)
            {
                this.domHighlighter = document.createElement('pre');
                this.domHighlighter.classList.add('textarea_highlighter');
                this.domHighlighter.setAttribute('aria-hidden', 'true');
                this.domText.parentElement.insertBefore(this.domHighlighter, this.domText);
                this.domText.classList.add('textarea_editor');

                // put the textarea into a new common parent with the highlighter layer
                let domTextParentOrig = this.domText.parentElement;
                let domTextParentNew = document.createElement('div');
                domTextParentOrig.insertBefore(domTextParentNew, this.domText);
                this.domText.remove();
                domTextParentNew.classList.add('textarea_parent');
                domTextParentNew.appendChild(this.domHighlighter);
                domTextParentNew.appendChild(this.domText);

                this.domText.setAttribute('mode', 'normal');
                this.domHighlighter.setAttribute('mode', 'normal');
            }

            // subscribe to textarea's events
            let self = this;
            //this.domText.addEventListener('input', () => { self.update(this.) }));
            this.domText.addEventListener('scroll', self.sync_scroll.bind(self));
            this.domText.addEventListener('focus', () => { self.domHighlighter?.setAttribute('focused', 'true'); });
            this.domText.addEventListener('blur', () => { self.domHighlighter?.setAttribute('focused', 'false'); });
        }
    }


    /**
     * @param {String?} htmlText
     */
    update(htmlText = null)
    {
        // Update code
        if (this.domText && this.domHighlighter)
        {
            if (htmlText == null)
                htmlText = this.domText.value;
            if (htmlText[htmlText.length - 1] == '\n')
                htmlText += ' ';
            htmlText += '\n\n\n';
            this.domHighlighter.innerHTML = htmlText;
        }
    }

    /**
     * @param {String[]?} textLines 
     */
    updateLines(textLines = null)
    {
        // Update code
        if (this.domText && this.domHighlighter)
        {
            if (textLines == null)
                textLines = this.domText.value.split('\n');
            // workaround for a textarea bug (when the last row is empty)
            if (textLines[textLines.length - 1].endsWith('\n'))
                textLines[textLines.length - 1] += ' ';
            this.domHighlighter.innerHTML = textLines.join('\n');
        }
    }

    /**
     * 
     * @param {Number} cursorRow 
     */
    render(cursorRow)
    {
        let highlightedStr = '';
        for (let iRow = 0; iRow < this.tempHtmlBuffer.buffer.length; iRow++)
        {
            if (iRow > 0)
                highlightedStr += '\n';
            // add cursor to the appropriate row
            let rowStr = this.tempHtmlBuffer.buffer[iRow];
            if (iRow === cursorRow)
                rowStr = `<div class="textCurrentRow" style="width:100%">${rowStr}</div>`;
            highlightedStr += rowStr;
        }
        this.update(highlightedStr);
    }

    sync_scroll()
    {
        /* Scroll result to scroll coords of event - sync with textarea */
        if (this.domHighlighter && this.domText)
        {
            // Get and set x and y
            this.domHighlighter.scrollTop = this.domText.scrollTop;
            this.domHighlighter.scrollLeft = this.domText.scrollLeft;
        }
    }

}

class TempHtmlBuffer
{
    /**
     * Creates a new temporary HTML buffer
     * @param {TextareaHighlight} parent 
     */
    constructor(parent)
    {
        this.parent = parent;
        /** @type { String[]} */
        this.buffer = [];
        this.bufferSectionsByRow = new Map();
        this.bufferSections = new Map();
    }

    clear()
    {
        this.buffer = [];
        this.bufferSectionsByRow.clear();
        this.bufferSections.clear();
    }

    /**
     * Add a new row section to highlight
     * @param {Number} row Row number
     * @param {String} htmlText HTML text to add 
     * @param {boolean} addSection generate new section ID and wrap this text with a highlighted span
     * @returns {String} Name for this section (for dynamic highlighting)
     */
    appendToLine(row, col, htmlText, metadata, addSection = false)
    {
        // add new rows if needed
        while (row >= this.buffer.length)
            this.buffer.push('');

        // get the column index
        let currRowSections = this.bufferSectionsByRow.get(row),
            currPos = 0;
        if (currRowSections != null)
            currPos = currRowSections[currRowSections.length - 1][1] + 1;
        else
            this.bufferSectionsByRow.set(row, currRowSections = []);

        // fill the gap with the original text from the textarea (if needed)
        if (currPos < col)
        {
            this.buffer[row] += this.parent.textareaExt.rows[row].substring(currPos, col);
            currPos = col;
        }

        // calculate the raw text (length) of this row
        let htmlTextStripped = htmlText.replaceAll(/<.*?>/g, '');

        let sectionName = '';
        if (addSection)
        {
            sectionName = `section_${row}_${currPos}-${currPos + htmlTextStripped.length-1}`;
            htmlText = `<span class="${sectionName}">${htmlText}</span>`;
        }

        this.buffer[row] += htmlText;
        let sectionData = [currPos, currPos + htmlTextStripped.length - 1, sectionName, metadata];
        currRowSections.push(sectionData);
        this.bufferSections.set(sectionName, sectionData);

        return sectionName;
    }
}