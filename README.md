# ego-network
https://ego.jveres.me

Deno app for creating an egograph of Google autocomplete results.
Also includes:
- caching
- whitelisting

Install dependencies:
`npm i ngraph.graph`

Start with:
`deno run --watch --allow-net=0.0.0.0,suggestqueries.google.com --unstable --allow-read --allow-env egonet.ts`
