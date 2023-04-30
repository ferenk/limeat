import { FindCursor } from 'mongodb';
import { DbConnector } from './dbconnector';
import { FoodDbItemStore, FoodDbItem, KCalTextDbItem } from '../../data/requests';

const { MongoClient } = require('mongodb');
const path = require('path');

export class MongoDb extends DbConnector
{
    connectUri: string;
    mongoDbClient: typeof MongoClient;

    /**
     * 
     * @param {String} uri 
     */
    constructor()
    {
        super();

        let connectUri = MongoDb.prepareConnectURI();
        if (connectUri)
        {
            this.connectUri = connectUri;
            this.mongoDbClient = new MongoClient(this.connectUri, { useUnifiedTopology: true });
        }
        else
            throw('No MongoDB URI has been specified!');
    }

    static prepareConnectURI(): string | undefined
    {
        let connectUri = process.env.DB_MONGO_URI; 
        if (connectUri && process.env.DB_MONGO_AUTH == 'X.509')
        {
            if (!connectUri.includes('authMechanism='))
                connectUri += `&authMechanism=MONGODB-X509`;
            // add certificate path
            if (!connectUri.includes('tlsCertificateKeyFile='))
            {
                // certificate path is relative to the project root folder
                if (process.env.DB_MONGO_AUTH_X_509_CERTFILE)
                {
                    let certfilePath = path.join(__dirname, '..', '..', '..', process.env.DB_MONGO_AUTH_X_509_CERTFILE);
                    connectUri += `&tlsCertificateKeyFile=${encodeURIComponent(certfilePath)}`;
                }
                else
                    console.error(`ERROR: X.509 certificate file is not set! Please use the DB_MONGO_AUTH_X_509_CERTFILE env variable!`);
            }
        }
        let connectUriStripped = connectUri ? connectUri.replace(/\/\/(...).*:(...).*@/, '\/\/<User>\($1...\):<PW>\($2...\)@') : '<null>';
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
    async dbCommand(command: string)
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
        var foodFileRecord = await this.findDocuments('foods', { 'version': 'kcaldb 0.0' }, false) as KCalTextDbItem[];

        return foodFileRecord[0].kcaldbfile;
    }

    override async readFoodDbRows(dbData: FoodDbItemStore)
    {
        dbData.foods_raw = [];

        try
        {
            dbData.foods_raw = await this.findDocuments('food_records_raw', {}, true) as FoodDbItem[];

            //console.log(`Cursor: ${ JSON.stringify(foodRecord)}`);
        }
        catch (e)
        {
            console.error(`ERROR: While reading food data from MongoDB: ${e}`);
        }
    }

    override async findDocuments(tableName: string, query: Object, findMany: boolean): Promise<Object[]>
    {
        const dbo = this.mongoDbClient.db(process.env.DB_NAME);
        const foodRecordCollection = dbo.collection(tableName);

        let resultArray: Object[] = [];

        if (findMany)
        {
            let cursor: FindCursor = await foodRecordCollection.find(query);
            await cursor.forEach((item) => { resultArray.push(item); });
        }
        else
        {
            resultArray.push(await foodRecordCollection.findOne(query));
        }

        return resultArray;
    }

    override async updateRow(tableName: string, user: string, date: string, food_data: string): Promise<string>
    {
        let objKeys = new Map([ [ 'user', user], ['date', date], ]);
        let fullObj = { user: user, date: date, food_data: food_data };
        return this.updateDocument(tableName, objKeys, fullObj);
    }

    override async updateDocument(tableName: string, keys: Map<String, String>, obj: Object): Promise<string>
    {
        try
        {
            const dbo = this.mongoDbClient.db(process.env.DB_NAME);
            const foodRecordCollection = dbo.collection(tableName);

            foodRecordCollection.updateOne(
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
