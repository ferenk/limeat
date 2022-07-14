const path = require('path');

const { DbConnector } = require(path.join(__dirname, 'dbconnector'));

class MongoDb extends DbConnector
{
    /**
     * 
     * @param {String} uri 
     */
    constructor()
    {
        super();

        const { MongoClient } = require('mongodb');

        this.connectUri = MongoDb.prepareConnectURI();
        /** @type {MongoClient} */
        this.mongoDbClient = new MongoClient(this.connectUri, { useUnifiedTopology: true });
    }

    static prepareConnectURI()
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
                    let certfilePath = path.join(__dirname, '..', '..', process.env.DB_MONGO_AUTH_X_509_CERTFILE);
                    connectUri += `&tlsCertificateKeyFile=${encodeURIComponent(certfilePath)}`;
                }
                else
                    console.error(`ERROR: X.509 certificate file is not set! Please use the DB_MONGO_AUTH_X_509_CERTFILE env variable!`);
            }
        }
        console.log(`MongoDb connect URI: ${connectUri.replace(/\/\/.*@/, '\/\/<User>:<PW>@')}`);

        return connectUri;
    }

    async connect()
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
    async dbCommand(command)
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
        console.log('Creating MongoDB databases... are currently NOT necessary. Skipped.');
    }

    async readKCalDb()
    {
        const dbo = this.mongoDbClient.db('KCalcDB');
        const foodRecordCollection = dbo.collection('foods');

        var foodFileRecord = await foodRecordCollection.findOne( { version: "kcaldb 0.0" } );

        return foodFileRecord.kcaldbfile;
    }

    async readFoodDbRows(dbData)
    {
        dbData.foods_raw = [];

        try
        {
            const dbo = this.mongoDbClient.db('KCalcDB');
            const foodRecordCollection = dbo.collection('food_records_raw');

            const cursor = await foodRecordCollection.find({ });
            await cursor.forEach((foodItem) => { dbData.foods_raw.push(foodItem); });

            //console.log(`Cursor: ${ JSON.stringify(foodRecord)}`);
        }
        catch (e)
        {
            console.error(`ERROR: While reading food data from MongoDB: ${e}`);
        }
    }

    async updateRow(tableName, user, date, food_data)
    {
        try
        {
            const dbo = this.mongoDbClient.db('KCalcDB');
            const foodRecordCollection = dbo.collection(tableName);

            let newDocument = { user: user, date: date, food_data: food_data.replace(/\n/g, '\\nNEWLINE') };

            //foodRecordCollection.insertOne(newDocument);
            foodRecordCollection.updateOne(
                { 'user': user, 'date': date },
                { $set: newDocument },
                { upsert: true }
            );
        }
        catch (e)
        {
            console.error(`ERROR: While reading food data from MongoDB: ${e}`);
        }
    }
}

module.exports = { MongoDb };
