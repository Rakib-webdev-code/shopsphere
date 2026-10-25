/**
 * Browser-side checkout idempotency key storage.
 *
 * The server idempotency key is the source of truth. Persisting the same key in
 * `sessionStorage` only lets a reload of the *same* logical checkout reuse it;
 * it is scoped to the authenticated user and the cart revision so a changed
 * cart (or a different signed-in user) can never reuse the key.
 *
 * Storage access is optional: private browsing or a storage quota error falls
 * back to the component's in-memory ref without claiming persistence.
 */

export type CheckoutKeyStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

const KEY_PREFIX = "shopsphere.checkout-key.v1";
const CHECKOUT_KEY_PATTERN = /^[A-Za-z0-9_-]{16,80}$/;

export function isCheckoutKey(value: unknown): value is string {
  return typeof value === "string" && CHECKOUT_KEY_PATTERN.test(value);
}

export function checkoutKeyStorageId(
  userId: string,
  cartRevision: number,
): string {
  return `${KEY_PREFIX}:${userId}:${cartRevision}`;
}

export function readStoredCheckoutKey(
  storage: CheckoutKeyStorage | null,
  userId: string,
  cartRevision: number,
): string | null {
  if (!storage) {
    return null;
  }

  try {
    const value = storage.getItem(checkoutKeyStorageId(userId, cartRevision));

    if (isCheckoutKey(value)) {
      return value;
    }

    if (value !== null) {
      storage.removeItem(checkoutKeyStorageId(userId, cartRevision));
    }
  } catch {
    // Storage may be unavailable; the caller falls back to memory.
  }

  return null;
}

export function storeCheckoutKey(
  storage: CheckoutKeyStorage | null,
  userId: string,
  cartRevision: number,
  key: string,
): void {
  if (!storage || !isCheckoutKey(key)) {
    return;
  }

  try {
    storage.setItem(checkoutKeyStorageId(userId, cartRevision), key);
  } catch {
    // Not fatal; the server still enforces idempotency for this attempt.
  }
}

export function clearStoredCheckoutKey(
  storage: CheckoutKeyStorage | null,
  userId: string,
  cartRevision: number,
): void {
  if (!storage) {
    return;
  }

  try {
    storage.removeItem(checkoutKeyStorageId(userId, cartRevision));
  } catch {
    // Nothing to do.
  }
}

/**
 * Returns the persisted key for this user/cart revision, or creates and stores
 * a new one. `createKey` is injected so tests can be deterministic.
 */
export function resolveCheckoutKey(options: {
  storage: CheckoutKeyStorage | null;
  userId: string;
  cartRevision: number;
  createKey: () => string;
}): string {
  const existing = readStoredCheckoutKey(
    options.storage,
    options.userId,
    options.cartRevision,
  );

  if (existing) {
    return existing;
  }

  const key = options.createKey();

  if (!isCheckoutKey(key)) {
    throw new Error("Generated checkout key is invalid.");
  }

  storeCheckoutKey(
    options.storage,
    options.userId,
    options.cartRevision,
    key,
  );

  return key;
}
