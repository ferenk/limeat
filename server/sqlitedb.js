// bookshelf-app/server/db.js

// Import path module
const path = require('path')
const fs = require('fs')

// Find the food DB file: first sqlite file which begins with 'foods-' (e.g 'foods-test.sqlite')
var dbPath =  path.resolve(__dirname, 'foods-default.sqlite');
let fileNames = fs.readdirSync(__dirname);
fileNames.some(fileName => {
    if (fileName.startsWith('foods-') && fileName.endsWith('.sqlite')) {
        dbPath = path.join(__dirname, fileName);
        console.log(`Found food DB file: ${dbPath}`);
        return true;
    }
    return false;
});

// users: 'id', 'name', 'password_hash', 'email'
// foods: 'id', 'name', 'variant_name', 'creator', 'date', 'calories', 'weights'
// tracking: 'user_id', 'date', 'foods'

// Create connection to SQLite database
const knex = require('knex')({
    client: 'sqlite3',
    connection: {
        filename: dbPath,
    },
    useNullAsDefault: true
} );

//const sqlite = require('sqlite3');

class SQLiteDb {
    async createDbs()
    {
        // Create a foods table in the db if needed
        await knex.schema
            .hasTable('foods')
            .then((exists) => {
                if (!exists) {
                    let tableName = 'foods';
                    return knex.schema.createTable(tableName, (table) => {
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

        await knex.schema
            .hasTable('food_records_raw')
            .then((exists) => {
                if (!exists)
                {
                    let tableName = 'food_records_raw';

                    return knex.schema.createTable(tableName, (table) =>
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
        return await knex.select('*').from(tableName)
            .then(data => {
                console.log('data:', data);
                return data;
            })
            .catch(err => console.log(`ERROR (.catch() handler): ${err}`));
    }

    // Just for debugging purposes:    
    async updateRow(tableName, user, date, food_data)
    {
        await knex(tableName).insert({ user: user, date: date, food_data: food_data.replace(/\n/g, '\\nNEWLINE') })
            .onConflict(['user', 'date'])
            .merge({ food_data: food_data })
            .catch(err => {
                console.log(`ERROR (.catch() handler): ${err}`);
                return `ERROR: ${err}`;
            });
    }
}


// Export the database
module.exports = SQLiteDb;
