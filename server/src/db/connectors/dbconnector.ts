export class DbConnector
{
    static null: DbConnector;

    static
    {
        DbConnector.null = new DbConnector();
    }

    connect()
    {
        console.error('Not implemented yet!');
    }

    /**
     * Read ALL food data from the file
     * @param {Object} dbData 
     */
    async readFoodDbRows(dbData)
    {
        console.error('Not implemented yet!');
    }

    /**
     * 
     * @returns {string} KCal DB file's content
     */
    async readKCalDb()
    {
        return '';
    }

    async updateRow(tableName, user, date, food_data): Promise<string>
    {
        console.error('Not implemented yet!');
        return '';
    }
}

export class FoodDbItem
{
    user: string;
    date: string;
    food_data: string;
}

export class FoodDbItemStore
{
    foods_raw: FoodDbItem[];

    constructor()
    {
        this.foods_raw = [];
    }
}
