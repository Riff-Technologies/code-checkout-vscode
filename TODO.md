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
    - [x] yarn
    - [ ] npm
    - [ ] pnpm
  - [ ] add an option to opt out of obfuscation
- [ ] if any part of the scripts fail, it should show steps to complete it manually
  - [ ] it should try to log errors
- [ ] should the node scripts be a command line tool instead?
- [x] init should also add `onUri` activation event, if it doesn't already exist
- [ ] refactor the `tag` script to get the package name in a universal way, and license functionality should be in a single place
- [ ] add `.env` file to `.gitignore` on init

## Documentation

- [ ] manual setup (scripts, envars, etc.)

## Testing

- [ ] various extension types
- [ ] installation
- [ ] build
- [ ] commands
- [ ] onUri
- [ ] npm
- [ ] pnpm

## Things to try in order to break stuff

- [ ] test license validation
- [ ] test URI for opening the extension via URL
  - [ ] test it also when the extension has existing URI functionality - will it overwrite what's there?
- [ ] test with all the various kinds of extensions (run `npx --package yo --package generator-code -- yo code` to see them)
