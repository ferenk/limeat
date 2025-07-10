import { DbConnector } from './connectors/dbconnector';
import { SQLiteDb } from './connectors/sqlitedb';
import { MongoDb } from './connectors/mongodb';

import { log, error } from '../core/log';

var DB_MONGO_DEFAULT_DBNAME = 'KCalcDB-Test';

export async function initDb(): Promise<DbConnector>
{
    log(`DB_MODE: ${process.env.DB_MODE}`);

    process.env.DB_MONGO_DBNAME = process.env.DB_MONGO_DBNAME ?? DB_MONGO_DEFAULT_DBNAME;
    log(`Selected DB: ${process.env.DB_MONGO_DBNAME}`);

    if (process.env.DB_MODE === 'sqlite')
    {
        log('Initializing SQLite DB...');

        const path = require('path');
        let connectDb = new SQLiteDb(path.join(__dirname, '..', '..'));

        log('Reading tables...');
        await connectDb.createDbs();

        return connectDb;
    }
    else if (process.env.DB_MODE === 'mongodb')
    {
        log('Initializing MongoDB...');

        let connectDb = new MongoDb();
        await connectDb.connect();
        await connectDb.createDbs();

        return connectDb;
    }
    else
    {
        error('DB_MODE is not set correctly! (sqlite or mongodb) Exiting...');
        process.exit(2);
    }
    return DbConnector.null;
}
