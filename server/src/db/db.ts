import { DbConnector } from './connectors/dbconnector';
import { SQLiteDb } from './connectors/sqlitedb';
import { MongoDb } from './connectors/mongodb';

export async function initDb() : Promise<DbConnector>
{
    console.log(`DB_MODE: ${process.env.DB_MODE}`);

    if (process.env.DB_DATABASE_NAME == null)
    {
        process.env.DB_NAME = 'KCalcDB-Test';
    }
    console.log(`Selected DB: ${process.env.DB_NAME}`);

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
