import path from "node:path";
export default {
  outputFileTracingRoot: path.resolve(process.cwd(), ".."),
  output: "standalone",
  devIndicators: false,
  experimental: { serverActions: { bodySizeLimit: "26mb" } },
  logging: { incomingRequests: false },
  transpilePackages: ["@study-partner/shared"],
  serverExternalPackages: ["mongodb", "nodemailer"],
  async redirects() {
    return [
      {
        source: "/subjects",
        destination: "/courses",
        permanent: false,
      },
      {
        source: "/subjects/:subjectId",
        destination: "/courses",
        permanent: false,
      },
      {
        source: "/upload-course",
        destination: "/courses/new",
        permanent: false,
      },
      {
        source: "/team-lobby",
        destination: "/study-together",
        permanent: false,
      },
      {
        source: "/session-setup",
        destination: "/sessions",
        permanent: false,
      },
      {
        source: "/competency",
        destination: "/progress",
        permanent: false,
      },
      {
        source: "/analytics",
        destination: "/progress",
        permanent: false,
      },
      {
        source: "/reviews",
        destination: "/practice",
        permanent: false,
      },
      {
        source: "/calendar",
        destination: "/planner",
        permanent: false,
      },
      {
        source: "/leaderboard",
        destination: "/progress",
        permanent: false,
      },
      {
        source: "/friends",
        destination: "/study-together",
        permanent: false,
      },
      {
        source: "/customize/wallpaper",
        destination: "/profile",
        permanent: false,
      },
      {
        source: "/customize/animated",
        destination: "/profile",
        permanent: false,
      },
      {
        source: "/pricing",
        destination: "/profile",
        permanent: false,
      },
      {
        source: "/checkout/success",
        destination: "/profile",
        permanent: false,
      },
      {
        source: "/checkout/cancel",
        destination: "/profile",
        permanent: false,
      },
      {
        source: "/admin/dashboard",
        destination: "/admin",
        permanent: false,
      },
      {
        source: "/admin/users",
        destination: "/admin",
        permanent: false,
      },
      {
        source: "/admin/analytics",
        destination: "/admin",
        permanent: false,
      },
      {
        source: "/admin/subscriptions",
        destination: "/admin",
        permanent: false,
      },
      {
        source: "/admin/coupons",
        destination: "/admin",
        permanent: false,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${process.env.BACKEND_URL || "http://localhost:3000"}/api/v1/:path*`,
      },
      {
        source: "/uploads/:path*",
        destination: `${process.env.BACKEND_URL || "http://localhost:3000"}/uploads/:path*`,
      },
    ];
  },
};
