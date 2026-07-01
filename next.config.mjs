/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // The confidential brand PDF lives in private/ (outside public/), so it is
    // not auto-traced. Force-include it in the brand-guide route's serverless
    // function so the runtime read succeeds on Vercel.
    outputFileTracingIncludes: {
      '/api/admin/brand-guide': ['./private/brand/**']
    }
  }
};

export default nextConfig;
