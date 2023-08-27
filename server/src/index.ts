import { Request, Response, Application } from 'express';
const express = require('express');

import { DbConnector } from './db/connectors/dbconnector';
import { FoodDbItem, FoodDbItemStore, FoodObjBase, FoodObjList } from './data/requests';
import { SSEService } from './net/sseService';
import { initDb } from './db/db';
import { initEnvVariables } from './startup';

import { ClientQuery } from './data/requests';
import { connect } from 'http2';

const path = require('path');

const PORT = process.env.PORT || 8089;

var connectDb: DbConnector = DbConnector.null;
var g_allFoodRows = new FoodDbItemStore();

var app:Application = express();

app.use(express.static(path.join(__dirname, '..', '..', 'client', 'src'), { extensions: ['html', 'js', 'mjs', 'css', 'png', 'svg'] }));
app.set('views', path.join(__dirname, '..', '..', 'client', 'src'));
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');

// WEB server
app.get('/', function(_req:Request, _res:Response) {
    console.log('Rendering page... (main.html)');
    _res.render('main');
});

var sseService = new SSEService(app);

function checkQuery(req: Request, params: string[]): boolean
{
    if (g_allFoodRows.foods_raw == null)
    {
        console.log("DB not found!");
        return false;
    }

    for (let i = 0; i < params.length; i++)
    {
        if (req.query[params[i]] == null)
        {
            console.log(`ERROR: Query problem! Param '${params[i]}' not received!`);
            return false;
        }
    }
    return true;
}

app.get('/node_api/read_calcdb', async function (_req: Request, res: Response): Promise<void>
{
    try
    {
        console.log(`Query: /node_api/read_calcdb`);

        let kcalDb = await connectDb.readKCalDb();
        res.send(kcalDb);
    }
    catch (e)
    {
        console.error(`Error: ${e}`);
    }
});

app.get('/node_api/read_foodrowdb', async function (req, res)
{
    try
    {
        console.log(`Query: /node_api/read_calcdb (params: ${JSON.stringify(req.query)}`);

        if (checkQuery(req, ['user', 'date']))
        {
            let reqQuery: ClientQuery = req.query as unknown as ClientQuery;
            let dayDataObjs = await connectDb.findDocuments('food_records_raw', { user: reqQuery.user, date: reqQuery.date }, {}, false) as FoodDbItem[];
            if (dayDataObjs != null && dayDataObjs.length > 0)
            {
                console.log(`Read data: ${JSON.stringify(dayDataObjs)}`);
                res.send(dayDataObjs[0].food_data);
                return;
            }
        }

        res.send('');
    }
    catch (e)
    {
        console.error(`Error: ${e}`);
    }
});

app.get('/node_api/save_foodrowdb', async function (req, res)
{
    try
    {
        console.log(`Query: /node_api/save_calcdb (params: ${JSON.stringify(req.query)})`);
        let resStr = '';

        if (checkQuery(req, ['user', 'date', 'food_data']))
        {
            let reqQuery: ClientQuery = req.query as unknown as ClientQuery;
            sseService.notifyOtherClients(reqQuery.clientId, 'updated_db');
            console.log(`SAVED DATA: ${req.query.food_data}`);
            resStr = await connectDb.updateRow('food_records_raw', reqQuery.user, reqQuery.date, reqQuery.food_data);
        }

        res.send(resStr);
    }
    catch (e)
    {
        console.error(`Error: ${e}`);
    }
});

app.get('/node_api/search_meal_history', async function (req, res)
{
    try
    {
        let resStr = '';
        if (checkQuery(req, ['user', 'firstDay', 'keyword']))
        {
            console.log(`Query: /node_api/search_meals (params: query: ${JSON.stringify(req.query)})`);
            let paramUserName = (req.query.user ?? '') as string;
            let paramFirstDay = (req.query.firstDay ?? '') as string;
            let paramKeyword = (req.query.keyword ?? '') as string;
            let hitsLimit = (req.query.hitsLimit ?? '') as string;

            var queryObj = { user: paramUserName, date: { $gte: paramFirstDay }, food_data: { $regex: paramKeyword, $options: 'i' } };
            var optionsObj = { sort: { date: -1 } }; 
            if (hitsLimit.length > 0)
            {
                let limit = parseInt(hitsLimit);
                if (!isNaN(limit) && limit > 0)
                    optionsObj.limit = limit;
            }
            console.log(`Mongo.findDocuments('food_records_raw', ${JSON.stringify(queryObj)}, ${JSON.stringify(optionsObj)}, true)`);

            let resultMeals = await connectDb.findDocuments('food_records_raw', queryObj, optionsObj, true);
            resStr = JSON.stringify(resultMeals);
            console.log(`Result arrived:\r\n${resStr}`);
            res.send(resStr);
        } else
        {
            console.log(`ERROR: Query param error! (Query: /node_api/search_meals (params: ${JSON.stringify(req.query)}))`);
        }
        res.send('');
    }
    catch (e)
    {
        console.error(`ERROR: ${e}`);
    }
});
    
async function initApp()
{
    try
    {
        // basic init
        initEnvVariables();

        // check config
        if (!process.env.HEROKU)
        {
            console.error('Application is not set up correctly!\nPlease use either an app.env config file or use Heroku env variables!\nExiting...');
            process.exit(1);
        }
        console.log(`Initialize HEROKU mode: ${process.env.HEROKU}`);

        // init DB subsystem and read all food data
        connectDb = await initDb();
        await connectDb.connect();
        await connectDb.readFoodDbRows(g_allFoodRows);

        // start to listen
        app.listen(PORT, () => console.log(`KCal web page has been started on port ${PORT} !`));
    }
    catch (e)
    {
        console.error(`Error: ${e}`);
    }
}

initApp();