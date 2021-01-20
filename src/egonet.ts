// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

import {
  Response,
  serve,
  ServerRequest,
} from "https://deno.land/std@0.82.0/http/server.ts";
import { Status } from "https://deno.land/std@0.82.0/http/http_status.ts";
import * as Colors from "https://deno.land/std@0.82.0/fmt/colors.ts";
import { EgoGraph, EgoGraphOptions } from "./egograph.ts";
import { Memoize, RateLimit, Try } from "https://deno.land/x/deco@0.4.7/mod.ts";

const SERVER_HOST = "0.0.0.0";
const SERVER_PORT = Deno.env.get("PORT") ?? "8080";
const ALLOWED_ORIGINS = ["https://ego.jveres.me"];
const CACHE_EXPIRATION_MS = 12 * 60 * 60 * 1000; // 12 hours
const MAX_QUERY_RPS = 50; // 50 Requests Per Second

class EgoNet {
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
    return JSON.stringify(ego.toObject());
  }

  @Try({
    catch: ["BrokenPipe"],
    log: true,
  })
  respond(req: ServerRequest, r: Response): Promise<void> {
    return req.respond(r);
  }

  @RateLimit({ rate: MAX_QUERY_RPS })
  async handleQuery(
    req: ServerRequest,
    options: EgoGraphOptions,
    headers: Headers,
  ): Promise<void> {
    console.log(`${Colors.brightGreen(req.method)} ${Colors.bold(req.url)}`);
    const graph: string = await this.graph(options);
    headers.set(
      "Cache-Control",
      `public, max-age=${CACHE_EXPIRATION_MS / 1000}`,
    );
    headers.set("Date", new Date().toUTCString());
    headers.set("Content-Type", "application/json");
    return this.respond(req, {
      status: Status.OK,
      headers,
      body: graph,
    });
  }

  handleNotAcceptable(
    req: ServerRequest,
    headers: Headers,
  ): Promise<void> {
    console.error(
      `${req.method} ${req.url} ${Colors.brightYellow("Not acceptable")}`,
    );
    return this.respond(req, {
      status: Status.NotAcceptable,
      headers,
      body: JSON.stringify({
        message: "Not Acceptable",
      }),
    });
  }

  handleNotFound(req: ServerRequest, headers: Headers): Promise<void> {
    console.warn(
      `${req.method} ${req.url} ${Colors.brightYellow("Not Found")}`,
    );
    return this.respond(req, {
      status: Status.NotFound,
      headers,
      body: JSON.stringify({
        message: "Request Not Found",
      }),
    });
  }

  handleError(
    req: ServerRequest,
    message: string,
    headers: Headers,
  ): Promise<void> {
    console.error(`${req.method} ${req.url} ${Colors.brightRed(message)}`);
    return this.respond(req, {
      status: Status.InternalServerError,
      headers,
      body: JSON.stringify({
        message: "Internal server error",
        error: Colors.stripColor(message),
      }),
    });
  }

  @Try({
    log: true,
  })
  async startServer(): Promise<void> {
    const server = serve({ hostname: SERVER_HOST, port: Number(SERVER_PORT) });
    console.info(
      `${Colors.brightBlue("Server")} is running at ${
        Colors.bold(Colors.underline(SERVER_HOST + ":" + SERVER_PORT))
      }`,
    );
    console.info(
      `Deno: ${Colors.brightGreen(Deno.version.deno)} · V8: ${
        Colors.brightGreen(Deno.version.v8)
      } · TypeScript: ${Colors.brightGreen(Deno.version.typescript)}`,
    );
    for await (const req of server) {
      const origin = req.headers.get("origin");
      const headers = new Headers();
      if (origin && ALLOWED_ORIGINS.includes(origin)) {
        headers.set("Access-Control-Allow-Origin", origin); // enable CORS
      }
      const host = req.headers.get("host");
      const params = new URLSearchParams(req.url.slice(1));
      if (
        (host &&
          ![`localhost:${SERVER_PORT}`, `host.docker.internal:${SERVER_PORT}`]
            .includes(host)) &&
        !headers.get("Access-Control-Allow-Origin")
      ) {
        this.handleNotAcceptable(req, headers); // not local dev and missing or not allowed origin
      } else if (req.method === "GET" && params.get("q")) {
        this.handleQuery(req, {
          query: params.get("q") ?? "",
          ...params.get("d") && { depth: Number(params.get("d")) },
          ...params.get("r") && { radius: Number(params.get("r")) },
        }, headers)
          .catch(async (e): Promise<void> => { // error handling
            await this.handleError(req, e.message ?? e, headers);
          });
      } else {
        this.handleNotFound(req, headers);
      }
    }
  }
}

new EgoNet().startServer();
