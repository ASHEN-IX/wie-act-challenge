/* eslint-disable import/first */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("@/store/authStore", () => ({
  __esModule: true,
  useAuthStore: Object.assign(
    (sel) => {
      const s = { getTier: () => "normal", isTrialExpired: () => false };
      return sel ? sel(s) : s;
    },
    { getState: () => ({}) },
  ),
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
  },
  AnimatePresence: ({ children }) => <>{children}</>,
}));

import UpgradePrompt from "../UpgradePrompt";

describe("UpgradePrompt Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("is hidden by default", () => {
    const { container } = render(
      <MemoryRouter>
        <UpgradePrompt />
      </MemoryRouter>,
    );
    // Should not show the modal initially
    expect(screen.queryByText("Upgrade Required")).not.toBeInTheDocument();
  });

  it("shows when show prop is true", () => {
    render(
      <MemoryRouter>
        <UpgradePrompt show onClose={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getByText("Upgrade Required")).toBeInTheDocument();
  });

  it("shows tier upgrade button", () => {
    render(
      <MemoryRouter>
        <UpgradePrompt show onClose={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: /View Plans|Upgrade/i })).toBeInTheDocument();
  });

  it("closes when X is clicked", async () => {
    const onClose = vi.fn();
    render(
      <MemoryRouter>
        <UpgradePrompt show onClose={onClose} />
      </MemoryRouter>,
    );
    // Find close button (X icon button)
    const buttons = screen.getAllByRole("button");
    // First button should be the X close
    await userEvent.click(buttons[0]);
    expect(onClose).toHaveBeenCalled();
  });

  it("responds to custom tier-upgrade-required event", async () => {
    render(
      <MemoryRouter>
        <UpgradePrompt />
      </MemoryRouter>,
    );
    // Dispatch the custom event
    window.dispatchEvent(
      new CustomEvent("tier-upgrade-required", {
        detail: {
          code: "TIER_REQUIRED",
          requiredTier: "vip",
          currentTier: "normal",
        },
      }),
    );
    await waitFor(() => {
      expect(screen.getByText("Upgrade Required")).toBeInTheDocument();
    });
  });

  it("shows trial expired message", async () => {
    render(
      <MemoryRouter>
        <UpgradePrompt />
      </MemoryRouter>,
    );
    window.dispatchEvent(
      new CustomEvent("tier-upgrade-required", {
        detail: { code: "TRIAL_EXPIRED" },
      }),
    );
    await waitFor(() => {
      expect(screen.getByText("Your Trial Has Expired")).toBeInTheDocument();
    });
  });
});
