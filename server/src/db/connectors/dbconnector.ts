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
}
