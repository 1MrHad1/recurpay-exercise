// Runs the example from the brief, plus a messier list, so the behaviour is
// visible without reading the tests.
const { filterProducts } = require('./filterProducts');

const fromTheBrief = [
  { id: 1, name: 'T-Shirt', price: 599,  quantity: 2, available: true  },
  { id: 2, name: 'Cap',     price: 299,  quantity: 1, available: true  },
  { id: 3, name: 'Hoodie',  price: 999,  quantity: 1, available: false },
  { id: 4, name: 'Shoes',   price: 1499, quantity: 1, available: true  },
];

console.log('From the brief:');
console.log(JSON.stringify(filterProducts(fromTheBrief), null, 2));

const messy = [
  { id: 5, name: 'Socks',  price: 500,    quantity: 3, available: true },  // exactly 500, excluded
  { id: 6, name: 'Belt',   price: '1200', quantity: 1, available: true },  // price is a string
  { id: 7, name: 'Bag',    price: 1200,                available: true },  // no quantity
  { id: 8, name: 'Jacket', price: 2500,   quantity: 1, available: 'yes' }, // not a boolean
  { id: 9, name: 'Scarf',  price: 750,    quantity: 2, available: true },  // the only keeper
];

console.log('\nA messier list, with the skipped rows reported:');
console.log(JSON.stringify(
  filterProducts(messy, {
    onInvalid: (product, reason) => console.log(`  skipped id ${product && product.id}: ${reason}`),
  }),
  null,
  2,
));
