// bookshelf-app/server/db.js

// Import path module
const path = require('path');
const fs = require('fs');

const { DbConnector } = require(path.join(__dirname, 'dbconnector'));

// users: 'id', 'name', 'password_hash', 'email'
// foods: 'id', 'name', 'variant_name', 'creator', 'date', 'calories', 'weights'
// tracking: 'user_id', 'date', 'foods'

class SQLiteDb extends DbConnector {
    /**
     * Initializes the SQlite DB connector
     * @param {String} dbRootFolder The folder where the DB files are stored
     */
    constructor(dbRootFolder)
    {
        super();

        this.foodDbPath = this.findFoodDbFile(dbRootFolder);
        this.knex = this.initWithKnex();
    }

    initWithKnex()
    {
        //const sqlite = require('sqlite3');

        // Create connection to SQLite database
        const knex = require('knex')({
            client: 'sqlite3',
            connection: {
                filename: this.foodDbPath,
            },
            useNullAsDefault: true
        } );

        return knex;
    }

    async connect()
    {
        console.log('Connecting is not needed in case of SQLite DBs. Skipped.');
    }

    findFoodDbFile(dbRootFolder)
    {
        if (dbRootFolder == null)
            dbRootFolder = __dirname;

        // Find the food DB file: first sqlite file which begins with 'foods-' (e.g 'foods-test.sqlite')
        var foodDbPath =  path.resolve(dbRootFolder, 'foods-default.sqlite');

        let fileNames = fs.readdirSync(dbRootFolder);
        let found = false;
        fileNames.some(fileName => {
            if (fileName.startsWith('foods-') && fileName.endsWith('.sqlite')) {
                foodDbPath = path.join(dbRootFolder, fileName);
                console.log(`Found food DB file: ${foodDbPath}`);
                found = true;
                return true;
            }
            return false;
        });

        if (!found)
            console.log('DB file NOT found!');
        return foodDbPath;
    }

    async createDbs()
    {
        // Create a foods table in the db if needed
        await this.knex.schema
            .hasTable('foods')
            .then((exists) => {
                if (!exists) {
                    let tableName = 'foods';
                    return this.knex.schema.createTable(tableName, (table) => {
                        table.increments('id').primary();
                        table.string('short_name');
                        table.string('name');
                        table.string('variant_name');
                        table.string('password_hash');
                        table.string('email');
                    })
                        .then(() => {
                            // Log success message
                            console.log(`Table \'${tableName}\' created`);
                        })
                        .catch((error) => {
                            console.error(`There was an error creating table: ${error}`);
                        })
                }
            })
            .catch((error) => {
                console.error(`There was an error setting up the database: ${error}`);
            });

        await this.knex.schema
            .hasTable('food_records_raw')
            .then((exists) => {
                if (!exists)
                {
                    let tableName = 'food_records_raw';

                    return this.knex.schema.createTable(tableName, (table) =>
                    {
                        table.string('user');
                        table.string('date');
                        table.string('food_data');
                        table.primary(['user', 'date']);
                    })
                        .then(() => {
                            // Log success message
                            console.log(`Table \'${tableName}\' created`);
                        })
                        .catch((error) => {
                            console.error(`There was an error creating table: ${error}`);
                        });
                }
            })
            .catch((error) => {
                console.error(`There was an error setting up the database: ${error}`);
            });
    }

    // Just for debugging purposes:
    // Log all data in "books" table
    async selectAllRows(tableName) {
        return await this.knex.select('*').from(tableName)
            .then(data => {
                console.log('data:', data);
                return data;
            })
            .catch(err => console.log(`ERROR (.catch() handler): ${err}`));
    }

    async readKCalDb()
    {
        return SQLiteDb.readFile(path.join(__dirname, '..', '..', '..', 'kcal_db.md')) 
    }

    static readFile(filename)
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

    /**
     * Read all food data from the file (read from the SQLite DB)
     * @param {Object} dbData 
     */
    async readFoodDbRows(dbData)
    {
        dbData.foods_raw = await this.selectAllRows('food_records_raw');
        console.log(`DB rows read: ${dbData.foods_raw}`);
    }

    // Just for debugging purposes:    
    async updateRow(tableName, user, date, food_data)
    {
        await this.knex(tableName).insert({ user: user, date: date, food_data: food_data })
            .onConflict(['user', 'date'])
            .merge({ food_data: food_data })
            .catch(err => {
                console.log(`ERROR (.catch() handler): ${err}`);
                return `ERROR: ${err}`;
            });
    }
}


// Export the database
module.exports = { SQLiteDb };
