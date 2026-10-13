import { describe, expect, it } from "vitest";
import { sanitizeSentryEvent, sanitizeSentrySpan, sanitizeUrl, scrubText } from "../../src/lib/observability/sentry";

describe("Sentry privacy sanitization", () => {
  it("removes card tokens and query values from URLs", () => {
    const token = "a".repeat(40);
    expect(sanitizeUrl(`https://nextap.example/c/${token}?via=nfc&token=secret`)).toBe("https://nextap.example/c/[card-token]");
    expect(scrubText("failed /c/" + token + "?token=secret")).toBe("failed /c/[card-token]?token=[redacted]");
  });

  it("drops user, payload, cookies, and sensitive request headers", () => {
    const event = sanitizeSentryEvent({
      request: {
        url: "https://nextap.example/api/admin/cards?card_token=secret",
        headers: { authorization: "Bearer secret", "content-type": "application/json" },
        cookies: { session: "secret" },
        data: { payment: "secret" },
      },
      user: { email: "owner@example.test" },
      message: "redirect /c/abcdefghijklmnopqrstuvwxyz1234567890TOKEN",
    });
    expect(event.request.url).toBe("https://nextap.example/api/admin/cards");
    expect(event.request.headers).toEqual({ "content-type": "application/json" });
    expect(event.request.cookies).toBeUndefined();
    expect(event.request.data).toBeUndefined();
    expect(event.user).toBeUndefined();
    expect(event.message).toContain("[card-token]");
  });

  it("scrubs span descriptions and sensitive span data", () => {
    const span = sanitizeSentrySpan({
      description: "/c/abcdefghijklmnopqrstuvwxyz1234567890TOKEN?token=secret",
      data: { authorization: "secret", operation: "card redirect" },
    });
    expect(span.description).toContain("[card-token]");
    expect(span.data).toEqual({ authorization: "[redacted]", operation: "card redirect" });
  });
});
