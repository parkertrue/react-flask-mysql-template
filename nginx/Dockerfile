# ---------- Stage 1: build frontend ----------
FROM node:20-alpine AS build
WORKDIR /app
COPY ../frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# ---------- Stage 2: nginx ----------
FROM nginx:alpine
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
