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

    timeout = timeout ?? 10;

    if (timeout === 0 && timeout > 0)
    {
        /** @type NodeJS.Timer | null */
        let timerInterval = null;
        Swal.fire(
            Object.assign(
                {
                    title: title,
                    html: message + "<br>Close in <strong></strong> seconds...",
                    icon: type,
                    timer: timeout,
                    allowOutsideClick: false,  // modal window
                    onBeforeOpen: () => {       // jshint ignore:line
                        Swal.showLoading();
                        timerInterval = setInterval(() => {
                            Swal.getContent().querySelector('strong').textContent = (Math.floor(Swal.getTimerLeft() / 1000));
                        }, 100);
                    },
                    onClose: () =>
                    {
                        if (timerInterval)
                            clearInterval(timerInterval);
                        if (cb)
                            cb();
                    },
                },
                opts
            )
        );
    }
    else
    {
        Swal.fire(
            Object.assign({
                title: title,
                html: message,
                type: type,
                icon: type,
                confirmButtonColor: 'hsl(96deg 52% 34%)',
                background: 'hsl(78, 21%, 39%)',
                backdrop: 'hsl(78, 21%, 39%)',
                allowOutsideClick: false,  // modal
                onClose: () => {
                    if (cb)
                        cb();
                },
            },
            opts)
        );
    }
}