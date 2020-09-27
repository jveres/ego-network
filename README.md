# ego-network
https://ego.jveres.me

Deno app for creating an egograph of Google autocomplete results.
Also includes:
- caching
- whitelisting

Install dependencies:

`npm i ngraph.graph`

Run test:

`deno test --unstable --allow-read --allow-env --allow-net --coverage`

Run server:

`deno run --allow-net=0.0.0.0,suggestqueries.google.com --unstable --allow-read --allow-env egonet.ts`
