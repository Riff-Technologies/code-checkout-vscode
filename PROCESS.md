# Processes to keep my mind straight

## How it works

### Initialization

- dev installs the `code-checkout` package
- dev runs `npx code-checkout-init`
  - adds a `postcompile` obfuscation script to package.json
  - adds `activateLicenseCommand`, `revokeLicenseCommand`, `purchaseOnlineCommand`, and analytics
    - adds analytics to every command as fire-and-forget
      - analytics
    - `activateLicenseCommand` allows entry of a license key which will be saved in vscode.secrets
    - `revokeLicenseCommand` will clear out that license key
    - `purchaseOnlineCommand` will take the user to a website: `https://my-website/{publisher.extensionId}/activate`
      - TODO: this website should redirect back to vscode and pass a value into the `activateLicenseCommand`
      - the web will try to open `cursor://riff.testmystuff/test`

### Tagging

- dev adds the `injectCheckoutCommands` to wrap their `activate` function in `extension.ts`
  - this adds implementations of `activateLicenseCommand`, `revokeLicenseCommand`, `purchaseOnlineCommand`
- dev "tags" their functions with `tagCommand`
  - this accepts a "free" or "pro" or "free-trial" option
  - `tagCommand` checks the "type" and will validate the license if necessary before executing the tagged function
  - if the license is not found/not valid, a notification is shown which will direct the user to the website in the default browser

### Building

- `build.ts` is run as part of the `postcompile` script
  - it only obfuscates the javascript code after it is compiled by `tsc`

### Licensing

- the license is added manually by the user, or automatically when the website redirects back to vscode/cursor/something else via `activateLicenseCommand`
- the license key is saved to vscode secret storage along with its expiration and the date it was last validated, and a machineId
  - the machineID is used locally to see if the license is being used on more than 1 computer, but will also be used on the server
- there's a 7 day grace period to use the license from the time it was last validated online, if there's no internet connection or the server cannot be reached
- when a command is run that requires a license, it is validated
  - if it's not present nor valid, then we prompt the user accordingly
  - TODO: we need to implement a prompt that makes sense here
- the license key itself is used as authentication to the server
- the website can open the app directly because we're passing the app URI (vscode, cursor) as a param on the request to activate online
