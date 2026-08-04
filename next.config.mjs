/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep the ffmpeg binaries as REAL external modules on Vercel. If they get
  // bundled/traced by nft, the platform binary inside @ffmpeg-installer is
  // dropped and spawn() ENOENTs — the exact bug this fixes. Marking them
  // external keeps node_modules/@ffmpeg-installer/<plat>-<arch>/ffmpeg on disk
  // in the serverless function, so the compose/caption-burn paths run locally
  // (honoring in-points) instead of silently falling back to fal.
  serverExternalPackages: ['@ffmpeg-installer/ffmpeg', 'ffmpeg-static'],

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


