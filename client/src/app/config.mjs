export { Config }

let ConfigPW = 'PeWet1427'

class Config
{
    /** @type {Config} */
    static instance;
    
    /**
     * @param {Config | null} values
     */
    static getInstance(values = null)
    {
        if (!Config.instance)
            Config.instance = new Config(ConfigPW, values);
        return Config.instance;
    }

    /**
     * @param {string} pw
     * @param {Config | null} values
     */
    constructor(pw, values = null)
    {
        if (pw != ConfigPW)
            throw new Error('You should not call the constructor directly. Use Config.getInstance() instead.');

        this.scaleType = values?.scaleType || 'barista';
        this.clientId =  values?.scaleType || 'myPC/Phone',
        this.finalClientId = values?.scaleType || 'myPC/Phone'
    }
}