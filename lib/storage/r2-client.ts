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
