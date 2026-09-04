import { describe, expect, it } from "vitest";

import { priceToCents } from "@/processors/helpers/payload";

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
