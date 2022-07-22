export { coolConfirm, coolMessage };

async function coolConfirm(type, title, question, cb, yesAnswer, noAnswer, confirmByDefault)
{
    yesAnswer = yesAnswer || "Yes";
    noAnswer = noAnswer || "No";
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
            reverseButtons: !confirmByDefault
        }
    );

    return result;
}

async function coolMessage(type, title, message, opts, timeout, cb)
{
    if (timeout) {
        let timerInterval = null;
        Swal.fire(
            Object.assign(
                {
                    title: title,
                    html: message + "<br>Close in <strong></strong> seconds...",
                    icon: type,
                    timer: timeout,
                    onBeforeOpen: () => {
                        Swal.showLoading();
                        timerInterval = setInterval(() => {
                            Swal.getContent().querySelector('strong').textContent = (Math.floor(Swal.getTimerLeft() / 1000));
                        }, 100);
                    },
                    onClose: () => {
                        clearInterval(timerInterval);
                        if (cb)
                            cb();
                    }
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
                onClose: () => {
                    if (cb)
                        cb();
                }
            },
            opts)
        );
    }
}