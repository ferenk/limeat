class TextSection
{
    /**
     * @param {number} startPos
     * @param {number} endPos
     * @param {string?} htmlText
     * @param {string} sectionName
     * @param { { foodPart: Object }? } metadata
     */
    constructor(startPos, endPos, htmlText, sectionName, metadata)
    {
        this.startPos = startPos;
        this.endPos = endPos;
        this.htmlText = htmlText;
        this.sectionName = sectionName;
        this.metadata = metadata;
    }
}

class TextContainer
{
    /**
     * @abstract
     * @param { number } _row
     * @returns {string}
     */
    getRow(_row)    // jshint ignore:line
    {
        throw Error('This is an abstract class. You should not call this method.');
    }

    /**
     * @abstract
     * @returns {number}
     */
    getRowCount()
    {
        throw Error('This is an abstract class. You should not call this method.');
    }
}

export { TextSection, TextContainer };
