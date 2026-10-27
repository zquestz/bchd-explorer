# bchrpc JavaScript bindings

`bchrpc_pb.js` and `bchrpc_pb_service.js` are copied unmodified from
[gcash/bchd](https://github.com/gcash/bchd) master at commit `6972fd5b`, after
`v0.22.3`, directory `bchrpc/pb-js`. That commit adds `confirmed_count` to the
address transaction replies; switch to the tag of the release that includes it.
They are generated code; do not edit them by hand.
They are covered by bchd's ISC license, included here as `LICENSE`.

To update them for a newer bchd release, copy both files from that release's
`bchrpc/pb-js` directory and update the tag above:

```
curl -sSfL -o vendor/bchrpc-pb/bchrpc_pb.js https://raw.githubusercontent.com/gcash/bchd/<tag>/bchrpc/pb-js/bchrpc_pb.js
curl -sSfL -o vendor/bchrpc-pb/bchrpc_pb_service.js https://raw.githubusercontent.com/gcash/bchd/<tag>/bchrpc/pb-js/bchrpc_pb_service.js
```

Then bump `version` in `package.json` and run `npm install`.

## Notes

- They are CommonJS, so they live in this local package (installed as the
  `bchrpc-pb` dependency) rather than in `src/`: Vite converts CommonJS in
  dependencies to ES modules, but serves `src/` files as they are.
- They run `Function('return this')()` when loaded, which is why the
  Content-Security-Policy in `nginx.conf` allows `'unsafe-eval'`.

- These files register their classes on a shared global `proto.pb` namespace.
  Never load a second copy of the bchrpc bindings (for example the old
  `grpc-bchrpc-web` package) in the same bundle, or one copy overwrites the
  other's classes and fields such as `cash_token` silently stop decoding.
- They use the `@improbable-eng/grpc-web` client, which is in maintenance mode.
  bchd itself serves gRPC-Web with `github.com/traefik/grpc-web`, a maintained
  fork of the server side only; the improbable-eng client remains compatible
  with it. A move to a maintained client (Connect or the official `grpc-web`)
  would need bindings generated for that client instead of these files.
- The explorer talks to these bindings only through `src/bchrpc.js`.
