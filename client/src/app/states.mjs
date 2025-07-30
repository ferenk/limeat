import {Config} from "./config.mjs";
import {getCurrentRawMoment} from "../util/util.mjs";

const g_config = Config.getInstance(
    {
        scaleType: 'barista',
        clientId: window.localStorage.optClientId,
        finalClientId: window.localStorage.optClientId
    }
);

class FoodLogEntry {
    user = '';
    date = '';
    saveDate = '';
    changeDate = '';
    food_data = '';

    /**
     * 
     * @param user { String }
     * @param date { String }
     * @param food_data { String }
     * @param updateTimestamps { boolean }
     */
    constructor(user= '', date = '', food_data = '', updateTimestamps = false) {
        this.user = user;
        this.date = date;
        this.food_data = food_data;
        if (updateTimestamps) {
            this.saveDate = this.changeDate = getCurrentRawMoment().toISOString();
        }
    }
}

class AppState {
    actFoodEntry = new FoodLogEntry();
    maskedEvents = new Set();
    jobsRunning = new Set();
    mealListLang = {};
}

const g_appState = new AppState();

export { g_appState, g_config, AppState, FoodLogEntry };