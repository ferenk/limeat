import { Request, Response, Application } from 'express';
const express = require('express');

import { DbConnector } from './db/connectors/dbconnector';
import { FoodDbItem, FoodDbItemStore, ClientQuery } from './data/requests';
import { SSEService } from './net/sseService';
import { initDb } from './db/db';
import { initEnvVariables } from './startup';
import { StringUtils } from './core/stringUtils';

const DEfAULT_WEB_PORT = 8089;
const PORT = process.env.PORT || DEfAULT_WEB_PORT;
const SEARCH_RESULTS_LOG_LIMIT = 320;

const fs = require('fs');
const path = require('path');
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
        console.error("DB not found!");
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

function errorHandler(req: Request, res: Response, e: unknown)
{
    console.error(`\r\nGET: ${req.originalUrl}, ERROR: ${e}`);
    res.send('');
}

// API endpoint for client folder's version listing
app.get('/node_api/client_versions', async function (_req: Request, res: Response): Promise<void> {
    const clientVersionsPath = path.join(__dirname, '..', '..', 'client_versions');

    try {
        const files: string[] = fs.readdirSync(clientVersionsPath);
        const fileList = files.map(file => {
            const filePath = path.join(clientVersionsPath, file);
            const stats = fs.statSync(filePath);

            return {
                name: file,
                type: stats.isDirectory() ? 'directory' : 'file',
                size: stats.size,
                modified: stats.mtime
            };
        });

        res.json(fileList);
    } catch (error) {
        res.status(500).json({error: 'Unable to read directory'});
    }
});

app.get('/node_api/read_calcdb', async function (req: Request, res: Response): Promise<void>
{
    const PATH = `\r\nGET: ${req.originalUrl}`;
    try
    {
        console.log(`${PATH} called (params: ${StringUtils.jsonStringifyCircular(req.query)}`);

        let kcalDb = await connectDb.readKCalDb();
        res.send(kcalDb);
    }
    catch (e)
    {
        errorHandler(req, res, e);
    }
});

app.get('/node_api/read_foodrowdb', async function (req, res)
{
    const PATH = `\r\nGET: ${req.originalUrl}`;
    try
    {
        console.log(`${PATH} called (params: ${StringUtils.jsonStringifyCircular(req.query)}`);

        if (checkQuery(req, ['user', 'date']))
        {
            let reqQuery: ClientQuery = req.query as unknown as ClientQuery;
            let dayDataObjs = await connectDb.findDocuments('food_records_raw', { user: reqQuery.user, date: reqQuery.date }, {}, false) as FoodDbItem[];
            if (dayDataObjs != null && dayDataObjs.length > 0)
            {
                console.log(`${PATH}, Read data: ${StringUtils.jsonStringifyCircular(dayDataObjs)}`);
                res.send(dayDataObjs[0].food_data);
                return;
            }
            else
            {
                console.log(`${PATH}, No data found!`);
                res.send('');
            }
        }
        else
        {
            console.error(`${PATH}, ERROR: Query param error! (params: ${StringUtils.jsonStringifyCircular(req.query)})`);
            res.send('');
        }
    }
    catch (e)
    {
        errorHandler(req, res, e);
    }
});

app.get('/node_api/save_foodrowdb', async function (req, res)
{
    const PATH = `\r\nGET: ${req.originalUrl}`;
    try
    {
        console.log(`${PATH} called (params: ${StringUtils.jsonStringifyCircular(req.query)}`);

        let resStr = '';

        if (checkQuery(req, ['user', 'date', 'food_data']))
        {
            let reqQuery: ClientQuery = req.query as unknown as ClientQuery;
            sseService.notifyOtherClients(reqQuery.clientId, 'updated_db');
            console.log(`${PATH}, SAVED DATA: ${req.query.food_data}`);
            resStr = await connectDb.updateRow('food_records_raw', reqQuery.user, reqQuery.date, reqQuery.food_data);
            res.send(resStr);
        }
        else
        {
            console.error(`${PATH}, ERROR: Query param error! (params: ${StringUtils.jsonStringifyCircular(req.query)})`);
            res.send('');
        }
    }
    catch (e)
    {
        errorHandler(req, res, e);
    }
});

app.get('/node_api/search_meal_history', async function (req, res)
{
    const PATH = `\r\nGET: ${req.originalUrl}`;

    try
    {
        console.log(`${PATH} called (params: ${StringUtils.jsonStringifyCircular(req.query)}`);

        let resStr = '';
        if (checkQuery(req, ['user', 'firstDay', 'keyword']))
        {
            let paramUserName = (req.query.user ?? '') as string;
            let paramFirstDay = (req.query.firstDay ?? '') as string;
            let paramKeyword = (req.query.keyword ?? '') as string;
            let hitsLimit = (req.query.hitsLimit ?? '') as string;

            var queryObj = { user: paramUserName, date: { $gte: paramFirstDay }, food_data: { $regex: paramKeyword, $options: 'i' } };
            let optionsObj = { sort: { date: -1 } };
            if (hitsLimit.length > 0)
            {
                let limit = parseInt(hitsLimit);

                if (!isNaN(limit) && limit > 0)
                    (optionsObj as any).limit = limit;
            }
            console.log(`${PATH}, Mongo.findDocuments('food_records_raw', ${StringUtils.jsonStringifyCircular(queryObj)}, ${StringUtils.jsonStringifyCircular(optionsObj)}, true)`);

            let resultMeals = await connectDb.findDocuments('food_records_raw', queryObj, optionsObj, true);
            resStr = StringUtils.jsonStringifyCircular(resultMeals);
            //! TODO log levels + more compact logs!!
            console.log(`${PATH}, DB result arrived! Length: ${resStr.length}\r\n${resStr.substring(0, SEARCH_RESULTS_LOG_LIMIT) + (resStr.length > SEARCH_RESULTS_LOG_LIMIT ? "\r\n..." : "")}`);
            res.send(resStr);
        } else
        {
            console.error(`${PATH}, ERROR: Query param error! (params: ${StringUtils.jsonStringifyCircular(req.query)})`);
            res.send('');
        }
    }
    catch (e)
    {
        errorHandler(req, res, e);
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