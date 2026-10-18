import path from 'node:path';
export default {
  outputFileTracingRoot: path.resolve(process.cwd(), '..'),
  output: 'standalone',
  logging: { incomingRequests: false },
  transpilePackages: ['@study-partner/shared'],
  serverExternalPackages: ['mongodb', 'nodemailer'],
  async rewrites() {
    return [{ source: '/api/v1/:path*', destination: `${process.env.BACKEND_URL || 'http://localhost:3000'}/api/v1/:path*` },
      { source: '/uploads/:path*', destination: `${process.env.BACKEND_URL || 'http://localhost:3000'}/uploads/:path*` }];
  }
};
