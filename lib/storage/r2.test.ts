import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { describe, expect, it } from "vitest";
import { createR2Client } from "./r2-client";

describe("presignUpload", () => {
  it("does not bind an empty-body SDK checksum into a browser PUT URL", async () => {
    const client = createR2Client({
      endpoint: "https://example.r2.cloudflarestorage.com",
      accessKeyId: "test-access-key",
      secretAccessKey: "test-secret-key",
    });
    const url = new URL(
      await getSignedUrl(
        client,
        new PutObjectCommand({
          Bucket: "test-bucket",
          Key: "users/user-1/material.pdf",
          ContentType: "application/pdf",
        }),
        { expiresIn: 120 },
      ),
    );

    expect(url.searchParams.has("x-amz-checksum-crc32")).toBe(false);
    expect(url.searchParams.has("x-amz-sdk-checksum-algorithm")).toBe(false);
  });
});
