import { Knex } from 'knex';

import { DbConnector } from './dbconnector';
import { FoodDbItemStore } from '../../data/requests';

import { log } from '../../core/log';

const fs = require('fs');
const path = require('path');

// users: 'id', 'name', 'password_hash', 'email'
// foods: 'id', 'name', 'variant_name', 'creator', 'date', 'calories', 'weights'
// tracking: 'user_id', 'date', 'foods'

export class SQLiteDb extends DbConnector
{
    foodDbPath: string;
    knex: Knex;

    /**
     * Initializes the SQlite DB connector
     * @param {String} dbRootFolder The folder where the DB files are stored
     */
    constructor(dbRootFolder: string)
    {
        super();

        this.foodDbPath = this.findFoodDbFile(dbRootFolder);
        this.knex = this.initWithKnex();
    }

    initWithKnex()
    {
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

    override async connect()
    {
        log('Connecting is not needed in case of SQLite DBs. Skipped.');
    }

    findFoodDbFile(dbRootFolder: string)
    {
        if (dbRootFolder == null)
            dbRootFolder = __dirname;

        // Find the food DB file: first sqlite file which begins with 'foods-' (e.g 'foods-test.sqlite')
        var foodDbPath =  path.resolve(dbRootFolder, 'foods-default.sqlite');

        let fileNames: string[] = fs.readdirSync(dbRootFolder);
        let found = false;
        fileNames.some(fileName => {
            if (fileName.startsWith('foods-') && fileName.endsWith('.sqlite')) {
                foodDbPath = path.join(dbRootFolder, fileName);
                log(`Found food DB file: ${foodDbPath}`);
                found = true;
                return true;
            }
            return false;
        });

        if (!found)
            log('DB file NOT found!');
        return foodDbPath;
    }

    async createDbs()
    {
        // Create a foods table in the db if needed
        await this.knex.schema
            .hasTable('foods')
            .then((exists: boolean) => {
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
                            log(`Table \'${tableName}\' created`);
                        })
                        .catch((error: Error) => {
                            console.error(`There was an error creating table: ${error}`);
                        })
                }
                return null;
            })
            .catch((error: Error) => {
                console.error(`There was an error setting up the database: ${error}`);
            });

        await this.knex.schema
            .hasTable('food_records_raw')
            .then((exists: boolean) => {
                if (!exists)
                {
                    let tableName = 'food_records_raw';

                    return this.knex.schema.createTable(tableName, (table: Knex.TableBuilder) =>
                    {
                        table.string('user');
                        table.string('date');
                        table.string('food_data');
                        table.primary(['user', 'date']);
                    })
                        .then(() => {
                            // Log success message
                            log(`Table \'${tableName}\' created`);
                        })
                        .catch((error) => {
                            console.error(`There was an error creating table: ${error}`);
                        });
                }
                return null;
            })
            .catch((error) => {
                console.error(`There was an error setting up the database: ${error}`);
            });
    }

    // Just for debugging purposes:
    // Log all data in "books" table
    async selectAllRows(tableName: string): Promise<string[] | any /** TODO */> {
        return await this.knex.select('*').from(tableName)
            .then(data => {
                log(`data: ${data}`);
                return data;
            })
            .catch(err => console.error(`ERROR (.catch() handler): ${err}`));
    }

    override async readKCalDb()
    {
        return SQLiteDb.readFile(path.join(__dirname, '..', '..', '..', 'kcal_db.md'));
    }

    static readFile(filename: string)
    {
        try
        {
            const data = fs.readFileSync(filename, 'utf8');
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
     */
    override async readFoodDbRows(dbData: FoodDbItemStore)
    {
        dbData.foods_raw = await this.selectAllRows('food_records_raw');
        log(`DB rows read: ${dbData.foods_raw}`);
    }

    // Just for debugging purposes:
    override async updateRow(tableName: string, user: string, date: string, food_data: string): Promise<string>
    {
        await this.knex(tableName).insert({ user: user, date: date, food_data: food_data })
            .onConflict(['user', 'date'])
            .merge({ food_data: food_data })
            .catch(err => {
                log(`ERROR (.catch() handler): ${err}`);
                return `ERROR: ${err}`;
            });
        return 'OK';
    }
}

