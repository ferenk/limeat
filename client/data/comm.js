export { nodeXHRComm, nodeXHRPost };

/**
 * XML HTTP communication: Callback for the received message
 *
 * @callback xhrCommCallback
 * @param {Object} xhr
 * @param {Object} ev the Event or an Error
 */

/**
 * Do XML HTTP request communication
 * @param {string} path 
 * @param {Object?} params 
 * @param {xhrCommCallback} cb 
 */

function nodeXHRComm(path, params, cb)
{
    if (params != null)
    {
        var paramNames = Object.keys(params);
        if (paramNames.length > 0)
        {
            let paramStr = '';
            paramNames.forEach(paramName =>
            {
                if (paramStr.length > 0)
                    paramStr += '&';
                paramStr += paramName + '=' + encodeURIComponent(params[paramName]);
            });
            path += `?${paramStr}`;
        }
    }
    try {
        let xhr = new XMLHttpRequest();
        xhr.addEventListener('load', (e) => {
            console.log(`XHR result: OK, URL: ${xhr.responseURL} - Response length: ${xhr.responseText.length}`);
            cb(xhr, e);
        });
        xhr.addEventListener('error', (e) => {
            console.log(`XHR result: ERROR!, URL: ${xhr.responseURL} - Response length: ${xhr.responseText.length}`);
            cb(xhr, e);
        });

        xhr.open("GET", path);
        xhr.send();
    } catch (e) {
        cb(null, e);
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

