FROM node:24-alpine AS build
RUN corepack enable && corepack prepare pnpm@11.3.0 --activate
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/api/modules/auth/package.json ./apps/api/modules/auth/package.json
COPY apps/api/modules/user-profile/package.json ./apps/api/modules/user-profile/package.json
COPY apps/api/modules/study/package.json ./apps/api/modules/study/package.json
COPY apps/api/modules/ai-orchestrator/package.json ./apps/api/modules/ai-orchestrator/package.json
COPY apps/api/modules/signal-processing/package.json ./apps/api/modules/signal-processing/package.json
COPY apps/api/modules/analytics/package.json ./apps/api/modules/analytics/package.json
COPY apps/api/modules/notification/package.json ./apps/api/modules/notification/package.json
COPY apps/api/shared/package.json ./apps/api/shared/package.json
COPY apps/web/package.json ./apps/web/package.json
# The web strict check also checks the real API-backed browser launchers. Keep
# their owning API sources/dependencies in the builder; standalone tracing still
# determines the runtime image contents.
RUN --mount=type=cache,id=mindflow-pnpm,target=/pnpm/store pnpm install --network-concurrency=4 --store-dir /pnpm/store --frozen-lockfile --filter web... --filter api...
COPY apps/api ./apps/api
COPY apps/web ./apps/web
ARG BACKEND_URL=http://app:3000
ENV BACKEND_URL=$BACKEND_URL
RUN pnpm --filter web build
FROM node:24-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache curl
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public
ENV NODE_ENV=production PORT=5173 HOSTNAME=0.0.0.0
USER node
EXPOSE 5173
CMD ["node", "apps/web/server.js"]
