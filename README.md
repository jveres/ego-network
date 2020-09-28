[![actions](https://github.com/jveres/ego-network/workflows/Fly%20Deploy/badge.svg)](https://github.com/jveres/ego-network/actions?query=workflow%3A%22Fly+Deploy%22)
[![license](https://img.shields.io/github/license/jveres/ego-network.svg)](https://github.com/jveres/ego-network)

# ego-network

Deno app for creating an egograph of Google autocomplete results.
Also includes:
- caching
- whitelisting

Install dependencies:

```sh
npm i ngraph.graph
```

Run test:

```sh
deno test --unstable --allow-read --allow-env --allow-net --coverage
```

Run server:

```sh
deno run --allow-net=0.0.0.0,suggestqueries.google.com --unstable --allow-read --allow-env egonet.ts
```
