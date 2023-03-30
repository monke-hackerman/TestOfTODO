FROM node:lts-alpine

WORKDIR /app

COPY package-lock.json /app
COPY package.json /app/

RUN npm i

COPY db.db /app/
COPY app.js /app/
COPY public /app/public

EXPOSE 3000

ENTRYPOINT [ "node", "app.js" ]
