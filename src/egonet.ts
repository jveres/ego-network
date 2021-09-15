// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file no-explicit-any

import {
  Response,
  serve,
  ServerRequest,
} from "https://deno.land/std@0.82.0/http/server.ts";
import { Status } from "https://deno.land/std@0.82.0/http/http_status.ts";
import * as Colors from "https://deno.land/std@0.82.0/fmt/colors.ts";
import { onSignal } from "https://deno.land/std@0.82.0/signal/mod.ts";
import { EgoGraph, EgoGraphOptions } from "./egograph.ts";
import { Concurrency, Memoize, RateLimit, Try } from "../../deno/deco/mod.ts";
//} from "https://deno.land/x/deco@0.4.9/mod.ts";

const SERVER_HOST = Deno.env.get("HOST") ?? "0.0.0.0";
const SERVER_PORT = Deno.env.get("PORT") ?? "8080";
const ALLOWED_ORIGINS = ["https://ego.jveres.me"];
const CACHE_EXPIRATION_MS = 12 * 60 * 60 * 1000; // 12 hours
const MAX_QUERY_RPS = 50; // 50 Requests Per Second
const MAX_QUERY_CONCURRENCY = 1; // concurrency limit for identical requests

let connections = 0; // number of all active tcp connections
let getCurrentRate: any = undefined; // function to get current rate for the query endpoint

(function hookForConsoleLogs() {
  const _origConsoleLog = console.log;
  const _origConsoleInfo = console.info;
  const _origConsoleWarn = console.warn;
  const _origConsoleError = console.error;

  console.log = function () {
    _origConsoleLog.apply(console, [
      Colors.brightWhite("[L]"),
      ...arguments,
    ]);
  };

  console.info = function () {
    _origConsoleInfo.apply(console, [
      Colors.brightGreen("[I]"),
      ...arguments,
    ]);
  };

  console.warn = function () {
    _origConsoleWarn.apply(console, [
      Colors.brightYellow("[W]"),
      ...arguments,
    ]);
  };

  console.error = function () {
    _origConsoleError.apply(console, [
      Colors.brightRed("[E]"),
      ...arguments,
    ]);
  };
})();

class EgoNet {
  private static _keyFromOptions(options: EgoGraphOptions): string {
    return `${options.query}#${options.depth ??
      EgoGraph.DEFAULT_GRAPH_DEPTH}#${options.pattern ??
      EgoGraph.DEFAULT_SEARCH_PATTERN}#${options.radius ??
      EgoGraph.DEFAULT_GRAPH_RADIUS}#${options.format ??
      EgoGraph.DEFAULT_GRAPH_FORMAT}`;
  }

  @Concurrency({
    max: MAX_QUERY_CONCURRENCY,
    resolver: (options: EgoGraphOptions) => EgoNet._keyFromOptions(options),
    onPooled: (key: string) =>
      console.log(`pooled query "${Colors.bold(key.split("#")[0])}"`),
  })
  @Memoize({
    ttl: CACHE_EXPIRATION_MS,
    resolver: (options: EgoGraphOptions) => EgoNet._keyFromOptions(options),
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
      {
        query: options.query,
        depth: options.depth,
        radius: options.radius,
        format: options.format,
      },
    );
    await ego.build();
    return JSON.stringify(ego.toObject());
  }

  @Try({
    catch: ["BrokenPipe"],
    log: true,
  })
  respond(req: ServerRequest, r: Response): Promise<void> {
    return req.respond(r).finally(() => {
      connections -= 1;
    });
  }

  @RateLimit({ rate: MAX_QUERY_RPS })
  async handleQuery(
    req: ServerRequest,
    options: EgoGraphOptions,
    headers: Headers,
  ): Promise<void> {
    console.log(`${Colors.brightGreen(req.method)} ${Colors.bold(req.url)}`);
    if (getCurrentRate === undefined) {
      ({ getCurrentRate } = [...arguments].pop()); // getCurrentRate is injected by @RateLimit
    }
    const graph: string = await this.graph(options);
    headers.set(
      "Cache-Control",
      `public, max-age=${CACHE_EXPIRATION_MS / 1000}`,
    );
    headers.set("Date", new Date().toUTCString());
    headers.set(
      "Content-Type",
      "application/json",
    );
    return this.respond(req, {
      status: Status.OK,
      headers,
      body: graph,
    });
  }

  handleMetrics(req: ServerRequest, headers: Headers): Promise<void> {
    const reqParams = new URLSearchParams(
      req.url.slice(1).split("?").slice(-1).join(),
    );
    const reqHeaders: any = {};
    for (const [key, value] of req.headers.entries()) {
      reqHeaders[key] = value;
    }
    const metrics: any = {
      connections,
      rps: getCurrentRate?.call() ?? 0,
      ...reqParams.get("h") && { headers: reqHeaders },
      ...reqParams.get("e") && { env: Deno.env.toObject() },
    };
    console.log(
      `${Colors.brightGreen(req.method)} ${Colors.bold(req.url)} ${
        JSON.stringify(metrics)
      }`,
    );
    return this.respond(req, {
      status: Status.OK,
      headers,
      body: JSON.stringify(metrics),
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

  private diag() {
    console.info(
      `Deno: ${Colors.brightGreen(Deno.version.deno)} · V8: ${
        Colors.brightGreen(Deno.version.v8)
      } · TypeScript: ${Colors.brightGreen(Deno.version.typescript)}`,
    );
    const mem = Deno.systemMemoryInfo();
    console.info(
      `CPU cores: ${
        Colors.bold(String(navigator.hardwareConcurrency))
      } · Memory: ${Colors.bold(Math.floor(mem.total / 1024) + "MB")} · free: ${
        Colors.bold(Math.floor(mem.free / 1024) + "MB")
      } · available: ${Colors.bold(Math.floor(mem.available / 1024) + "MB")}`,
    );
    const osRel = Deno.osRelease();
    console.info(
      `OS target: ${Colors.bold(Deno.build.target)} · release: ${
        Colors.bold(osRel)
      }`,
    );
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
    this.diag();
    onSignal(Deno.Signal.SIGTERM, () => {
      console.info(
        Colors.bold(`Received ${Colors.brightRed("SIGTERM")}, exiting...`),
      );
      Deno.exit();
    });
    for await (const req of server) {
      connections += 1; // number of active connections
      const origin = req.headers.get("origin");
      const headers = new Headers();
      if (origin && ALLOWED_ORIGINS.includes(origin)) {
        headers.set("Access-Control-Allow-Origin", origin); // enable CORS
      }
      const host = req.headers.get("host") ?? "<unknown-host>";
      const params = new URLSearchParams(req.url.slice(1));
      if (
        ![
          `localhost:${SERVER_PORT}`,
          `127.0.0.1:${SERVER_PORT}`,
          `egonet:${SERVER_PORT}`,
          `egonet.egonet.svc.cluster.local:${SERVER_PORT}`,
          `host.docker.internal:${SERVER_PORT}`,
        ].includes(host) && !host.endsWith("127.0.0.1.sslip.io") &&
        !headers.get("Access-Control-Allow-Origin")
      ) {
        this.handleNotAcceptable(req, headers); // not local dev and missing or not allowed origin
      } else if (req.method === "GET" && params.get("q")) { // GET /?q=...
        this.handleQuery(req, {
          query: params.get("q") ?? "",
          ...params.get("d") && { depth: Number(params.get("d")) },
          ...params.get("r") && { radius: Number(params.get("r")) },
          ...params.get("f") && { format: params.get("f") || "json" },
        }, headers)
          .catch(async (e): Promise<void> => { // error handling
            await this.handleError(req, e.message ?? e, headers);
          });
      } else if (req.method === "GET" && req.url.startsWith("/metrics")) {
        this.handleMetrics(req, headers);
      } else {
        this.handleNotFound(req, headers);
      }
    }
  }
}

new EgoNet().startServer();
