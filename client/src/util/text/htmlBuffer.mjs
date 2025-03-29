import { TextSection, TextContainer } from './textContainers.mjs';

class HtmlBuffer extends TextContainer
{
    /**
     * Creates a new temporary HTML buffer
     * @param {TextContainer | null} inBuffer
     * @param { { autoCloseLines: boolean }? } options
     */
    constructor(inBuffer, options = { autoCloseLines: true })
    {
        super();
        /** @type { String[]} */
        this.outBuffer = [];
        /** @type { Map<number, TextSection[]> } */
        this.outBufferSectionsByRow = new Map();
        /** @type { Map<string, TextSection> } */
        this.outBufferSections = new Map();
        this.inBuffer = inBuffer;
        this.options = options;
    }

    clear()
    {
        this.outBuffer = [];
        this.outBufferSectionsByRow.clear();
        this.outBufferSections.clear();
    }

    /**
     * @override
     * @param {number} row
     * @returns {string}}
     */
    getRow(row)
    {
        // option: autoCloseLines
        if (this.options?.autoCloseLines == true)
        {
            if (this.inBuffer == null)
                throw new Error(`ERROR: 'autoCloseLines' option is enabled but no input buffer was provided in the constructor!`);

            if (0 <= row && row <= this.inBuffer.getRowCount())
                this.appendToLine(row, -1, null, null, false);
        }

        // Error check: Out of bounds (output buffer)
        if (row < 0 || row >= this.outBuffer.length)
        {
            let maxIndex = (this.inBuffer == null ? this.outBuffer.length-1 : this.inBuffer.getRowCount()-1);
            throw new RangeError(`ERROR: index ${row} is out of range [0, ${maxIndex}]`);
        }

        return this.outBuffer[row];
    }

    /**
     * @override
     * @returns {number}
     */
    getRowCount()
    {
        return this.outBuffer.length;
    }

    /**
     * Remove markup from a HTML text
     * @param {string?} htmlText
     */
    static stripHtml(htmlText = '')
    {
        return (htmlText || '').replace(/<.*?>/g, '');
    }

    /**
     * Add a new row section to highlight
     * @param {number} row Row number
     * @param {number} col Column number
     * @param {string?} htmlText HTML text to add
     * @param { { foodPart: Object}? } metadata (for storing FoodPart metadata)
     * @param {boolean} addSection generate new section ID and wrap this text with a highlighted span
     * @returns {string} Name for this section (for dynamic highlighting)
     */
    appendToLine(row, col, htmlText, metadata, addSection = false)
    {
        if (col == -1)
        {
            if (!this.inBuffer)
            {
                console.error('It\'s not possible to use the additional input buffer (inBuffer) AND setting col to -1!');
                return '';
            }
            else
                if (row < this.inBuffer.getRowCount())  // it is not guaranteed that we will always have an input row (e.g in case of changing days)
                    col = this.inBuffer.getRow(row).length;
        }

        // add new rows if needed
        while (row >= this.outBuffer.length)
            this.outBuffer.push('');

        // get the column index
        let currRowSections = this.outBufferSectionsByRow.get(row);
        let currPos = 0;
        if (currRowSections != null)
            currPos = currRowSections[currRowSections.length - 1].endPos + 1;
        else
            this.outBufferSectionsByRow.set(row, currRowSections = []);

        // fill the gap with the original text from the textarea (if needed)
        if (currPos < col)
        {
            if (this.inBuffer?.getRow(row) != null)
                this.outBuffer[row] += this.inBuffer.getRow(row).substring(currPos, col);
            currPos = col;
        }

        // calculate the raw text (length) of this row
        let htmlTextStripped = HtmlBuffer.stripHtml(htmlText);

        let sectionName = '';
        if (addSection)
        {
            sectionName = `section_${row}_${currPos}-${currPos + htmlTextStripped.length-1}`;
            htmlText = `<span class="${sectionName}">${htmlText}</span>`;
        }

        if (htmlText != null)
            this.outBuffer[row] += htmlText;
        let sectionData = new TextSection(currPos, currPos + htmlTextStripped.length - 1, null, sectionName, metadata);
        currRowSections.push(sectionData);
        this.outBufferSections.set(sectionName, sectionData);

        return sectionName;
    }

    /**
     * @param {number} row
     * @param {TextSection} section
     * @param {boolean} addSection
     */
    appendToLine2(row, section, addSection)
    {
        this.appendToLine(row, section.startPos, section.htmlText, section.metadata, addSection);
    }
}

export { HtmlBuffer };
