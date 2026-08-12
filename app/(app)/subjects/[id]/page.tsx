// =============================================================================
// FILE: app/(app)/subjects/[id]/page.tsx   ->   web address: /subjects/<id>
// WHAT THIS FILE DOES:
//   One subject's detail page. The [id] in the folder name is a placeholder: it
//   means this single file serves /subjects/ANY-id, and the id is read from the
//   address to load that subject. It shows the subject's topics, the "Add topic"
//   dialog, delete menus, and a "Back to subjects" link. If the id is not the
//   user's own subject, it shows the not-found page.
// =============================================================================
import { permanentRedirect } from "next/navigation";

export default async function SubjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  permanentRedirect(`/library/subjects/${id}`);
}
