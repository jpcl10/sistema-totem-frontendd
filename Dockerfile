FROM node:22-bookworm-slim AS deps

WORKDIR /app

ARG BUN_VERSION=1.3.14

RUN npm install --global "bun@${BUN_VERSION}"

COPY package.json bun.lock bunfig.toml ./

RUN bun install --frozen-lockfile

FROM deps AS build

ARG VITE_API_URL
ARG VITE_SOCKET_URL
ARG VITE_APP_URL

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL
ENV VITE_APP_URL=$VITE_APP_URL

COPY . .

RUN bun run build

FROM nginx:alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["wget", "--quiet", "--tries=1", "--spider", "http://127.0.0.1/health"]

CMD ["nginx", "-g", "daemon off;"]
