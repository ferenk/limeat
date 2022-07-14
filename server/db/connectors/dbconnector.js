class DbConnector
{
    connect()
    {
        log.error("Not implemented yet!");
    }

    /**
     * Read ALL food data from the file
     * @param {Object} dbData 
     */
    async readFoodDbRows(dbData)
    {
        log.error("Not implemented yet!");
    }

    /**
     * 
     * @returns {String} KCal DB file's content
     */
    async readKCalDb()
    {
        return readFile(path.join(__dirname, '..', 'server', 'kcal_db.md')) 
    }
}

module.exports = { DbConnector };