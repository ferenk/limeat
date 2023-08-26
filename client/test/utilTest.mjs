import { printToFixedFloat } from '../src/util/util.mjs';

test('toFixedFloat functions', () =>
{
    expect(printToFixedFloat(1.499999)).toBe('1.5');
    expect(printToFixedFloat(1.01)).toBe('1');
    expect(printToFixedFloat(1.01, 1, ' ')).toBe('1  ');
    expect(printToFixedFloat(1.1, 3, '0')).toBe('1.100');
});
