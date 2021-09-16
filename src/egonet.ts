// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

// deno-lint-ignore-file no-explicit-any

import { Status } from "https://deno.land/std@0.107.0/http/http_status.ts";
import * as Colors from "https://deno.land/std@0.107.0/fmt/colors.ts";
import { onSignal } from "https://deno.land/std@0.107.0/signal/mod.ts";
import { EgoGraph, EgoGraphOptions } from "./egograph.ts";
import {
  Concurrency,
  Memoize,
  RateLimit,
  Try,
} from "https://deno.land/x/deco@0.5.1/mod.ts";
// from "../../deno/deco/mod.ts";

const SERVER_HOST = Deno.env.get("HOST") ?? "0.0.0.0";
const SERVER_PORT = Deno.env.get("PORT") ?? "8080";
const TELEGRAM_NOTIFICATION = Deno.env.get("TELEGRAM_NOTIFICATION");
const TELEGRAM_CHATID = TELEGRAM_NOTIFICATION?.split("#")[0];
const TELEGRAM_TOKEN = TELEGRAM_NOTIFICATION?.split("#")[1];
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
      Colors.brightWhite(" • log     "),
      ...arguments,
    ]);
  };

  console.info = function () {
    _origConsoleInfo.apply(console, [
      Colors.brightGreen(" ℹ info    "),
      ...arguments,
    ]);
  };

  console.warn = function () {
    _origConsoleWarn.apply(console, [
      Colors.brightYellow(" ⚠ warning "),
      ...arguments,
    ]);
  };

  console.error = function () {
    _origConsoleError.apply(console, [
      Colors.brightRed(" ✖ error   "),
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

  @Try()
  sendTelegramNotification(text: string) {
    if (!TELEGRAM_CHATID || !TELEGRAM_TOKEN) return;
    fetch(
      `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage?chat_id=${TELEGRAM_CHATID}&text=${text}`,
    );
  }

  @RateLimit({ rate: MAX_QUERY_RPS })
  async handleQuery(
    httpReq: Deno.RequestEvent,
    options: EgoGraphOptions,
    headers: Headers,
  ): Promise<void> {
    console.log(
      `${Colors.brightGreen(httpReq.request.method)} ${
        Colors.bold(httpReq.request.url)
      }`,
    );
    this.sendTelegramNotification(
      `${httpReq.request.headers.get("host") ??
        "<unkown host>"} -> ${options.query}`,
    );
    if (getCurrentRate === undefined) {
      ({ getCurrentRate } = [...arguments].pop()); // getCurrentRate is injected by @RateLimit
    }
    const graph: string = await this.graph(options);
    headers.set(
      "Cache-Control",
      `public, max-age=${CACHE_EXPIRATION_MS / 1000}`,
    );
    headers.set(
      "Content-Type",
      "application/json",
    );
    return this.respond(
      httpReq,
      new Response(graph, {
        status: Status.OK,
        headers,
      }),
    );
  }

  handleMetrics(httpReq: Deno.RequestEvent, headers: Headers): Promise<void> {
    const reqParams = new URLSearchParams(new URL(httpReq.request.url).search);
    const reqHeaders: any = {};
    for (const [key, value] of httpReq.request.headers.entries()) {
      reqHeaders[key] = value;
    }
    const metrics: any = {
      connections,
      rps: getCurrentRate?.call() ?? 0,
      ...reqParams.get("h") && { headers: reqHeaders },
      ...reqParams.get("e") && { env: Deno.env.toObject() },
    };
    console.log(
      `${Colors.brightGreen(httpReq.request.method)} ${
        Colors.bold(httpReq.request.url)
      } ${JSON.stringify(metrics)}`,
    );
    headers.set(
      "Content-Type",
      "application/json",
    );
    return this.respond(
      httpReq,
      new Response(JSON.stringify(metrics), {
        status: Status.OK,
        headers,
      }),
    );
  }

  handleNotAcceptable(
    httpReq: Deno.RequestEvent,
    headers: Headers,
  ): Promise<void> {
    console.error(
      `${httpReq.request.method} ${httpReq.request.url} ${
        Colors.brightYellow("Not acceptable")
      }`,
    );
    headers.set(
      "Content-Type",
      "application/json",
    );
    return this.respond(
      httpReq,
      new Response(
        JSON.stringify({
          message: "Not Acceptable",
        }),
        {
          status: Status.NotAcceptable,
          headers,
        },
      ),
    );
  }

  handleNotFound(httpReq: Deno.RequestEvent, headers: Headers): Promise<void> {
    console.warn(
      `${httpReq.request.method} ${httpReq.request.url} ${
        Colors.brightYellow("Not Found")
      }`,
    );
    headers.set(
      "Content-Type",
      "application/json",
    );
    return this.respond(
      httpReq,
      new Response(
        JSON.stringify({
          message: "Request Not Found",
        }),
        {
          status: Status.NotFound,
          headers,
        },
      ),
    );
  }

  handleError(
    httpReq: Deno.RequestEvent,
    message: string,
    headers: Headers,
  ): Promise<void> {
    console.error(
      `${httpReq.request.method} ${httpReq.request.url} ${
        Colors.brightRed(message)
      }`,
    );
    headers.set(
      "Content-Type",
      "application/json",
    );
    return this.respond(
      httpReq,
      new Response(
        JSON.stringify({
          message: "Internal server error",
          error: Colors.stripColor(message),
        }),
        {
          status: Status.InternalServerError,
          headers,
        },
      ),
    );
  }

  @Try()
  respond(httpReq: Deno.RequestEvent, resp: Response): Promise<void> {
    return httpReq.respondWith(resp);
  }

  async handleConnection(conn: Deno.Conn) {
    connections += 1;
    const httpConn = Deno.serveHttp(conn);
    for await (const httpReq of httpConn) {
      const req = httpReq.request;
      const url = new URL(req.url);
      const origin = req.headers.get("origin");
      const headers = new Headers();
      if (origin && ALLOWED_ORIGINS.includes(origin)) {
        headers.set("Access-Control-Allow-Origin", origin); // enable CORS
      }
      const host = req.headers.get("host") ?? "<unknown>";
      const params = new URLSearchParams(url.search);
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
        this.handleNotAcceptable(httpReq, headers); // not local dev and missing or not allowed origin
      } else if (
        req.method === "GET" &&
        (url.pathname === "/" || url.pathname === "/graph") && params.get("q")
      ) { // GET /?q=... or /graph?q=...
        this.handleQuery(httpReq, {
          query: params.get("q") ?? "",
          ...params.get("d") && { depth: Number(params.get("d")) },
          ...params.get("r") && { radius: Number(params.get("r")) },
          ...params.get("f") && { format: params.get("f") || "json" },
        }, headers)
          .catch(async (e): Promise<void> => { // error handling
            await this.handleError(httpReq, e.message ?? e, headers);
          });
      } else if (req.method === "GET" && url.pathname === "/metrics") {
        this.handleMetrics(httpReq, headers);
      } else {
        this.handleNotFound(httpReq, headers);
      }
    }
    connections -= 1;
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
    const server = Deno.listen({
      hostname: SERVER_HOST,
      port: Number(SERVER_PORT),
    });
    console.info(
      `${Colors.brightBlue("Server")} is running at ${
        Colors.bold(Colors.underline(SERVER_HOST + ":" + SERVER_PORT))
      }`,
    );
    this.diag();
    onSignal("SIGTERM", () => {
      console.info(
        Colors.bold(`Received ${Colors.brightRed("SIGTERM")}, exiting...`),
      );
      Deno.exit();
    });
    for await (const conn of server) {
      this.handleConnection(conn);
    }
  }
}

new EgoNet().startServer();
