// =============================================================================
// FILE: app/(app)/subjects/page.tsx   ->   web address: /subjects
// WHAT THIS FILE DOES:
//   The Subjects page. It lists the student's subjects as cards (with a colour
//   dot and the topic/material counts), plus the "New subject" dialog and each
//   card's delete menu. Clicking a card opens that subject's detail page
//   (app/(app)/subjects/[id]/page.tsx).
// =============================================================================
import { permanentRedirect } from "next/navigation";

export default async function SubjectsPage() {
  permanentRedirect("/library?view=subjects");
}
