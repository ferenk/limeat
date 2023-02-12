export function initEnvVariables()
{
    if (process.env.HEROKU !== "true")
    {
        try
        {
            const path = require('path');
            // try to open the file from the PARENT (project's home) folder!
            let appenvInitPath = path.join(__dirname, '..', '..', 'app.env');
            console.log(`Trying to read environment config from: ${appenvInitPath}`)
            require('dotenv').config({ path: appenvInitPath });
        } catch (e)
        {
            console.error('Unable to read environment variables!\n' + e);
        }
    }
}
