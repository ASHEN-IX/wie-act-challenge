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
    description: "Your very first day with a new subject.",
    unlock: "New subject",
  },
  {
    id: "learner",
    name: "Learner",
    description: "The first course is done. Curiosity becomes a habit.",
    unlock: "First course",
  },
  {
    id: "explorer",
    name: "Explorer",
    description: "More courses, more questions, more to discover.",
    unlock: "Making progress",
  },
  {
    id: "expert",
    name: "Expert",
    description: "Most courses completed. Your companion is ready for anything.",
    unlock: "Nearly there",
  },
  {
    id: "graduate",
    name: "Graduate",
    description: "You finished every course in this subject. Celebrate it.",
    unlock: "Subject complete",
  },
] as const;

export type Stage = (typeof stages)[number];
export type StageId = Stage["id"];

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
