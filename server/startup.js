function initEnvVariables()
{
    if (process.env.HEROKU !== "true")
    {
        try
        {
            const path = require('path');
            // try to open the file from the PARENT (project's home) folder!
            require('dotenv').config({ path: path.join(__dirname, '..', 'app.env') });
        } catch (e)
        {
            console.error('Unable to read environment variables!\n' + e);
        }
    }
}

module.exports = { initEnvVariables };