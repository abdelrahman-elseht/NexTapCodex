import { describe, expect, it } from "vitest";
import { buildWalletUssdCode, dialerHref } from "@/lib/business/wallet-ussd";

describe("experimental wallet USSD formats", () => {
  it("preserves each sandbox provider's field ordering and leading zeros", () => {
    expect(buildWalletUssdCode("vodafone", "01004060919", "10")).toBe("*9*7*01004060919*10#");
    expect(buildWalletUssdCode("etisalat", "01104060919", "10")).toBe("*777*1*01104060919*10#");
    expect(buildWalletUssdCode("orange", "01204060919", "10")).toBe("#7115*1*10*01204060919#");
    expect(buildWalletUssdCode("vodafone", "+20 100 000 0000", "10")).toBe("*9*7*01000000000*10#");
  });

  it("accepts only positive EGP amounts and Egyptian mobile recipients", () => {
    for (const amount of ["", "0", "-1", "1e2", "1.234", "NaN"]) expect(buildWalletUssdCode("vodafone", "01012345678", amount)).toBe("");
    expect(buildWalletUssdCode("vodafone", "201012345678", "1")).toBe("");
    expect(buildWalletUssdCode("vodafone", "+201012345678", "1")).toBe("*9*7*01012345678*1#");
  });

  it("encodes the dialer fragment while retaining exact copy text", () => {
    const code = buildWalletUssdCode("orange", "01204060919", "5.5");
    expect(code).toBe("#7115*1*5.5*01204060919#");
    expect(dialerHref(code)).toBe("tel:%237115*1*5.5*01204060919%23");
  });

  it("does not create formats for unrelated providers", () => {
    expect(buildWalletUssdCode("instapay", "01012345678", "1")).toBe("");
  });
});
