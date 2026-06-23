/**
 * Magic-byte (file signature) checks. Pure and dependency-free so they can be
 * unit-tested directly (the R2 client module is server-only and not importable
 * from tests). Used to confirm an uploaded object really is its declared type.
 */

/** True if the bytes begin with the PDF magic number (%PDF). */
export function isPdfMagic(bytes: Uint8Array | null): boolean {
  if (!bytes || bytes.length < 4) return false;
  return (
    bytes[0] === 0x25 && // %
    bytes[1] === 0x50 && // P
    bytes[2] === 0x44 && // D
    bytes[3] === 0x46 // F
  );
}

/** True if the bytes begin with the PNG signature. */
export function isPngMagic(bytes: Uint8Array | null): boolean {
  if (!bytes || bytes.length < 8) return false;
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  return sig.every((b, i) => bytes[i] === b);
}

/** True if the bytes begin with the JPEG start-of-image marker (FF D8 FF). */
export function isJpegMagic(bytes: Uint8Array | null): boolean {
  if (!bytes || bytes.length < 3) return false;
  return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

/** True if the bytes are a WebP container (RIFF....WEBP). */
export function isWebpMagic(bytes: Uint8Array | null): boolean {
  if (!bytes || bytes.length < 12) return false;
  return (
    bytes[0] === 0x52 && // R
    bytes[1] === 0x49 && // I
    bytes[2] === 0x46 && // F
    bytes[3] === 0x46 && // F
    bytes[8] === 0x57 && // W
    bytes[9] === 0x45 && // E
    bytes[10] === 0x42 && // B
    bytes[11] === 0x50 // P
  );
}

/** True if the leading bytes match the magic number expected for the mime type. */
export function matchesMagic(
  mimeType: string,
  bytes: Uint8Array | null,
): boolean {
  switch (mimeType) {
    case "application/pdf":
      return isPdfMagic(bytes);
    case "image/png":
      return isPngMagic(bytes);
    case "image/jpeg":
      return isJpegMagic(bytes);
    case "image/webp":
      return isWebpMagic(bytes);
    default:
      return false;
  }
}
