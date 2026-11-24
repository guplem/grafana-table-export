/**
 * A tiny element tree for the tests. The page scripts run in `node:vm`, which has no DOM, and the
 * project adds no dependency for one. The matcher knows the attribute selectors that `src/page/` uses.
 */

/** Such as `[role="grid"]`, `[data-testid^="a"]` or `[data-testid$="b"]`. */
const ATTRIBUTE_SELECTOR = /^\[([a-z-]+)([$^]?)="(.*)"\]$/;

/**
 * @param {FakeElement} element
 * @param {string} selector One attribute selector, without a comma.
 * @returns {boolean}
 */
function matchesOne(element, selector) {
  const parts = ATTRIBUTE_SELECTOR.exec(selector.trim());
  if (parts === null) throw new Error(`The fake DOM does not know the selector "${selector}".`);
  const [, name, operator, wanted] = parts;
  const value = element.attributes[name];
  if (value === undefined) return false;
  if (operator === '^') return value.startsWith(wanted);
  if (operator === '$') return value.endsWith(wanted);
  return value === wanted;
}

export class FakeElement {
  /**
   * @param {object} parts
   * @param {Record<string, string>} [parts.attributes]
   * @param {FakeElement[]} [parts.children]
   * @param {object} [parts.frame] The data frame that the React fiber of this element leads to.
   */
  constructor({ attributes = {}, children = [], frame } = {}) {
    this.attributes = attributes;
    this.children = children;
    /** @type {FakeElement | null} */
    this.parentElement = null;
    for (const child of children) child.parentElement = this;
    if (frame !== undefined) {
      // The real table sits a few components below the frame, so the walk up needs more than one step.
      this['__reactFiber$fake'] = { memoizedProps: {}, return: { memoizedProps: { data: frame } } };
    }
  }

  /**
   * @param {string} selector One selector, or a list with commas.
   * @returns {boolean}
   */
  matches(selector) {
    return selector.split(',').some((one) => matchesOne(this, one));
  }

  /**
   * @param {string} selector
   * @returns {FakeElement | null} This element or the nearest parent that matches.
   */
  closest(selector) {
    /** @type {FakeElement | null} */
    let level = this;
    while (level !== null) {
      if (level.matches(selector)) return level;
      level = level.parentElement;
    }
    return null;
  }

  /**
   * @param {FakeElement} element
   * @returns {boolean} `true` for this element and for each element below it.
   */
  contains(element) {
    return element === this || this.children.some((child) => child.contains(element));
  }

  /**
   * @param {string} selector
   * @returns {FakeElement[]} The elements below this one that match, in document order.
   */
  querySelectorAll(selector) {
    return this.children.flatMap((child) => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]);
  }
}
