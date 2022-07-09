const path = require('path');

class MongoDb
{
    /**
     * 
     * @param {String} uri 
     */
    constructor()
    {
        // Prepare connection URI for connect()
        this.connectUri = process.env.DB_MONGO_URI; 
        if (this.connectUri && process.env.DB_MONGO_AUTH == 'X.509')
        {
            if (!this.connectUri.includes('authMechanism='))
                this.connectUri += `&authMechanism=MONGODB-X509`;
            // add certificate path
            if (!this.connectUri.includes('tlsCertificateKeyFile='))
            {
                // certificate path is relative to the project root folder
                if (process.env.DB_MONGO_AUTH_X_509_CERTFILE)
                {
                    let certfilePath = path.join(__dirname, '..', '..', process.env.DB_MONGO_AUTH_X_509_CERTFILE);
                    this.connectUri += `&tlsCertificateKeyFile=${encodeURIComponent(certfilePath)}`;
                }
                else
                    console.error(`ERROR: X.509 certificate file is not set! Please use the DB_MONGO_AUTH_X_509_CERTFILE env variable!`);
            }
        }
        console.log(`MongoDb connect URI: ${this.connectUri}`);
    }

    async connect()
    {
        const { MongoClient } = require('mongodb');
        this.mongoDbClient = await new MongoClient(this.connectUri, { useUnifiedTopology: true });
        await this.mongoDbClient.connect();
        await this.dbCommand();
    }

        /**
     * 
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
}

module.exports = { MongoDb };
