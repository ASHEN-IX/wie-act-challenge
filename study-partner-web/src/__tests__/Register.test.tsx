/* eslint-disable import/first */
/**
 * Register Page Tests
 * Tests form rendering, validation, and submit flow
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
// jest-dom is loaded via src/setupTests.js

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
    register: vi.fn(),
  },
}));

vi.mock("../store/authStore", () => ({
  __esModule: true,
  useAuthStore: () => ({
    login: mockLogin,
    isAuthenticated: false,
  }),
}));

import Register from "../screens/Register.jsx";
import { authAPI } from "../services/api";

const renderRegister = () => {
  return render(
    <MemoryRouter>
      <Register />
    </MemoryRouter>,
  );
};

describe("Register Page", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should render registration form fields", () => {
    renderRegister();

    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    // Should have at least two password fields (password + confirm)
    const passwordFields = screen.getAllByLabelText(/password/i);
    expect(passwordFields.length).toBeGreaterThanOrEqual(2);
  });

  it("should validate password match", async () => {
    renderRegister();
    const user = userEvent.setup();

    const nameInput = screen.getByLabelText(/name/i);
    const emailInput = screen.getByLabelText(/email/i);
    const passwordFields = screen.getAllByLabelText(/password/i);

    await user.type(nameInput, "Test User");
    await user.type(emailInput, "test@example.com");
    await user.type(passwordFields[0], "Password123!");
    await user.type(passwordFields[1], "DifferentPass!");

    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    });
    expect(authAPI.register).not.toHaveBeenCalled();
  });

  it("should call authAPI.register on valid submit", async () => {
    authAPI.register.mockResolvedValue({
      message: "Registration successful. Please verify your email to continue.",
      requiresVerification: true,
    });

    renderRegister();
    const user = userEvent.setup();

    const nameInput = screen.getByLabelText(/name/i);
    const emailInput = screen.getByLabelText(/email/i);
    const passwordFields = screen.getAllByLabelText(/password/i);

    await user.type(nameInput, "Test User");
    await user.type(emailInput, "test@example.com");
    await user.type(passwordFields[0], "Password123!");
    await user.type(passwordFields[1], "Password123!");

    await user.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() => {
      expect(screen.getByText(/learning profile/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() => {
      expect(screen.getByText(/preferences/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(authAPI.register).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        "/verify-email?email=test%40example.com",
      );
    });
  });
});
