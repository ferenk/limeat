class Config
{
    /** @type {Config | null} */
    static instance;

    scaleType = 'barista';
    clientId = 'myPC/Phone';
    finalClientId = 'myPC/Phone';
    static TEXTAREA_ID = 'txtMealsDiary';

    /**
     * @param {any | null} values
     */
    static getInstance(values = null)
    {
        if (!Config.instance)
            Config.instance = new Config(PRIVATE_CONFIG_CONSTRUCTOR_KEY, values);
        return Config.instance;
    }

    /**
     * @param {string} pw
     * @param {Config | null} values
     */
    constructor(pw = '', values = null)
    {
        if (pw !== PRIVATE_CONFIG_CONSTRUCTOR_KEY)
            throw new Error('You should not call the constructor directly. Use Config.getInstance() instead.');

        this.scaleType = values?.scaleType || this.scaleType;
        this.clientId = values?.clientId || this.clientId;
        this.finalClientId = values?.finalClientId || this.finalClientId;
    }
}

let PRIVATE_CONFIG_CONSTRUCTOR_KEY = Symbol();

export { Config };
