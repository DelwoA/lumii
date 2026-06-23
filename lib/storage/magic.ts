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

// Note: the audio checks below confirm the declared CONTAINER, not the audio
// codec (e.g. any ISO-BMFF "ftyp" passes isM4aMagic, including some video). For
// user-owned uploads this is proportionate: a non-audio file that slips through
// simply fails transcription gracefully. Tightening to codec-level parsing would
// need a media-parser dependency and is deliberately deferred.

/** True for an MP3 (ID3 tag or an MPEG audio frame sync). */
export function isMp3Magic(bytes: Uint8Array | null): boolean {
  if (!bytes || bytes.length < 3) return false;
  const id3 = bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33; // "ID3"
  const frameSync = bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0;
  return id3 || frameSync;
}

/** True for a WAV container (RIFF....WAVE). */
export function isWavMagic(bytes: Uint8Array | null): boolean {
  if (!bytes || bytes.length < 12) return false;
  return (
    bytes[0] === 0x52 && // R
    bytes[1] === 0x49 && // I
    bytes[2] === 0x46 && // F
    bytes[3] === 0x46 && // F
    bytes[8] === 0x57 && // W
    bytes[9] === 0x41 && // A
    bytes[10] === 0x56 && // V
    bytes[11] === 0x45 // E
  );
}

/** True for an MP4/M4A container (a "ftyp" box at offset 4). */
export function isM4aMagic(bytes: Uint8Array | null): boolean {
  if (!bytes || bytes.length < 8) return false;
  return (
    bytes[4] === 0x66 && // f
    bytes[5] === 0x74 && // t
    bytes[6] === 0x79 && // y
    bytes[7] === 0x70 // p
  );
}

/** True for an Ogg container (OggS). */
export function isOggMagic(bytes: Uint8Array | null): boolean {
  if (!bytes || bytes.length < 4) return false;
  return (
    bytes[0] === 0x4f && // O
    bytes[1] === 0x67 && // g
    bytes[2] === 0x67 && // g
    bytes[3] === 0x53 // S
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
    case "audio/mpeg":
      return isMp3Magic(bytes);
    case "audio/wav":
    case "audio/x-wav":
      return isWavMagic(bytes);
    case "audio/mp4":
    case "audio/x-m4a":
      return isM4aMagic(bytes);
    case "audio/ogg":
      return isOggMagic(bytes);
    default:
      return false;
  }
}
