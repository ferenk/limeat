import { FoodDbItemStore } from '../../data/requests';

export class DbConnector
{
    static null: DbConnector;

    static
    {
        DbConnector.null = new DbConnector();
    }

    connect()
    {
        console.error('Abstract class - Methods are not implemented!');
    }

    /**
     * Read ALL food data from the file
     * @param {Object} _dbData
     */
    async readFoodDbRows(_dbData: FoodDbItemStore)
    {
        console.error('Abstract class - Methods are not implemented!');
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
        console.error('Abstract class - Methods are not implemented!');
        return '';
    }

    /**
     * General interface for reading table rows (as an Object)
     * @param tableName table name
     * @param keys the query JSON object
     * @returns read result message
     */
    async findDocuments(tableName: string, query: Object, options: Object | undefined, findMany: boolean): Promise<Object>
    {
        console.error('Abstract class - Methods are not implemented!');
        return '';
    }

    /**
     * General interface for creating/updating table rows (with an Object)
     * @param tableName table name
     * @param keys map which contains all keys in <key>:<value> format
     * @returns update result message
     */
    async updateDocument(tableName: string, keys: Map<String, String>, object: Object): Promise<string>
    {
        console.error('Abstract class - Methods are not implemented!');
        return '';
    }
}
