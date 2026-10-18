/* eslint-disable import/first */
/**
 * AuthorizationGate Component Tests
 * Tests auth guard and admin redirect logic
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
// jest-dom is loaded via src/setupTests.js

// Mock the auth store
const mockStore = {
  isAuthenticated: false,
  initialized: true,
  token: null,
  sessionExpiry: null,
  user: null,
};
vi.mock("../store/authStore", () => ({
  __esModule: true,
  useAuthStore: (selector) =>
    typeof selector === "function" ? selector(mockStore) : mockStore,
}));
vi.mock("../services/api", () => ({
  __esModule: true,
}));
import AuthorizationGate from "../components/AuthorizationGate.jsx";
const renderWithRouter = (ui, { route = "/" } = {}) => {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/" element={ui} />
        <Route path="/login" element={<div>Login Page</div>} />
        <Route path="/dashboard" element={<div>Dashboard</div>} />
      </Routes>
    </MemoryRouter>,
  );
};
describe("AuthorizationGate", () => {
  afterEach(() => {
    mockStore.isAuthenticated = false;
    mockStore.token = null;
    mockStore.sessionExpiry = null;
    mockStore.user = null;
  });
  it("should redirect to login when not authenticated", () => {
    renderWithRouter(
      <AuthorizationGate>
        <div>Protected Content</div>
      </AuthorizationGate>,
    );
    expect(screen.getByText("Login Page")).toBeInTheDocument();
  });
  it("should render children when authenticated", () => {
    mockStore.isAuthenticated = true;
    mockStore.user = {
      role: "student",
    };
    renderWithRouter(
      <AuthorizationGate>
        <div>Protected Content</div>
      </AuthorizationGate>,
    );
    expect(screen.getByText("Protected Content")).toBeInTheDocument();
  });
  it("should redirect non-admin from admin route", () => {
    mockStore.isAuthenticated = true;
    mockStore.user = {
      role: "student",
    };
    renderWithRouter(
      <AuthorizationGate requireAdmin>
        <div>Admin Content</div>
      </AuthorizationGate>,
    );
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });
  it("should render admin content for admin users", () => {
    mockStore.isAuthenticated = true;
    mockStore.user = {
      role: "admin",
    };
    renderWithRouter(
      <AuthorizationGate requireAdmin>
        <div>Admin Content</div>
      </AuthorizationGate>,
    );
    expect(screen.getByText("Admin Content")).toBeInTheDocument();
  });
  it("allows verified students straight into protected pages", () => {
    mockStore.isAuthenticated = true;
    mockStore.user = { role: "student", isVerified: true };
    renderWithRouter(
      <AuthorizationGate requireStudent>
        <div>Student Content</div>
      </AuthorizationGate>,
    );
    expect(screen.getByText("Student Content")).toBeInTheDocument();
  });
});
