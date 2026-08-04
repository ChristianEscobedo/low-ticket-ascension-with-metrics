/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Keep the ffmpeg binaries as REAL external modules on Vercel. If they get
    // bundled/traced by nft, the platform binary inside @ffmpeg-installer is
    // dropped and spawn() ENOENTs — the exact bug this fixes. Marking them
    // external keeps node_modules/@ffmpeg-installer/<plat>-<arch>/ffmpeg on
    // disk in the serverless function, so the compose/caption-burn paths run
    // locally (honoring in-points) instead of silently falling back to fal.
    // NOTE: Next.js 14 uses `serverComponentsExternalPackages` (not the
    // Next.js 15 `serverExternalPackages` top-level key).
    serverComponentsExternalPackages: [
      '@ffmpeg-installer/ffmpeg',
      '@ffmpeg-installer/linux-x64',
      '@ffmpeg-installer/win32-x64',
    ],

    // Force-include the ffmpeg binary in the reel render/compose functions'
    // traced files so it PHYSICALLY ships to Vercel. nft bundling drops the
    // platform binary inside @ffmpeg-installer even when the package is marked
    // external, so spawn() ENOENTs and the compose silently falls back to fal.
    // Copying the linux-x64 binary into the function guarantees the local
    // compose (which honors in-points/preview) can actually run.
    outputFileTracingIncludes: {
      '/api/admin/brand-guide': ['./private/brand/**'],
      '/api/admin/mothermode-reel': [
        './node_modules/@ffmpeg-installer/linux-x64/**',
        './node_modules/.pnpm/@ffmpeg-installer+linux-x64*/node_modules/@ffmpeg-installer/linux-x64/**'
      ],
      '/api/admin/reel-render': [
        './node_modules/@ffmpeg-installer/linux-x64/**',
        './node_modules/.pnpm/@ffmpeg-installer+linux-x64*/node_modules/@ffmpeg-installer/linux-x64/**'
      ],
      '/api/admin/reel-loop': [
        './node_modules/@ffmpeg-installer/linux-x64/**',
        './node_modules/.pnpm/@ffmpeg-installer+linux-x64*/node_modules/@ffmpeg-installer/linux-x64/**'
      ]
    }
  }

};

export default nextConfig;


