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
WORKDIR /repo
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
COPY --from=build /repo /repo
WORKDIR /repo/apps/hub
RUN cp -a public .next/standalone/apps/hub/public && cp -a .next/static .next/standalone/apps/hub/.next/static
EXPOSE 3000
CMD ["node", ".next/standalone/apps/hub/server.js"]
