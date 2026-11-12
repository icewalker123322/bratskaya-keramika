FROM node:24-alpine
WORKDIR /app
COPY package.json server.mjs ./
COPY public ./public
COPY data/default.json ./data/default.json
ENV HOST=0.0.0.0 PORT=8080 DATA_DIR=/storage/data UPLOADS_DIR=/storage/uploads COOKIE_SECURE=1
EXPOSE 8080
CMD ["node", "server.mjs"]
