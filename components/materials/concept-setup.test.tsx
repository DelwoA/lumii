import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ConceptSetup } from "./concept-setup";

const actions = vi.hoisted(() => ({
  proposeMaterialSetup: vi.fn(),
  confirmMaterialSetup: vi.fn(),
}));

vi.mock("@/app/(app)/materials/concept-actions", () => actions);

describe("ConceptSetup", () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  beforeEach(() => {
    actions.proposeMaterialSetup.mockReset();
    actions.confirmMaterialSetup.mockReset();
  });

  it("reviews an AI topic without persisting it, then hands confirmed data onward", async () => {
    actions.proposeMaterialSetup.mockResolvedValue({
      ok: true,
      proposal: {
        subject: { id: "subject-1", name: "Physics" },
        topic: { id: null, name: "Momentum", isExisting: false },
        concepts: [
          {
            name: "Impulse",
            description: "Relate force, time, and momentum change.",
            evidence: ["Impulse changes momentum."],
          },
        ],
      },
    });
    actions.confirmMaterialSetup.mockResolvedValue({
      ok: true,
      materialId: "material-1",
      topic: { id: "topic-1", name: "Momentum" },
      concepts: [
        {
          id: "concept-1",
          name: "Impulse",
          description: "Relate force, time, and momentum change.",
          status: "CONFIRMED",
          evidence: ["Impulse changes momentum."],
        },
      ],
    });
    const onConfirmed = vi.fn();
    const user = userEvent.setup();

    render(
      <ConceptSetup
        materialId="material-1"
        subjectName="Physics"
        topicName={null}
        initialConcepts={[]}
        onConfirmed={onConfirmed}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Analyze Material" }));
    expect(await screen.findByDisplayValue("Momentum")).toBeVisible();
    expect(actions.confirmMaterialSetup).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole("button", { name: "Confirm & Start Quick Quiz" }),
    );
    expect(onConfirmed).toHaveBeenCalledWith({
      topic: { id: "topic-1", name: "Momentum" },
      concepts: [expect.objectContaining({ id: "concept-1" })],
    });
  });
});
