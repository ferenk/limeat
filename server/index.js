//app.use('/scripts', express.static(__dirname + '/node_modules/bootstrap/dist/'));

const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8089;
const express = require('express');
const { url } = require('inspector');
const bodyParser = require('body-parser');
const { query } = require('express');

const { SSEService } = require(path.join(__dirname, 'net', 'sseService.js'));

var app = express();

app.use(express.static(path.join(__dirname, '..', 'client'), { extensions: ['html', 'js', 'png'] }));
app.set('views', path.join(__dirname, '..', 'client'));
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');

// WEB server
app.get('/', function (req, res) {
    console.log('Rendering page... (main.html)');
    res.render('main');
});

var sseService = new SSEService(app);


function getsetCache(user, date, data)
{
    for (let idx = 0; idx< dbData.foods_raw.length; idx++)
    {
        if (dbData.foods_raw[idx].user == user && dbData.foods_raw[idx].date == date)
        {
            if (data == null)
            {
                console.log(`Cache: GET data FOUND (user: "${user}" date: "${date}")`);
                return dbData.foods_raw[idx].food_data;
            }
            else
            {
                dbData.foods_raw[idx].food_data = data;
                console.log(`Cache: SET data UPDATED (user: "${user}" date: "${date}")`);
                return null;
            }
        }
    }

    if (data != null)
    {
        dbData.foods_raw.push({ user: user, date: date, food_data: data });
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
    if (dbData.foods_raw == null)
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
    console.log(`Query: /node_api/read_calcdb`);

    let kcalDb = await connectDb.readKCalDb();
    res.send(kcalDb);
});

app.get('/node_api/read_foodrowdb', function (req, res)
{
    console.log(`Query: /node_api/read_calcdb (params: ${JSON.stringify(req.query)}`);

    if (checkQuery(req, ['user', 'date']))
    {
        let daydata = getsetCache(req.query.user, req.query.date);
        res.send(daydata);
        return;
    }

    res.send('');
});

app.get('/node_api/save_foodrowdb', async function (req, res)
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
});

/** @type { import('./db/connectors/dbconnector.js').DbConnector } */
var connectDb = null;
var dbData = {};

async function initApp()
{
    // basic init
    require(path.join(__dirname, 'startup')).initEnvVariables();

    // check config
    if (!process.env.HEROKU)
    {
        console.error('Application is not set up correctly!\nPlease use either an app.env config file or use Heroku env variables!\nExiting...');
        process.exit(1);
    }
    console.log(`Initialize HEROKU mode: ${process.env.HEROKU}`);

    // init DB subsystem and read all food data
    const Db = require(path.join(__dirname, 'db/db'));
    connectDb = await Db.initDb();
    await connectDb.connect();
    await connectDb.readFoodDbRows(dbData);

    // start to listen
    app.listen(PORT, () => console.log(`KCal web page has been started on port ${PORT} !`));
}

initApp();