FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@10.34.6 --activate
WORKDIR /repo
ENV HUSKY=0
ARG NEXT_PUBLIC_API_URL=http://localhost:3333
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @spl/hub build

FROM node:22-alpine
RUN corepack enable && corepack prepare pnpm@10.34.6 --activate
WORKDIR /repo
ENV HUSKY=0 NODE_ENV=production
COPY --from=build /repo /repo
WORKDIR /repo/apps/hub
EXPOSE 3000
CMD ["pnpm", "start"]
