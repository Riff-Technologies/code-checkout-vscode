# Processes to keep my mind straight

## How it works

### Initialization

- dev installs the `code-checkout` package
- dev runs `npx code-checkout-init`
  - adds a `postcompile` obfuscation script to package.json
  - adds `activateLicenseCommand`, `revokeLicenseCommand`, `activateOnlineCommand`
    - `activateLicenseCommand` allows entry of a license key which will be saved in vscode.secrets
    - `revokeLicenseCommand` will clear out that license key
    - `activateOnlineCommand` will take the user to a website: `https://my-website/{publisher.extensionId}/activate`
      - TODO: this website should redirect back to vscode and pass a value into the `activateLicenseCommand`

### Tagging

- dev adds the `injectCheckoutCommands` to wrap their `activate` function in `extension.ts`
  - this adds implementations of `activateLicenseCommand`, `revokeLicenseCommand`, `activateOnlineCommand`
- dev "tags" their functions with `tagFunction`
  - this accepts a "free" or "pro" or "free-trial" option
  - `tagFunction` checks the "type" and will validate the license if necessary before executing the tagged function
  - if the license is not found/not valid, a notification is shown which will direct the user to the website in the default browser

### Building

- `build.ts` is run as part of the `postcompile` script
  - it only obfuscates the javascript code after it is compiled by `tsc`

### Licensing
