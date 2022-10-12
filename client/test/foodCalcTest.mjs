import { processQuantity } from '../src/data/foodsLang.mjs';
import { FoodsDbItem  } from '../src/data/foodsDb.mjs';

test('processQuantity("100g") test', () =>
{
    expect(processQuantity('100g', new FoodsDbItem())).toBe(true);
});