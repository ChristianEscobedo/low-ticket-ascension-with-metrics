FROM node:20-bookworm

# Chromium + ffmpeg for Remotion's headless render + encoding
RUN apt-get update && apt-get install -y \
  chromium \
  ffmpeg \
  fonts-noto \
  fonts-noto-cjk \
  fonts-noto-color-emoji \
  && rm -rf /var/lib/apt/lists/*

# Remotion needs to know where Chromium is
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV CHROME_PATH=/usr/bin/chromium

WORKDIR /app

# Install deps first (layer cache)
COPY render-worker/package.json render-worker/package-lock.json* ./
RUN npm ci --omit=dev

# The worker source
COPY render-worker/ ./

# The composition it renders (shared with the Next.js preview — same component)
COPY remotion-project/ ./remotion-project/

EXPOSE 8080
CMD ["node", "server.js"]
