import { processQuantity } from '../src/data/foodsLang.mjs';

test('processQuantity("100g") test', () =>
{
    expect(processQuantity('100g', {})).toBe(true);
});