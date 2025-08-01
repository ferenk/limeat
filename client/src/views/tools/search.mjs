export { SearchTools };

import { nodeXHRComm } from '../../comm/comm.mjs';
import { printMoment, parseIsoDate, toFixedFloat, copyText2Clipboard } from '../../util/util.mjs';
import { searchForId, showMessage } from '../../util/ui/uiUtils.mjs';
import { Meal, Food } from '../../data/foodData.mjs';
import { Controller } from '../../controller.mjs';


class SearchTools
{
    /**
     * @param {Controller} controller
     * @param {import('../../data/basicTypes.mjs').StringReceiverCB} activatedCB
     */
    constructor(controller, activatedCB)
    {
        this.g_controller = controller;
        this.autoCompleteActivatedCB = activatedCB;
        this.onSearchToolsClose();
        document.getElementById('autoCompleteResult')?.addEventListener('click', this.onAutoCompleteResultClicked.bind(this));
    }

    /**
     *
     * @param {String} eventStr
     */
    onSearchOptionsChanged(eventStr)
    {
        //alert(`Option '${eventStr}' was used`);
        if (eventStr.startsWith('days'))
        {
            let selectionHelpStr = ''
            const optionValueStr = $('#searchDays').val();
            console.log(`Search options, selected time range: ${optionValueStr}`);
            switch (optionValueStr)
            {
                case 'last10': selectionHelpStr = 'for records from the <b><u>last 10 days</u></b>'; break;
                case 'last31': selectionHelpStr = 'for records from the <b><u>last month</u></b>'; break;
                case 'lastyear': selectionHelpStr = 'for records from the <b><u>last year</u></b>'; break;
                case 'unlimited':
                default: selectionHelpStr = 'for records <b><u>without time limitations</u></b>.'; break;
            }
            if (eventStr == 'daysChanged')
            {
                showMessage(`<b>Option changed:</b> search will look ${selectionHelpStr}`, 2000, 2);
                // save the latest time range setting
                if (window.localStorage)
                {
                    window.localStorage.optTimePeriod = optionValueStr;
                    console.log(`localStorage.optTimePeriod = '${optionValueStr}'`);
                }
            }
            else if (eventStr == 'daysClicked')
                showMessage(`Search looks ${selectionHelpStr}`, 2000, 1);
        }
        if (eventStr.startsWith('result'))
        {
            let selectionStr = ''
            switch ($('#searchResultFormat').val())
            {
                case 'food': selectionStr = 'only the matching food'; break;
                case 'meal': selectionStr = 'the whole meal'; break;
                default: selectionStr = 'unknown';
            }
            if (eventStr == 'resultChanged')
                showMessage(`<b>Option changed: </b> Search item selection will copy <b><u>${selectionStr}</u></b>`, 2000, 2);
            else if (eventStr == 'resultClicked')
                showMessage(`Search item selection will copy <b><u>${selectionStr}</u></b>`, 2000, 1);
        }
    }

    /**
     * Get the user name from the upper right textbox
     * @returns {String} the current user's name
     */
    getUserName()
    {
        let userNameField = document.getElementById("tUser");
        let userName = userNameField instanceof HTMLInputElement ? userNameField.value : null;

        if (userName == null)
        {
            let errorMsg = 'User name problem, unable to start search!';
            console.log('ERROR: ' + errorMsg);
            alert(errorMsg);
            throw errorMsg;
        }

        return userName;
    }

    /**
     * Get the search limit setting (from the UI textedit widget)
     * @returns {number} the maximum number of hits to return
     */
    getSearchHitsLimit()
    {
        /** @type { HTMLInputElement | null } */
        // @ts-ignore:next-line (Type 'HTMLElement | null' is not assignable to type 'HTMLInputElement | null'.)
        const elHitsLimit = document.getElementById("searchHitsLimit");
        try
        {
            let hitsLimit = Number.parseInt((elHitsLimit?.value ?? '50'));
            return hitsLimit;
        } catch (e)
        {
            console.log('ERROR: ' + e);
            return 0;
        }
    }

    /**
     * @returns {String} the first day when the search begins
     */
    getSearchDaysRange()
    {
        const daysSelectionBox = document.getElementById("searchDays");
        let daysSelection = daysSelectionBox instanceof HTMLSelectElement ? daysSelectionBox.value : 'last10';
        /** @type {number} */
        let daysMinus;
        switch (daysSelection)
        {
            case 'last10': daysMinus = 10; break;
            case 'last31': daysMinus = 31; break;
            case 'lastyear': daysMinus = 365; break;
            case 'unlimited': // 100 years must be enough for 'unlimited' :)
            default: daysMinus = 100 * 365;
                if (daysSelection != 'unlimited')
                    console.log(`daysSelection: unknown value '${daysSelection}'! Using the default, unlimited range.`);
        }

        var lastDay = new Date(Date.now());
        let firstDay = new Date()
        firstDay.setDate(lastDay.getDate() - daysMinus);
        return firstDay.toISOString().substring(0, 10);
    }

    /**
     * Start a new search (activated by pressing the "Search" button)
     */
    onSearchStarted()
    {
        let searchStr = String($('#tSearch').val()).trim();    // trim: the autocomplete function of a phone's virtual keyboard usually adds an extra, unneeded space
        let firstDayStr = this.getSearchDaysRange();
        let hitsLimit = this.getSearchHitsLimit();

        console.log(`mealSearch: starting search for '${searchStr}' (starting from day ${firstDayStr})...`);

        let self = this;
        this.startMealSearchQuery({
            user: this.getUserName(),
            firstDay: firstDayStr,
            keyword: searchStr,
            hitsLimit: hitsLimit
        }, (xhr) => { self.onSearchResultArrived(xhr, searchStr) });
    }

    /**
     * Connects to the server and starts a search in the user's meal history
     * @param {Object} params
     * @param {import('../../comm/comm.mjs').XHRCommCallback} callback
     */
    startMealSearchQuery(params, callback)
    {
        nodeXHRComm(
            '/node_api/search_meal_history',
            params,
            callback
        );
    }

    /** @type {Meal[]} */
    lastFoundMeals = [];
    lastSearchStr = '';

    /** @type {Food[]} */
    autoCompleteFoods = [];
    autoCompleteWord = '';
    /**
     * Communication handler: Incoming search result
     * @param {XMLHttpRequest?} xhr
     * //@param {ProgressEvent<XMLHttpRequestEventTarget> | Error} ev
     * @param {String} searchStr
     */
    onSearchResultArrived(xhr, searchStr)
    {
        let filteredMeals = this.processMealHistoryResult(xhr, searchStr);
        let searchResult = '';

        for (let iMeal = 0; iMeal < filteredMeals.length; iMeal++)
        {
            let mealObj = filteredMeals[iMeal];
            let printedMeal = mealObj.date ?? '';

            for (let iFoodPart = 0; iFoodPart < mealObj.foodParts.length; iFoodPart++)
            {
                let foodPart = mealObj.foodParts[iFoodPart];
                let printedFoodPart = '';
                let printedFoodPart1 = `${foodPart.name} ${foodPart?.kcal ? toFixedFloat(foodPart.kcal) + 'kc/ ' : ''}`;
                let printedFoodPart2 = `${toFixedFloat(foodPart.quantity)}${foodPart.quantityunit} ${toFixedFloat(foodPart.computedkcal)}kc`;
                if (foodPart && foodPart.name && new RegExp(searchStr, 'i').test(foodPart.name))
                    printedFoodPart = `<u><b>${printedFoodPart1}</b> ${printedFoodPart2}</u>`;
                else
                    printedFoodPart = `${printedFoodPart1} ${printedFoodPart2}`;
                printedMeal += (iFoodPart > 0 ? ', ' : '') + printedFoodPart;
            }
            searchResult += `<div id="res_${this.lastFoundMeals.length}">${printedMeal}</div>`;
            this.lastFoundMeals.push(mealObj);
        }

        // display results, update footer
        let hits = filteredMeals.length;
        let findResultMessage = (hits > 0 ? `${hits} row${hits > 1 ? 's' : ''} found` : 'No rows found');

        let closeTimeout = 0;
        if (this.searchOpened)
        {
            closeTimeout = 200;
            this.onSearchToolsClose();
        }

        setTimeout(() =>
        {
            $('#searchFooterMessage').text(findResultMessage);
            $('#searchMealsResult').html(searchResult);
            $('#searchTools').addClass('active');
            this.onSearchToolsOpen();
        }, closeTimeout);
    }

    /**
     * Communication handler: Incoming search result
     * @param {XMLHttpRequest?} xhr
     * //@param {ProgressEvent<XMLHttpRequestEventTarget> | Error} ev
     * @param {String} filterStr
     * @returns {Meal[]} the filtered and processed meal objects
     */
    processMealHistoryResult(xhr, filterStr)
    {
        if (xhr == null)
        {
            this.onSearchClear();
            throw new Error(`ERROR: Impossible, empty result arrived from the server! (xhr == null)`);
        }

        /** @type Meal[] */
        let resultMeals = [];
        if (xhr.status == 200)
        {
            let foundMealsObj = JSON.parse(xhr.responseText);
            console.log(`Result arrived. It contains data about ${foundMealsObj.length} days.`);
            this.lastFoundMeals = [];
            this.lastSearchStr = filterStr;
            for (let foundMealsObjIter of foundMealsObj)
            {
                let dayText = foundMealsObjIter.food_data;
                let dayTextArr = dayText.split('\\n');
                /** @type {Map<string, [Number|undefined, number|undefined] ?>} */
                let lastFoodMap = new Map();
                for (let iDayRow = dayTextArr.length - 1; iDayRow >= 0; iDayRow--)
                {
                    let mealLine = dayTextArr[iDayRow];
                    if (new RegExp(filterStr,'i').test(mealLine))
                    {
                        let mealObj = this.g_controller.mealListLang.parseMeal(mealLine, lastFoodMap);
                        this.g_controller.mealListLang.calculateMeal(mealObj, false);
                        const isoDate = parseIsoDate(foundMealsObjIter.date);
                        try
                        {
                            mealObj.date =  `<b>${isoDate != null ? printMoment(isoDate) : '[date?]'}</b> ${mealObj.timeStampPrefix}: `;
                        }
                        catch (e)
                        {
                            mealObj.date = '<b>????-??-??.?</b> ';
                            console.error(`Error while parsing date '${foundMealsObjIter.date}'`);
                        }
                        resultMeals.push(mealObj);
                    }
                }
            }
        }
        else
            showMessage('ERROR: Network problem during search!', 5000, 2, 'hsla(15, 75%, 55%, 0.90)');

        return resultMeals;
    }

    searchOpened = false;

    /**
     * Open the search tools
     * @param {number | null} speed in ms
     */
    onSearchToolsOpen(speed = null)
    {
        this.onSearchToolsToggle(true, speed);
    }

    /**
     * Close the search tools
     * @param {number | null} speed in ms
     */
    onSearchToolsClose(speed = null)
    {
        this.onSearchToolsToggle(false, speed);
    }

    /**
     * Open or close the search tools section in the UI
     * @param {boolean | null} open
     * @param {number | null} speed in ms
     */
    onSearchToolsToggle(open = null, speed = null)
    {
        open ??= !this.searchOpened;
        this.searchOpened = open;

        if (open)
        {
            speed ??= 400;
            $('#searchMealsResult').slideDown(speed);
            $('#searchFooter').slideDown(speed);
            $('#searchToggle').html('&nbsp; ▲ &nbsp;');
        }
        else
        {
            speed ??= 200;
            $('#searchMealsResult').slideUp(speed);
            //$('#searchFooter').slideUp(speed);
            $('#searchToggle').html('&nbsp; ▼ &nbsp;');
        }
    }

    async onSearchClear()
    {
        this.lastFoundMeals = [];
        this.lastSearchStr = '';
        $('#searchMealsResult').slideUp(100);
        setTimeout(() =>
        {
            $('#searchMealsResult').html('');
            $('#searchFooter').slideUp('fast');
            $('#searchTools').removeClass('active');
        }, 200)
    }

    /**
     *
     * @param {Event} ev
     */
    onSearchResultClicked(ev)
    {
        if (ev.target == null)
        {
            console.error('onSearchResultClicked: ev.target is null!');
            return;
        }

        let clickedDiv = searchForId(ev.target);
        if (clickedDiv)
        {
            let clickedItemIdx = Number.parseInt(clickedDiv.id.replace(/^res_/, ''));
            if (clickedItemIdx < this.lastFoundMeals.length)
            {
                let clickedMealObj = this.lastFoundMeals[clickedItemIdx];
                if (clickedMealObj)
                {
                    if ($('#searchResultFormat').val() == 'food')
                    {
                        for (let foodPart of clickedMealObj.foodParts)
                        {
                            if (foodPart.name?.match(RegExp(this.lastSearchStr, 'i')))
                            {
                                let kcalPer = foodPart?.kcal ? toFixedFloat(foodPart.kcal) + 'kc/ ' : '';
                                copyText2Clipboard(`${foodPart.name} ${kcalPer}`);
                                showMessage(`Selected food item copied: <b>${foodPart.name} ${kcalPer}</b>`, 3000)
                            }
                        }
                    } else if ($('#searchResultFormat').val() == 'meal')
                    {
                        let inputlineWithoutTimestamp = clickedMealObj.inputLine.replace(/^\d\d:\d\d /, '');
                        copyText2Clipboard(inputlineWithoutTimestamp);
                        showMessage(`Whole meal copied: <b>${inputlineWithoutTimestamp.slice(0, 30)}...</b>`, 3000)
                    }
                }
            }
        }
    }

    /**
     *
     * @param {string} currentWord
     * @param {import('../../data/basicTypes.mjs').StringReceiverCB} updatedCB
     */
    autoCompleteSearchStart(currentWord, updatedCB)
    {
        if (currentWord.length < 2)
        {
            console.log('Search skipped because the keyword is too short!');
            return;
        }

        this.autoCompleteSearchResultCB = updatedCB;

        let firstDayStr = this.getSearchDaysRange();
        let hitsLimit = this.getSearchHitsLimit();

        console.log(`mealSearch: starting autocomplete search for '${currentWord}' (starting from day ${firstDayStr})...`);

        let self = this;
        this.startMealSearchQuery({
            user: this.getUserName(),
            firstDay: firstDayStr,
            keyword: currentWord,
            hitsLimit: hitsLimit
        }, (xhr) => { self.onAutoCompleteSearchFinished(xhr, currentWord); });
   }

    /**
     * Communication handler: Incoming autocomplete search result
     * @param {XMLHttpRequest?} xhr
     * @param {String} currentWord
     */
    onAutoCompleteSearchFinished(xhr, currentWord)
    {
        let filteredMeals = this.processMealHistoryResult(xhr, currentWord);

        // reset: clear previous search results
        this.autoCompleteFoods = [];
        this.autoCompleteWord = currentWord;

        let matchingFoodParts = 0;
        /** @type Map<string, Food> */
        let filteredSortedMealsMap = new Map();

        for (let mealObj of filteredMeals)
        {
            //!let printedMeal = mealObj.date ?? '';

            for (let foodPart of mealObj.foodParts)
            {
                let foodPartName = foodPart.name ?? '-';

                // this food part is a match!
                if (foodPartName && new RegExp(currentWord, 'i').test(foodPartName))
                {
                    let foodHitPoints = Math.pow(0.85, matchingFoodParts++);

                    let storedFoodPart = filteredSortedMealsMap.get(foodPartName);
                    if (storedFoodPart == null)
                    {
                        storedFoodPart = foodPart;
                        foodPart.rankingPoints = foodHitPoints;
                        filteredSortedMealsMap.set(foodPartName, foodPart);
                        this.autoCompleteFoods.push(foodPart);
                    } else
                    {
                        storedFoodPart.rankingPoints += foodHitPoints / 5;   // recurring hit, this food part was found previously
                        if (foodPart.kcal != null)
                            storedFoodPart.kcal ??= toFixedFloat(foodPart.kcal);
                    }
                }
            }
        }

        // sort hits by ranking points
        this.autoCompleteFoods.sort((a, b) => { return b.rankingPoints - a.rankingPoints; });

        if (this.autoCompleteSearchResultCB != null)
        {
            //this.autoCompleteSearchResultCB(`csoki+${currentWord} 450kc/`);
            let resultStr = '';
            for (let i = 0; i < this.autoCompleteFoods.length && i < 6; i++)
            {
                let kcalStr = this.serializeSearchResult(this.autoCompleteFoods[i]);
                let nameStr = this.autoCompleteFoods[i].name?.replace(RegExp(`(${currentWord})`, "i"), `<span style="color:darkred;">$1</span>`);
                resultStr += `<center id="ac_res_${i}"><div><b>${nameStr}</b></div><div>${kcalStr}</div></center>`;
            }
            this.autoCompleteSearchResultCB(`<div style="display:flex; flex-direction: row; gap: 16px;">${resultStr}</div>`);
        }
    }

    /**
     * @param {Food} foodObj
     * @param {string} format
     */
    serializeSearchResult(foodObj, format="kcal")
    {
        if (format == "kcal")
        {
            // print: prefer kc/ value
            let serializedResult = foodObj.kcal ? `${toFixedFloat(foodObj.kcal)}kc/` : null;
            // print: prefer kc value will be also good
            serializedResult ??= foodObj.computedkcal ? `${toFixedFloat(foodObj.computedkcal)}kc` : '';
            return serializedResult;
        }
        return "";
    }

    /**
     * @param {Event} ev
     */
    onAutoCompleteResultClicked(ev)
    {
        if (ev.target == null)
        {
            console.error('onSearchResultClicked: ev.target is null!');
            return;
        }

        let clickedDiv = searchForId(ev.target);
        if (clickedDiv)
        {
            let clickedItemIdx = Number.parseInt(clickedDiv.id.replace(/^ac_res_/, ''));
            if (clickedItemIdx < this.autoCompleteFoods.length)
            {
                let clickedFood = this.autoCompleteFoods[clickedItemIdx];
                let foodStr = `${clickedFood.name} ${this.serializeSearchResult(clickedFood)}`;
                copyText2Clipboard(`${foodStr}`);
                if (this.autoCompleteActivatedCB != null)
                    this.autoCompleteActivatedCB(foodStr);
            }
        }
    }
}