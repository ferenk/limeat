//app.use('/scripts', express.static(__dirname + '/node_modules/bootstrap/dist/'));

const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8089;
const express = require('express');
const { url } = require('inspector');
const bodyParser = require('body-parser');

var app = express();

app.use(express.static(path.join(__dirname, '../client'), { extensions: ['html', 'js', 'png'] }));
app.set('views', path.join(__dirname, '../client'));
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');

app.get('/', function (req, res) {
    console.log('Rendering page... (main.html)');
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
    res.send( readFile(path.join(__dirname, '../server/kcal_db.md')) );
});


app.listen(PORT, () => console.log('KCal web page has been started on port ' + PORT + ' !'));
