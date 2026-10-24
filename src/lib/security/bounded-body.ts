export class BodyLimitError extends Error {
  constructor() {
    super("Request body exceeds the permitted size.");
    this.name = "BodyLimitError";
  }
}

export class MissingBodyError extends Error {
  constructor() {
    super("Request body is required.");
    this.name = "MissingBodyError";
  }
}

/** Read a request body without allowing a chunked request to grow unbounded. */
export async function readBoundedBody(request: Request, maxBytes: number): Promise<Uint8Array> {
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const declared = Number(contentLength);
    if (!Number.isSafeInteger(declared) || declared < 0 || declared > maxBytes) throw new BodyLimitError();
  }
  const reader = request.body?.getReader();
  if (!reader) throw new MissingBodyError();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new BodyLimitError();
      }
      chunks.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export function boundedRequest(request: Request, body: Uint8Array) {
  const buffer = body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer;
  return new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body: buffer,
  });
}
