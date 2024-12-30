# TODO

- [ ] License key validation
  - [ ] Access secret storage to get license key
  - [ ] Validate the key
  - [ ] If key is not found link to the web to buy a license
  - [ ] If key is not valid link to the web to renew a license
- [ ] Installion script
  - [x] Add a command to the extension to buy a license
  - [x] Add a secret to the .env file
- [ ] Build tools
  - [x] Build the extension and obfuscate the JS code
    - [x] update the package.json.main to `./src/extension.js`

## Things to try in order to break stuff

- [ ] When the `vsce package` command is run, it compiles the typescript in the `src-backup` folder, so .ts and .js files live alongside each other
  - [ ] We should try to prevent this, and compile the typescript to an `out` folder, or `temp` folder
  - [ ] But in the meantime, what will happen if there's an `index.ts` file and an `index.js` file in the same folder, and the typescript is compiled? Will something be overwritten? Will the script fail?
