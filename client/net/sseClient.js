import { coolConfirm } from '../views/uiHelper.js';

export { SSEClient };

class SSEClient
{
    constructor(config)
    {
        this.config = config;
        this.eventSource = null;
    }

    init(refreshDataCB)
    {
        if (refreshDataCB)
            this.refreshDataCB = refreshDataCB;

        let self = this;
        if (!!window.EventSource)
        {
            if (this.eventSource != null)
            {
                self.eventSource.close();
            }

            this.eventSource = new EventSource(`/sse?clientId=${ self.config.clientId }`);
            this.eventSource.addEventListener('message',
                async function SSEMsgHandler(e)
                {
                    //$('#lUser').html(`U: ${e.data}`);
                    console.log(`SSE message object arrived: ${e.data}`);
                    let msgObj = JSON.parse(e.data);
                    if (msgObj.eventName == 'updated_db')
                    {
                        let reloadAnswer = await coolConfirm(
                            'warning',
                            'Update detected',
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
                        console.log(`SSE Client: ClientID changed to '${self.config.finalClientId}'`);
                    }
                }
            );
            this.eventSource.addEventListener('error', function (e)
            {
                if (e.eventPhase == EventSource.CLOSED)
                {
                    $('#lUser').html(`U: CLOSED`);
                    self.eventSource.close()
                }
                if (e.target.readyState == EventSource.CLOSED)
                {
                    $('#lUser').html(`U: DISCONNECTED`);
                }
                else if (e.target.readyState == EventSource.CONNECTING)
                {
                    $('#lUser').html(`U: CONNECTING`);
                }
            }, false);
        }
        else
            alert('Your browser doesn\'t support SSE, which is needed for client events!');
    }
}
