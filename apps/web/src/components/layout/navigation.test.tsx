import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("next/navigation", () => ({ usePathname: () => "/courses" }));
import { Navigation } from "./navigation";
describe("role-specific navigation", () => {
  it("gives instructors courses and teaching tools without learner links", () => {
    const html = renderToStaticMarkup(<Navigation instructor />);
    expect(html).toContain("My courses");
    expect(html).not.toContain("/study-together");
    expect(html).toContain("Instructor insights");
    for (const label of [
      "My Learning",
      "Study Together",
      "Study plan",
      "Practice",
      "Progress",
    ])
      expect(html).not.toContain(`>${label}<`);
  });
  it("keeps learner navigation and does not grant teaching links by default", () => {
    const html = renderToStaticMarkup(<Navigation />);
    expect(html).toContain("My Learning");
    expect(html).toContain("Study Together");
    expect(html).not.toContain("Instructor insights");
  });
  it("keeps practice inside the course and out of the sidebar", () => {
    const html = renderToStaticMarkup(<Navigation />);
    expect(html).not.toContain(">Practice<");
    expect(html).not.toContain("Binary search demo");
    expect(html).not.toContain('href="/practice"');
    // Standalone helpers stay reachable under More tools.
    for (const label of ["Visual Lab", "Tasks", "Study plan"])
      expect(html).toContain(`>${label}<`);
  });
});
