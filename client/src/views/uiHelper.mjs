export { coolConfirm, coolMessage };

import Swal from '../3rdparty/sweetalert2.min.js';  // jshint ignore:line

/**
 * @param {string} type
 * @param {string} title
 * @param {string} question
 * @param {Function | null} _cb
 * @param {string} yesAnswer
 * @param {string} noAnswer
 * @param {boolean} confirmByDefault
*/
async function coolConfirm(type, title, question, _cb, yesAnswer, noAnswer, confirmByDefault)
{
    'use strict';

    yesAnswer = yesAnswer ?? "Yes";
    noAnswer = noAnswer ?? "No";
    confirmByDefault = (confirmByDefault == null ? true : confirmByDefault);

    const { value: result }  = await Swal.fire(
        {
            title: title,
            html: question,
            icon: type,
            showCancelButton: true,
            confirmButtonColor: 'hsl(96deg 52% 34%)',
            cancelButtonColor: '#888',
            background: 'hsl(78, 21%, 39%)',
            backdrop: 'hsl(78, 21%, 39%)',
            confirmButtonText: yesAnswer,
            cancelButtonText: noAnswer,
            focusConfirm: confirmByDefault,
            reverseButtons: !confirmByDefault,
            allowOutsideClick: false,  // modal
        }
    );

    return result;
}

/**
 * @param {string} type
 * @param {string} title
 * @param {string} message
 * @param {Object | null } opts
 * @param {number | null } timeout
 * @param {Function | null} cb
 */
async function coolMessage(type, title, message, opts, timeout, cb)
{
    'use strict';

    /** @type NodeJS.Timer | null */
    let timerInterval = null;
    // core parameters
    let msgBoxArgs = {
        title: title,
        html: message,
        icon: type,
        confirmButtonColor: 'hsl(96deg 52% 34%)',
        background: 'hsl(78, 21%, 40%)',
        backdrop: 'hsl(78, 21%, 35%)',
        allowOutsideClick: false,  // modal
        timerProgressBar: false,
        willClose: () =>
        {
            clearInterval(timerInterval);
            if (cb)
                cb();
        },
    }

    // timout settings
    if (timeout != null) {
        Object.assign(msgBoxArgs, {
            timer: timeout,
            timerProgressBar: true,
            allowOutsideClick: true,  // not modal
            didOpen: () => {
                Swal.showLoading();
                Swal.enableButtons();
                const timer = Swal.getPopup().querySelector("strong");
                timerInterval = setInterval(() => {
                    timer.textContent = `${Math.floor(Swal.getTimerLeft() / 1000)}s`;
                }, 100);
            }
        });
    }
    Swal.fire(msgBoxArgs);
}