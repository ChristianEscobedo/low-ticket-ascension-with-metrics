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

# Install deps first (layer cache). The build context IS render-worker/ (when
# Railway's Root Directory is set), so paths are relative to it — no
# render-worker/ prefix.
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# The worker source (includes remotion-project/ — copied in so it's self-contained)
COPY . ./



EXPOSE 8080
CMD ["node", "server.js"]
