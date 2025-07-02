import * as stackTraceParser from '../3rdparty/stack-trace-parser.esm.js';

let PROXY_METHOD_NAME = 'PrOxY';
let PROXY_METHOD_SEPARATOR = '___';
let PROXY_METHOD_NAME_PREFIX = `${PROXY_METHOD_NAME}${PROXY_METHOD_SEPARATOR}`;

/* Previous version. Not in use anymore */
/*
const addCallTracker = (obj) => {
    return new Proxy(obj, { get: getFunction })
}

function getFunction(target, name, receiver)
{
    if (!target.hasOwnProperty(name))
    {
        if (typeof target[name] === "function")
        {
            let stacktraceArr = new Error().stack?.split('\n');
            consoleLog(`${'    '.repeat(stacktraceArr ? stacktraceArr.length : 0)}${target.constructor.name}.${name}()`);
        }
        return new Proxy(target[name], this);
    }
    return Reflect.get(target, name, receiver);
}
*/

var opt_enableCallTracker = true;

/**@type { import('../3rdparty/stack-trace-parser').StackFrame[] } */
let lastStack = [];

/**
 * Register a class instance to track its method calls
 * @template C
 * @param {C} obj
 * @param {boolean} printNullResults
 * @returns {C}
 */
function traceMethodCalls(obj, printNullResults) {
    "use strict";
    printNullResults ??= true;

    /** @type {ProxyHandler<object>} */
    let handler = {
        get(target, propKey, receiver) {
            if (!target.hasOwnProperty(propKey))
            {
                if (propKey == null || typeof propKey !== 'string')
                {
                    console.log(`ERROR: Only string properties are handled. Current propKey is: ${JSON.stringify(propKey)}`);
                    return null;
                }

                /** @type {function} */
                // @ts-ignore:next-line ('any' because 'string' cannot be used to index an {})
                const origMethod = target[propKey] ?? 'unknownMethod';

                if (typeof origMethod !== 'function')
                {
                    console.log(`ERROR: Only function properties are handled here. typeof target[propKey] is: ${typeof origMethod}`);
                    return null;
                }

                let proxyGetFuncName = `${PROXY_METHOD_NAME}${PROXY_METHOD_SEPARATOR}${target.constructor.name}${PROXY_METHOD_SEPARATOR}${propKey}`;
                return {
                    // @ts-ignore:next-line (rest parameter 'args' implicity has an 'any[]' type)
                    [proxyGetFuncName]: function (...args) {
                        // stack trace handling
                        let stackParsed = stackTraceParser.parse(new Error().stack);
                        let stackProcessed = processStack(stackParsed);

                        printHiddenCalls(stackProcessed);
                        lastStack = stackProcessed;

                        // prepare & print call log
                        let indentSpaces = '    '.repeat(stackProcessed && stackProcessed.length > 0 ? stackProcessed.length - 1 : 0);
                        let argsShortened = args.map((item) => shortenStringParam(item));
                        let argsShortenedStr = JSON.stringify(argsShortened).replace(/^\[/, '').replace(/\]$/, '');
                        let methodName = `${target.constructor.name}.${propKey}`;
                        let methodCallLog = `${methodName}(${argsShortenedStr})`;
                        consoleLog(`${indentSpaces}${methodCallLog}`);

                        // MAIN: Call method
                        let methodResult = origMethod.apply(this, args);

                        // prepare & print result log
                        if (methodResult || printNullResults)
                            consoleLog(`${indentSpaces}=> ${methodResult ? shortenStringParam(methodResult) : 'null'}`);

                        return methodResult;
                    }
                }[proxyGetFuncName];
                //let proxyGetFuncName = `proxy___${target.constructor.name}___${propKey}`;
                //const fn = { [proxyGetFuncName]: function () { proxyGetFunc(); } }[proxyGetFuncName];
                //return fn;
                //return new Function(`return function ${proxyGetFuncName}(...args) { return proxyGetFunc(args); }`)();
                //Object.defineProperty(proxyGetFunc, 'name', { value: `proxy___${target.constructor.name}___${propKey}`, configurable: true, writable: false });
                //return proxyGetFunc;
            }
            else return Reflect.get(target, propKey, receiver);
        }
    };
    // @ts-ignore:next-line (Argument of type 'C' is not assignable to parameter of type 'object'.ts(2345))
    return new Proxy(obj, handler);
}

/**
 * Filter the stack trace and revert the stack call mappings
 * @param {import('../3rdparty/stack-trace-parser').StackFrame[]} stackParsed
 * @returns { import('../3rdparty/stack-trace-parser').StackFrame[] }
 */
function processStack(stackParsed)
{
    /**@type { import('../3rdparty/stack-trace-parser').StackFrame[] } */
    const stackParsedFiltered = [];
    let prevMethodWasReplaced = false;
    for (let iSrc = stackParsed.length - 1; iSrc >= 0; iSrc--)
    {
        let replacedMethodName = null;
        if (stackParsed[iSrc].methodName?.includes(`${PROXY_METHOD_NAME_PREFIX}`))
        {
            replacedMethodName = stackParsed[iSrc].methodName
                .replace(new RegExp(`.*${PROXY_METHOD_NAME_PREFIX}`), '')
                .replace(PROXY_METHOD_SEPARATOR, '.');
        }

        // create a copy of the original stack frames (filtered version)
        if (replacedMethodName || !prevMethodWasReplaced)
        {
            //! _copy_ stack frame
            stackParsedFiltered.unshift(JSON.parse(JSON.stringify(stackParsed[iSrc])));
            if (replacedMethodName)
            {
                stackParsedFiltered[0].methodName = replacedMethodName;
                // @ts-ignore:next-line (Property 'remapped' does not exist on type 'StackFrame'.)
                // noinspection JSUndefinedPropertyAssignment
                stackParsedFiltered[0].remapped = true;
                prevMethodWasReplaced = true;
            }
        }
        else if (prevMethodWasReplaced)
        {
            stackParsedFiltered[0].file = stackParsed[iSrc].file;
            stackParsedFiltered[0].lineNumber = stackParsed[iSrc].lineNumber;
            prevMethodWasReplaced = false;
        }
    }

    return stackParsedFiltered;
}

/**
 *
 * @param { import('../3rdparty/stack-trace-parser').StackFrame[] } currentStack
 */
function printHiddenCalls(currentStack)
{
    let iFrame;

    // let currStackStr = '';
    // for (iFrame = 0; iFrame < currentStack.length; iFrame++)
    //     currStackStr += `${iFrame > 0 ? ', ' : ''}${iFrame}. ${currentStack[currentStack.length - (iFrame + 1)].methodName}`;
    // consoleLog('// ' + currStackStr);

    for (iFrame = 0; iFrame < lastStack.length && iFrame < currentStack.length; iFrame++)
    {
        let lastIdx = lastStack.length - 1 - iFrame;
        let currIdx = currentStack.length - 1 - iFrame;
        // Comment: NOT filtering by line numbers!
        // - It can fail on Firefox(stack doesn't contain class names so C1.func() and C2.func() cannot be distinguished)
        // + But it's quite safe on Chrome (stack contains class names, too)
        // && (lastStack[lastIdx].lineNumber == currentStack[currIdx].lineNumber)))

        //if (!((lastStack[lastIdx].file == currentStack[currIdx].file) && (lastStack[lastIdx].methodName == currentStack[currIdx].methodName)))
        if (lastStack[lastIdx].methodName != currentStack[currIdx].methodName)
            break;
    }
    //consoleLog(`// STACK frame equals: ${iFrame}`, false);
    for (; iFrame < currentStack.length; iFrame++)
    {
        let currIdx = currentStack.length - 1 - iFrame;
        // @ts-ignore:next-line (Property 'remapped' does not exist on type 'StackFrame'.)
        if (currIdx > 0 || currentStack[0].remapped == null)
            consoleLog(`${'    '.repeat(iFrame)}[ ${currentStack[currentStack.length - 1 - iFrame].methodName}() ]`, false);
    }
}

//function printCall(frames, idx, )

/**
 * If the parameter is a string then shorten it if it's too long
 * @param { Object | string} paramObjOrString
 * @param { number } maxLen
 * @returns { Object | string}
 */
function shortenStringParam(paramObjOrString, maxLen = 32)
{
    if (typeof paramObjOrString === 'string' && paramObjOrString.length > maxLen)
        return `${paramObjOrString.substring(0, maxLen - 4)} ... [${paramObjOrString.length}]`;
    else
        return paramObjOrString;
}

/**
 * Enable/disable call tracker's extra logs about method calls
 * @param boolean enable Whether to enable (or disable it)
 */
function enableCallTracker(val)
{
    opt_enableCallTracker = val;
}

let lastMsgHeader = '';
function consoleLog(message = '', recalcTime = true)
{
    if (recalcTime || lastMsgHeader.length === 0)
        lastMsgHeader = `${new Date().toISOString().slice(0, -2).replace('T', ' ')} TRACE: `;
    if (opt_enableCallTracker)
        console.log(lastMsgHeader + message);
}

export { traceMethodCalls, enableCallTracker };
