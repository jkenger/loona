# syntax = docker/dockerfile:1

# Adjust NODE_VERSION as desired
ARG NODE_VERSION=22.21.1
FROM node:${NODE_VERSION}-slim AS base

LABEL fly_launch_runtime="Node.js"

# Node.js app lives here
WORKDIR /app

# Set production environment
ENV NODE_ENV="production"


# Throw-away build stage to reduce size of final image
FROM base AS build

# Install packages needed to build node modules
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential node-gyp pkg-config python-is-python3 && \
    rm -rf /var/lib/apt/lists/*

# Install node modules
COPY package-lock.json package.json ./
RUN npm ci --include=dev

# Copy application code
COPY . .

# Build the app only.
# NOTE: package.json's "build" script also runs `drizzle-kit migrate`, which needs
# DATABASE_URL. Fly secrets are not available during an image build, so migrations
# are run at container start instead (see CMD below).
RUN node --max-old-space-size=4096 ./node_modules/.bin/vite build

# Remove development dependencies
RUN npm prune --omit=dev


# Final stage for app image
FROM base

# Copy built application
COPY --from=build /app /app

# Migration runner, invoked once per deploy by release_command in fly.toml.
# Uses drizzle-orm's neon-http migrator (a production dependency), so it still
# works after `npm prune --omit=dev` removed drizzle-kit.
COPY <<'EOF' /app/docker-migrate.mjs
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { migrate } from 'drizzle-orm/neon-http/migrator'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is not set. Run: fly secrets set DATABASE_URL=...')
  process.exit(1)
}

await migrate(drizzle(neon(url)), { migrationsFolder: './drizzle' })
console.log('migrations up to date')
EOF

# Nitro reads PORT; keep this in sync with internal_port in fly.toml
ENV PORT=8080
EXPOSE 8080

# Migrations run via release_command in fly.toml, so they happen once per deploy
# instead of once per machine boot.
CMD [ "node", ".output/server/index.mjs" ]
