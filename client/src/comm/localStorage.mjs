import { Config } from "../app/config.mjs";
import { g_appState } from "../app/states.mjs";
import { g_config} from "../app/states.mjs";

class LocalStorage {
    static DEFAULT_LOGENTRY_NAME = 'foodlog';

    /**
     * Handle local storage as the 0. level, local cache of the log serialization
     * @param FoodLogEntry entry
     * @returns Object The XHR payload object ("params")
     */
    static updateEntryObj(entry) {
        // refresh the cache object
        entry.user = $('#tUser').val();
        entry.date = $('#tDate').val().substring(0, 10);
        entry.clientId = g_config.finalClientId;
        entry.food_data = $(`#${Config.TEXTAREA_ID}`).val();
        return entry;
    }


    static generateStorageKey(entry, entryName = LocalStorage.DEFAULT_LOGENTRY_NAME)
    {
        return `cached_${entryName}_${entry.user}_${entry.date}`;
    }

    static loadEntry(entry, copyValues = true)
    {
        const storageKey = LocalStorage.generateStorageKey(entry);

        // load from local storage
        const item = localStorage.getItem(storageKey);

        // check item & convert it to a serialized JSON object
        if ((item ?? '').length != 0) {
            console.log(`localStorage.load: loaded item from localStorage (key: '${storageKey}')`);
            return JSON.parse(item);
        } else {
            console.log(`ERROR: localStorage.load: item not found! (key: '${storageKey}')`);
            return null;
        }
    }

    static saveEntry(entry, updateTimes = 0)
    {
        const storageKey = LocalStorage.generateStorageKey(entry);
        const currTimeStamp = moment().toISOString();

        // update timestamps
        if ((updateTimes & 1) && !g_appState.jobsRunning.has("foodLogAreaReplace")) {
            entry.changeDate = currTimeStamp;
        }
        if ((updateTimes & 2) && !g_appState.jobsRunning.has("foodLogAreaReplace")) {
            entry.saveDate = currTimeStamp;
        }

        // save to local storage
        localStorage.setItem(storageKey, JSON.stringify(entry));
        console.log(`localStorage.save: saved state in the cache (key: '${storageKey}')`);
    }

    static deleteEntry(entry, entryName)
    {
        const storageKey = LocalStorage.generateStorageKey(entry);

        //localStorage.removeItem(storageKey);
        console.log(`save.cache: NOT deleted cached state (key: '${storageKey}')`);
    }
}

export { LocalStorage };