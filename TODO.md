# TODO

- [ ] Build tools
  - [x] Build the extension and obfuscate the JS code
    - [x] update the package.json.main to `./src/extension.js`
  - [ ] add an option to opt out of obfuscation
  - [x] support bundling the extension (esbuild or webpack)
    - [x] this would be configured in the extension project itself, but should be included in documentation for recommendation
  - [ ] determine a way to pull the extension commands from the server, instead of being loaded in the `.vsix` file
- [ ] if any part of the scripts fail, it should show steps to complete it manually
  - [ ] it should try to log errors
  - [ ] comprehensive logging for how the package is working
- [x] wrap all commands with analytics, if it's added as an option
- [x] add support for free trial to license
- [ ] consider registering each "tagged function" on the website, so that it can be configured remotely

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

- [ ] test with all the various kinds of extensions (run `npx --package yo --package generator-code -- yo code` to see them)

## Notes

- [x] test activation via uri handler: `cursor://riff.testmystuff/activate?key=123`
