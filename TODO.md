# TODO

- Improve logging, avoid all raw console.method calls
  - Hierarchical logging
- update circuit management
- cache microdescs
- write technical guide to this project
- write a good AGENTS.md
- more tests for certificate caching

# DONE

- add src/clock/README.md
- get all tests running in both nodejs and playwright
  - playwright testing via npm run test:browser
- cache certificates
  - fingerprint->cert, see Consensus.Certificate.fetchOrThrow
- src/clock: nodejs unref behavior
- src/clock: delayUnref method and browser testing setup
