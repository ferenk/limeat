/**
 * @returns { import('./clipboard.js').DbConnector }
 */
async function initDb()
{
    console.log(`DB_MODE: ${process.env.DB_MODE}`);

    if (process.env.DB_MODE === 'sqlite')
    {
        console.log('Initializing SQLite DB...');

        const path = require('path');
        const DBModule_SQLite = require(path.join(__dirname, 'connectors', 'sqlitedb'));

        let connectDb = new DBModule_SQLite.SQLiteDb(path.join(__dirname, '..'));

        console.log('Reading tables...');
        await connectDb.createDbs();

        return connectDb;
    }
    else if (process.env.DB_MODE === 'mongodb')
    {
        console.log('Initializing MongoDB...');

        const path = require('path');
        const DBModule_MongoDB = require(path.join(__dirname, 'connectors', 'mongodb'));

        let connectDb = new DBModule_MongoDB.MongoDb();
        await connectDb.connect();
        await connectDb.createDbs();

        return connectDb;
    }
    else
    {
        console.error('DB_MODE is not set correctly! (sqlite or mongodb) Exiting...');
        process.exit(2);
    }
}

module.exports = { initDb };