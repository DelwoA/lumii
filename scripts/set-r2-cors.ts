/**
 * One-time (re-runnable) script to set the Cloudflare R2 bucket CORS policy so
 * the browser can PUT directly to presigned upload URLs. Run with the R2 env
 * vars loaded, e.g.:
 *   npx tsx --env-file=.env.local scripts/set-r2-cors.ts
 *
 * R2 follows the S3 spec: AllowedOrigins must be EXACT origins (no subdomain
 * wildcards). Add any extra deployment origins here as needed.
 */
import {
  S3Client,
  PutBucketCorsCommand,
  GetBucketCorsCommand,
} from "@aws-sdk/client-s3";

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

const ALLOWED_ORIGINS = [
  "https://lumii-kappa.vercel.app",
  "https://lumii-git-main-teamdelwo.vercel.app",
  "http://localhost:3000",
];

async function main(): Promise<void> {
  const client = new S3Client({
    region: "auto",
    endpoint: req("CLOUDFLARE_R2_ENDPOINT"),
    credentials: {
      accessKeyId: req("CLOUDFLARE_R2_ACCESS_KEY_ID"),
      secretAccessKey: req("CLOUDFLARE_R2_SECRET_ACCESS_KEY"),
    },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  const Bucket = req("CLOUDFLARE_R2_BUCKET");

  await client.send(
    new PutBucketCorsCommand({
      Bucket,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: ALLOWED_ORIGINS,
            AllowedMethods: ["PUT"],
            AllowedHeaders: ["Content-Type"],
            ExposeHeaders: ["ETag"],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    }),
  );

  const got = await client.send(new GetBucketCorsCommand({ Bucket }));
  console.log("R2 CORS policy applied. Current rules:");
  console.dir(got.CORSRules, { depth: null });
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Failed to set R2 CORS:", e);
    process.exit(1);
  });
