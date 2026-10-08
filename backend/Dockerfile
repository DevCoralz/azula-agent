FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
      git curl ca-certificates python3 python3-pip build-essential jq unzip \
    && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
RUN useradd -m azula && mkdir -p /var/lib/azula/workspaces && chown -R azula /var/lib/azula
USER azula
EXPOSE 8000
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/index.js"]
