// @ts-check

const { freeze } = Object; //TODO:harden()

/**
 * @param {string} base
 * @param {string} apiKey
 * @param {Object} io
 * @param {typeof fetch} io.fetch
 */
export const endpoint = (base, apiKey, { fetch }) => {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  /**
   * @param {string} query
   * @param {Record<string, string |  number>} [variables]
   */
  const query = async (query, variables = {}) => {
    const body = JSON.stringify({ query, variables });
    const res = await fetch(base, { method: "POST", headers, body });
    if (!res.ok) {
      const body = await res.text();
      throw Error(`query failed: ${body}`);
    }
    return res.json();
  };

  return freeze({ query });
};
