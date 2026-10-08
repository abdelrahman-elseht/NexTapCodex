import QRCode from "qrcode";
import { zipSync } from "fflate";

export type ManufacturingCard = {
  serial: string;
  token: string;
  status: string;
};

export const CARD_ORIGIN = "https://nextab.services";

export function cardUrls(token: string) {
  const base = `${CARD_ORIGIN}/c/${token}`;
  return { qrUrl: `${base}?via=qr`, nfcUrl: `${base}?via=nfc` };
}

export function sanitizeSerial(serial: string) {
  const sanitized = serial.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 80);
  if (!sanitized || sanitized === "." || sanitized === "..") {
    throw new Error("Invalid card serial");
  }
  return sanitized;
}

function csvCell(value: string) {
  const guarded = /^[\s\u0000-\u001f]*[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${guarded.replaceAll('"', '""')}"`;
}

export function csv(rows: string[][]) {
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

export function manifestCsv(cards: ManufacturingCard[], batchCode: string) {
  return csv([
    ["batch_code", "serial", "token", "qr_url", "nfc_url", "status"],
    ...cards.map((card) => {
      const urls = cardUrls(card.token);
      return [batchCode, card.serial, card.token, urls.qrUrl, urls.nfcUrl, card.status];
    }),
  ]);
}

export function nfcCsv(cards: ManufacturingCard[]) {
  return csv([
    ["serial", "nfc_url"],
    ...cards.map((card) => [card.serial, cardUrls(card.token).nfcUrl]),
  ]);
}

export async function qrSvg(url: string) {
  return QRCode.toString(url, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 4,
    color: { dark: "#000000", light: "#FFFFFF" },
  });
}

export const PRINT_INSTRUCTIONS = `NexTap card manufacturing and quality checks

Match each QR SVG filename to the discreet serial printed on the same card. Keep the serial-to-encoding record with the production batch. Do not expose token inventory or admin credentials to the print vendor.

Before printing:
- Confirm the vendor's variable-data/template requirements, final physical QR size, bleed, and safe area before preparing any card layout. No card dimensions are assumed here.
- Print a test sheet in high contrast with the full QR quiet zone. Do not crop finder patterns or place a logo over a code.
- Spot-check five QR samples, including the first and last serial. Scan each on a real device and compare the full HTTPS URL with that serial's manifest.csv row.
- Ensure every printed serial remains reliably tied to its QR and NFC encoding record.

After NFC encoding:
- Do not assume the vendor programs NFC unless this is explicitly contracted.
- Tap several physical samples with a real NFC-capable device. Compare each NFC URL and token with the serial in nfc-encoding.csv and manifest.csv.
- Scan the QR and tap the NFC chip on the same samples; verify both resolve to the same current card assignment. A correct QR scan does not verify NFC encoding.
`;

/** Build a bounded, on-demand archive from persisted card identifiers. */
export async function manufacturingZip(cards: ManufacturingCard[], batchCode: string) {
  if (cards.length < 1 || cards.length > 1000 || !/^BATCH-[0-9]{3,}$/.test(batchCode)) {
    throw new Error("Invalid manufacturing export");
  }

  const qrFiles: Record<string, Uint8Array> = {};
  const orderedCards = [...cards].sort((a, b) => a.serial.localeCompare(b.serial));
  for (const card of orderedCards) {
    const serial = sanitizeSerial(card.serial);
    const { qrUrl } = cardUrls(card.token);
    qrFiles[`qr/${serial}.svg`] = new TextEncoder().encode(await qrSvg(qrUrl));
  }

  const entries: Record<string, Uint8Array> = {
    "manifest.csv": new TextEncoder().encode(manifestCsv(orderedCards, batchCode)),
    "nfc-encoding.csv": new TextEncoder().encode(nfcCsv(orderedCards)),
    "PRINT-INSTRUCTIONS.txt": new TextEncoder().encode(PRINT_INSTRUCTIONS),
    ...qrFiles,
  };
  return zipSync(entries, { level: 6 });
}
