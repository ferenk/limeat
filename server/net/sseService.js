class SSEService
{
    static clients = new Map();

    constructor(app)
    {
        app.get('/sse', SSEService.serviceHandler);
        console.log('SSE is initialized!')
    }


    static serviceHandler(req, responseStream)
    {
        console.log(`Query: /sse (params: ${JSON.stringify(req.query)})`);
        responseStream.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });
        responseStream.write('retry: 10000\n');

        let clientId = null;
        if (req.query.clientId)
        {
            // calculate unique client ID
            clientId = req.query.clientId;
            if (SSEService.clients.get(req.query.clientId))
                clientId += `_${new Date().toISOString().toString().replace(/-/g, '').replace(/:/g, '').replace('T', '_').replace(/\..*$/, '')}`;
            SSEService.clients.set(clientId, { responseStream: responseStream, originalClientId: req.query.clientId });
            console.log (`Client connected: "${clientId}" (query's ID: "${req.query.clientId}")`)

            // notify client about its new ID
            let eventObj = { clientId: clientId, eventName: "clientid_changed" };
            responseStream.write(`data: ${JSON.stringify(eventObj)}\n\n`);
        }

        req.on('close',
            function onClientClose()
            {
                console.log(`Client disconnected: "${clientId}"`);
                SSEService.clients.delete(clientId);
            }
        );
    }

    notifyOtherClients(currentClientId, eventName)
    {
        try
        {
            if (!currentClientId)
            {
                console.error('Error: Unable to find current client (currentClientId == null)! notifyOtherClients() skipped!');
                return;
            }
            let clientRegObj = SSEService.clients.get(currentClientId);
            if (!clientRegObj)
            {
                console.error('Error: Unable to find client registration! An old client is connected?!');
                return;
            }

            let currTime = new Date();
            let modificationTimeStr = `${currTime.getHours().toString().padStart(2, '0')}:${currTime.getMinutes().toString().padStart(2, '0')}`;

            let eventObj = { clientId: clientRegObj.originalClientId, eventName: eventName, modificationTime: modificationTimeStr };
            let eventObjStr = JSON.stringify(eventObj);

            for (let [clientId, clientInfoObj] of SSEService.clients)
            {
                if (clientId != currentClientId)
                    //value.write(`data: ${clientId} ${eventName}\n\n`);
                    clientInfoObj.responseStream.write(`data: ${eventObjStr}\n\n`);
            }
        }
        catch (e)
        {
            console.error(`Error: ${e}`);
        }
    }
}

module.exports = { SSEService };