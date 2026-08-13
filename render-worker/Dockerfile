# Node 22, not 20. @supabase/supabase-js requires a native global WebSocket for
# its realtime client; Node 20 has none, so `createClient` throws
# "Node.js detected but native WebSocket not found" at the storage-upload step —
# after the render has already finished. Node 22 ships WebSocket globally.
FROM node:22-bookworm


# Chromium + ffmpeg for Remotion's headless render + encoding.
# curl + yt-dlp for the hook-bank fetch-and-clip endpoint (download a social
# clip, probe it, sprite it). yt-dlp ships as a single static binary — no
# python needed.
RUN apt-get update && apt-get install -y \
  chromium \
  ffmpeg \
  curl \
  ca-certificates \
  fonts-noto \
  fonts-noto-cjk \
  fonts-noto-color-emoji \
  && rm -rf /var/lib/apt/lists/* \
  && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
       -o /usr/local/bin/yt-dlp \
  && chmod +x /usr/local/bin/yt-dlp

# Remotion needs to know where Chromium is
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV CHROME_PATH=/usr/bin/chromium
# Docker's default /dev/shm is 64MB. Chrome + the Remotion compositor will
# OOM-SIGKILL into it under a 1080p OffthreadVideo load. Prefer /tmp.
ENV PUPPETEER_DISABLE_DEV_SHM_USAGE=true
# Keep Node's own heap from competing with the compositor for the box's RAM.
ENV NODE_OPTIONS=--max-old-space-size=2048


WORKDIR /app

# Install deps first (layer cache). The build context IS render-worker/ (when
# Railway's Root Directory is set), so paths are relative to it — no
# render-worker/ prefix.
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# The worker source (includes remotion-project/ — copied in so it's self-contained)
COPY . ./



EXPOSE 8080
CMD ["node", "server.js"]
