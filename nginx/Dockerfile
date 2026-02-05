# ---------- Stage 1: build frontend ----------
FROM node:20-alpine AS build
WORKDIR /app
COPY ../frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---------- Stage 2: nginx ----------
FROM nginx:alpine
RUN apk add --no-cache ca-certificates
RUN rm /etc/nginx/nginx.conf
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY nginx/proxy_params.conf /etc/nginx/proxy_params.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80 443
CMD ["nginx", "-g", "daemon off;"]