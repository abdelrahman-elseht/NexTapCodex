import { describe, expect, it } from "vitest";
import { unzipSync } from "fflate";
import { Resvg } from "@resvg/resvg-js";
import jsQR from "jsqr";
import { PNG } from "pngjs";
import { cardUrls, manufacturingZip, manifestCsv, nfcCsv, qrSvg } from "../lib/card-manufacturing";

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
  it("keeps manifest, NFC CSV, filenames, and QR payloads aligned for every card", async () => {
    const archive = unzipSync(await manufacturingZip(cards, "BATCH-001"));
    const manifest = csvRows(new TextDecoder().decode(archive["manifest.csv"]));
    const nfc = csvRows(new TextDecoder().decode(archive["nfc-encoding.csv"]));
    expect(Object.keys(archive).filter((name) => name.startsWith("qr/")).length).toBe(100);
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
