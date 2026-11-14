// Login page integration test: real AuthProvider, fetch mocked.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "../AuthContext";
import { ToastProvider } from "../components/Toast";
import { LoginPage } from "../pages/AuthPages";

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<p>Dashboard home</p>} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

const jsonResponse = (status, body) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });

describe("LoginPage", () => {
  beforeEach(() => { globalThis.fetch = vi.fn(); });

  it("validates the form before calling the API", async () => {
    renderLogin();
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(screen.getByText("Enter your email address.")).toBeInTheDocument();
    expect(screen.getByText("Enter your password.")).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("shows the server's message when credentials are wrong", async () => {
    fetch.mockReturnValueOnce(jsonResponse(401, { error: "Invalid email or password." }));
    renderLogin();
    await userEvent.type(screen.getByLabelText("Email"), "student@unifix.edu.ng");
    await userEvent.type(screen.getByLabelText("Password"), "wrongpass1");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByText("Invalid email or password.")).toBeInTheDocument();
  });

  it("stores the token and opens the dashboard on success", async () => {
    fetch.mockReturnValueOnce(jsonResponse(200, {
      access_token: "jwt-token-123",
      user: { id: 1, full_name: "Tunde Bakare", role: "student" },
    }));
    renderLogin();
    await userEvent.type(screen.getByLabelText("Email"), "student@unifix.edu.ng");
    await userEvent.type(screen.getByLabelText("Password"), "Student1234");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByText("Dashboard home")).toBeInTheDocument();
    expect(localStorage.getItem("unifix_token")).toBe("jwt-token-123");
    const [url, options] = fetch.mock.calls[0];
    expect(url).toMatch(/\/api\/auth\/login$/);
    expect(JSON.parse(options.body)).toEqual({ email: "student@unifix.edu.ng", password: "Student1234" });
  });

  it("fills credentials from a demo account button", async () => {
    renderLogin();
    await userEvent.click(screen.getByRole("button", { name: "Admin" }));
    await waitFor(() => expect(screen.getByLabelText("Email")).toHaveValue("admin@unifix.edu.ng"));
  });
});
