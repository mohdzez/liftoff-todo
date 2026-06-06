# Single tiny Alpine image at the repo root — Liftoff's default service builds it
# directly (auto-detect finds this Dockerfile). Listens on $PORT (App Platform).
FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev && npm cache clean --force
COPY index.js ./
ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "index.js"]
