import { DbConnector, FoodDbItemStore, FoodDbItem } from './db/connectors/dbconnector';
import { SSEService } from './net/sseService';
import { initDb } from './db/db';
import { initEnvVariables } from './startup';

const path = require('path');

const PORT = process.env.PORT || 8089;
const express = require('express');
const bodyParser = require('body-parser');
const { query } = require('express');

var connectDb: DbConnector = DbConnector.null;
var g_allFoodRows = new FoodDbItemStore();


var app = express();

app.use(express.static(path.join(__dirname, '..', '..', 'client', 'src'), { extensions: ['html', 'js', 'mjs', 'css', 'png', 'svg'] }));
app.set('views', path.join(__dirname, '..', '..', 'client', 'src'));
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');

// WEB server
app.get('/', function (req, res) {
    console.log('Rendering page... (main.html)');
    res.render('main');
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
        return '';
    }
}

async function updateFoodRow(user, date, data)
{
    
}

function checkQuery(req, params)
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
            console.log(`Query problem! ${params[i]}: null`);
            return false;
        }
    }
    return true;
}

app.get('/node_api/read_calcdb', async function (req, res)
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
            let daydata = getsetCache(req.query.user, req.query.date, req.query.data);
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
            getsetCache(req.query.user, req.query.date, req.query.food_data);
            sseService.notifyOtherClients(req.query.clientId, 'updated_db');
            console.log(`SAVED DATA: ${req.query.food_data}`);
            resStr = await connectDb.updateRow('food_records_raw', req.query.user, req.query.date, req.query.food_data);
        }

        res.send(resStr);
    }
    catch (e)
    {
        console.error(`Error: ${e}`);
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