import React from "react";
import { createRoot } from "react-dom/client";
import { NardouchAssistant } from "../../src/features/nardouch/nardouch-assistant";
import "../../src/app/globals.css";
createRoot(document.getElementById("root")!).render(
  <main style={{ maxWidth: 720, margin: "32px auto", padding: 16 }}>
    <NardouchAssistant
      courseId={"a".repeat(24)}
      revisionId="rev_1"
      userId="browser-test"
    />
  </main>,
);
