// =============================================================================
// FILE: app/(app)/materials/[id]/page.tsx   ->   web address: /materials/<id>
// WHAT THIS FILE DOES:
//   One material's detail page (the [id] is the material's id, read from the
//   address). It shows the file viewer (using a secure short-lived link for
//   PDFs/images) and the AI tools as tabs: Summary, Quiz, and Chat. It also has
//   a "Back to materials" link and a delete option. Only the owner can open it.
// =============================================================================
import { permanentRedirect } from "next/navigation";

export default async function MaterialDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === "string") next.set(key, value);
    else value?.forEach((item) => next.append(key, item));
  }
  permanentRedirect(`/library/materials/${id}${next.size ? `?${next}` : ""}`);
}
