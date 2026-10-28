import "server-only";
import { load } from "@/lib/api";
import type { InstitutionContext } from "./types";

export const getInstitutionContexts = () =>
  load<{ institutions: InstitutionContext[] }>(
    "/api/v1/study/institutions",
  );
