# TODO

- [ ] License key validation
  - [ ] Access secret storage to get license key
  - [ ] Validate the key
  - [ ] If key is not found link to the web to buy a license
  - [ ] If key is not valid link to the web to renew a license
- [ ] Installion script
  - [ ] it should implement the `injectActivateCommand` on `extension.ts/js`
  - [ ] should also inject a `purchase` command
  - [x] Add a command to the extension to buy a license
  - [x] Add a secret to the .env file
- [ ] Build tools
  - [ ] add an option to obfuscate the source code when executing the script
  - [x] Build the extension and obfuscate the JS code
    - [x] update the package.json.main to `./src/extension.js`
  - [ ] support other packaging tools
    - [ ] yarn
    - [ ] npm
    - [ ] pnpm
  - [ ] add an option to opt out of obfuscation
- [ ] if any part of the scripts fail, it should show steps to complete it manually
  - [ ] it should try to log errors
- [ ] should the node scripts be a command line tool instead?
- [ ] add a `validateLicense` function
- [ ] init should also add `onUri` activation event, if it doesn't already exist
- [ ] refactor the `tag` script to get the package name in a universal way, and license functionality should be in a single place

## Things to try in order to break stuff

- [ ] When the `vsce package` command is run, it compiles the typescript in the `src-backup` folder, so .ts and .js files live alongside each other
  - [ ] We should try to prevent this, and compile the typescript to an `out` folder, or `temp` folder
  - [ ] But in the meantime, what will happen if there's an `index.ts` file and an `index.js` file in the same folder, and the typescript is compiled? Will something be overwritten? Will the script fail?
- [ ] test with all the various kinds of extensions (run `npx --package yo --package generator-code -- yo code` to see them)
