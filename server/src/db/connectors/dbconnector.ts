import { FoodDbItemStore } from '../../data/requests';

import { error } from '../../core/log';

export class DbConnector
{
    static null: DbConnector;

    static
    {
        DbConnector.null = new DbConnector();
    }

    connect()
    {
        error('Abstract class - Methods are not implemented!');
    }

    /**
     * Read ALL food data from the file
     * @param {Object} _dbData
     */
    async readFoodDbRows(_dbData: FoodDbItemStore)
    {
        error('Abstract class - Methods are not implemented!');
    }

    /**
     *
     * @returns {string} KCal DB file's content
     */
    async readKCalDb()
    {
        return '';
    }

    async updateRow(_tableName: string, _user: string, _date: string, _food_data: string): Promise<string>
    {
        error('Abstract class - Methods are not implemented!');
        return '';
    }

    /**
     * General interface for reading table rows (as an Object)
     * @param tableName table name
     * @param keys the query JSON object
     * @returns read result message
     */
    async findDocuments(_tableName: string, _query: Object, _options: Object | undefined, _findMany: boolean): Promise<Object>
    {
        error('Abstract class - Methods are not implemented!');
        return '';
    }

    /**
     * General interface for creating/updating table rows (with an Object)
     * @param tableName table name
     * @param keys map which contains all keys in <key>:<value> format
     * @returns update result message
     */
    async updateDocument(_tableName: string, _keys: Map<String, String>, _object: Object): Promise<string>
    {
        error('Abstract class - Methods are not implemented!');
        return '';
    }
}
