[![actions](https://github.com/jveres/ego-network/workflows/Fly%20Deploy/badge.svg)](https://github.com/jveres/ego-network/actions?query=workflow%3A%22Fly+Deploy%22)
[![license](https://img.shields.io/github/license/jveres/ego-network.svg)](https://github.com/jveres/ego-network)

# ego-network

Deno app for creating an egograph of Google autocomplete results.
Also includes:
- in-memory caching,
- whitelisting.

Available `go-task` scripts:
- `dev` run development server (default)
- `test` run unit tests
- `build` build production bundle, uses `denopack`
- `prod` run production server
- `deploy` deploy to fly.io

Sample `json` result:
```json
{
    "nodes": [{
        "id": "javascript",
        "count": 1,
        "depth": 0
    }, {
        "id": "java",
        "count": 1,
        "depth": 1
    }, {
        "id": "python",
        "count": 1,
        "depth": 1
    }, {
        "id": "typescript",
        "count": 1,
        "depth": 1
    }, {
        "id": "jquery",
        "count": 1,
        "depth": 1
    }, {
        "id": "php",
        "count": 1,
        "depth": 1
    }, {
        "id": "html",
        "count": 1,
        "depth": 1
    }, {
        "id": "node.js",
        "count": 1,
        "depth": 1
    }, {
        "id": "c#",
        "count": 1,
        "depth": 1
    }, {
        "id": "react",
        "count": 1,
        "depth": 1
    }, {
        "id": "python speed",
        "count": 1,
        "depth": 1
    }],
    "links": [{
        "source": "javascript",
        "target": "java",
        "distance": 1,
        "weight": 10,
        "query": "javascript vs java"
    }, {
        "source": "javascript",
        "target": "python",
        "distance": 2,
        "weight": 9,
        "query": "javascript vs python"
    }, {
        "source": "javascript",
        "target": "typescript",
        "distance": 3,
        "weight": 8,
        "query": "javascript vs typescript"
    }, {
        "source": "javascript",
        "target": "jquery",
        "distance": 4,
        "weight": 7,
        "query": "javascript vs jquery"
    }, {
        "source": "javascript",
        "target": "php",
        "distance": 5,
        "weight": 6,
        "query": "javascript vs php"
    }, {
        "source": "javascript",
        "target": "html",
        "distance": 6,
        "weight": 5,
        "query": "javascript vs html"
    }, {
        "source": "javascript",
        "target": "node.js",
        "distance": 7,
        "weight": 4,
        "query": "javascript vs node.js"
    }, {
        "source": "javascript",
        "target": "c#",
        "distance": 8,
        "weight": 3,
        "query": "javascript vs c#"
    }, {
        "source": "javascript",
        "target": "react",
        "distance": 9,
        "weight": 2,
        "query": "javascript vs react"
    }, {
        "source": "javascript",
        "target": "python speed",
        "distance": 10,
        "weight": 1,
        "query": "javascript vs python speed"
    }],
    "query": "javascript",
    "depth": 1,
    "radius": 10,
    "maxWeight": 10,
    "maxDistance": 10,
    "pattern": " vs ",
    "elapsedMs": 64
}
```
