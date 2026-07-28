-- LUMII IoT desk companion pairing, credentials, and user-controlled config.
CREATE TABLE "IoTDevice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'LUMII Desk Companion',
    "tokenDigest" TEXT NOT NULL,
    "brightness" INTEGER NOT NULL DEFAULT 20,
    "volume" INTEGER NOT NULL DEFAULT 40,
    "moodNudgeEnabled" BOOLEAN NOT NULL DEFAULT false,
    "pairedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IoTDevice_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "IoTDevice_brightness_check" CHECK ("brightness" BETWEEN 0 AND 100),
    CONSTRAINT "IoTDevice_volume_check" CHECK ("volume" BETWEEN 0 AND 100)
);

CREATE TABLE "IoTDevicePairingCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeDigest" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IoTDevicePairingCode_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IoTDevicePairingRateLimit" (
    "keyDigest" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IoTDevicePairingRateLimit_pkey" PRIMARY KEY ("keyDigest", "windowStart")
);

CREATE UNIQUE INDEX "IoTDevice_tokenDigest_key" ON "IoTDevice"("tokenDigest");
CREATE INDEX "IoTDevice_userId_revokedAt_idx" ON "IoTDevice"("userId", "revokedAt");
CREATE UNIQUE INDEX "IoTDevicePairingCode_codeDigest_key" ON "IoTDevicePairingCode"("codeDigest");
CREATE INDEX "IoTDevicePairingCode_userId_expiresAt_idx" ON "IoTDevicePairingCode"("userId", "expiresAt");
CREATE INDEX "IoTDevicePairingCode_expiresAt_idx" ON "IoTDevicePairingCode"("expiresAt");
CREATE INDEX "IoTDevicePairingRateLimit_expiresAt_idx" ON "IoTDevicePairingRateLimit"("expiresAt");

ALTER TABLE "IoTDevice"
ADD CONSTRAINT "IoTDevice_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IoTDevicePairingCode"
ADD CONSTRAINT "IoTDevicePairingCode_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
