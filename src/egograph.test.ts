// Copyright 2020 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

import {
  assert,
  assertArrayContains,
  assertEquals,
} from "https://deno.land/std@0.74.0/testing/asserts.ts";
import { EgoGraph } from "./egograph.ts";

Deno.test({
  name: "testing EgoGraph builder with query='okr'",
  async fn(): Promise<void> {
    const ego = new EgoGraph({ query: "okr", depth: 1, radius: 1 });
    await ego.build();
    const graph = ego.toObject();
    assert(graph.nodes);
    assert(graph.links);
    assertArrayContains(graph.nodes, [{ id: "okr", count: 1, depth: 0 }]);
    assertEquals(graph.query, "okr");
    assertEquals(graph.depth, 1);
    assertEquals(graph.radius, 1);
    assertEquals(graph.maxWeight, 1);
    assertEquals(graph.maxDistance, 1);
    assertEquals(graph.pattern, " vs ");
    assert(graph.elapsedMs);
  },
});
