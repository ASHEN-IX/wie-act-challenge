FROM node:24-alpine AS build
ENV CI=true
RUN apk add --no-cache curl && corepack enable && corepack prepare pnpm@11.3.0 --activate
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY study-partner-api/package.json ./study-partner-api/package.json
COPY study-partner-api/shared/package.json ./study-partner-api/shared/package.json
COPY study-partner-api/modules/auth/package.json ./study-partner-api/modules/auth/package.json
COPY study-partner-api/modules/user-profile/package.json ./study-partner-api/modules/user-profile/package.json
COPY study-partner-api/modules/study/package.json ./study-partner-api/modules/study/package.json
COPY study-partner-api/modules/ai-orchestrator/package.json ./study-partner-api/modules/ai-orchestrator/package.json
COPY study-partner-api/modules/signal-processing/package.json ./study-partner-api/modules/signal-processing/package.json
COPY study-partner-api/modules/analytics/package.json ./study-partner-api/modules/analytics/package.json
COPY study-partner-api/modules/notification/package.json ./study-partner-api/modules/notification/package.json
COPY study-partner-web/package.json ./study-partner-web/package.json
RUN --mount=type=cache,id=mindflow-pnpm,target=/pnpm/store pnpm install --network-concurrency=4 --store-dir /pnpm/store --frozen-lockfile --filter study-partner-api...
COPY study-partner-api ./study-partner-api
WORKDIR /app/study-partner-api
RUN pnpm build
WORKDIR /app
RUN --mount=type=cache,id=mindflow-pnpm,target=/pnpm/store pnpm install --network-concurrency=4 --store-dir /pnpm/store --frozen-lockfile --filter study-partner-api... --prod

FROM node:24-alpine
RUN apk add --no-cache curl
COPY --from=build --chown=node:node /app /app
WORKDIR /app/study-partner-api
RUN mkdir -p uploads logs && chown node:node uploads logs && rm -rf tests seeds ../study-partner-web
ENV NODE_ENV=production PORT=3000
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
