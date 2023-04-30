export {
    searchForId, showMessage
};

/**
 * @param {HTMLElement} htmlElem 
 */
function searchForId(htmlElem)
{
    /** @type { HTMLElement | null} */
    var node = htmlElem;
    for (node = htmlElem; node != null; node = node.parentNode)
    {
        if (node.id != null && node.id !== '')
        {
            return node;
		}
	}
	return null;
}

var currentMessagePriority = 0;
/**
 * 
 * @param {String} text the message to display
 * @param {number} timeout in milliseconds
 * @param {number} priority higher number means higher priority
 */
function showMessage(text, timeout = 2000, priority = 1)
{
    if (currentMessagePriority == 0 || priority >= currentMessagePriority)
    {
        currentMessagePriority = priority;
        $('#quickMessageBar')
            .html(text)
            .stop(true, true)
            .slideDown(200)
            .delay(timeout)
            .slideUp(200, 'swing', () => { currentMessagePriority = 0; });
    }
}