# This assumes the standard Vite project layout (package.json + index.html at
# the frontend root, with this src/ folder inside it) -- only src/ was shared
# with me, so double check paths against your actual folder structure.

# ---- Build stage ----
FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- Serve stage ----
FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
