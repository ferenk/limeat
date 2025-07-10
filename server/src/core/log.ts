
// very simple logger
export function log(msg: string): void
{
    if (process.env.LOG_TIMESTAMPS) {
        let dateStr = new Date().toISOString();
        dateStr = `[${dateStr.substring(0, 10)} ${dateStr.substr(11, 10)}]`;
        console.log(dateStr, msg);
    } else {
        console.log( msg);
    }
};

export function error(msg: string): void
{
    if (process.env.LOG_TIMESTAMPS) {
        let dateStr = new Date().toISOString();
        dateStr = `[${dateStr.substring(0, 10)} ${dateStr.substr(11, 10)}]`;
        console.error(dateStr, msg);
    } else {
        console.error(msg);
    }
};
