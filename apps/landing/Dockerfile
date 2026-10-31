FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@10.34.6 --activate
WORKDIR /repo
ENV HUSKY=0
ARG VITE_API_URL=https://splsolucoes.com/api
ENV VITE_API_URL=$VITE_API_URL
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @spl/landing build

FROM nginx:1.27-alpine
COPY apps/landing/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/landing/dist /usr/share/nginx/html
EXPOSE 80
