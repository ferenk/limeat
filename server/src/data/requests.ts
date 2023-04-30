export class ClientQuery
{
    clientId: string;
    user: string;
    date: string;
    data: string;
    food_data: string;
    constructor(user: string, date: string, data: string, food_data: string)
    {
        this.user = user;
        this.date = date;
        this.data = data;
        this.food_data = food_data;
        this.clientId = '';
    }
}

export class FoodDbItem
{
    user: string;
    date: string;
    food_data: string;

    constructor(user: string, date: string, food_data: string)
    {
        this.user = user;
        this.date = date;
        this.food_data = food_data;
    }
}

export class KCalTextDbItem
{
    version: string = '';
    kcaldbfile: string = '';
}

export class FoodDbItemStore
{
    foods_raw: FoodDbItem[];

    constructor()
    {
        this.foods_raw = [];
    }
}

export class FoodObjBase
{
    name: string = '';
    amount: number = 0;
    unit: string = '';
    kcal: number = 0;
}

export class FoodObjList
{
    user: string = '';
    data: FoodObjBase[] = [];
}