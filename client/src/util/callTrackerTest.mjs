import { traceMethodCalls } from './callTracker.mjs'

class FirstClass
{
    init() {
        this.func();
    }
    func() {
        obj2.init(6);
        this.value = obj2.func(4);
    }
}
class SecondClass
{
    init(i = 5) {
        this.val = 3 + i;
        return false;
    }

    /** @param {number} num */
    func(num) {
        let i = this.funcHelper(num) + 2;
        return i+ this.funcHelper(num) + 2;
    }
    funcHelper(num = 5)
    {
        return (num * num);
    }
}
let obj1 = new FirstClass();
let obj2 = traceMethodCalls(new SecondClass());


window.addEventListener("load", onPageLoaded);

function onPageLoaded() {
    obj1.init();
    obj1.func();
}
