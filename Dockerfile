FROM node:alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build


FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY --from=build /app/docker/nginx/conf.d /etc/nginx/conf.d
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
