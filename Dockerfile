FROM node:22-bullseye

RUN apt-get update && apt-get install -y wget gnupg ca-certificates libglib2.0-0 libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 libxshmfence1 libxcb-dri3-0 --no-install-recommends && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files first
COPY package*.json ./

# Copy prisma schema so postinstall doesn't crash
COPY prisma ./prisma/

# Now safely run install
RUN npm ci

# Copy the rest of the application
COPY . .

RUN npx prisma generate
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
