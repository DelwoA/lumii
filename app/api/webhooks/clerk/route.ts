import { Webhook } from "svix";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireServerEnv } from "@/lib/env";
import { deleteObjectsForUser } from "@/lib/storage/r2";

type ClerkEmail = { id: string; email_address: string };
type ClerkUserData = {
  id: string;
  email_addresses?: ClerkEmail[];
  primary_email_address_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
};
type ClerkEvent = { type: string; data: ClerkUserData };

function pickEmail(data: ClerkUserData): string | undefined {
  const primary = data.email_addresses?.find(
    (e) => e.id === data.primary_email_address_id,
  );
  return primary?.email_address ?? data.email_addresses?.[0]?.email_address;
}

function pickDisplayName(data: ClerkUserData): string | undefined {
  const name = [data.first_name, data.last_name].filter(Boolean).join(" ");
  return name || data.username || undefined;
}

export async function POST(req: Request) {
  const { CLERK_WEBHOOK_SIGNING_SECRET } = requireServerEnv(
    "CLERK_WEBHOOK_SIGNING_SECRET",
  );

  const h = await headers();
  const svixId = h.get("svix-id");
  const svixTimestamp = h.get("svix-timestamp");
  const svixSignature = h.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response("Missing svix headers", { status: 400 });
  }

  const body = await req.text();
  let evt: ClerkEvent;
  try {
    const wh = new Webhook(CLERK_WEBHOOK_SIGNING_SECRET);
    evt = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkEvent;
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    const { type, data } = evt;
    if (type === "user.created" || type === "user.updated") {
      const email = pickEmail(data);
      const displayName = pickDisplayName(data);
      await prisma.user.upsert({
        where: { clerkId: data.id },
        update: { email, displayName },
        create: { clerkId: data.id, email, displayName },
      });
    } else if (type === "user.deleted" && data.id) {
      // Idempotent deletion saga: remove the user's R2 objects FIRST, then the
      // DB rows (cascade). If R2 deletion throws, we return non-2xx below so
      // Svix retries and data is never left half-deleted.
      const existing = await prisma.user.findUnique({
        where: { clerkId: data.id },
        select: { id: true },
      });
      if (existing) {
        await deleteObjectsForUser(existing.id);
        await prisma.user.delete({ where: { id: existing.id } });
      }
    }
  } catch {
    // Non-2xx so Svix retries.
    return new Response("Processing error", { status: 500 });
  }

  return new Response("ok", { status: 200 });
}
