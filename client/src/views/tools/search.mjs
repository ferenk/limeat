export { SearchTools };

import { nodeXHRComm } from '../../data/comm.mjs';
import { printMoment, parseIsoDate, toFixedFloat, copyText2Clipboard } from '../../util/util.mjs';
import { searchForId, showMessage } from '../../util/ui/uiUtils.mjs';
import { Meal } from '../../data/foodData.mjs';
import { Controller } from '../../controller.mjs';


class SearchTools
{
    /**
     * @param {Controller} controller 
     */
    constructor(controller)
    {
        this.g_controller = controller;
        this.onSearchOpenClose(false);
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
            let selectionStr = ''
            switch ($('#searchDays').val())
            {
                case 'last10': selectionStr = 'last 10 days'; break;
                case 'last31': selectionStr = 'last month'; break;
                case 'lastyear': selectionStr = 'last year'; break;
                default: selectionStr = 'unknown';
            }
            if (eventStr == 'daysChanged')
                showMessage(`<b>Option changed:</b> search will look for records from the <b><u>${selectionStr}</u></b>`, 2000, 2);
            else if (eventStr == 'daysClicked')
                showMessage(`Search will look for records from the <b><u>${selectionStr}</u></b>`, 2000, 1);
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
                showMessage(`<b>Option changed: </b> Search item selection will copy  <b><u>${selectionStr}</u></b>`, 2000, 2);
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
        var elHitsLimit = document.getElementById("searchHitsLimit");
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
        var daysSelectionBox = document.getElementById("searchDays");
        var daysSelection = 'last10';
        if (daysSelectionBox instanceof HTMLSelectElement)
            daysSelection = daysSelectionBox.value;
        var daysMinus = (daysSelection == 'last10' ? 10 : (daysSelection == 'last31' ? 31 : 365));

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
     * @param {import('../../data/comm.mjs').XHRCommCallback} callback
     */
    startMealSearchQuery(params, callback)
    {
        nodeXHRComm(
            'node_api/search_meal_history',
            params,
            callback
        );
    }

    /** @type {Meal[]} */
    lastFoundMeals = [];
    lastSearchStr = '';
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
                let printedFoodPart2 = `${foodPart.quantity}${foodPart.quantityunit} ${toFixedFloat(foodPart.computedkcal)}kc`;
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
            this.onSearchOpenClose(false);
        }
        
        setTimeout(() =>
        {
            $('#searchFooterMessage').text(findResultMessage);
            $('#searchMealsResult').html(searchResult);
            $('#searchTools').addClass('active');
            this.onSearchOpenClose(true);
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
            throw `ERROR: Impossible, empty result arrived from the server! (xhr == null)`;
        }

        /** @type Meal[] */
        let resultMeals = [];
        if (xhr.status == 200)
        {
            let foundMealsObj = JSON.parse(xhr.responseText);
            console.log(`Result arrived. It contains data about ${foundMealsObj.length} days.`);
            this.lastFoundMeals = [];
            this.lastSearchStr = filterStr;
            for (let iDay = 0; iDay < foundMealsObj.length; iDay++)
            {
                let dayText = foundMealsObj[iDay].food_data;
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
                        let isoDate = parseIsoDate(foundMealsObj[iDay].date);
                        var printedMeal = '<b>????-??-??.?</b> ';
                        try
                        {
                            printedMeal = `<b>${isoDate != null ? printMoment(isoDate) : '[date?]'}</b> ${mealObj.timeStampPrefix}: `;
                        }
                        catch (e)
                        {
                            console.error(`Error while parsing date '${foundMealsObj[iDay].date}'`);
                        }
                        mealObj.date = printedMeal;
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
     * 
     * @param {boolean | null} open
     * @param {number | null} speed in ms
     */
    onSearchOpenClose(open = null, speed = null)
    {
        open ??= !this.searchOpened;
        this.searchOpened = open;

        if (open)
        {
            speed ??= 400;
            $('#searchMealsResult').slideDown(speed);
            $('#searchFooter').slideDown(speed);
            $('#searchOpenClose').html('&nbsp; ▲ &nbsp;');
        }
        else
        {
            speed ??= 200;
            $('#searchMealsResult').slideUp(speed);
            //$('#searchFooter').slideUp(speed);
            $('#searchOpenClose').html('&nbsp; ▼ &nbsp;');
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
                        for (let i = 0; i < clickedMealObj.foodParts.length; i++)
                        {
                            let foodPart = clickedMealObj.foodParts[i];
                            if (foodPart.name?.match(RegExp(this.lastSearchStr, 'i')))
                            {
                                let kcalPer = foodPart?.kcal ? foodPart.kcal + 'kc/ ' : '';
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
}