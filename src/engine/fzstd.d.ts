/**
 * Type declarations for the vendored fzstd 0.1.1 (see fzstd.js).
 * Only the parts the engine uses are declared.
 */

/**
 * Decompress a complete Zstandard frame (or sequence of frames).
 * @param dat the compressed input
 * @param buf optional pre-allocated output buffer; when provided and sized
 *            correctly the decompressed bytes are written into it and it is
 *            returned.
 */
export function decompress(dat: Uint8Array, buf?: Uint8Array): Uint8Array;

export const ZstdErrorCode: Record<string, number>;

export class Decompress {
  constructor(ondata?: (data: Uint8Array, final: boolean) => void);
  ondata: (data: Uint8Array, final: boolean) => void;
  push(chunk: Uint8Array, final?: boolean): void;
}
