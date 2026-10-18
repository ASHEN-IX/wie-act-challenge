FROM node:24-alpine AS build
RUN corepack enable && corepack prepare pnpm@11.3.0 --activate
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY study-partner-api/package.json ./study-partner-api/package.json
COPY study-partner-api/modules/auth/package.json ./study-partner-api/modules/auth/package.json
COPY study-partner-api/modules/user-profile/package.json ./study-partner-api/modules/user-profile/package.json
COPY study-partner-api/modules/study/package.json ./study-partner-api/modules/study/package.json
COPY study-partner-api/modules/ai-orchestrator/package.json ./study-partner-api/modules/ai-orchestrator/package.json
COPY study-partner-api/modules/signal-processing/package.json ./study-partner-api/modules/signal-processing/package.json
COPY study-partner-api/modules/analytics/package.json ./study-partner-api/modules/analytics/package.json
COPY study-partner-api/modules/notification/package.json ./study-partner-api/modules/notification/package.json
COPY study-partner-api/shared/package.json ./study-partner-api/shared/package.json
COPY study-partner-web/package.json ./study-partner-web/package.json
RUN --mount=type=cache,id=mindflow-pnpm,target=/pnpm/store pnpm install --network-concurrency=4 --store-dir /pnpm/store --frozen-lockfile --filter study-partner-web...
COPY study-partner-api/shared ./study-partner-api/shared
COPY study-partner-web ./study-partner-web
ARG BACKEND_URL=http://app:3000
ENV BACKEND_URL=$BACKEND_URL
RUN pnpm --filter study-partner-web build
FROM node:24-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache curl
COPY --from=build --chown=node:node /app/study-partner-web/.next/standalone ./
COPY --from=build --chown=node:node /app/study-partner-web/.next/static ./study-partner-web/.next/static
COPY --from=build --chown=node:node /app/study-partner-web/public ./study-partner-web/public
ENV NODE_ENV=production PORT=5173 HOSTNAME=0.0.0.0
USER node
EXPOSE 5173
CMD ["node", "study-partner-web/server.js"]
