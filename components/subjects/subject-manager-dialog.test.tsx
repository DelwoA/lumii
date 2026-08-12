import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  SubjectManagerDialog,
  type ManagedSubject,
} from "./subject-manager-dialog";

const actions = vi.hoisted(() => ({
  createOrganizerSubject: vi.fn(),
  renameOrganizerSubject: vi.fn(),
  deleteOrganizerSubject: vi.fn(),
}));

vi.mock("@/app/(app)/subjects/actions", () => actions);

const physics: ManagedSubject = {
  id: "physics",
  name: "Introduction to Physics",
  color: "#2F6048",
  topicCount: 2,
  materialCount: 4,
  topics: [],
};

function renderManager(
  overrides?: Partial<React.ComponentProps<typeof SubjectManagerDialog>>,
) {
  const props = {
    subjects: [physics],
    selectedSubjectId: "physics",
    onCreated: vi.fn(),
    onRenamed: vi.fn(),
    onDeleted: vi.fn(),
    ...overrides,
  };
  render(<SubjectManagerDialog {...props} />);
  return props;
}

describe("SubjectManagerDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("makes existing-subject management explicit", async () => {
    const user = userEvent.setup();
    renderManager();

    await user.click(screen.getByRole("button", { name: "Manage Subjects" }));
    expect(
      screen.getByRole("heading", { name: "Manage Subjects" }),
    ).toBeVisible();
    expect(screen.getByText("Introduction to Physics")).toBeVisible();
    expect(screen.getByRole("button", { name: "Rename" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Delete" })).toBeVisible();
  });

  it("creates and selects a subject", async () => {
    actions.createOrganizerSubject.mockResolvedValue({
      ok: true,
      id: "biology",
      name: "Biology",
      topicCount: 0,
      materialCount: 0,
    });
    const user = userEvent.setup();
    const props = renderManager();

    await user.click(screen.getByRole("button", { name: "Manage Subjects" }));
    await user.type(screen.getByLabelText("New Subject"), "Biology");
    await user.click(screen.getByRole("button", { name: "Create & Select" }));

    expect(props.onCreated).toHaveBeenCalledWith(
      expect.objectContaining({ id: "biology", name: "Biology" }),
    );
  });

  it("confirms deletion with preservation details", async () => {
    actions.deleteOrganizerSubject.mockResolvedValue({
      ok: true,
      id: "physics",
      topicCount: 2,
      materialCount: 4,
    });
    const user = userEvent.setup();
    const props = renderManager();

    await user.click(screen.getByRole("button", { name: "Manage Subjects" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(
      screen.getByText(/4 materials are kept and moved to Needs Setup/),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Delete Subject" }));

    expect(props.onDeleted).toHaveBeenCalledWith("physics");
  });
});
