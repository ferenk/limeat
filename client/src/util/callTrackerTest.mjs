import { traceMethodCalls } from './callTracker.mjs'

class firstClass
{
    init() {
        this.func();
    }
    func() {
        obj2.init(6);
        this.value = obj2.func(4);
    }
}
class secondClass
{
    init(i = 5) {
        this.val = 3;
        return false;
    }
    func(num) {
        let i = this.funcHelper(num) + 2;
        return i+ this.funcHelper(num) + 2;
    }
    funcHelper(num = 5)
    {
        return (num * num);
    }
}
let obj1 = new firstClass();
let obj2 = traceMethodCalls(new secondClass());


window.addEventListener("load", onPageLoaded);

function onPageLoaded() {
    obj1.init();
    obj1.func();
}
