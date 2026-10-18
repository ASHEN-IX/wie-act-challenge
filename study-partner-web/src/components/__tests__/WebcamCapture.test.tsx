/* eslint-disable import/first */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";

// Mock CSS
vi.mock("../WebcamCapture.css", () => ({}));

// Mock getUserMedia
const mockGetUserMedia = vi.fn();
Object.defineProperty(global.navigator, "mediaDevices", {
  value: { getUserMedia: mockGetUserMedia },
  writable: true,
});

import WebcamCapture from "../WebcamCapture";

describe("WebcamCapture Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUserMedia.mockResolvedValue({
      getTracks: () => [{ stop: vi.fn() }],
    });
  });

  it("renders video element", () => {
    render(<WebcamCapture onFrameCapture={vi.fn()} enabled={false} />);
    expect(screen.getByTestId("webcam-video")).toBeInTheDocument();
  });

  it("renders canvas element", () => {
    render(<WebcamCapture onFrameCapture={vi.fn()} enabled={false} />);
    expect(screen.getByTestId("webcam-canvas")).toBeInTheDocument();
  });

  it("requests webcam when enabled", async () => {
    render(<WebcamCapture onFrameCapture={vi.fn()} enabled />);
    await waitFor(() => {
      expect(mockGetUserMedia).toHaveBeenCalledWith(
        expect.objectContaining({
          video: expect.any(Object),
        }),
      );
    });
  });

  it("does not request webcam when disabled", () => {
    render(<WebcamCapture onFrameCapture={vi.fn()} enabled={false} />);
    expect(mockGetUserMedia).not.toHaveBeenCalled();
  });

  it("shows error message when webcam access fails", async () => {
    mockGetUserMedia.mockRejectedValue(new Error("Permission denied"));
    render(<WebcamCapture onFrameCapture={vi.fn()} enabled />);
    await waitFor(() => {
      expect(
        screen.getByText(/unable to access webcam|camera/i),
      ).toBeInTheDocument();
    });
  });
});
