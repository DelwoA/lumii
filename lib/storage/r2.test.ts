import { PutObjectCommand, UploadPartCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { describe, expect, it } from "vitest";
import { createR2Client } from "./r2-client";

function testClient() {
  return createR2Client({
    endpoint: "https://example.r2.cloudflarestorage.com",
    accessKeyId: "test-access-key",
    secretAccessKey: "test-secret-key",
  });
}

describe("presignUpload", () => {
  it("does not bind an empty-body SDK checksum into a browser PUT URL", async () => {
    const url = new URL(
      await getSignedUrl(
        testClient(),
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

describe("presignUploadPart", () => {
  it("does not bind an SDK checksum into a browser multipart part URL", async () => {
    const url = new URL(
      await getSignedUrl(
        testClient(),
        new UploadPartCommand({
          Bucket: "test-bucket",
          Key: "users/user-1/material.pdf",
          UploadId: "upload-1",
          PartNumber: 1,
        }),
        { expiresIn: 3600 },
      ),
    );

    expect(url.searchParams.has("x-amz-checksum-crc32")).toBe(false);
    expect(url.searchParams.has("x-amz-sdk-checksum-algorithm")).toBe(false);
    expect(url.searchParams.get("partNumber")).toBe("1");
    expect(url.searchParams.get("uploadId")).toBe("upload-1");
  });
});
