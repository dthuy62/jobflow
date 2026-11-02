# Build from the repo root: docker build -f backend/Dockerfile .
FROM node:22-slim@sha256:4b150b48b4116e2a22f2c39cc27025fbf4f153e2078fd3b14d159fdb5c7279da AS manifests
WORKDIR /app
# Every workspace's manifest must be present for `npm ci` to accept the shared lockfile.
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/contract/package.json packages/contract/
COPY packages/safety/package.json packages/safety/
COPY career-ops-wrapper/package.json career-ops-wrapper/
COPY backend/package.json backend/

FROM manifests AS build
RUN npm ci --ignore-scripts --no-audit --no-fund -w @jobflow/backend -w @jobflow/contract
COPY packages/contract packages/contract
COPY backend backend
RUN npm run build -w @jobflow/backend

# A separate install, because `npm prune` leaves development packages behind in a workspace.
FROM manifests AS production-deps
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund -w @jobflow/backend -w @jobflow/contract

FROM node:22-slim@sha256:4b150b48b4116e2a22f2c39cc27025fbf4f153e2078fd3b14d159fdb5c7279da
ENV NODE_ENV=production
# The API never installs anything, and npm's bundled packages would add their own vulnerabilities.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack
WORKDIR /app
COPY --from=production-deps /app/node_modules node_modules
COPY --from=build /app/packages/contract/package.json packages/contract/package.json
COPY --from=build /app/packages/contract/dist packages/contract/dist
COPY --from=build /app/backend/package.json backend/package.json
COPY --from=build /app/backend/dist backend/dist
COPY --from=build /app/backend/migrations backend/migrations
USER node
CMD ["node", "backend/dist/main.js"]
