/* eslint-disable import/first */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => vi.fn() };
});

vi.mock("../services/api", () => ({
  aiAPI: { ingestCourse: vi.fn() },
  courseAPI: { create: vi.fn(), addFiles: vi.fn(), list: vi.fn() },
  subjectAPI: { list: vi.fn(), create: vi.fn() },
  gamificationAPI: { awardXP: vi.fn() },
}));

vi.mock("../store/authStore", () => ({
  __esModule: true,
  useAuthStore: Object.assign(
    (sel) => {
      const s = { user: { _id: "u1", name: "Test" } };
      return sel ? sel(s) : s;
    },
    { getState: () => ({ user: { _id: "u1" } }) },
  ),
}));

vi.mock("../components/XPNotification", () => ({
  __esModule: true,
  default: () => <div data-testid="xp-notification" />,
}));

vi.mock("../components/LevelUpModal", () => ({
  __esModule: true,
  default: () => <div data-testid="level-up-modal" />,
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
    h1: React.forwardRef((p: any, r: any) => {
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
      return <h1 ref={r} {...rest} />;
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
    p: React.forwardRef((p: any, r: any) => {
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
      return <p ref={r} {...rest} />;
    }),
  },
  AnimatePresence: ({ children }) => <>{children}</>,
}));

import CourseUpload from "../screens/CourseUpload";
import { subjectAPI, courseAPI } from "../services/api";

const renderUpload = () =>
  render(
    <MemoryRouter>
      <CourseUpload />
    </MemoryRouter>,
  );

describe("CourseUpload Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    subjectAPI.list.mockResolvedValue({
      data: { subjects: [{ _id: "s1", name: "Math" }] },
    });
    courseAPI.list.mockResolvedValue({
      data: { courses: [] },
    });
  });

  it("loads existing subjects on mount", async () => {
    renderUpload();
    await waitFor(() => {
      expect(subjectAPI.list).toHaveBeenCalled();
    });
  });

  it("renders the upload heading", async () => {
    renderUpload();
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    });
  });

  it("renders course title input", async () => {
    renderUpload();
    await waitFor(() => {
      const inputs = screen.getAllByRole("textbox");
      expect(inputs.length).toBeGreaterThan(0);
    });
  });

  it("renders file input area", async () => {
    renderUpload();
    await waitFor(() => {
      expect(screen.getByText(/drop|browse|select|file/i)).toBeInTheDocument();
    });
  });
});
