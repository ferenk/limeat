//app.use('/scripts', express.static(__dirname + '/node_modules/bootstrap/dist/'));

const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8089;
const express = require('express');
const { url } = require('inspector');
const bodyParser = require('body-parser');
const { query } = require('express');

var app = express();

app.use(express.static(path.join(__dirname, '../client'), { extensions: ['html', 'js', 'png'] }));
app.set('views', path.join(__dirname, '../client'));
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');

app.get('/', function (req, res) {
    console.log('Rendering page... (main.html)');
    res.render('main');
});

var connectDb = null, dbData = {};;
initDb();

function readFile(filename)
{
    try
    {
        const data = fs.readFileSync(filename, 'utf8')
        return data;
    }
    catch (err)
    {
        console.error(err)
        return null;
    }
}

async function readFoodDbRows()
{
    dbData.foods_raw = await connectDb.selectAllRows('food_records_raw');
    console.log(`DB rows read: ${dbData.foods_raw}`);
}

async function initDb()
{
    const DBConnector_SQLite = require('./sqlitedb');

    //console.log(`imported knex lib: ${sqlitedb}`);
    connectDb = new DBConnector_SQLite();
    await connectDb.createDbs();

    await readFoodDbRows('food_records_raw');
}

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

app.get('/node_api/read_calcdb', function (req, res)
{
    console.log(`Query: /node_api/read_calcdb`);
    res.send( readFile(path.join(__dirname, '../server/kcal_db.md')) );
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
        console.log(`SAVED DATA: ${req.query.food_data}`);
        resStr = await connectDb.updateRow('food_records_raw', req.query.user, req.query.date, req.query.food_data);
    }

    res.send(resStr);
});

app.listen(PORT, () => console.log(`KCal web page has been started on port ${PORT} !`));
