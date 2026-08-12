// =============================================================================
// FILE: app/(app)/materials/page.tsx   ->   web address: /materials
// WHAT THIS FILE DOES:
//   The Materials library. It shows the student's uploaded items as a grid of
//   cards (with an icon per type and a status badge) and the upload dialog.
//   Clicking a card opens that material's detail page
//   (app/(app)/materials/[id]/page.tsx) with the Summary / Quiz / Chat tabs.
// =============================================================================
import { permanentRedirect } from "next/navigation";

export default async function MaterialsPage() {
  permanentRedirect("/library");
}
