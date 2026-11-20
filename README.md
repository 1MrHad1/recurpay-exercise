# Product filter exercise

Filters a product list down to what is actually sellable, and totals it up.

A product is kept when it is **available** and priced **above** the threshold.
The brief says "unavailable **or** priced at 500 or below" are removed, so the
bound is exclusive: a product at exactly 500 is dropped, one at 501 is kept.

```js
const { filterProducts } = require('./filterProducts');

filterProducts([
  { id: 1, name: 'T-Shirt', price: 599,  quantity: 2, available: true  },
  { id: 2, name: 'Cap',     price: 299,  quantity: 1, available: true  },
  { id: 3, name: 'Hoodie',  price: 999,  quantity: 1, available: false },
  { id: 4, name: 'Shoes',   price: 1499, quantity: 1, available: true  },
]);
// {
//   products:   [ T-Shirt, Shoes ],
//   totalValue: 2697          // (599 x 2) + (1499 x 1)
// }
```

## Running it

```
npm test     # 16 tests, node --test, no dependencies
npm run demo # prints the brief's example plus a messier list
```

No install step. Everything uses the Node standard library.

---

## 1. Handling missing or unexpected values

The rule I worked to: **never guess, never coerce, and never fail silently.**
A wrong total is more expensive than a missing row, because a missing row gets
reported and a wrong total gets believed.

So each row is checked before it is used, and lands in one of three places:

| Situation | What happens |
| --- | --- |
| `price` or `quantity` missing, `NaN`, `Infinity`, negative, or a string like `"599"` | row is skipped and reported through `onInvalid` |
| row is `null`, a string, a number, an array | skipped and reported the same way |
| `available` missing, or truthy-but-not-`true` such as `"yes"` or `1` | row is excluded, same as `available: false` |
| `products` itself is not an array | throws a `TypeError` naming what arrived |

Three decisions inside that are worth stating explicitly.

**Numeric strings are rejected, not coerced.** `"1200"` looks harmless, and
`Number("1200")` would even give the right answer. But the same coercion turns
`"1,200"` into `NaN` and `""` into `0`, and a single `NaN` poisons the running
total so the whole number becomes `NaN` with no clue which row did it. If an API
is sending prices as strings that is a contract problem worth seeing, not
worth papering over at the last mile.

**`available` fails closed.** `product.available !== true` rather than
`!product.available`. Hiding a product that should be visible is a support
ticket. Showing and selling a product that is actually out of stock is a refund
and an unhappy customer. When I am not sure, I would rather be wrong in the
cheap direction.

**Bad data is skipped, bad arguments throw.** A malformed row is runtime data
and the list should still produce a usable answer, so it is skipped. A
non-array argument is a programming mistake, and returning an empty result
there would hide it behind something that looks like a legitimately empty
catalogue. `onInvalid` is an optional callback rather than a `console.warn`
so the caller decides whether that becomes a log line, a Sentry breadcrumb, or
nothing at all.

**One thing I deliberately did not do.** `price * quantity` in floating point is
exact for integer rupees, which is what the brief uses. If prices ever carried
paise, I would store and total in minor units (integer paise) and divide only at
display time, because `0.1 + 0.2` is the classic way money drifts in a long
accumulation.

## 2. A design choice, and the alternative I considered

**The choice: one explicit loop that filters and totals together, returning
`{ products, totalValue }`.**

**The alternative: `products.filter(...)` followed by `.reduce(...)`.**

The chained version reads beautifully and is what I would reach for first:

```js
const kept  = products.filter(p => p.available && p.price > 500);
const total = kept.reduce((sum, p) => sum + p.price * p.quantity, 0);
```

I moved away from it for one reason, and it is not performance. Each row here
has **three** outcomes, not two: unusable, excluded, or kept. `filter` only
expresses two. To report the unusable rows I would either need a third pass
over the data, or a side effect inside the `filter` predicate, and a predicate
with a side effect is a thing I have had to debug in someone else's code and
would not inflict on a teammate. The single loop lets validation, exclusion and
accumulation sit next to each other where you can read all three rules at once.

The cost is honest: it is more lines, and it is less idiomatic than the chain.
On a list this size the speed difference is irrelevant, so this was a
readability call, not an optimisation.

Two smaller choices in the same spirit:

- **The threshold is a parameter** (`{ minPrice }`), defaulting to 500. A
  magic number that appears in one business rule tends to appear in three more
  later.
- **Kept products are returned by reference, not cloned.** The function neither
  reads nor writes anything outside the fields it validates, and the input is
  left untouched. Cloning would be a hidden cost on large lists for a guarantee
  nobody asked for.

## 3. Would I approach it differently with 10,000 products?

**For the algorithm itself, no, and I want to be precise about why.** It is
already a single O(n) pass. Chaining `filter` and `reduce` would be O(n) too,
just with two passes and one intermediate array. Going from two passes to one
is a constant-factor change on work that is already linear. At 10,000 rows this
runs in low single-digit milliseconds either way. Optimising it would be
measuring the wrong thing.

**What actually hurts at 10,000 is everything around it**, and that is where I
would spend the effort:

1. **Do not ship 10,000 rows to the browser to throw most of them away.**
   The filter belongs where the data lives. In SQL this is a `WHERE available
   = true AND price > 500` with the total as a `SUM(price * quantity)` in the
   same query, over an index. The client then receives the answer, not the
   catalogue. The payload and the parse cost both collapse.
2. **Paginate or stream what is left.** Cursor pagination over a stable sort
   key, rather than `OFFSET`, which gets slower the deeper you go and skips
   rows when the underlying data shifts between pages.
3. **Do not recompute on every render.** In React this is the real bug at
   scale: a filter that runs inside the render body re-runs on every keystroke
   in an unrelated input. It goes in a `useMemo` keyed on the list and the
   threshold, so it only runs when one of those actually changes.
4. **Virtualise the rendering.** 10,000 filtered rows is still 10,000 DOM
   nodes, and the DOM will be slower than the filter by orders of magnitude.
   A windowing library renders the visible slice only.
5. **If it genuinely must run client-side on the full list**, chunk it across
   frames so the main thread is not blocked, or move it to a Web Worker. Both
   are about keeping the UI responsive, which is a different problem from
   making the loop faster.

The short version: at 10,000 the loop is not the bottleneck, the **network,
the re-renders and the DOM** are. I would measure before changing any of it,
because the fix for a slow list is usually not in the function that filters it.

---

## Tests

16 tests, run with `node --test`, no test framework to install. They cover the
example from the brief, both sides of the 500 boundary, the availability rules
including the truthy-non-boolean case, every unusable-input shape, the
`TypeError` contract, input immutability, and `quantity: 0` (kept, since it is
available and priced above the threshold, but contributing nothing to the
total).
