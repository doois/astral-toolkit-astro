// The cart lives in Shopify: the browser talks to the Storefront API with the
// public token and the site keeps only the cart's id. Prices, coupons and
// automatic discounts are always the store's own, whatever the page showed.
// The toolkits share this contract (cms/docs/TOOLKITS.md).

export const API_VERSION = "2026-10";
const KEY = "astral:cart";

export type Money = { amount: string; currencyCode: string };
export type CartLine = {
  id: string;
  quantity: number;
  cost: { subtotalAmount: Money; totalAmount: Money };
  merchandise: { id: string; title: string; product: { title: string }; image: { url: string; altText: string | null } | null };
};
export type Cart = {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  cost: { totalAmount: Money };
  discountCodes: { code: string; applicable: boolean }[];
  lines: { nodes: CartLine[] };
};

const CART = `id checkoutUrl totalQuantity
  cost { totalAmount { amount currencyCode } }
  discountCodes { code applicable }
  lines(first: 100) { nodes {
    id quantity
    cost { subtotalAmount { amount currencyCode } totalAmount { amount currencyCode } }
    merchandise { ... on ProductVariant { id title product { title } image { url altText } } }
  } }`;
const RESULT = `cart { ${CART} } userErrors { message }`;

/** Where the id is kept. A function: merely reaching localStorage can throw (private windows, blocked site data). */
export type Keeper = () => Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function createCart(options: { store: string; token: string; storage: Keeper }) {
  const { store, token, storage } = options;
  const keep = (action: () => void) => {
    try {
      action();
    } catch {
      // Without storage the cart lasts as long as the page.
    }
  };
  let id: string | null = null;
  keep(() => (id = storage().getItem(KEY)));

  async function call<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    const response = await fetch(`https://${store}/api/${API_VERSION}/graphql.json`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-shopify-storefront-access-token": token },
      body: JSON.stringify({ query, variables }),
    });
    if (!response.ok) throw new Error(`Shopify ${response.status}`);
    const body = (await response.json()) as { data?: T; errors?: { message: string }[] };
    if (body.errors?.length) throw new Error(body.errors[0]!.message);
    return body.data as T;
  }

  const remember = (cart: Cart) => {
    id = cart.id;
    keep(() => storage().setItem(KEY, cart.id));
    return cart;
  };

  function forget() {
    id = null;
    keep(() => storage().removeItem(KEY));
  }

  /** Runs a mutation and reads its cart; the store's refusals come back as errors. */
  async function change(name: string, signature: string, args: string, variables: Record<string, unknown>) {
    const data = await call<Record<string, { cart: Cart | null; userErrors: { message: string }[] }>>(`mutation(${signature}) { result: ${name}(${args}) { ${RESULT} } }`, variables);
    const { cart, userErrors } = data.result!;
    if (userErrors.length) throw new Error(userErrors[0]!.message);
    return remember(cart!);
  }

  return {
    /** The cart in progress; null when there is none, or the store let it expire. */
    async load() {
      if (!id) return null;
      const { cart } = await call<{ cart: Cart | null }>(`query($id: ID!) { cart(id: $id) { ${CART} } }`, { id });
      if (cart) return cart;
      forget();
      return null;
    },

    async add(variantId: string, quantity = 1) {
      const lines = [{ merchandiseId: variantId, quantity }];
      // An expired cart is found out here, not by the visitor.
      const current = id ? await this.load() : null;
      if (!current) return change("cartCreate", "$input: CartInput!", "input: $input", { input: { lines } });
      return change("cartLinesAdd", "$id: ID!, $lines: [CartLineInput!]!", "cartId: $id, lines: $lines", { id: current.id, lines });
    },

    setQuantity: (lineId: string, quantity: number) =>
      quantity > 0
        ? change("cartLinesUpdate", "$id: ID!, $lines: [CartLineUpdateInput!]!", "cartId: $id, lines: $lines", { id, lines: [{ id: lineId, quantity }] })
        : change("cartLinesRemove", "$id: ID!, $lineIds: [ID!]!", "cartId: $id, lineIds: $lineIds", { id, lineIds: [lineId] }),

    /** The list replaces the cart's codes: an empty one takes them all off. A code that does not apply stays listed, with `applicable` false. */
    setCodes: (codes: string[]) => change("cartDiscountCodesUpdate", "$id: ID!, $codes: [String!]!", "cartId: $id, discountCodes: $codes", { id, codes }),
  };
}
