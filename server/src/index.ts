import { Request, Response, Application } from 'express';

import { log, error } from './core/log';
import { DbConnector } from './db/connectors/dbconnector';
import { FoodDbItem, FoodDbItemStore, ClientQuery } from './data/requests';
import { SSEService } from './net/sseService';
import { initDb } from './db/db';
import { initEnvVariables } from './startup';
import { StringUtils } from './core/stringUtils';

const DEfAULT_WEB_PORT = 8089;
const PORT = process.env.PORT || DEfAULT_WEB_PORT;
const SEARCH_RESULTS_LOG_LIMIT = 320;

const express = require('express');
const fs = require('fs');
const path = require('path');
var connectDb: DbConnector = DbConnector.null;
var g_allFoodRows = new FoodDbItemStore();

// simple express logger
var app:Application = express();
app.use((req, _res, next)=> {
    log(`express (${req.method}): ${req.url}`);
    next();
})

// basic bindings
app.use('/client_versions', express.static(path.join(__dirname, '..', '..', 'client_versions'), { extensions: ['html', 'js', 'mjs', 'css', 'png', 'svg'] }));
app.use(express.static(path.join(__dirname, '..', '..', 'client', 'src'), { extensions: ['html', 'js', 'mjs', 'css', 'png', 'svg'] }));
app.set('views', path.join(__dirname, '..', '..', 'client', 'src'));
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');

// WEB server
app.get('/', function(_req:Request, _res:Response) {
    log('Rendering page... (main.html)');
    _res.render('main');
});

var sseService = new SSEService(app);

function checkQuery(req: Request, params: string[]): boolean
{
    if (g_allFoodRows.foods_raw == null)
    {
        error("DB not found!");
        return false;
    }

    for (let i = 0; i < params.length; i++)
    {
        if (req.query[params[i]] == null)
        {
            log(`ERROR: Query problem! Param '${params[i]}' not received!`);
            return false;
        }
    }
    return true;
}

function errorHandler(req: Request, res: Response, e: unknown)
{
    error(`GET: ${req.originalUrl}, ERROR: ${e}`);
    res.send('');
}

// API endpoint for client folder's version listing
app.get(['/node_api/client_versions', '/client_versions/:version/node_api/client_versions'], async function (_req: Request, res: Response): Promise<void> {
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

app.get(['/node_api/read_calcdb', '/client_versions/:version/node_api/read_calcdb'], async function (req: Request, res: Response): Promise<void>
{
    const PATH = `GET: ${req.originalUrl}`;
    try
    {
        log(`${PATH} called (params: ${StringUtils.jsonStringifyCircular(req.query)}`);

        let kcalDb = await connectDb.readKCalDb();
        res.send(kcalDb);
    }
    catch (e)
    {
        errorHandler(req, res, e);
    }
});

app.get(['/node_api/read_foodrowdb', '/client_versions/:version/node_api/read_foodrowdb'], async function (req, res)
{
    const PATH = `GET: ${req.originalUrl}`;
    try
    {
        log(`${PATH} called (params: ${StringUtils.jsonStringifyCircular(req.query)}`);

        if (checkQuery(req, ['user', 'date']))
        {
            let reqQuery: ClientQuery = req.query as unknown as ClientQuery;
            let dayDataObjs = await connectDb.findDocuments('food_records_raw', { user: reqQuery.user, date: reqQuery.date }, {}, false) as FoodDbItem[];
            if (dayDataObjs != null && dayDataObjs.length > 0)
            {
                log(`${PATH}, Read data: ${StringUtils.jsonStringifyCircular(dayDataObjs)}`);
                res.send(dayDataObjs[0].food_data);
                return;
            }
            else
            {
                log(`${PATH}, No data found!`);
                res.send('');
            }
        }
        else
        {
            error(`${PATH}, ERROR: Query param error! (params: ${StringUtils.jsonStringifyCircular(req.query)})`);
            res.send('');
        }
    }
    catch (e)
    {
        errorHandler(req, res, e);
    }
});

app.get(['/node_api/save_foodrowdb', '/client_versions/:version/node_api/save_foodrowdb'], async function (req, res)
{
    const PATH = `GET: ${req.originalUrl}`;
    try
    {
        log(`${PATH} called (params: ${StringUtils.jsonStringifyCircular(req.query)}`);

        let resStr = '';

        if (checkQuery(req, ['user', 'date', 'food_data']))
        {
            let reqQuery: ClientQuery = req.query as unknown as ClientQuery;
            sseService.notifyOtherClients(reqQuery.clientId, 'updated_db');
            log(`${PATH}, SAVED DATA: ${req.query.food_data}`);
            resStr = await connectDb.updateRow('food_records_raw', reqQuery.user, reqQuery.date, reqQuery.food_data);
            res.send(resStr);
        }
        else
        {
            error(`${PATH}, ERROR: Query param error! (params: ${StringUtils.jsonStringifyCircular(req.query)})`);
            res.send('');
        }
    }
    catch (e)
    {
        errorHandler(req, res, e);
    }
});

app.get(['/node_api/search_meal_history', '/client_versions/:version/node_api/search_meal_history'], async function (req, res)
{
    const PATH = `GET: ${req.originalUrl}`;

    try
    {
        log(`${PATH} called (params: ${StringUtils.jsonStringifyCircular(req.query)}`);

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
            log(`${PATH}, Mongo.findDocuments('food_records_raw', ${StringUtils.jsonStringifyCircular(queryObj)}, ${StringUtils.jsonStringifyCircular(optionsObj)}, true)`);

            let resultMeals = await connectDb.findDocuments('food_records_raw', queryObj, optionsObj, true);
            resStr = StringUtils.jsonStringifyCircular(resultMeals);
            //! TODO log levels + more compact logs!!
            log(`${PATH}, DB result arrived! Length: ${resStr.length}\r\n${resStr.substring(0, SEARCH_RESULTS_LOG_LIMIT) + (resStr.length > SEARCH_RESULTS_LOG_LIMIT ? "\r\n..." : "")}`);
            res.send(resStr);
        } else
        {
            error(`${PATH}, ERROR: Query param error! (params: ${StringUtils.jsonStringifyCircular(req.query)})`);
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
            error('Application is not set up correctly!\nPlease use either an app.env config file or use Heroku env variables!\nExiting...');
            process.exit(1);
        }
        log(`Initialize HEROKU mode: ${process.env.HEROKU}`);

        // init DB subsystem and read all food data
        connectDb = await initDb();
        await connectDb.connect();
        await connectDb.readFoodDbRows(g_allFoodRows);

        // start to listen
        app.listen(PORT, () => log(`KCal web page has been started on port ${PORT} !`));
    }
    catch (e)
    {
        error(`Error: ${e}`);
    }
}

initApp();