FROM jveres/alpine-deno:latest
EXPOSE 8080
COPY dist/egonet.js .
CMD ["deno", "run", "--allow-net=0.0.0.0,suggestqueries.google.com", "--allow-env", "egonet.js"]