import {
  serve,
  ServerRequest,
} from "https://deno.land/std@0.71.0/http/server.ts";
import { Status } from "https://deno.land/std@0.71.0/http/http_status.ts";
import { createRequire } from "https://deno.land/std@0.71.0/node/module.ts";

const SERVER_HOST = "0.0.0.0";
const SERVER_PORT = Deno.env.get("PORT") || "8080";
const ALLOWED_ORIGINS = ["https://ego.jveres.me"];
const MAX_CACHE_CAPACITY = 500;
const CACHE_EXPIRATION_MS = 60 * 60 * 1000;
const httpCache = new Map<string, Cache>();

const requireNpm = createRequire(import.meta.url);
const createGraph = requireNpm("ngraph.graph");

interface Cache {
  date: number;
  value: string;
}

interface EgoGraphOptions {
  query: string;
  pattern?: string;
  depth?: number;
  radius?: number;
}

class EgoGraph {
  static readonly DEFAULT_GRAPH_DEPTH: number = 1;
  static readonly DEFAULT_SEARCH_PATTERN: string = " vs ";
  static readonly DEFAULT_GRAPH_RADIUS: number = 10;

  private readonly query: string;
  private readonly pattern: string;
  private readonly depth: number;
  private readonly radius: number;

  public graph;

  private elapsedMs: number = 0;
  private maxDistance: number = Number.NEGATIVE_INFINITY;

  constructor(options: EgoGraphOptions = { query: "" }) {
    this.graph = createGraph();
    this.query = options.query;
    this.depth = options.depth || EgoGraph.DEFAULT_GRAPH_DEPTH;
    this.pattern = options.pattern || EgoGraph.DEFAULT_SEARCH_PATTERN;
    this.radius = options.radius || EgoGraph.DEFAULT_GRAPH_RADIUS;
  }

  async fetchAutocomplete(
    term: string,
    maxCount: number,
  ): Promise<Set<string>> {
    const q = term + this.pattern;
    const res = await fetch(
      `http://suggestqueries.google.com/complete/search?&client=firefox&gl=us&hl=en&q=${
        encodeURIComponent(q)
      }`,
      fetchHeader,
    );
    if (res.status === Status.OK) {
      const hits = await res.json();
      const set = new Set<string>();
      for (let hit of hits[1].slice(0, maxCount)) {
        hit.split(this.pattern).slice(1).map((t: string) => {
          if (!new RegExp("^[0-9.]+$").test(t)) {
            set.add(t); // filters
          }
        });
      }
      return set;
    } else {
      throw new Error(`${res.status} ${res.statusText}`);
    }
  }

  async build() {
    if (this.query === "") return;
    const t1 = performance.now();
    this.graph.beginUpdate();
    let sources: string[] = [this.query];
    let distances: number[] = [0];
    for (let depth = 0; depth < this.depth; depth++) {
      let nextSources: string[] = [];
      let nextDistances: number[] = [];
      for (let i = 0; i < sources.length; i++) {
        const srcDistance = distances[i];
        if (srcDistance >= this.radius) continue;
        const src = sources[i];
        const targets = await this.fetchAutocomplete(
          src,
          this.radius - srcDistance,
        );
        if (!this.graph.getNode(src)) {
          this.graph.addNode(src, {
            count: 1,
            depth: src === this.query ? 0 : depth + 1,
          }); // new node
        }
        let weight: number = targets.size;
        let distance = 1;
        targets.forEach((target: string) => {
          const dist = srcDistance + distance;
          if (dist > this.maxDistance) this.maxDistance = dist;
          const targetNode = this.graph.getNode(target);
          if (!targetNode) {
            this.graph.addNode(target, { count: 1, depth: depth + 1 });
            this.graph.addLink(
              src,
              target,
              {
                distance: dist,
                weight,
                query: `${src}${this.pattern}${target}`,
              },
            ); // new edge
            nextDistances.push(dist);
            nextSources.push(target);
          } else {
            targetNode.data.count++; // existing node
            const link1 = this.graph.getLink(src, target),
              link2 = this.graph.getLink(target, src);
            if (link1 || link2) {
              link1 ? link1.data.weight += weight : link2.data.weight += weight;
            } else {
              this.graph.addLink(
                src,
                target,
                {
                  distance: dist,
                  weight,
                  query: `${src}${this.pattern}${target}`,
                },
              ); // existing edge
            }
          }
          weight -= 1;
          distance += 1;
        });
      }
      sources = nextSources;
      distances = nextDistances;
    }
    this.graph.endUpdate();
    this.elapsedMs = performance.now() - t1;
    console.log(`build() took ${this.elapsedMs}ms`);
  }

  toJSON() {
    let maxWeight = Number.NEGATIVE_INFINITY;
    this.graph.forEachLink((link: any) => {
      if (link.data.weight > maxWeight) maxWeight = link.data.weight;
    });
    const json = {
      nodes: [] as any,
      links: [] as any,
      query: this.query,
      depth: this.depth,
      radius: this.radius,
      maxWeight,
      maxDistance: this.maxDistance,
      pattern: this.pattern,
      elapsedMs: this.elapsedMs,
    };
    this.graph.forEachNode((node: any) => {
      json.nodes.push({ id: node.id, ...node.data });
    });
    this.graph.forEachLink((link: any) => {
      json.links.push({ source: link.fromId, target: link.toId, ...link.data });
    });
    return json;
  }
}

async function test(): Promise<void> {
  const ego = new EgoGraph({ query: "okr", depth: 1 });
  await ego.build();
  ego.graph.forEachLink((link: unknown) => console.log(link));
}

const responseHeaders = new Headers();
responseHeaders.set("Access-Control-Allow-Origin", "https://ego.jveres.me"); // CORS

const handleQuery = async (
  req: ServerRequest,
  options: EgoGraphOptions,
): Promise<void> => {
  console.log(`${req.method} ${req.url}`);
  let cache = httpCache.get(options.query);
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
    cache = { date: Date.now(), value: JSON.stringify(ego.toJSON()) };
    httpCache.set(options.query, cache);
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

let fetchHeader = {};
const httpProxy = Deno.env.get("HTTP_PROXY");
if (httpProxy) {
  const url = new URL(httpProxy);
  fetchHeader = {
    headers: {
      "Authorization": `Basic ${btoa(url.username + ":" + url.password)}`,
    },
  };
  console.info(
    `Using HTTP_PROXY (origin="${url.origin}", Authorization="Basic ***...***")`,
  );
}

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
        query: params.get("q") || "",
        depth: Number(params.get("d")),
        radius: Number(params.get("r")),
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
