export { Config }

class Config
{
    /** @type {Config} */
    static instance;

    scaleType = 'barista';
    clientId = 'myPC/Phone';
    finalClientId = 'myPC/Phone';
    
    /**
     * @param {Config | null} values
     */
    static getInstance(values = null)
    {
        if (!Config.instance)
            Config.instance = new Config(CONFIG_PW, values);
        return Config.instance;
    }

    /**
     * @param {string} pw
     * @param {Config | null} values
     */
    constructor(pw = '', values = null)
    {
        if (pw != CONFIG_PW)
            throw new Error('You should not call the constructor directly. Use Config.getInstance() instead.');

        this.scaleType = values?.scaleType || this.scaleType;
        this.clientId = values?.clientId || this.clientId;
        this.finalClientId = values?.finalClientId || this.finalClientId;
    }
}

let CONFIG_PW = 'PeWet1427'
