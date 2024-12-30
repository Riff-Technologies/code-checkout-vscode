## build locally

Update the version in package.json.

`npm run pack:local`

In the extension project run `yarn add ~/Developer/code-checkout/riff-code-checkout-{{version}}.tgz` to add it to `node_modules`.

In the extension project run `npx code-checkout-install {{secret}}` and then `npx code-checkout-build`.

## Install `npx code-checkout-install`

- Adds an `activateLicenseCommand` and activation event to the package.json
- Adds the secret to the .env file
- Adds the .env file to the .vscodeignore file

## Build `npx code-checkout-build`

- Delete the `build` folder if it exists
- Compiles the javascript from `src` into `build`
- Obfuscates the .js files in `build` and replaces the unobfuscated files
- Deletes the `src_backup` folder if it already exists
- Renames the `src` folder to `src_backup`
- Creates a list of the original `src` files (this is needed to delete the compiled .js files that are produced from `vsce package` command)
- Deletes the `src` directory and makes a new `src` folder
- Copies the files from `build` to the new `src` folder
- Updates the `.vscodeignore` file to ignore some folders
- Updates the `main` entry point in package.json to use `src/extension.js`
- Creates the `.vsix` file from the `src` folder
- Deletes any new compiled .js files from `src_backup`
- Deletes the new `src` folder and renames `src_backup` to `src`
- Restores the original `.vscodeignore` file
- Restores the original package.json file
