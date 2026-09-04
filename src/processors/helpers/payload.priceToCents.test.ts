import { describe, expect, it } from "vitest";

import {
  priceToCents,
  resolveVimeoAmountCents,
  vimeoProductPriceCents,
} from "@/processors/helpers/payload";

describe("priceToCents", () => {
  it("treats Vimeo integer subscription_price as cents", () => {
    expect(priceToCents(599)).toBe(599);
    expect(priceToCents(5000)).toBe(5000);
    expect(priceToCents(0)).toBe(0);
  });

  it("converts fractional dollar amounts to cents", () => {
    expect(priceToCents(5.99)).toBe(599);
    expect(priceToCents(12.5)).toBe(1250);
  });

  it("returns null for non-finite input", () => {
    expect(priceToCents(null)).toBeNull();
    expect(priceToCents(undefined)).toBeNull();
    expect(priceToCents(Number.NaN)).toBeNull();
  });
});

describe("vimeoProductPriceCents", () => {
  const product = {
    price: {
      monthly: { cents: 599, currency: "USD", formatted: "$5.99" },
      yearly: { cents: 5999, currency: "USD", formatted: "$59.99" },
    },
  };

  it("picks monthly by default", () => {
    expect(vimeoProductPriceCents(product, "monthly")).toBe(599);
    expect(vimeoProductPriceCents(product, null)).toBe(599);
  });

  it("picks yearly for annual frequency", () => {
    expect(vimeoProductPriceCents(product, "annual")).toBe(5999);
    expect(vimeoProductPriceCents(product, "yearly")).toBe(5999);
  });
});

describe("resolveVimeoAmountCents", () => {
  const product = {
    price: {
      monthly: { cents: 599, currency: "USD" },
      yearly: { cents: 5999, currency: "USD" },
    },
  };

  it("prefers customer subscription_price", () => {
    expect(
      resolveVimeoAmountCents({
        subscriptionPrice: 419,
        frequency: "monthly",
        product,
      }),
    ).toBe(419);
  });

  it("falls back to product catalog when subscription_price is null", () => {
    expect(
      resolveVimeoAmountCents({
        subscriptionPrice: null,
        frequency: "monthly",
        product,
      }),
    ).toBe(599);
  });

  it("uses explicit fallback before product", () => {
    expect(
      resolveVimeoAmountCents({
        subscriptionPrice: null,
        frequency: "monthly",
        product,
        fallbackCents: 1299,
      }),
    ).toBe(1299);
  });
});
