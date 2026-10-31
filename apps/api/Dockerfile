FROM node:22-alpine
RUN corepack enable && corepack prepare pnpm@10.34.6 --activate
WORKDIR /repo
ENV HUSKY=0
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @spl/api prisma:generate && pnpm --filter @spl/api build
WORKDIR /repo/apps/api
ENV NODE_ENV=production
EXPOSE 3333
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && node dist/main.js"]
