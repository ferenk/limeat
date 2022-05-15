export { TextareaHighlight };

class TextColor
{
    /** @type {Number} */
    lineNo = 0;
    /** @type {Number} */

}

class TextareaHighlight
{
    constructor()
    {
        /** @type { TextColor[] } */
        this.lineColors = [];
    }

    /**
     * Sets the JQuery selector and initializes event subscriptions
     * @param {String} jqSelector selector for a textarea HTML widget 
     */
    initialize(jqSelector)
    {
        /** @type {HTMLTextAreaElement?} */
        this.domText = document.querySelector(jqSelector);
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

    // Update helpers
    //
    // Handle final newlines (see article)
    //if(text[text.length-1] == "\n") {
    //text += " ";
    //}
    // escape HTML tags
    //text = text.replace(new RegExp("&", "g"), "&").replace(new RegExp("<", "g"), "<"); /* Global RegExp */


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
            // process text
            for (let i = 0; i < textLines.length; i++)
                textLines[i] = textLines[i].replaceAll('AAA', '<font color="red">AAA</font>'); /* Global RegExp */
            this.domHighlighter.innerHTML = textLines.join('\n');
        }
    }

    clearLineColors()
    {

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
