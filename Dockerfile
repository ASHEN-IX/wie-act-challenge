FROM node:24-alpine AS build
ENV CI=true
RUN apk add --no-cache curl && corepack enable && corepack prepare pnpm@11.3.0 --activate
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/api/shared/package.json ./apps/api/shared/package.json
COPY apps/api/modules/auth/package.json ./apps/api/modules/auth/package.json
COPY apps/api/modules/user-profile/package.json ./apps/api/modules/user-profile/package.json
COPY apps/api/modules/study/package.json ./apps/api/modules/study/package.json
COPY apps/api/modules/ai-orchestrator/package.json ./apps/api/modules/ai-orchestrator/package.json
COPY apps/api/modules/signal-processing/package.json ./apps/api/modules/signal-processing/package.json
COPY apps/api/modules/analytics/package.json ./apps/api/modules/analytics/package.json
COPY apps/api/modules/notification/package.json ./apps/api/modules/notification/package.json
COPY apps/web/package.json ./apps/web/package.json
RUN --mount=type=cache,id=mindflow-pnpm,target=/pnpm/store pnpm install --network-concurrency=4 --store-dir /pnpm/store --frozen-lockfile --filter api...
COPY apps/api ./apps/api
WORKDIR /app/apps/api
RUN pnpm build
WORKDIR /app
RUN --mount=type=cache,id=mindflow-pnpm,target=/pnpm/store pnpm install --network-concurrency=4 --store-dir /pnpm/store --frozen-lockfile --filter api... --prod

FROM node:24-alpine
RUN apk add --no-cache curl
COPY --from=build --chown=node:node /app /app
WORKDIR /app/apps/api
RUN mkdir -p uploads logs && chown node:node uploads logs && rm -rf tests seeds ../web
ENV NODE_ENV=production PORT=3000
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
