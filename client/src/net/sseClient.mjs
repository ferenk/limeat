export { SSEClient };

import { coolConfirm } from '../views/uiHelper.mjs';
import { Config } from '../app/config.mjs';

    
/**
 * @callback ProcessInputCallBack
 */
class SSEClient
{
    /**
     * @param {Config} config
     */
    constructor(config)
    {
        this.config = config;
        this.eventSource = null;
        this.status = 'CREATED';
    }

    /**
     * @param {function} refreshDataCB
     * @param {function} statusChangeCB
     * @param {function} logCB
     */
    init(refreshDataCB, statusChangeCB, logCB)
    {
        if (statusChangeCB)
            this.statusChangeCB = statusChangeCB;

        /** @type SSEClient */
        let self = this;
        if (!!window.EventSource)
        {
            self.eventSource?.close();

            let config = self.config;
            this.eventSource = new EventSource(`/sse?clientId=${ config.clientId }`);
            this.eventSource.addEventListener('message',
                async function SSEMsgHandler(e)
                {
                    logCB(`SSE message object arrived: ${e.data}`);
                    let msgObj = JSON.parse(e.data);
                    if (msgObj.eventName == 'updated_db')
                    {
                        let reloadAnswer = await coolConfirm(
                            'warning',
                            'Update notification received',
                            `You modified your records on client '${msgObj.clientId}' at ${msgObj.modificationTime}.<br>Refresh here, too?`,
                            null,
                            'Refresh',
                            'Skip',
                            true);
                        if (reloadAnswer)
                            refreshDataCB();
                    }
                    else if (msgObj.eventName == 'clientid_changed')
                    {
                        self.config.finalClientId = msgObj.clientId;
                        logCB(`SSE Client: ClientID changed to '${self.config.finalClientId}'`);
                    }
                }
            );

            this.eventSource.addEventListener('ping', function (e)
            {
                logCB(`Ping received: ${e.data}`);
            });

            this.eventSource.addEventListener('open', function ()
            {
                self.statusChangeCB?.(self.status = 'OPENED');
            });

            this.eventSource.addEventListener('error', function (e)
            {
                if (e.eventPhase == EventSource.CLOSED)
                {
                    self.statusChangeCB?.(self.status = 'CLOSED');
                    self.eventSource?.close()
                }
                // @ts-ignore (Property 'readyState' does not exist on type 'EventTarget'.)
                if (e.target?.readyState == EventSource.CLOSED)
                {
                    self.statusChangeCB?.(self.status = 'DISCONNECTED');
                }
                // @ts-ignore (Property 'readyState' does not exist on type 'EventTarget'.)
                else if (e.target?.readyState == EventSource.CONNECTING)
                {
                    self.statusChangeCB?.(self.status = 'CONNECTING');
                }
            }, false);
        }
        else
            alert('Your browser doesn\'t support SSE, which is needed for client events!');
    }
}
