import { describe, expect, it } from "vitest";
import { unzipSync } from "fflate";
import { Resvg } from "@resvg/resvg-js";
import jsQR from "jsqr";
import { PNG } from "pngjs";
import { cardUrls, getCardOrigin, manufacturingZip, manifestCsv, nfcCsv, qrSvg } from "../lib/card-manufacturing";

const cards = Array.from({ length: 100 }, (_, index) => ({
  serial: `NT-20261008-${String(index + 1).padStart(6, "0")}`,
  token: `${String.fromCharCode(65 + (index % 26))}${"x".repeat(47)}${String(index).padStart(2, "0")}`,
  status: "unassigned",
}));

function csvRows(source: string) {
  return source.replace(/^\uFEFF/, "").trimEnd().split("\r\n").map((row) =>
    row.match(/"(?:[^"]|"")*"/g)?.map((cell) => cell.slice(1, -1).replaceAll('""', '"')) ?? [],
  );
}

describe("card manufacturing export", () => {
  it("uses the forwarded public origin when the app is reached through ngrok", () => {
    expect(getCardOrigin(undefined, new Headers({
      host: "localhost:3000",
      "x-forwarded-host": "deputy-happiest-closable.ngrok-free.dev",
      "x-forwarded-proto": "https",
    }))).toBe("https://deputy-happiest-closable.ngrok-free.dev");
  });

  it("uses the public referer when a tunnel rewrites Host to localhost", () => {
    expect(getCardOrigin(undefined, new Headers({
      host: "localhost:3000",
      referer: "https://deputy-happiest-closable.ngrok-free.dev/admin/cards",
    }))).toBe("https://deputy-happiest-closable.ngrok-free.dev");
  });

  it("uses the configured site origin for QR and NFC payloads", () => {
    const previousOrigin = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_SITE_URL = "https://cards.example.test/";

    try {
      expect(cardUrls("token-123456789012345678901234567890")).toEqual({
        qrUrl: "https://cards.example.test/c/token-123456789012345678901234567890?via=qr",
        nfcUrl: "https://cards.example.test/c/token-123456789012345678901234567890?via=nfc",
      });
    } finally {
      if (previousOrigin === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
      else process.env.NEXT_PUBLIC_SITE_URL = previousOrigin;
    }
  });

  it("keeps manifest, NFC CSV, filenames, and QR payloads aligned for every card", async () => {
    const archive = unzipSync(await manufacturingZip(cards, "BATCH-001"));
    const manifest = csvRows(new TextDecoder().decode(archive["manifest.csv"]));
    const nfc = csvRows(new TextDecoder().decode(archive["nfc-encoding.csv"]));
    const qrIndex = new TextDecoder().decode(archive["qr-index.html"]);
    expect(Object.keys(archive).filter((name) => name.startsWith("qr/")).length).toBe(100);
    expect(qrIndex).toContain("qr/NT-20261008-000001.svg");
    expect(qrIndex).toContain("NT-20261008-000001");
    expect(qrIndex).toContain(cardUrls(cards[0].token).qrUrl);
    expect(manifest).toHaveLength(101);
    expect(nfc).toHaveLength(101);

    for (let index = 0; index < cards.length; index += 1) {
      const card = cards[index];
      const row = manifest[index + 1];
      const nfcRow = nfc[index + 1];
      const urls = cardUrls(card.token);
      expect(row).toEqual(["BATCH-001", card.serial, card.token, urls.qrUrl, urls.nfcUrl, "unassigned"]);
      expect(nfcRow).toEqual([card.serial, urls.nfcUrl]);
      const svg = new TextDecoder().decode(archive[`qr/${card.serial}.svg`]);
      expect(svg).toBe(await qrSvg(urls.qrUrl));
      const png = PNG.sync.read(new Resvg(svg, { fitTo: { mode: "width", value: 512 } }).render().asPng());
      const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
      expect(decoded?.data).toBe(urls.qrUrl);
    }
  }, 30_000);

  it("guards spreadsheet formula injection in exported fields", () => {
    expect(manifestCsv([{ serial: "=SERIAL", token: "-TOKEN".padEnd(32, "x"), status: "@status" }], "BATCH-001"))
      .toContain("\"'=SERIAL\"");
  });
});
