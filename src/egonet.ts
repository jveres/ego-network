// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

import {
  serve,
  ServerRequest,
} from "https://deno.land/std@0.74.0/http/server.ts";
import { Status } from "https://deno.land/std@0.74.0/http/http_status.ts";
import * as Colors from "https://deno.land/std@0.74.0/fmt/colors.ts";
import { EgoGraph, EgoGraphOptions } from "./egograph.ts";
import { Memoize } from "https://deno.land/x/deco@0.3.1/mod.ts";

const SERVER_HOST = "0.0.0.0";
const SERVER_PORT = Deno.env.get("PORT") ?? "8080";
const REDIS_URL = Deno.env.get("FLY_REDIS_CACHE_URL");
const ALLOWED_ORIGINS = ["https://ego.jveres.me"];
const CACHE_EXPIRATION_MS = 12 * 60 * 60 * 1000; // 12 hours

class EgoNet {
  private readonly responseHeaders = new Headers();

  constructor() {
    REDIS_URL && console.info(
      `${Colors.brightCyan("Redis")} is accessible at ${
        Colors.bold(Colors.underline((REDIS_URL)))
      }`,
    );
  }

  @Memoize({
    ttl: CACHE_EXPIRATION_MS,
    resolver: (options: EgoGraphOptions): string => {
      return `${options.query}#${options.depth ??
        EgoGraph.DEFAULT_GRAPH_DEPTH}#${options.pattern ??
        EgoGraph.DEFAULT_SEARCH_PATTERN}#${options.radius ??
        EgoGraph.DEFAULT_GRAPH_RADIUS}`;
    },
    onAdded: (key: string) => {
      console.log(`query="${Colors.bold(key.split("#")[0])}" added to cache`);
    },
    onFound: (key: string) => {
      console.log(
        `query="${Colors.bold(key.split("#")[0])}" served from cache`,
      );
    },
  })
  async graph(options: EgoGraphOptions): Promise<string> {
    const ego = new EgoGraph(
      { query: options.query, depth: options.depth, radius: options.radius },
    );
    await ego.build();
    this.responseHeaders.set("fly-cache-status", "MISS");
    return JSON.stringify(ego.toObject());
  }

  async handleQuery(
    req: ServerRequest,
    options: EgoGraphOptions,
  ): Promise<void> {
    console.log(`${Colors.brightGreen(req.method)} ${Colors.bold(req.url)}`);
    this.responseHeaders.set("fly-cache-status", "HIT");
    const graph: string = await this.graph(options);
    return req.respond({
      status: Status.OK,
      headers: this.responseHeaders,
      body: graph,
    });
  }

  async handleNotAcceptable(req: ServerRequest): Promise<void> {
    console.error(
      `${req.method} ${req.url} ${Colors.brightYellow("Not acceptable")}`,
    );
    return req.respond({
      status: Status.NotAcceptable,
      headers: this.responseHeaders,
      body: JSON.stringify({
        message: "Not acceptable",
      }),
    });
  }

  async handleNotFound(req: ServerRequest): Promise<void> {
    console.warn(
      `${req.method} ${req.url} ${Colors.brightYellow("Not Found")}`,
    );
    return req.respond({
      status: Status.NotFound,
      headers: this.responseHeaders,
      body: JSON.stringify({
        message: "Request not found",
      }),
    });
  }

  async handleError(req: ServerRequest, message: string): Promise<void> {
    console.error(`${req.method} ${req.url} ${Colors.brightRed(message)}`);
    return req.respond({
      status: Status.InternalServerError,
      headers: this.responseHeaders,
      body: JSON.stringify({
        message: "Internal server error",
        error: Colors.stripColor(message),
      }),
    });
  }

  async startServer() {
    const server = serve({ hostname: SERVER_HOST, port: Number(SERVER_PORT) });
    console.info(
      `${Colors.brightCyan("Server")} is running at ${
        Colors.bold(Colors.underline(SERVER_HOST + ":" + SERVER_PORT))
      }`,
    );
    for await (const req of server) {
      const origin = req.headers.get("origin");
      if (origin && ALLOWED_ORIGINS.indexOf(origin) !== -1) {
        this.responseHeaders.set("Access-Control-Allow-Origin", origin); // enable CORS
      }
      const host = req.headers.get("host");
      const params = new URLSearchParams(req.url.slice(1));
      if (
        host !== `localhost:${SERVER_PORT}` &&
        !this.responseHeaders.get("Access-Control-Allow-Origin")
      ) {
        this.handleNotAcceptable(req); // not local dev and missing or not allowed origin
      } else if (req.method === "GET" && params.get("q")) {
        this.handleQuery(req, {
          query: params.get("q") ?? "",
          ...params.get("d") && { depth: Number(params.get("d")) },
          ...params.get("r") && { radius: Number(params.get("r")) },
        })
          .catch(async ({ message }) => {
            try {
              await this.handleError(req, message);
            } catch (err) {
              console.error(err); // Issue with broken pipe (os error 32)
            }
          });
      } else {
        this.handleNotFound(req);
      }
    }
  }
}

new EgoNet().startServer();
