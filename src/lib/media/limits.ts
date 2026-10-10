export const MAX_INPUT_BYTES = 5 * 1024 * 1024;
// Leave ample multipart overhead under Vercel's 4.5 MB function payload limit.
export const MAX_TRANSPORT_BYTES = 3 * 1024 * 1024;
export const MAX_PIXELS = 20_000_000;
export const MAX_DIMENSION = 16_384;
export type ImageRole = "photo" | "logo";
