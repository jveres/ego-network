FROM hayd/alpine-deno:1.4.2
EXPOSE 8080
WORKDIR /app
USER deno
COPY egonet.ts .
COPY node_modules ./node_modules
RUN deno cache --unstable egonet.ts
CMD ["run","--allow-net=0.0.0.0,suggestqueries.google.com", "--unstable", "--allow-read", "--allow-env", "egonet.ts"]