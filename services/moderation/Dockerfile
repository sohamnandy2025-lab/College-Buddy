FROM node:20-alpine
WORKDIR /srv
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
ENV PORT=8080 GOOGLE_APPLICATION_CREDENTIALS=/var/secrets/google/key.json
EXPOSE 8080
CMD ["npm","start"]
