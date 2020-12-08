// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

import {
  assertArrayIncludes,
  assertEquals,
  assertExists,
  assertObjectMatch,
} from "https://deno.land/std@0.80.0/testing/asserts.ts";

Deno.test({
  name: "fetch with HTTP proxy",
  async fn(): Promise<void> {
    Deno.env.set("HTTP_PROXY", "http://username:password@www.proxy.com");
    const mod = await import("./egograph.ts");
    assertObjectMatch(mod.fetchHeader, {
      headers: {
        Authorization: "Basic dXNlcm5hbWU6cGFzc3dvcmQ=",
      },
    });
  },
});

Deno.test({
  name: "EgoGraph builder, defaults",
  async fn(): Promise<void> {
    const mod = await import("./egograph.ts");
    const ego = new mod.EgoGraph();
    const graph = ego.toObject();
    assertEquals(graph, {
      depth: 1,
      elapsedMs: 0,
      links: [],
      maxDistance: -Infinity,
      maxWeight: -Infinity,
      nodes: [],
      pattern: " vs ",
      query: "",
      radius: 10,
    });
  },
});

Deno.test({
  name: "EgoGraph: query='okr', radius=1",
  async fn(): Promise<void> {
    const mod = await import("./egograph.ts");
    const ego = new mod.EgoGraph({ query: "okr", radius: 1 });
    await ego.build();
    const graph = ego.toObject();
    assertExists(graph.nodes);
    assertExists(graph.links);
    assertArrayIncludes(graph.nodes, [{ id: "okr", count: 1, depth: 0 }]);
    assertEquals(graph.query, "okr");
    assertEquals(graph.depth, 1);
    assertEquals(graph.radius, 1);
    assertEquals(graph.maxWeight, 1);
    assertEquals(graph.maxDistance, 1);
    assertEquals(graph.pattern, " vs ");
    assertExists(graph.elapsedMs);
  },
});

Deno.test({
  name: "EgoGraph: query='devops', depth=2, radius=3",
  async fn(): Promise<void> {
    const mod = await import("./egograph.ts");
    const ego = new mod.EgoGraph({ query: "devops", depth: 2, radius: 3 });
    await ego.build();
    const graph = ego.toObject();
    assertEquals(graph.query, "devops");
    assertEquals(graph.depth, 2);
    assertEquals(graph.radius, 3);
    assertEquals(graph.pattern, " vs ");
    assertExists(graph.elapsedMs);
  },
});
