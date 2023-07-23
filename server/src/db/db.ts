import { DbConnector } from './connectors/dbconnector';
import { SQLiteDb } from './connectors/sqlitedb';
import { MongoDb } from './connectors/mongodb';

var DB_MONGO_DEFAULT_DBNAME = 'KCalcDB-Test';

export async function initDb(): Promise<DbConnector>
{
    console.log(`DB_MODE: ${process.env.DB_MODE}`);

    process.env.DB_MONGO_DBNAME = process.env.DB_MONGO_DBNAME ?? DB_MONGO_DEFAULT_DBNAME;
    console.log(`Selected DB: ${process.env.DB_MONGO_DBNAME}`);

    if (process.env.DB_MODE === 'sqlite')
    {
        console.log('Initializing SQLite DB...');

        const path = require('path');
        let connectDb = new SQLiteDb(path.join(__dirname, '..', '..'));

        console.log('Reading tables...');
        await connectDb.createDbs();

        return connectDb;
    }
    else if (process.env.DB_MODE === 'mongodb')
    {
        console.log('Initializing MongoDB...');

        let connectDb = new MongoDb();
        await connectDb.connect();
        await connectDb.createDbs();

        return connectDb;
    }
    else
    {
        console.error('DB_MODE is not set correctly! (sqlite or mongodb) Exiting...');
        process.exit(2);
    }
    return DbConnector.null;
}
