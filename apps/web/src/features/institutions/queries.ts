import "server-only";
import { cache } from "react";
import { load } from "@/lib/api";
import type { InstitutionContext } from "./types";

// Cached per request: the workspace layout and the Institutions page both read
// these contexts, and they should cost one API call, not two.
export const getInstitutionContexts = cache(() =>
  load<{ institutions: InstitutionContext[] }>(
    "/api/v1/study/institutions",
  ),
);
