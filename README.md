# BCHD Explorer

Simple block explorer for the BCHD gRPC API with SLP and Cash Tokens support.

## Requirements

- Node 20.19 or later, or 22.12 or later, to build.
- A [bchd](https://github.com/gcash/bchd) node whose gRPC port (8335, or
  18335 on testnet) the browser can reach over HTTPS. The explorer talks to
  it with gRPC-Web, which bchd serves on the same port.
- For every lookup, the node's indexes: `--txindex` for transactions,
  `--addrindex` for addresses and `--slpindex` for SLP tokens. Without one,
  the explorer says which lookups it can't do.
- The confirmed transaction count on address pages needs a bchd newer than
  0.22.3. Older nodes show 0, and address pages still page through every
  transaction.

## Servers

The servers in the menu are listed in the `nodes` array in
`src/components/BCHDExplorer.vue`. Each has the node's URL, a name for the
menu and its network (`mainnet` or `testnet4`); add your own node there.
Links carry their network, and open on the first server listed for it.

## Project setup
```
npm install
```

### Runs a development server with hot reload
```
npm run dev
```

### Builds for production into `dist/`
```
npm run build
```

### Serves the production build locally
```
npm run preview
```

### Lints files
```
npm run lint
```

### Runs tests
```
npm test
```

## Docker

The image builds the explorer and serves it with nginx on port 80, with
gzip, long-lived caching of the built assets and security headers (see
`nginx.conf`).

```
docker build -t bchd-explorer .
docker run -d -p 8080:80 bchd-explorer
```

The explorer is then at http://localhost:8080.

## Contributing

Bug reports and pull requests are welcome on GitHub at https://github.com/zquestz/bchd-explorer.

## License

The project is available as open source under the terms of the [Apache 2.0 License](https://opensource.org/licenses/Apache-2.0).
