import { useState } from "react";
import { createRoot } from "react-dom/client";
import {
  CourseNardouch,
  refreshCourseNardouch,
} from "../../src/features/nardouch/course-growth";
import { passFixtureCheck } from "./actions.fixture";
import "../../src/app/globals.css";
function App() {
  const [course, setCourse] = useState("course-a");
  return (
    <main style={{ maxWidth: 760, margin: "32px auto", padding: 16 }}>
      <h1>Course companion browser fixture</h1>
      <button onClick={() => setCourse("course-a")}>Course A</button>{" "}
      <button onClick={() => setCourse("course-b")}>Course B</button>
      <CourseNardouch
        key={course}
        courseId={course}
        revisionId="revision"
        practiceHref="#checks"
      />
      <section id="checks">
        <button
          onClick={() => {
            passFixtureCheck(course);
            refreshCourseNardouch(course, "revision");
          }}
        >
          Accept reviewed check (test fixture)
        </button>
      </section>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
