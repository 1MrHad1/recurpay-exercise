const test = require('node:test');
const assert = require('node:assert/strict');
const { filterProducts } = require('./filterProducts');

const BRIEF_INPUT = [
  { id: 1, name: 'T-Shirt', price: 599,  quantity: 2, available: true  },
  { id: 2, name: 'Cap',     price: 299,  quantity: 1, available: true  },
  { id: 3, name: 'Hoodie',  price: 999,  quantity: 1, available: false },
  { id: 4, name: 'Shoes',   price: 1499, quantity: 1, available: true  },
];

test('matches the example from the brief exactly', () => {
  assert.deepEqual(filterProducts(BRIEF_INPUT), {
    products: [BRIEF_INPUT[0], BRIEF_INPUT[3]],
    totalValue: 2697, // (599 x 2) + (1499 x 1)
  });
});

// --- the boundary -----------------------------------------------------------
// "priced at 500 or below" makes the bound exclusive. This is the single most
// likely place for an off-by-one, so it is pinned from both sides.

test('a product priced at exactly 500 is excluded', () => {
  const result = filterProducts([
    { id: 1, name: 'Socks', price: 500, quantity: 1, available: true },
  ]);
  assert.deepEqual(result, { products: [], totalValue: 0 });
});

test('a product priced at 501 is included', () => {
  const result = filterProducts([
    { id: 1, name: 'Socks', price: 501, quantity: 1, available: true },
  ]);
  assert.equal(result.products.length, 1);
  assert.equal(result.totalValue, 501);
});

// --- availability -----------------------------------------------------------

test('an unavailable product is excluded however expensive', () => {
  const result = filterProducts([
    { id: 1, name: 'Watch', price: 90000, quantity: 1, available: false },
  ]);
  assert.deepEqual(result, { products: [], totalValue: 0 });
});

test('a missing available flag fails closed', () => {
  const result = filterProducts([
    { id: 1, name: 'Watch', price: 90000, quantity: 1 },
  ]);
  assert.deepEqual(result, { products: [], totalValue: 0 });
});

test('a truthy non-boolean available flag fails closed', () => {
  const result = filterProducts([
    { id: 1, name: 'Watch', price: 90000, quantity: 1, available: 'yes' },
  ]);
  assert.deepEqual(result, { products: [], totalValue: 0 });
});

// --- unusable rows ----------------------------------------------------------

test('a missing quantity is skipped and reported, not guessed', () => {
  const seen = [];
  const result = filterProducts(
    [{ id: 1, name: 'Bag', price: 1200, available: true }],
    { onInvalid: (product, reason) => seen.push([product.id, reason]) },
  );
  assert.deepEqual(result, { products: [], totalValue: 0 });
  assert.deepEqual(seen, [[1, 'quantity is not a usable number']]);
});

test('a numeric string price is rejected rather than coerced', () => {
  const seen = [];
  const result = filterProducts(
    [{ id: 1, name: 'Bag', price: '1200', quantity: 1, available: true }],
    { onInvalid: (product, reason) => seen.push(reason) },
  );
  assert.deepEqual(result, { products: [], totalValue: 0 });
  assert.deepEqual(seen, ['price is not a usable number']);
});

test('NaN, Infinity and negative numbers are all rejected', () => {
  const rows = [
    { id: 1, price: NaN,       quantity: 1, available: true },
    { id: 2, price: Infinity,  quantity: 1, available: true },
    { id: 3, price: -100,      quantity: 1, available: true },
    { id: 4, price: 900,       quantity: -1, available: true },
  ];
  const result = filterProducts(rows);
  assert.deepEqual(result, { products: [], totalValue: 0 });
});

test('null and non-object entries are skipped, not thrown on', () => {
  const seen = [];
  const result = filterProducts(
    [null, 'Shoes', 42, BRIEF_INPUT[3]],
    { onInvalid: (_product, reason) => seen.push(reason) },
  );
  assert.equal(result.products.length, 1);
  assert.equal(result.totalValue, 1499);
  assert.deepEqual(seen, ['not an object', 'not an object', 'not an object']);
});

test('a quantity of zero is kept but contributes nothing', () => {
  const result = filterProducts([
    { id: 1, name: 'Lamp', price: 800, quantity: 0, available: true },
  ]);
  assert.equal(result.products.length, 1);
  assert.equal(result.totalValue, 0);
});

// --- shape and contract -----------------------------------------------------

test('an empty list returns an empty result, not null', () => {
  assert.deepEqual(filterProducts([]), { products: [], totalValue: 0 });
});

test('a non-array input throws a TypeError naming what arrived', () => {
  assert.throws(() => filterProducts(null),      { name: 'TypeError', message: /received null/ });
  assert.throws(() => filterProducts(undefined), { name: 'TypeError', message: /received undefined/ });
  assert.throws(() => filterProducts({}),        { name: 'TypeError', message: /received object/ });
});

test('the input array and its products are left untouched', () => {
  const input = structuredClone(BRIEF_INPUT);
  const snapshot = JSON.stringify(input);
  filterProducts(input);
  assert.equal(JSON.stringify(input), snapshot);
});

test('the threshold can be overridden', () => {
  const result = filterProducts(BRIEF_INPUT, { minPrice: 1000 });
  assert.deepEqual(result.products.map((p) => p.id), [4]);
  assert.equal(result.totalValue, 1499);
});

test('onInvalid is optional and a non-function is ignored', () => {
  assert.doesNotThrow(() => filterProducts([null], { onInvalid: 'nope' }));
});
