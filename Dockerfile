FROM hayd/alpine-deno:1.4.2
EXPOSE 8080
WORKDIR /app
USER deno
COPY dist/egonet.js .
CMD ["run","--allow-net=0.0.0.0,suggestqueries.google.com", "--allow-env", "egonet.js"]