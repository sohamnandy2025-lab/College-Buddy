FROM node:20-alpine
WORKDIR /srv
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
ENV PORT=8080 ALGOLIA_APP_ID= ALGOLIA_API_KEY=
EXPOSE 8080
CMD ["npm","start"]
