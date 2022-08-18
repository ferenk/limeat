export { TextareaHighlight };

import { TextareaExt } from './textareaExt.mjs';
import { HtmlBuffer } from '../util/text/htmlBuffer.mjs';

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
     * @param { TextareaExt | null } textareaExt 
     * @param { { withoutUI: boolean }? } options
     */
    constructor(textareaExt = null, options = { withoutUI: false })
    {
        /** @type { TextColor[] } */
        this.lineColors = [];
        this.textareaExt = textareaExt;
        this.htmlBuffer = new HtmlBuffer(textareaExt);
        this.options = options;
    }

    /**
     * Sets the JQuery selector and initializes event subscriptions
     * @param {String} selector selector for a textarea HTML widget 
     */
    initialize(selector)
    {
        if (this.options?.withoutUI)
            return;

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
        for (let iRow = 0; iRow < this.htmlBuffer.getRowCount(); iRow++)
        {
            if (iRow > 0)
                highlightedStr += '\n';
            // add cursor to the appropriate row
            let rowStr = this.htmlBuffer.getRow(iRow);
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
