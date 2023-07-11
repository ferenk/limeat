import { Request, Response, Application } from 'express';
const express = require('express');

import { DbConnector } from './db/connectors/dbconnector';
import { FoodDbItemStore, FoodObjBase, FoodObjList } from './data/requests';
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

function getsetCache(user: string, date: string, data: string)
{
    for (let idx = 0; idx< g_allFoodRows.foods_raw.length; idx++)
    {
        if (g_allFoodRows.foods_raw[idx].user == user && g_allFoodRows.foods_raw[idx].date == date)
        {
            if (data == null)
            {
                console.log(`Cache: GET data FOUND (user: "${user}" date: "${date}")`);
                return g_allFoodRows.foods_raw[idx].food_data;
            }
            else
            {
                g_allFoodRows.foods_raw[idx].food_data = data;
                console.log(`Cache: SET data UPDATED (user: "${user}" date: "${date}")`);
                return null;
            }
        }
    }

    if (data != null)
    {
        g_allFoodRows.foods_raw.push({ user: user, date: date, food_data: data });
        console.log(`Cache: SET data ADDED (user: "${user}" date: "${date}")`);
    }
    else
    {
        console.log(`Cache: GET data NOT FOUND, returning empty value (user: "${user}" date: "${date}")`);
    }
    return '';
}

/*
async function updateFoodRow(user, date, data)
{
    
}*/

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

app.get('/node_api/read_foodrowdb', function (req, res)
{
    try
    {
        console.log(`Query: /node_api/read_calcdb (params: ${JSON.stringify(req.query)}`);

        if (checkQuery(req, ['user', 'date']))
        {
            let reqQuery: ClientQuery = req.query as unknown as ClientQuery;
            let daydata = getsetCache(reqQuery.user, reqQuery.date, reqQuery.data);
            res.send(daydata);
            return;
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
            getsetCache(reqQuery.user, reqQuery.date, reqQuery.food_data);
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

            var queryObj = { user: paramUserName, date: { $gte: paramFirstDay }, food_data: { $regex: paramKeyword, $options: 'i' } };
            var optionsObj = { sort: { date: -1 }  }; 

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