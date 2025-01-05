## build locally

Update the version in package.json.

`npm run pack:local`

In the extension project run `yarn add ~/Developer/code-checkout/riff-code-checkout-{{version}}.tgz` to add it to `node_modules`.

In the extension project run `npx code-checkout-install {{secret}}` and then `npx code-checkout-build`.

## Initialize `code-checkout-init`

- Adds an `activateLicenseCommand` and activation event to the package.json
- Adds the secret to the .env file
- Adds the .env file to the .vscodeignore file

## Build `npx code-checkout-build`
