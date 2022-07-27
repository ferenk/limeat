export { CountdownButton };

/**
 * Button Pressed callback for the countdown button
 *
 * @callback ButtonEventCB
 * @returns {void}
 */


/**
 * Save button handling - countdown timer, 'unsaved' flag
 */
class CountdownButton
{
    /**
     * Creates a new countdown button
     * @param {String} jQueryString
     * @param {String} countdownText HTML text after the user pushes the button
     * @param {String} finalText HTML of the final text, before switching back to the normal message
     * @param {Number} count Timeout for the 'after push' text (in seconds)
     * @param {ButtonEventCB?} pressedCB Callback for the button press
     * @param {ButtonEventCB?} countdownFinishedCB Callback for the countdown finish
     */
    constructor(jQueryString, countdownText, finalText, count, pressedCB, countdownFinishedCB)
    {
        this.jqItem = $(jQueryString);
        this.count = count;
        this.countdownText = countdownText;
        this.finalText = finalText;

        this.pressedCB = pressedCB;
        this.countdownFinishedCB = countdownFinishedCB;

        /** @type { Number } */
        this.countDownCounter = 0;
        /** @type { Number } */
        this.countDownTimer = 0;

        let self = this;
        this.jqItem.on('click', self.onPressedCB.bind(self));
    }

    /** UI: Start the countdown after the Save operation is done */
    onPressedCB()
    {
        if (this.pressedCB)
            this.pressedCB();
    }

    /**
     * Start the countdown
     * @param {String?} altCountdownText
     * @param {Number?} altCountdownCount
     */
    startCountdown(altCountdownText = null, altCountdownCount = null)
    {
        if (altCountdownText)
            this.countdownText = altCountdownText;
        if (altCountdownCount)
            this.countDownCounter = altCountdownCount;
        clearInterval(this.countDownTimer);
        // first countdown state (setting initial text)
        this.countDownCounter = this.count;
        if (this.onCountdownTimerEventCB)
            this.onCountdownTimerEventCB();
        let self = this;
        this.countDownTimer = setInterval(self.onCountdownTimerEventCB.bind(self), 1000);
    }

    /** Countdown functionality for a button (currently specific to the save button) */
    onCountdownTimerEventCB()
    {
        this.jqItem.html(`${this.countdownText} (${this.countDownCounter})`);
        this.countDownCounter--;
        if (this.countDownCounter < 0) {
            clearInterval(this.countDownTimer);
            this.jqItem.html(this.finalText);
            if (this.countdownFinishedCB)
                this.countdownFinishedCB();
        }
    }
}