// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

import {
  serve,
  ServerRequest,
} from "https://deno.land/std@0.71.0/http/server.ts";
import { Status } from "https://deno.land/std@0.71.0/http/http_status.ts";
import { EgoGraph, EgoGraphOptions } from "./egograph.ts";

const SERVER_HOST = "0.0.0.0";
const SERVER_PORT = Deno.env.get("PORT") ?? "8080";
const ALLOWED_ORIGINS = ["https://ego.jveres.me"];
const MAX_CACHE_CAPACITY = 500;
const CACHE_EXPIRATION_MS = 3 * 60 * 60 * 1000; // 3 hours
const httpCache = new Map<string, Cache>();

interface Cache {
  date: number;
  value: string;
}

const responseHeaders = new Headers();
responseHeaders.set("Access-Control-Allow-Origin", "https://ego.jveres.me"); // enable CORS

const handleQuery = async (
  req: ServerRequest,
  options: EgoGraphOptions,
): Promise<void> => {
  console.log(`${req.method} ${req.url}`);
  const cacheKey = `${options.query}#${options.depth ??
    EgoGraph.DEFAULT_GRAPH_DEPTH}#${options.pattern ??
    EgoGraph.DEFAULT_SEARCH_PATTERN}#${options.radius ??
    EgoGraph.DEFAULT_GRAPH_RADIUS}`;
  let cache = httpCache.get(cacheKey);
  if (!(cache && (Date.now() - cache.date) < CACHE_EXPIRATION_MS)) { // not found in cache or expired
    const ego = new EgoGraph(
      { query: options.query, depth: options.depth, radius: options.radius },
    );
    await ego.build();
    console.info(
      `${req.method} ${req.url} ${
        cache ? "Refreshed in cache" : "Cached"
      } at ${httpCache.size}`,
    );
    cache = { date: Date.now(), value: JSON.stringify(ego.toObject()) };
    httpCache.set(cacheKey, cache);
    if (httpCache.size > MAX_CACHE_CAPACITY) {
      httpCache.delete(httpCache.keys().next().value); // rotate cache
    }
    responseHeaders.set("fly-cache-status", "MISS");
  } else {
    console.info(`${req.method} ${req.url} Found in cache`);
    responseHeaders.set("fly-cache-status", "HIT");
  }
  return req.respond({
    status: Status.OK,
    headers: responseHeaders,
    body: cache.value,
  });
};

const handleNotAcceptable = async (
  req: ServerRequest,
): Promise<void> => {
  console.error(`${req.method} ${req.url} Not acceptable`);
  return req.respond({
    status: Status.NotAcceptable,
    headers: responseHeaders,
    body: JSON.stringify({
      message: "Not acceptable",
    }),
  });
};

const handleNotFound = async (req: ServerRequest): Promise<void> => {
  console.warn(`${req.method} ${req.url} Not Found`);
  return req.respond({
    status: Status.NotFound,
    headers: responseHeaders,
    body: JSON.stringify({
      message: "Request not found",
    }),
  });
};

const handleError = async (
  req: ServerRequest,
  message: string,
): Promise<void> => {
  console.error(`${req.method} ${req.url} ${message}`);
  return req.respond({
    status: Status.InternalServerError,
    headers: responseHeaders,
    body: JSON.stringify({
      message: "Internal server error",
      error: message,
    }),
  });
};

const server = serve({ hostname: SERVER_HOST, port: Number(SERVER_PORT) });
console.log(`server is running at ${SERVER_HOST}:${SERVER_PORT}`);

(async () => {
  for await (const req of server) {
    const origin = req.headers.get("origin");
    const host = req.headers.get("host");
    const params = new URLSearchParams(req.url.slice(1));
    if (
      host !== `localhost:${SERVER_PORT}` &&
      (!origin || ALLOWED_ORIGINS.indexOf(origin) === -1)
    ) {
      handleNotAcceptable(req); // not local dev and missing or not allowed origin
    } else if (req.method === "GET" && params.get("q")) {
      handleQuery(req, {
        query: params.get("q") ?? "",
        ...params.get("d") && { depth: Number(params.get("d")) },
        ...params.get("r") && { radius: Number(params.get("r")) },
      })
        .catch(async ({ message }) => {
          try {
            await handleError(req, message);
          } catch (err) {
            console.error(err); // Issue with broken pipe (os error 32)
          }
        });
    } else {
      handleNotFound(req);
    }
  }
})();
