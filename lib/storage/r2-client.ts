// =============================================================================
// FILE: lib/storage/r2-client.ts
// WHAT THIS FILE DOES:
//   Creates the connection object used to talk to Cloudflare R2 (our file
//   storage). R2 understands the same commands as Amazon S3, so we use the AWS
//   S3 toolkit pointed at R2's address.
//
//   The two "WHEN_REQUIRED" settings turn off an extra checksum the toolkit adds
//   by default; that checksum broke direct browser uploads to R2, so we only add
//   it when actually needed. This factory is kept separate (with no server-only
//   import) so its behaviour can be unit-tested (see r2.test.ts).
// =============================================================================
import { S3Client } from "@aws-sdk/client-s3";

type R2ClientOptions = {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
};

/** Build an R2-compatible S3 client without SDK-added optional checksums. */
export function createR2Client(options: R2ClientOptions): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: options.endpoint,
    credentials: {
      accessKeyId: options.accessKeyId,
      secretAccessKey: options.secretAccessKey,
    },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
}
