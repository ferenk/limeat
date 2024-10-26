export {
    searchForId, showMessage
};

/**
 * @param {EventTarget} eventTarget
 */
function searchForId(eventTarget)
{
    if (eventTarget instanceof HTMLElement)
    {
        /** @type { HTMLElement | ParentNode | null} */
        var node = eventTarget;
        for (node = eventTarget; node != null && node instanceof HTMLElement; node = node.parentNode)
        {
            if (node.id != null && node.id !== '')
            {
                return node;
            }
        }
    }
    else
        console.log('ERROR: evetTarget is not an HTMLElement!');

    console.log('ERROR: searchForId() didn\'t find the element!');
    return null;
}

var currentMessagePriority = 0;
/**
 *
 * @param {String} text the message to display
 * @param {number} timeout in milliseconds
 * @param {number} priority higher number means higher priority
 */
function showMessage(text, timeout = 2000, priority = 1, bgColor = 'hsla(78, 75%, 35%, 0.95)')
{
    if (currentMessagePriority == 0 || priority >= currentMessagePriority)
    {
        $('#quickMessageBar').css('background-color', bgColor);
        currentMessagePriority = priority;
        $('#quickMessageBar')
            .html(text)
            .stop(true, true)
            .slideDown(200)
            .delay(timeout)
            .slideUp(200, 'swing', () => { currentMessagePriority = 0; });
    }
}