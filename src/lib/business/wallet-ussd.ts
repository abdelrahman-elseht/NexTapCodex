import { isMobileWalletProvider } from "./providers";

/** Experimental patterns copied from docs/refrence/index.html. Not carrier-verified. */
export function buildWalletUssdCode(provider: string, recipient: string, amount: string | number) {
  if (!isMobileWalletProvider(provider)) return "";
  const savedNumber = recipient.trim().replace(/[\s().-]/g, "");
  // Existing business profile normalization stores Egyptian mobile numbers as +20.
  const number = /^\+201\d{9}$/.test(savedNumber) ? `0${savedNumber.slice(3)}` : savedNumber;
  const rawAmount = String(amount).trim();
  if (!/^01\d{9}$/.test(number) || !/^(?:\d+)(?:\.\d{1,2})?$/.test(rawAmount) || !Number.isFinite(Number(rawAmount)) || Number(rawAmount) <= 0) return "";
  if (provider === "vodafone") return `*9*7*${number}*${rawAmount}#`;
  if (provider === "etisalat") return `*777*1*${number}*${rawAmount}#`;
  return `#7115*1*${rawAmount}*${number}#`;
}

export function dialerHref(code: string) {
  return code ? `tel:${code.replaceAll("#", "%23")}` : "";
}
