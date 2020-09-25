FROM hayd/alpine-deno:1.4.1
EXPOSE 8080
WORKDIR /app
USER deno
COPY egonet.ts .
COPY node_modules ./node_modules
RUN deno cache --unstable egonet.ts
CMD ["run","--allow-net", "--unstable", "--allow-read", "--allow-env", "egonet.ts"]