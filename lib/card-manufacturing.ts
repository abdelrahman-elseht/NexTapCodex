import QRCode from "qrcode";
import { zipSync } from "fflate";

export type ManufacturingCard = {
  serial: string;
  token: string;
  status: string;
};

export const CARD_ORIGIN = "https://nextab.services";

function normalizeOrigin(value: string | null | undefined) {
  const candidate = value?.trim();
  if (!candidate) return null;

  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(candidate) ? candidate : `https://${candidate}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * Resolve the public origin for a request. Proxies such as ngrok forward the
 * browser-facing host/protocol in these headers while the app itself may run
 * on localhost.
 */
export function getCardOrigin(requestOrigin?: string, requestHeaders?: Headers) {
  const forwardedHost = requestHeaders?.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || requestHeaders?.get("host")?.split(",")[0]?.trim();
  const forwardedProto = requestHeaders?.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const hostOrigin = host ? normalizeOrigin(`${forwardedProto || "https"}://${host}`) : null;
  const originHeader = normalizeOrigin(requestHeaders?.get("origin"));
  const refererOrigin = normalizeOrigin(requestHeaders?.get("referer"));
  const hostName = host?.replace(/^\[/, "").split("]")[0]?.split(":")[0].toLowerCase();
  const hostIsLocal = hostName === "localhost" || hostName === "127.0.0.1" || hostName === "::1";
  // Some tunnel configurations rewrite Host to localhost. The browser's
  // referer still carries the public tunnel origin in that case.
  const fromHeaders = hostIsLocal ? (originHeader || refererOrigin || hostOrigin) : (originHeader || hostOrigin);
  return normalizeOrigin(requestOrigin) || fromHeaders || normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL) || CARD_ORIGIN;
}

export function cardUrls(token: string, requestOrigin?: string) {
  const base = `${getCardOrigin(requestOrigin)}/c/${token}`;
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

export function manifestCsv(cards: ManufacturingCard[], batchCode: string, requestOrigin?: string) {
  return csv([
    ["batch_code", "serial", "token", "qr_url", "nfc_url", "status"],
    ...cards.map((card) => {
      const urls = cardUrls(card.token, requestOrigin);
      return [batchCode, card.serial, card.token, urls.qrUrl, urls.nfcUrl, card.status];
    }),
  ]);
}

export function nfcCsv(cards: ManufacturingCard[], requestOrigin?: string) {
  return csv([
    ["serial", "nfc_url"],
    ...cards.map((card) => [card.serial, cardUrls(card.token, requestOrigin).nfcUrl]),
  ]);
}

function htmlEscape(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Create a printable visual register pairing each QR image with its serial and URLs. */
export function qrIndexHtml(cards: ManufacturingCard[], batchCode: string, requestOrigin?: string) {
  const orderedCards = [...cards].sort((a, b) => a.serial.localeCompare(b.serial));
  const items = orderedCards.map((card) => {
    const serial = sanitizeSerial(card.serial);
    const urls = cardUrls(card.token, requestOrigin);
    return `<article class="card">
  <img src="qr/${htmlEscape(serial)}.svg" alt="QR ${htmlEscape(card.serial)}">
  <h2>${htmlEscape(card.serial)}</h2>
  <p><strong>QR</strong> <a href="${htmlEscape(urls.qrUrl)}">${htmlEscape(urls.qrUrl)}</a></p>
  <p><strong>NFC</strong> <a href="${htmlEscape(urls.nfcUrl)}">${htmlEscape(urls.nfcUrl)}</a></p>
  <p class="status">${htmlEscape(card.status)}</p>
</article>`;
  }).join("\n");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>NexTap QR register - ${htmlEscape(batchCode)}</title>
<style>
  :root { color-scheme: light; font-family: Arial, sans-serif; }
  body { margin: 0; padding: 24px; color: #201c17; background: #f5f1e9; }
  header { max-width: 1100px; margin: 0 auto 24px; }
  h1 { margin: 0 0 6px; font-size: 24px; }
  header p { margin: 0; color: #655d52; }
  .grid { max-width: 1100px; margin: 0 auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 16px; }
  .card { break-inside: avoid; padding: 16px; border: 1px solid #d8cfbf; border-radius: 10px; background: #fffdf8; }
  .card img { display: block; width: 180px; height: 180px; margin: 0 auto 12px; }
  .card h2 { margin: 0 0 8px; font: 700 16px/1.2 monospace; }
  .card p { margin: 6px 0; font-size: 11px; line-height: 1.4; overflow-wrap: anywhere; }
  .card a { color: #6e4c13; }
  .status { color: #655d52; }
  @media print { body { padding: 0; background: #fff; } header { margin-bottom: 12px; } .grid { gap: 8px; } .card { border-color: #bbb; } }
</style></head><body>
<header><h1>NexTap QR register</h1><p>Batch ${htmlEscape(batchCode)}. Match the serial printed on each card with the QR image and URLs below.</p></header>
<main class="grid">${items}</main>
</body></html>`;
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

Open qr-index.html from the ZIP to view every QR image beside its serial, QR URL, NFC URL, and status. Use that register when matching printed cards to their serials.

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
export async function manufacturingZip(cards: ManufacturingCard[], batchCode: string, requestOrigin?: string) {
  if (cards.length < 1 || cards.length > 1000 || !/^BATCH-[0-9]{3,}$/.test(batchCode)) {
    throw new Error("Invalid manufacturing export");
  }

  const qrFiles: Record<string, Uint8Array> = {};
  const orderedCards = [...cards].sort((a, b) => a.serial.localeCompare(b.serial));
  for (const card of orderedCards) {
    const serial = sanitizeSerial(card.serial);
    const { qrUrl } = cardUrls(card.token, requestOrigin);
    qrFiles[`qr/${serial}.svg`] = new TextEncoder().encode(await qrSvg(qrUrl));
  }

  const entries: Record<string, Uint8Array> = {
    "manifest.csv": new TextEncoder().encode(manifestCsv(orderedCards, batchCode, requestOrigin)),
    "nfc-encoding.csv": new TextEncoder().encode(nfcCsv(orderedCards, requestOrigin)),
    "qr-index.html": new TextEncoder().encode(qrIndexHtml(orderedCards, batchCode, requestOrigin)),
    "PRINT-INSTRUCTIONS.txt": new TextEncoder().encode(PRINT_INSTRUCTIONS),
    ...qrFiles,
  };
  return zipSync(entries, { level: 6 });
}
