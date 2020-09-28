// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

import { Status } from "https://deno.land/std@0.71.0/http/http_status.ts";
import { createRequire } from "https://deno.land/std@0.71.0/node/module.ts";

const requireNpm = createRequire(import.meta.url);
const createGraph = requireNpm("ngraph.graph");

let fetchHeader = {}; // fixed Deno's HTTP_PROXY auth issue
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
