export { nodeXHRComm, nodeXHRPost };

/**
 * XML HTTP communication: Callback for the received message
 *
 * @callback XHRCommCallback
 * @param {XMLHttpRequest} xhr
 * @param {ProgressEvent<XMLHttpRequestEventTarget> | Error} ev the Event or an Error
 */

/**
 * Do XML HTTP request communication
 * @param {string} path
 * @param {Object?} params
 * @param {XHRCommCallback} cb
 */

function nodeXHRComm(path = '', params, cb)
{
    if (params != null)
    {
        const paramNames = Object.keys(params);
        if (paramNames.length > 0)
        {
            let paramStr = '';
            paramNames.forEach(paramName =>
            {
                if (paramStr.length > 0)
                    paramStr += '&';
                // @ts-ignore:next-line (it's guaranteed that params has this value)
                paramStr += paramName + '=' + encodeURIComponent(params[paramName]);
            });
            path += `?${paramStr}`;
        }
    }
    let xhr = new XMLHttpRequest();
    try {
        xhr.addEventListener('load', (e) => {
            console.log(`XHR result: OK, URL: ${xhr.responseURL} - Response length: ${xhr.responseText.length}`);
            cb(xhr, e);
        });
        xhr.addEventListener('error', (e) => {
            console.log(`XHR result: ERROR!, URL: ${xhr.responseURL} - Response length: ${xhr.responseText.length}`);
            cb(xhr, e);
        });
        xhr.addEventListener('abort', (e) => {
            console.log(`XHR result: ERROR (abort)!, URL: ${xhr.responseURL} - Response length: ${xhr.responseText.length}`);
            cb(xhr, e);
        });

        xhr.open("GET", path);
        xhr.send();
    } catch (e2) {
        // @ts-ignore:next-line (e2 is not 'unknown' type but is an error for sure)
        cb(xhr, e2);
    }
}

/**
 * Server/Client communication
 * @param {string} path
 * @param {XMLHttpRequest} reqObj
 * @param {function} cb
 */
function nodeXHRPost(path, reqObj, cb) {
    let xhr = new XMLHttpRequest();
    xhr.open("POST", path, true);
    xhr.setRequestHeader('Content-Type', 'application/json;charset=UTF-8');
    xhr.addEventListener("load", function xhrCB() {
        if (cb != null)
            cb(this.responseText);
    });
    xhr.send(JSON.stringify(reqObj));

}

