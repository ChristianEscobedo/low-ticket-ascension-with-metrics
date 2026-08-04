/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // The confidential brand PDF lives in private/ (outside public/), so it is
    // not auto-traced. Force-include it in the brand-guide route's serverless
    // function so the runtime read succeeds on Vercel.
    // NOTE: the reel routes do NOT get ffmpeg-static tracing includes — tracing
    // a cookies()-using route forces a static-analysis pass that fails the build.
    // On Vercel the compose falls back to fal; thumbnails degrade to client-side.
    outputFileTracingIncludes: {
      '/api/admin/brand-guide': ['./private/brand/**']
    }
  }
};

export default nextConfig;
