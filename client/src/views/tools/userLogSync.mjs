import { isError } from "../../util/util.mjs";

import { AppState, FoodLogEntry } from "../../app/states.mjs";
import { LocalStorage } from "../../comm/localStorage.mjs";

import { coolConfirm } from "../uiHelper.mjs";

class UserLogSync {
    /**
     * Compare the cached logs (last known state of this client) to the saved logs
     * Comparison, cases:
     *  1. There weren't any unsaved local changes - use remote! (NO msg)
     *  2. Local changes here!
     *      2.1 saveDates are the same => just the local changed => use cached? (+confirm)
     *      2.2 saveDates are different
     *          2.2.1 food_datas are the same (rare case) - use remote (NO msg)
     *          2.2.2 local saveDate is newer (impossible!) (+msg)
     *          2.2.3 remote saveDate is newer => conflict, message, confirmation => 1. local (default?) 2. remote? 3. auto merge (later)
     *
     * @param { FoodLogEntry } remoteEntry
     * @param { FoodLogEntry } localEntry
     */
    async selectNewer(remoteEntry, localEntry) {
        if (remoteEntry == null) {
            remoteEntry = localEntry;
        }
        let resEntry = remoteEntry;

        if (localEntry != null) {
            console.log(`save.cache: Found cached data for ${localEntry.user}, ${localEntry.date}`);

            const bLocalUnsavedChange = localEntry.changeDate > localEntry.saveDate;
            const bRemoteSavedChange = remoteEntry.saveDate > localEntry.saveDate;

            try {
                if (!bLocalUnsavedChange) {
                    console.log('selectNewer(), case 1: not changed locally (remote change is possible) => using remote');
                    resEntry = remoteEntry;
                }
                // cases 2... - CHANGED locally
                else {
                    // case 2.1
                    if (localEntry.saveDate == remoteEntry.saveDate) {
                        console.log(`selectNewer(), case 2.1: CHANGED only locally => ask user (using local automatically would be better?)`);
                        resEntry = localEntry;
                        let useLocalAnswer = await coolConfirm(
                            'info',
                            'Unsaved local change',
                            `Your food logs has local unsaved changes but there are no changes on the server.<br>Which version to use?`,
                            null,
                            'Local (SUGGESTED)',
                            'Server (your changes will be lost!)',
                            true);
                        console.log(`selectNewer(), case 2.1. User answer: ${useLocalAnswer}`);
                        if (useLocalAnswer) {
                            resEntry = localEntry;
                        }
                    }
                    // cases 2.2...
                    else {
                        // case 2.2.1
                        if (localEntry.food_data == remoteEntry.food_data) {
                            console.log('selectNewer(), case 2.2.1: change times are different but the content is the same (rare) => use remote');
                            resEntry = remoteEntry;
                        }
                        // case 2.2.2
                        else if (localEntry.saveDate > remoteEntry.saveDate) {
                            console.log(`selectNewer(), case 2.2.2: local save date is bigger than server's (IMPOSSIBLE?) => use local`);
                            console.log(`Local logs shouldn't have a newer save date than the date in the DB! (date: ${localEntry.date})`);
                        }
                        // case 2.2.3
                        else {
                            console.log(`selectNewer(), case 2.2.3: changes both locally and on the server => ask user`);
                            resEntry = remoteEntry;
                            let useLocalAnswer = await coolConfirm(
                                'warning',
                                'Conflict detected',
                                `Your food records have been updated both locally and on the server.<br>Which version to use?`,
                                null,
                                'Local (server changes will be lost)',
                                'Server (local changes will be lost!)',
                                false);
                            console.log(`selectNewer(), case 2.2.3. User answer: ${useLocalAnswer}`);
                            if (useLocalAnswer) {
                                resEntry = localEntry;
                            }
                        }
                        if (resEntry == localEntry) {
                            coolMessage('success', `Local unsaved data restored`, `Unsaved changes have been restored for user ${resEntry.user}, day ${resEntry.date}`);
                        }
                    }
                }
            } catch (e) {
                console.log('Error: While loading previously saved value!')
            }
        } else {
            console.log('TRACE: selectNewer(): No cached item found, using remote entry...')
        }

        return resEntry;
    }

    /**
     * Communication handler: Incoming whole daily food record
     *
     * @param {AppState} appState
     * @param {Controller} controller
     * @param {FoodLogEntry} remoteEntry
     * @param {FoodLogEntry> localEntry
     */
    async checkForConflicts(appState, controller, remoteEntry, localEntry)
    {
        const selEntry = await this.selectNewer(remoteEntry, localEntry);
        const selEntryText = selEntry?.food_data ?? '';

        if (selEntry != null) {
            // update localStorage (cache only)
            LocalStorage.saveEntry(selEntry);
            appState.actFoodEntry = selEntry;
            controller.lastDbUpdate = Number(new Date());
        } else {
            console.log(`log.load: selected food log is null. Clear the textviewd but don't execute any actions`);
        }

        // pre process food log
        controller.lastDbFoodInput = selEntryText.replaceAll('\\n', '\n');
        appState.jobsRunning.add("foodLogAreaReplace");
        controller.mealsDiaryText.changeText(selEntryText, true);
        if (selEntry && selEntry.food_data) {
            controller.onFoodInputChanged(true);
        }
        appState.jobsRunning.delete("foodLogAreaReplace");
        const isLogSaved = (remoteEntry.food_data === selEntry.food_data);
        controller.updateSavedStateLight(true, isLogSaved);
        setTimeout(() => {
            $('.btRefreshBg').removeClass('led-loading');
        }, 200);
        controller.mealsDiaryTextHighlight.setUiEnabled(true);
    }
}

export { UserLogSync };