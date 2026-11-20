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
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/**
 * Returns null when the product can be reasoned about, or a short reason why
 * it cannot. A row is only usable when every field we need is present and
 * usable. Nothing is defaulted or guessed.
 */
function findProblem(product) {
  if (product === null || typeof product !== 'object' || Array.isArray(product)) {
    return 'not an object';
  }
  if (!isUsableNumber(product.price)) {
    return 'price is not a usable number';
  }
  if (!isUsableNumber(product.quantity)) {
    return 'quantity is not a usable number';
  }
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
    const received = products === null ? 'null' : typeof products;
    throw new TypeError(`filterProducts expects an array, received ${received}`);
  }

  const { minPrice = DEFAULT_MIN_PRICE, onInvalid } = options;

  const kept = [];
  let totalValue = 0;

  // One pass. Each row has three possible outcomes (unusable, excluded, kept)
  // and a single loop expresses that without building an intermediate array.
  for (const product of products) {
    const problem = findProblem(product);
    if (problem !== null) {
      if (typeof onInvalid === 'function') onInvalid(product, problem);
      continue;
    }

    // Strict `=== true`, so a missing flag or a truthy "yes" fails closed.
    // Showing something as available when we are not sure is the expensive
    // direction to be wrong in.
    if (product.available !== true) continue;

    if (product.price <= minPrice) continue;

    kept.push(product);
    totalValue += product.price * product.quantity;
  }

  return { products: kept, totalValue };
}

module.exports = { filterProducts, DEFAULT_MIN_PRICE };
