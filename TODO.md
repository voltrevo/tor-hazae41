# TODO

- test coverage
- update circuit management
- write technical guide to this project
- write a good AGENTS.md
- more tests for certificate caching

# DONE

- IClock usage
- Improve logging, avoid all raw console.method calls
  - Hierarchical logging
- add src/clock/README.md
- get all tests running in both nodejs and playwright
  - playwright testing via npm run test:browser
- cache certificates
  - fingerprint->cert, see Consensus.Certificate.fetchOrThrow
- src/clock: nodejs unref behavior
- src/clock: delayUnref method and browser testing setup
- cache microdescs
  - hash->microdesc with 1000 entry limit, see MicrodescManager
