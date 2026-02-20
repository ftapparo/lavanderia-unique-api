FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./

RUN npm install && \
    npm cache clean --force

COPY src ./src

RUN npm run build

FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --only=production && \
    npm cache clean --force

COPY --from=builder /app/dist ./dist

RUN mkdir -p logs storage/app-data

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "dist/server.js"]
