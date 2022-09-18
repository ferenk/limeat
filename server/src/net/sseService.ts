import { Request, Response, Application } from 'express';

import { ClientQuery } from '../data/requests';

export class SSEService
{
    static clients = new Map();

    constructor(app: Application)
    {
        app.get('/sse', SSEService.serviceHandler);
        // Setup keep-alive timer (needed for Heroku!)
        setInterval(SSEService.sendKeepAlive, 30000);
        console.log('SSE is initialized!')
    }

    static sendKeepAlive()
    {
        let currDateStr = new Date().toISOString().replace(/\..*$/g, '');
        for (let [_clientId, clientInfoObj] of SSEService.clients)
        {
            clientInfoObj.responseStream.write(`event: ping\n`);
            clientInfoObj.responseStream.write(`data: time: ${currDateStr}\n\n`);
        }
    }

    static serviceHandler(req: Request, responseStream: Response)
    {
        let reqQuery = req.query as unknown as ClientQuery;
        console.log(`Query: /sse (params: ${JSON.stringify(reqQuery)})`);
        responseStream.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });
        responseStream.write('retry: 5000\n');

        let clientId: string = '<null>';
        if (req.query.clientId)
        {
            // calculate unique client ID
            let reqQuery = req.query as unknown as ClientQuery;
            clientId = reqQuery.clientId;
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

    notifyOtherClients(currentClientId: string, eventName: string)
    {
        try
        {
            let originalClientId = currentClientId;
            if (currentClientId)
            {
                let clientRegObj = SSEService.clients.get(currentClientId);
                if (clientRegObj)
                {
                    originalClientId = clientRegObj.originalClientId;
                }
                else console.error('Error: Unable to find client registration! An old client is connected?!');
            }
            else console.error('Error: Unable to find current client (currentClientId == null)!');

            let currTime = new Date();
            let modificationTimeStr = `${currTime.getHours().toString().padStart(2, '0')}:${currTime.getMinutes().toString().padStart(2, '0')}:${currTime.getSeconds().toString().padStart(2, '0')}`;

            let eventObj = { clientId: originalClientId, eventName: eventName, modificationTime: modificationTimeStr };
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
