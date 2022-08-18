import { jest } from '@jest/globals';
jest.useFakeTimers();

import { TextSection, TextContainer } from '../src/util/text/textContainers.mjs';
import { HtmlBuffer } from '../src/util/text/htmlBuffer.mjs';

var inputText = ['apple 35kc/ 100g err_text', '10: orangeeee 10g'];
class TestTextContainer extends TextContainer
{
    /**
     * @override
     * @param {number} row
     * @returns {string}}
     */
    getRow(row)
    {
        return inputText[row];
    }

    /**
     * @override
     * @returns {number}
     */
    getRowCount()
    {
        return inputText.length;
    }
}

class TextProcessor
{
    inputHtml = [new TextSection(0, 4, '<b>apple</b>', 'section_1', { foodPart: {} })];

    /**
     * @param {HtmlBuffer} buffer 
     */
    process(buffer)
    {
        for (let i = 0; i < this.inputHtml.length; i++)
        {
            buffer.appendToLine2(0, this.inputHtml[i], true);
        }
        return buffer.getRow(0);
    }
}

let textObj = new TestTextContainer();
let processor = new TextProcessor();

test('option autoCloseLines: true, process() skipped => HtmlBuffer.getRow() should be still usable', () =>
{
    let buffer = new HtmlBuffer(textObj);
    let secondLine = buffer.getRow(1);
    expect(secondLine).toBe(inputText[1]);
});

test('option autoCloseLines: true + process() called => full row should be generated', () =>
{
    let buffer = new HtmlBuffer(textObj);
    let firstLineHtml = processor.process(buffer);
    let firstLine = HtmlBuffer.stripHtml(firstLineHtml);
    expect(firstLine).toBe(inputText[0]);
});

test('option autoCloseLines: false + process() called => PARTIAL row should be generated', () =>
{
    let bufferNoAuto = new HtmlBuffer(textObj, { autoCloseLines: false });
    let firstLineHtml = processor.process(bufferNoAuto);
    let firstLine = HtmlBuffer.stripHtml(firstLineHtml);
    expect(firstLine).toBe('apple');
});

test('HtmlBuffer & TextContainer error handling tests (indexing problems, abstract class call)', () =>
{
    let buffer = new HtmlBuffer(textObj);

    const outofboundTest1 = () =>
    {
        //try
        //{
        buffer.getRow(-1);
        //}
        //catch (e) { console.log(e); }
    };
    expect(outofboundTest1).toThrow(RangeError);

    const outofboundTest2 = () =>
    {
        buffer.getRow(5);
    };
    expect(outofboundTest2).toThrow(RangeError);

    let container = new TextContainer();
    const getterTest1 = () =>
    {
        container.getRowCount();
    }
    expect(getterTest1).toThrow(Error);

    const getterTest2 = () =>
    {
        container.getRow(0);
    }
    expect(getterTest2).toThrow(Error);
});
