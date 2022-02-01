//app.use('/scripts', express.static(__dirname + '/node_modules/bootstrap/dist/'));

const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8089;
const express = require('express');
const { url } = require('inspector');
const bodyParser = require('body-parser');

var app = express();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static('.'));
app.set('views', '.');
//app.register('.html', require('ejs'));
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');

app.get('/', function (req, res) {
    res.render('main');
});

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

app.get('/node_api/read_calcdb', function (req, res) {
    console.log(`Query: /node_api/read_calcdb`);
    res.send( readFile('kcal_db.md') );
});


app.listen(PORT, () => console.log('KCal web page has been started on port ' + PORT + ' !'));
