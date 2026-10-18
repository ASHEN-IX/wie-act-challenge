/* eslint-disable import/first */
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const mockUser = vi.hoisted(() => ({ _id: "u1", name: "Test", role: "student" }));

vi.mock("@/context/ThemeContext", () => ({
  useTheme: () => ({ theme: "dark", toggleTheme: vi.fn() }),
}));

vi.mock("@/store/authStore", () => ({
  __esModule: true,
  useAuthStore: Object.assign(
    (sel) => {
      const s = {
        user: mockUser,
        logout: vi.fn(),
        getTier: () => "vip",
        hasTierPermission: () => true,
      };
      return sel ? sel(s) : s;
    },
    { getState: () => ({ user: { _id: "u1" }, getTier: () => "vip" }) },
  ),
}));

vi.mock("@/services/api", () => ({
  profileAPI: {
    get: vi
      .fn()
      .mockResolvedValue({ data: { profile: { level: 5, xp: 450 } } }),
  },
}));

vi.mock("../NotificationBell", () => ({
  __esModule: true,
  default: () => <div data-testid="notification-bell">Bell</div>,
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: React.forwardRef((p: any, r: any) => {
      const {
        initial,
        animate,
        exit,
        whileHover,
        whileTap,
        variants,
        transition,
        ...rest
      } = p;
      return <div ref={r} {...rest} />;
    }),
    nav: React.forwardRef((p: any, r: any) => {
      const {
        initial,
        animate,
        exit,
        whileHover,
        whileTap,
        variants,
        transition,
        ...rest
      } = p;
      return <nav ref={r} {...rest} />;
    }),
    button: React.forwardRef((p: any, r: any) => {
      const {
        initial,
        animate,
        exit,
        whileHover,
        whileTap,
        variants,
        transition,
        ...rest
      } = p;
      return <button ref={r} {...rest} />;
    }),
    span: React.forwardRef((p: any, r: any) => {
      const {
        initial,
        animate,
        exit,
        whileHover,
        whileTap,
        variants,
        transition,
        ...rest
      } = p;
      return <span ref={r} {...rest} />;
    }),
  },
  AnimatePresence: ({ children }) => <>{children}</>,
}));

import Navbar from "../Navbar";

const renderNavbar = () => {
  const result = render(
    <MemoryRouter>
      <Navbar />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
  return result;
};

describe("Navbar Component", () => {
  it("renders nav links", async () => {
    renderNavbar();
    expect(await screen.findByText("Dashboard")).toBeInTheDocument();
    expect(await screen.findByText("Subjects")).toBeInTheDocument();
    expect(await screen.findByText("Tasks")).toBeInTheDocument();
  });

  it("renders Friends nav item", async () => {
    renderNavbar();
    await waitFor(() => {
      expect(screen.getByText("Friends")).toBeInTheDocument();
    });
  });

  it("renders Search nav item", async () => {
    renderNavbar();
    await waitFor(() => {
      expect(screen.getByText("Search")).toBeInTheDocument();
    });
  });

  it("renders notification bell", async () => {
    renderNavbar();
    await waitFor(() => {
      expect(screen.getByTestId("notification-bell")).toBeInTheDocument();
    });
  });

  it("shows tier badge", async () => {
    renderNavbar();
    await waitFor(() => {
      expect(screen.getByText("VIP")).toBeInTheDocument();
    });
  });

  it("hides nav items when minimal", async () => {
    render(
      <MemoryRouter>
        <Navbar minimal />
      </MemoryRouter>,
    );
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
  });
});
