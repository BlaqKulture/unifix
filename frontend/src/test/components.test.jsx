import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { Pagination, PriorityTag, StatusBadge } from "../components/ui";
import Timeline from "../components/Timeline";
import RequestList from "../components/RequestList";
import { RequestForm } from "../pages/NewRequest";

describe("StatusBadge", () => {
  it.each([
    ["pending", "Pending"],
    ["in_progress", "In progress"],
    ["on_hold", "On hold"],
    ["completed", "Completed"],
  ])("shows a readable label for %s", (status, label) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});

describe("PriorityTag", () => {
  it("shows the priority name", () => {
    render(<PriorityTag priority="urgent" />);
    expect(screen.getByText("urgent")).toBeInTheDocument();
  });
});

describe("Pagination", () => {
  it("disables Previous on the first page and moves forward", async () => {
    const onChange = vi.fn();
    render(<Pagination page={1} pages={3} total={25} onChange={onChange} />);
    expect(screen.getByText(/Page 1 of 3/)).toBeInTheDocument();
    expect(screen.getByLabelText("Previous page")).toBeDisabled();
    await userEvent.click(screen.getByLabelText("Next page"));
    expect(onChange).toHaveBeenCalledWith(2);
  });
  it("shows a simple count when there is one page", () => {
    render(<Pagination page={1} pages={1} total={4} onChange={() => {}} />);
    expect(screen.getByText("4 results")).toBeInTheDocument();
  });
});

describe("Timeline", () => {
  it("lists every status change with comment and author", () => {
    const logs = [
      { id: 1, old_status: null, new_status: "pending", comment: "Request submitted", changed_by: { full_name: "Tunde Bakare" }, created_at: "2026-11-10T09:00:00Z" },
      { id: 2, old_status: "pending", new_status: "assigned", comment: "Assigned to Musa Ibrahim", changed_by: { full_name: "Grace Adebayo" }, created_at: "2026-11-10T10:00:00Z" },
    ];
    render(<Timeline logs={logs} />);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[1]).toHaveTextContent("Assigned");
    expect(items[1]).toHaveTextContent("Assigned to Musa Ibrahim");
    expect(items[1]).toHaveTextContent("Grace Adebayo");
  });
});

describe("RequestList", () => {
  it("links each request to its tracking page", () => {
    const items = [{
      id: 7, reference: "SR-2026-00007", title: "Broken projector", location: "LT2", priority: "high",
      status: "assigned", category: { name: "Classroom Equipment" }, requester: { full_name: "Ada" },
      assigned_officer: null, attachment_count: 0, updated_at: new Date().toISOString(),
    }];
    render(<MemoryRouter><RequestList items={items} showOfficer /></MemoryRouter>);
    const links = screen.getAllByRole("link", { name: /Broken projector/ });
    expect(links[0]).toHaveAttribute("href", "/requests/7");
    expect(screen.getAllByText("Not assigned").length).toBeGreaterThan(0);
  });
});

describe("RequestForm (service request submission)", () => {
  const categories = [{ id: 1, name: "Electricity" }, { id: 2, name: "Plumbing" }];

  it("shows validation messages and does not submit an empty form", async () => {
    const onSubmit = vi.fn();
    render(<RequestForm categories={categories} onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole("button", { name: "Submit request" }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/Give the problem a short title/)).toBeInTheDocument();
    expect(screen.getByText("Choose the type of problem.")).toBeInTheDocument();
    expect(screen.getByText("Say where the problem is.")).toBeInTheDocument();
  });

  it("submits the entered values", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<RequestForm categories={categories} onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText("What's wrong?"), "Leaking pipe in washroom");
    await userEvent.selectOptions(screen.getByLabelText("Type of problem"), "2");
    await userEvent.type(screen.getByLabelText("Where is it?"), "Hall 1");
    await userEvent.click(screen.getByText("urgent"));
    await userEvent.type(screen.getByLabelText("Describe the problem"), "Water everywhere on the floor");
    await userEvent.click(screen.getByRole("button", { name: "Submit request" }));
    expect(onSubmit).toHaveBeenCalledWith(
      { title: "Leaking pipe in washroom", category_id: 2, location: "Hall 1", priority: "urgent", description: "Water everywhere on the floor" },
      [],
    );
  });
});

// ---- Route protection (role-based access in the UI) ----
const authState = { user: null, loading: false };
vi.mock("../AuthContext", () => ({ useAuth: () => authState }));
const { default: ProtectedRoute } = await import("../components/ProtectedRoute");

function renderGuarded(roles) {
  return render(
    <MemoryRouter initialEntries={["/admin"]}>
      <Routes>
        <Route path="/login" element={<p>Login page</p>} />
        <Route path="/admin" element={<ProtectedRoute roles={roles}><p>Secret admin area</p></ProtectedRoute>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProtectedRoute", () => {
  it("redirects logged-out visitors to the login page", () => {
    authState.user = null;
    renderGuarded(["admin"]);
    expect(screen.getByText("Login page")).toBeInTheDocument();
  });
  it("blocks users without the required role", () => {
    authState.user = { role: "student" };
    renderGuarded(["admin"]);
    expect(screen.getByText(/don't have access/)).toBeInTheDocument();
    expect(screen.queryByText("Secret admin area")).not.toBeInTheDocument();
  });
  it("lets the right role through", () => {
    authState.user = { role: "admin" };
    renderGuarded(["admin"]);
    expect(screen.getByText("Secret admin area")).toBeInTheDocument();
  });
});
