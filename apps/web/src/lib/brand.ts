export const brand = {
  name: "Noveris",
  slogan: "Learn Together. Grow Further.",
  description:
    "The space for curious university minds. Study with your peers, get AI guidance, and turn every course into a shared breakthrough.",
} as const;

export const marketingNavigation = [
  { label: "Home", href: "#home" },
  { label: "Why Noveris", href: "#features" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Nardouch", href: "#nardouch" },
] as const;

export const stages = [
  {
    id: "baby",
    name: "Baby",
    description: "A fresh companion for every new course.",
    unlock: "Start a course",
  },
  {
    id: "learner",
    name: "Learner",
    description: "Your first lesson is complete. Curiosity becomes a habit.",
    unlock: "First lesson",
  },
  {
    id: "explorer",
    name: "Explorer",
    description: "At least 40% of the lessons completed. Keep exploring.",
    unlock: "40% of lessons",
  },
  {
    id: "expert",
    name: "Expert",
    description:
      "At least 75% of the lessons completed. Your Graduate cap is getting closer.",
    unlock: "75% of lessons",
  },
  {
    id: "graduate",
    name: "Graduate",
    description:
      "All lessons completed and every reviewed objective check passed. Celebrate together.",
    unlock: "Finish & pass checks",
  },
] as const;

export type Stage = (typeof stages)[number];
export type StageId = Stage["id"];

/** New 1254px transparent artwork, visually matched to each course stage. */
export const nardouchImage = (stage: StageId | "hero") =>
  `/images/nardouch-${stage}-transparent.png`;

export const features = [
  {
    title: "Study Circles",
    copy: "Study together, exchange ideas, and solve problems as a team.",
  },
  {
    title: "AI Learning Guide",
    copy: "Get personalized explanations, practice, and guidance when you need it.",
  },
  {
    title: "Course Resources",
    copy: "Organize notes, slides, exercises, and shared learning materials.",
  },
  {
    title: "Track Your Progress",
    copy: "Review your goals and understand where your knowledge is growing.",
  },
] as const;

export const howItWorks = [
  {
    id: "01",
    title: "Set Up Your Space",
    copy: "Add your subjects, courses, and learning goals.",
  },
  {
    id: "02",
    title: "Learn & Collaborate",
    copy: "Join study circles, discuss ideas, and help one another learn.",
  },
  {
    id: "03",
    title: "Track & Grow",
    copy: "Complete courses, strengthen skills, and graduate with Nardouch.",
  },
] as const;
