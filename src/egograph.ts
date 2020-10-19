// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

import { Status } from "https://deno.land/std@0.74.0/http/http_status.ts";
import createGraph from "https://dev.jspm.io/ngraph.graph";
import { Retry, Timeout, Trace } from "https://deno.land/x/deco@0.3/mod.ts";

const FETCH_TIMEOUT_MS = 1000;
const FETCH_MAX_ATTEMPTS = 3;
const BUILD_TIMEOUT_MS = 10000;

export const fetchHeader = { headers: {} }; // fixes Deno's HTTP_PROXY auth issue
const httpProxy = Deno.env.get("HTTP_PROXY");
if (httpProxy) {
  const url = new URL(httpProxy);
  fetchHeader.headers = {
    "Authorization": `Basic ${btoa(url.username + ":" + url.password)}`,
  };
  console.info(
    `Using HTTP_PROXY (origin="${url.origin}", Authorization="Basic ***...***")`,
  );
}

export interface EgoGraphOptions {
  query: string;
  pattern?: string;
  depth?: number;
  radius?: number;
}

export class EgoGraph {
  static readonly DEFAULT_GRAPH_DEPTH: number = 1;
  static readonly DEFAULT_SEARCH_PATTERN: string = " vs ";
  static readonly DEFAULT_GRAPH_RADIUS: number = 10;

  private readonly query: string;
  private readonly pattern: string;
  private readonly depth: number;
  private readonly radius: number;

  public readonly graph: any;

  private elapsedMs: number = 0;
  private maxDistance: number = Number.NEGATIVE_INFINITY;

  /**
   * Creates a new EgoGraph instance.
   * @constructor
   * @param {EgoGraphOptions} options - Options for creating the ego network.
   */
  constructor(options: EgoGraphOptions = { query: "" }) {
    this.graph = (createGraph as () => any)();
    this.query = options.query;
    this.depth = options.depth ?? EgoGraph.DEFAULT_GRAPH_DEPTH;
    this.pattern = options.pattern ?? EgoGraph.DEFAULT_SEARCH_PATTERN;
    this.radius = options.radius ?? EgoGraph.DEFAULT_GRAPH_RADIUS;
  }

  @Timeout(FETCH_TIMEOUT_MS)
  @Retry({ maxAttempts: FETCH_MAX_ATTEMPTS })
  private async fetchAutocomplete(
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
          if (!new RegExp("^[0-9.]+$").test(t)) { // filters
            set.add(t);
          }
        });
      }
      return set;
    } else {
      throw new Error(`Fetch error: ${res.status} ${res.statusText}`);
    }
  }

  /**
   * Builds the ego network.
   * @returns {void}
   */
  @Trace()
  @Timeout(BUILD_TIMEOUT_MS)
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
  }

  /**
   * Creates final object representation of the graph. Should be called after build().
   * @returns {object} {nodes: [...], links: [...], query, depth, radius, maxWeight, maxDistance, pattern, elapsedMs}
   */
  toObject() {
    let maxWeight = Number.NEGATIVE_INFINITY;
    this.graph.forEachLink((link: any) => {
      if (link.data.weight > maxWeight) maxWeight = link.data.weight;
    });
    const obj = {
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
      obj.nodes.push({ id: node.id, ...node.data });
    });
    this.graph.forEachLink((link: any) => {
      obj.links.push({ source: link.fromId, target: link.toId, ...link.data });
    });
    return obj;
  }
}
