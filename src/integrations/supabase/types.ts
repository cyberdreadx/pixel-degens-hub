npm error code EPERM
npm error syscall open
npm error path /Users/rouge/.nvm/versions/node/v20.18.0/lib/node_modules/npm/node_modules/@sigstore/verify/dist/key/index.js
npm error errno -1
npm error Error: EPERM: operation not permitted, open '/Users/rouge/.nvm/versions/node/v20.18.0/lib/node_modules/npm/node_modules/@sigstore/verify/dist/key/index.js'
npm error     at Object.readFileSync (node:fs:448:20)
npm error     at getMaybeCachedSource (node:internal/modules/cjs/loader:1492:18)
npm error     at Module._extensions..js (node:internal/modules/cjs/loader:1504:19)
npm error     at Module.load (node:internal/modules/cjs/loader:1288:32)
npm error     at Module._load (node:internal/modules/cjs/loader:1104:12)
npm error     at Module.require (node:internal/modules/cjs/loader:1311:19)
npm error     at require (node:internal/modules/helpers:179:18)
npm error     at Object.<anonymous> (/Users/rouge/.nvm/versions/node/v20.18.0/lib/node_modules/npm/node_modules/@sigstore/verify/dist/verifier.js:21:15)
npm error     at Module._compile (node:internal/modules/cjs/loader:1469:14)
npm error     at Module._extensions..js (node:internal/modules/cjs/loader:1548:10) {
npm error   errno: -1,
npm error   code: 'EPERM',
npm error   syscall: 'open',
npm error   path: '/Users/rouge/.nvm/versions/node/v20.18.0/lib/node_modules/npm/node_modules/@sigstore/verify/dist/key/index.js'
npm error }
npm error
npm error The operation was rejected by your operating system.
npm error It is likely you do not have the permissions to access this file as the current user
npm error
npm error If you believe this might be a permissions issue, please double-check the
npm error permissions of the file and its containing directories, or try running
npm error the command again as root/Administrator.
npm error Log files were not written due to an error writing to the directory: /Users/rouge/.npm/_logs
npm error You can rerun the command with `--loglevel=verbose` to see the logs in your terminal
