export { AutoCompleteUi };

import { printToFixedFloat } from '../../util/util.mjs';
import { Controller } from '../../controller.mjs';

class AutoCompleteUi
{
    changeTimeout = 0.3;
    sessionTimeout = 1.2;
    timerIncrement = 0.02;

    WORD_BEGIN_CHARS = '\!\'\"_a-zA-Z\u00C0-\u024F\u1E00-\u1EFF'
    WORD_MIDDLE_CHARS = '\+\\-\.0-9';
    WORD_CHARS = this.WORD_BEGIN_CHARS + this.WORD_MIDDLE_CHARS;
    WORD_CHARS_REGEXP = new RegExp(`[${this.WORD_CHARS}]`);
    WORD_CHARS_REGEXP_G = new RegExp(`[${this.WORD_CHARS}]`, 'g');
    WORD_BEGIN_CHARS_REGEXP = new RegExp(`[${this.WORD_BEGIN_CHARS}]`);
    WORD_BEGIN_CHARS_REGEXP_G = new RegExp(`[${this.WORD_BEGIN_CHARS}]`, 'g');

    timer = 0;
    timeTextChanged = 0;
    timeSessionStarted = 0;

    waitingAnimations = ['oooO000O', '\\|/-'];
    waitingState = -1;      // -1: not waiting   // 0: waiting for the entered word to be complete   // 1: word complete, query sent - waiting for server response

    currentWord = '';
    currentWordToDisplay = '';
    currentWordBeginIndex= 0;
    currentWordEndIndex = 0;

    /**
     * Initializes the auto complete component
     * @param {Controller} controller
     * @param {HTMLElement?} displayElement
     * @param {HTMLElement?} progressElement
     * @param {HTMLElement?} resultElement
     * @param {import('../../data/basicTypes.mjs').StringProcessorCB} wordChangedCB
     */
    constructor(controller, displayElement, progressElement, resultElement, wordChangedCB)
    {
        this.g_controller = controller;
        this.displayElement = displayElement;
        this.progressElement = progressElement;
        this.resultElement = resultElement;
        this.wordChangedCB = wordChangedCB;
        let self = this;
        setInterval(self.timerLoop.bind(self), 20);
    }

    /**
     * Count the timers, updates the progress displays and calls actions after the timeout expires.
     * So this method is responsible for managing the timers and the IN PROGRESS and ENDING searches.
     * The starting of these searches are managed by the updateInput() method.
     */
    timerLoop()
    {
        // increment main timer
        this.timer += this.timerIncrement;
        // are the timers active?
        if (this.timeTextChanged != -1 || this.timeSessionStarted != -1)
        {
            // timeout: one of the timers expired
            // works for timers == 0, too, it causes an immediate update, and this is what we need
            if (this.timer - this.timeTextChanged > this.changeTimeout ||
                this.timer - this.timeSessionStarted > this.sessionTimeout)
            {
                // reset current timer display
                this.timeTextChanged = -1;
                this.timeSessionStarted = -1;
    
                // reset progress display and start the loading process if possible
                if (this.progressElement != null)
                    this.progressElement.innerHTML = '<tt>&nbsp;</tt>';
                if (this.wordChangedCB && this.waitingState >= 0)
                {
                    this.waitingState = 0;
                    this.wordChangedCB(this.currentWord, this.wordProcessedCB.bind(this));
                }
                else this.waitingState = -1;
            }
        }
        // display current timers (development version, not graphical just simple numbers)
        if (this.displayElement != null)
        {
            let timer1Str = this.timeTextChanged > 0 ? printToFixedFloat(this.changeTimeout - (this.timer - this.timeTextChanged), 2, '0') : '-';
            let timer2Str = this.timeSessionStarted > 0 ? printToFixedFloat(this.sessionTimeout - (this.timer - this.timeSessionStarted), 2, '0') : '-';
            // if a timer is in progress but we don't display it...
            if (timer1Str != '-' && this.waitingState == -1)
                this.waitingState = 0;
            this.displayElement.innerHTML = `${this.currentWordToDisplay} | ${timer1Str} | ${timer2Str}`;
        }
        if (this.progressElement != null && this.waitingState >= 0)
        {
            let currAnimation = this.waitingAnimations[this.waitingState];
            let currAnimationFrameIdx = Math.round(this.timer * 2 * currAnimation.length) % currAnimation.length;   // 2 full cycles in every second!
            let animIcon = currAnimation[currAnimationFrameIdx];
            this.progressElement.innerHTML = `<tt>${animIcon}</tt>`;
        }
    }

    /**
     * Manages the user events and automatically starts searches if needed.
     * So it is responsible for STARTING new searches. The searches will be managed and finished by the timerTick() method.
     * @param {String} line
     * @param {number} cursor
     */
    updateInput(line, cursor)
    {
        let wordBegins = cursor;
        let wordEnds = cursor;
        // go back until a whitespace is found
        while(wordBegins > 0 && this.WORD_CHARS_REGEXP.test(line[wordBegins - 1]))
            wordBegins--;
        // go forward until a whitespace is found
        while(wordEnds < line.length && this.WORD_CHARS_REGEXP.test(line[wordEnds]))
            wordEnds++;

        let nextWord = (wordBegins < wordEnds ? line.substring(wordBegins, wordEnds) : '');

        if (nextWord != this.currentWord)
        {
            if (this.testFoodName(nextWord))
            {
                // word has been changed => timers can be started, to give the user time for typing
                this.timeTextChanged = this.timer;
                if (this.timeSessionStarted < 0)
                    this.timeSessionStarted = this.timer;
                this.currentWordToDisplay = nextWord;
                this.currentWordBeginIndex = wordBegins;
                this.currentWordEndIndex = wordEnds;
            } else
            {
                // word has been emptied, invalidated (e.g because of a cursor move) => immediate update is needed!
                this.currentWordToDisplay = '-';
                this.timeTextChanged = 0;
                this.timeSessionStarted = 0;
                this.waitingState = 1;
            }
            this.currentWord = nextWord;
        }
    }

    /**
     * @param {string} word
     */
    testFoodName(word)
    {
        return (!RegExp(/[0-9\\.]g/).test(word) &&
            !RegExp(/[0-9]kc(al)?(\/)?/).test(word) &&
            (word.match(this.WORD_CHARS_REGEXP_G) || []).length > word.length / 2);
    }

    /**
     *
     * @param {string} result
     */
    wordProcessedCB(result)
    {
        this.waitingState = -1;
        if (this.resultElement != null)
            this.resultElement.innerHTML = result;
    }

    refreshTimer()
    {

    }
}