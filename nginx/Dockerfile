# ---------- Stage 1: build frontend ----------
FROM node:25-alpine AS build
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
# Compress once here so nginx serves the .gz (gzip_static) instead of
# compressing the same bundle on every request. Tiny files aren't worth it.
RUN npm run build \
    && find dist -type f -size +1k \
      \( -name '*.js' -o -name '*.css' -o -name '*.html' -o -name '*.svg' \) \
      -exec gzip -9 -k {} +

# ---------- Stage 2: nginx ----------
# Pinned so a rebuild never silently changes the web server version
FROM nginx:1.31-alpine
RUN rm /etc/nginx/nginx.conf /etc/nginx/conf.d/default.conf
COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY nginx/proxy_params.conf /etc/nginx/proxy_params.conf
COPY nginx/security_headers.conf /etc/nginx/security_headers.conf
COPY nginx/templates /etc/nginx/templates
# Production rate limits, per client IP; see templates/
# The auth rate covers login and register together. Flask's own limits are
# tighter per account; this one only has to stop a single address flooding.
ENV NGINX_AUTH_RATE=20r/m NGINX_API_RATE=30r/s
# docker-compose.yml sets the real domain; localhost serves the test stack.
ENV NGINX_SERVER_NAME=localhost
# Only NGINX_* variables are substituted into templates/, so no other
# environment variable can leak into the config.
ENV NGINX_ENVSUBST_FILTER=^NGINX_
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80 443
CMD ["nginx", "-g", "daemon off;"]