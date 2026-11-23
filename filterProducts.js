/**
 * Filter a product list down to what is actually sellable, and total it up.
 *
 * A product is kept when it is available AND priced above the threshold.
 * The threshold is exclusive: a product priced at exactly the threshold is
 * dropped, because the brief says "priced at 500 or below".
 */

const DEFAULT_MIN_PRICE = 500;

/**
 * Numbers that can safely take part in arithmetic.
 *
 * Deliberately strict: a numeric string like "599" is rejected rather than
 * coerced. Coercion is how one bad row upstream turns into a wrong total that
 * nobody can see. See the README for the alternative I considered.
 */
function isUsableNumber(value) {
  return typeof value === 'number'   // a real number, not the string "599"
    && Number.isFinite(value)        // rules out NaN and Infinity
    && value >= 0;                   // a negative would subtract from the total
}

/**
 * Returns null when the product can be reasoned about, or a short reason why
 * it cannot. A row is only usable when every field we need is present and
 * usable. Nothing is defaulted or guessed.
 */
function findProblem(product) {
  // `typeof null` is 'object' and so is an array, so both need ruling out here
  // or the property reads below either throw or silently succeed on nonsense.
  if (product === null || typeof product !== 'object' || Array.isArray(product)) {
    return 'not an object';
  }
  if (!isUsableNumber(product.price)) {
    return 'price is not a usable number';
  }
  if (!isUsableNumber(product.quantity)) {
    return 'quantity is not a usable number';
  }
  // `available` is deliberately not checked: a missing flag is not bad data,
  // it is a product that is not for sale. filterProducts excludes it instead.
  return null;
}

/**
 * @param {unknown} products            the list to filter
 * @param {object}  [options]
 * @param {number}  [options.minPrice]  exclusive lower bound, default 500
 * @param {function}[options.onInvalid] called as (product, reason) for each
 *                                      row that could not be used
 * @returns {{ products: object[], totalValue: number }}
 * @throws  {TypeError} when `products` is not an array
 */
function filterProducts(products, options = {}) {
  // A non-array here is a programmer error, not bad data, so it throws rather
  // than returning an empty result that would hide the mistake.
  if (!Array.isArray(products)) {
    // `typeof null` would report 'object' and send the reader the wrong way.
    const received = products === null ? 'null' : typeof products;
    throw new TypeError(`filterProducts expects an array, received ${received}`);
  }

  const { minPrice = DEFAULT_MIN_PRICE, onInvalid } = options;

  const kept = [];        // the products that survive both checks
  let totalValue = 0;     // price x quantity, accumulated as we go

  // One pass. Each row has three possible outcomes (unusable, excluded, kept)
  // and a single loop expresses that without building an intermediate array.
  for (const product of products) {
    // 1. Can this row be used at all?
    const problem = findProblem(product);
    if (problem !== null) {
      // Guarded, so passing a non-function by mistake does not kill the run.
      if (typeof onInvalid === 'function') onInvalid(product, problem);
      continue;
    }

    // Strict `=== true`, so a missing flag or a truthy "yes" fails closed.
    // Showing something as available when we are not sure is the expensive
    // direction to be wrong in.
    // 2. Should it be excluded? Two ways that can happen.
    if (product.available !== true) continue;

    // `<=` because the brief says "priced at 500 or below", so 500 is dropped.
    if (product.price <= minPrice) continue;

    // 3. It stays.
    kept.push(product);   // by reference: nothing here mutates a product
    totalValue += product.price * product.quantity;
  }

  return { products: kept, totalValue };
}

module.exports = { filterProducts, DEFAULT_MIN_PRICE };
