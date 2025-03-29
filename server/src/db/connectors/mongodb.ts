import { DbConnector } from './dbconnector';
import { FoodDbItemStore, FoodDbItem, KCalTextDbItem } from '../../data/requests';

import * as mongoDB from "mongodb";
const path = require('path');

export class MongoDb extends DbConnector
{
    connectUri: string;
    mongoDbClient: mongoDB.MongoClient;

    /**
     *
     * @param {String} uri
     */
    constructor()
    {
        super();

        const connectUri = MongoDb.prepareConnectURI();
        if (connectUri)
        {
            this.connectUri = connectUri;
            this.mongoDbClient = new mongoDB.MongoClient(this.connectUri, { });
        }
        else
            throw(new Error('No MongoDB URI has been specified!'));
    }

    static prepareConnectURI(): string | undefined
    {
        let connectUri = process.env.DB_MONGO_URI;
        if (connectUri && process.env.DB_MONGO_AUTH === 'X.509')
        {
            if (!connectUri.includes('authMechanism='))
                connectUri += `&authMechanism=MONGODB-X509`;
            // add certificate path
            if (!connectUri.includes('tlsCertificateKeyFile='))
            {
                // certificate path is relative to the project root folder
                if (process.env.DB_MONGO_AUTH_X_509_CERTFILE)
                {
                    const certfilePath = path.join(__dirname, '..', '..', '..', process.env.DB_MONGO_AUTH_X_509_CERTFILE);
                    connectUri += `&tlsCertificateKeyFile=${encodeURIComponent(certfilePath)}`;
                }
                else
                    console.error(`ERROR: X.509 certificate file is not set! Please use the DB_MONGO_AUTH_X_509_CERTFILE env variable!`);
            }
        }
        const connectUriStripped = connectUri ? connectUri.replace(/\/\/(...).*:(...).*@/, '//<User>($1...):<PW>($2...)@') : '<null>';
        console.log(`MongoDb connect URI: ${connectUriStripped}`);

        return connectUri;
    }

    override async connect()
    {
        try
        {
            await this.mongoDbClient.connect();
        }
        catch (e)
        {
            console.error(`ERROR: While connecting to MongoDB: ${e}`);
        }
    }

    /**
     * For testing purposes. Simple DB command execution
     * @param {String} command
     */
    async dbCommand(_command: string)
    {
        try
        {
            await this.mongoDbClient.db("admin").command({ ping: 1 });
            console.log("Connected successfully to server!");
        } finally
        {
            await this.mongoDbClient.close();
        }
    }

    async createDbs()
    {
        console.log('Creating MongoDB databases... are NOT necessary. Skipped.');
    }

    override async readKCalDb()
    {
        const foodFileRecord = await this.findDocuments('foods', { 'version': 'kcaldb 0.0' }, undefined, false) as KCalTextDbItem[];

        return foodFileRecord[0].kcaldbfile;
    }

    override async readFoodDbRows(dbData: FoodDbItemStore)
    {
        dbData.foods_raw = [];

        try
        {
            dbData.foods_raw = await this.findDocuments('food_records_raw', {}, undefined, true) as FoodDbItem[];

            //console.log(`Cursor: ${ JSON.stringify(foodRecord)}`);
        }
        catch (e)
        {
            console.error(`ERROR: While reading food data from MongoDB: ${e}`);
        }
    }

    override async findDocuments(tableName: string, query: Object, options: Object | undefined, findMany: boolean): Promise<Object[]>
    {
        const dbo = this.mongoDbClient.db(process.env.DB_MONGO_DBNAME);
        const foodRecordCollection = dbo.collection(tableName);

        const resultArray: Object[] = [];

        if (findMany)
        {
            //let cursor: mongoDB.FindCursor = await foodRecordCollection.find(query, options);
            console.log(`findDocuments() [findMany]: mongo options: ${JSON.stringify(options)}`);
            const cursor: mongoDB.FindCursor = foodRecordCollection.find(query, options);
            await cursor.forEach((item) => { resultArray.push(item); });
        }
        else
        {
            const oneResult = await foodRecordCollection.findOne(query, options);
            //console.log(`findDocuments() [findOne], result: ${JSON.stringify(oneResult)}`);
            if (oneResult)
                resultArray.push(oneResult);
        }

        return resultArray;
    }

    override async updateRow(tableName: string, user: string, date: string, food_data: string): Promise<string>
    {
        const objKeys = new Map([ [ 'user', user], ['date', date], ]);
        const fullObj = { user: user, date: date, food_data: food_data };
        return this.updateDocument(tableName, objKeys, fullObj);
    }

    override async updateDocument(tableName: string, keys: Map<string, string>, obj: Object): Promise<string>
    {
        try
        {
            const dbo = this.mongoDbClient.db(process.env.DB_MONGO_DBNAME);
            const foodRecordCollection = dbo.collection(tableName);

            await foodRecordCollection.updateOne(
                keys,
                { $set: obj },
                { upsert: true }
            );
        }
        catch (e)
        {
            console.error(`ERROR: While updating food data in MongoDB: ${e}`);
        }
        return 'OK';
    }
}
