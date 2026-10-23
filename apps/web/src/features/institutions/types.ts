export interface InstitutionContext {
  institution: {
    id: string;
    name: string;
    slug: string;
    domain?: string;
    isVerified: boolean;
  };
  membership: {
    id: string;
    role: "university_admin" | "instructor" | "university_student";
    status: string;
    createdAt: string;
  };
}
