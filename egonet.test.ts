import {
  assertArrayContains,
  assertEquals,
} from "https://deno.land/std@0.71.0/testing/asserts.ts";
import { EgoGraph, EgoGraphOptions } from "./egograph.ts";

Deno.test({
  name: "testing EgoGraph builder with",
  async fn(): Promise<void> {
    const ego = new EgoGraph({ query: "okr", depth: 1, radius: 1 });
    await ego.build();
    const graph = ego.toJSON();
    //console.log(graph);
    assertArrayContains(graph.nodes, [{ id: "okr", count: 1, depth: 0 }]);
    assertEquals(graph.query, "okr");
    assertEquals(graph.depth, 1);
    assertEquals(graph.radius, 1);
    assertEquals(graph.maxWeight, 1);
    assertEquals(graph.maxDistance, 1);
    assertEquals(graph.pattern, " vs ");
  },
});
