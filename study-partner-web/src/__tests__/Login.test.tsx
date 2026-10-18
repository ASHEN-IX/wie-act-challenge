/* eslint-disable import/first */
/**
 * Login Page Tests
 * Tests form rendering, validation, and submit flow
 */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
// jest-dom is loaded via src/setupTests.js

// Mock auth API and store
const mockLogin = vi.fn();
const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("../services/api", () => ({
  authAPI: {
    login: vi.fn(),
  },
}));

vi.mock("../store/authStore", () => ({
  __esModule: true,
  useAuthStore: () => ({
    login: mockLogin,
    isAuthenticated: false,
  }),
}));

import Login from "../screens/Login.jsx";
import { authAPI } from "../services/api";

const renderLogin = () => {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>,
  );
};

describe("Login Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render login form", () => {
    renderLogin();

    expect(screen.getByPlaceholderText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it("should have a submit button", () => {
    renderLogin();
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0);
  });

  it("should call authAPI.login on form submit", async () => {
    authAPI.login.mockResolvedValue({
      data: {
        token: "jwt-token",
        refreshToken: "refresh-token",
        user: { _id: "u1", name: "Test", role: "student" },
      },
    });

    renderLogin();

    const emailInput = screen.getByPlaceholderText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);

    await userEvent.type(emailInput, "test@example.com");
    await userEvent.type(passwordInput, "Password123");

    const buttons = screen.getAllByRole("button");
    const submitBtn =
      buttons.find((b) => b.type === "submit") || buttons[buttons.length - 1];
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(authAPI.login).toHaveBeenCalled();
    });
  });

  it("should display error on failed login", async () => {
    authAPI.login.mockRejectedValue({
      response: { data: { error: "Invalid credentials" } },
    });

    renderLogin();

    const emailInput = screen.getByPlaceholderText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);

    await userEvent.type(emailInput, "wrong@example.com");
    await userEvent.type(passwordInput, "WrongPass");

    const buttons = screen.getAllByRole("button");
    const submitBtn =
      buttons.find((b) => b.type === "submit") || buttons[buttons.length - 1];
    fireEvent.click(submitBtn);

    await waitFor(() => {
      const errorEl = screen.queryByText(/invalid|error|failed/i);
      // Error should appear somewhere on the page (avoid direct DOM access)
      const alt =
        screen.queryByRole("alert") ||
        screen.queryByText(/invalid|error|failed/i);
      expect(errorEl || alt).toBeTruthy();
    });
  });
});
