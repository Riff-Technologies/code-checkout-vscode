# TODO

- [ ] adding license from web
  - [ ] should be able to determine which IDE is being used `vscode` or `cursor` or something else
    - [ ] vscode://riff.testmystuff/activate?key=my-key
- [ ] Build tools
  - [ ] add an option to obfuscate the source code when executing the script
  - [x] Build the extension and obfuscate the JS code
    - [x] update the package.json.main to `./src/extension.js`
  - [ ] support other packaging tools
    - [x] yarn
    - [ ] npm
    - [ ] pnpm
  - [ ] add an option to opt out of obfuscation
  - [ ] support bundling the extension (esbundle or webpack)
- [ ] if any part of the scripts fail, it should show steps to complete it manually
  - [ ] it should try to log errors
- [ ] add `.env` file to `.gitignore` on init
- [ ] rename `injectActivateCommand` to `injectCheckoutCommands`

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

## Notes

- [ ] the parent extension project has to have `dotenv` installed and configured

```
  import * as dotenv from "dotenv";
  import * as path from "path";

  // Load .env file at the root of your project
  dotenv.config({ path: path.join(__dirname, "..", ".env") });
```
