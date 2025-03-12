# code-checkout-vscode 🔐

> Add professional licensing and paywalls to your VSCode extensions in minutes!

[![npm version](https://badge.fury.io/js/@riff-tech%2Fcode-checkout-vscode.svg)](https://badge.fury.io/js/@riff-tech%2Fcode-checkout-vscode)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🌟 Features

- 🔒 Secure license validation with offline support
- 🎯 Simple command tagging for paid vs. free features
- 🛡️ Code obfuscation to protect your intellectual property
- 🌐 Seamless integration with VSCode's extension ecosystem
- ⚡ Zero-config initialization
- 🔄 Automatic license validation with offline grace period

## 🌐 Platform & Tools

code-checkout is more than just an npm package - it's a complete platform for managing your software licensing:

- 💼 [Create a free account](https://codecheckout.dev/login) to get started
- 🖥️ Web Dashboard - Manage licenses, track usage, and view analytics
- 🛠️ CLI Tools - Powerful command-line interface for automation
- 📊 Analytics - Track user engagement with your commands

Visit [codecheckout.dev](https://codecheckout.dev) to learn more about the full platform capabilities.

## 🚀 Getting Started

The code-checkout CLI is the recommended method to implement code-checkout into your VSCode extension. There are two ways to use code-checkout:

- **Managed workflow** - Use this workflow to make your commands paid features
- **Custom workflow** - Use the license and checkout functions directly in your code for more control over paywalls

### Initialize Your Project

1. **Install the CLI**

```bash
npm install -g @riff-tech/code-checkout-cli
```

You can use the CLI with `code-checkout --help`.

2. **Initialize your VSCode extension project**

```bash
code-checkout init
```

This will walk you through creating a Publisher & Software, setting up a Pricing Model, linking your Stripe account, and bootstrapping your project to support licensing.

3. **Install the package**

```bash
npm install @riff-tech/code-checkout
```

### Managed Workflow

Add the higher-order function and tag your commands as "paid":

```typescript
import {
  tagCommand,
  injectCheckoutCommands,
  TagOptions,
} from "@riff-tech/code-checkout";

// 1. Inject code-checkout commands to handle licensing
export const activate = injectCheckoutCommands(
  (context: vscode.ExtensionContext) => {
    // Your original command
    const originalCommand = () => {
      vscode.window.showInformationMessage("Hello World");
    };

    // 2. Specify the tag options
    const tagOptions: TagOptions = {
      type: "paid",
      activationMessage: "This feature is only available in the paid version",
      activationCtaTitle: "Purchase License",
      reactivationMessage: "This feature is only available in the paid version",
      reactivationCtaTitle: "Purchase License",
    };

    // 3. Tag the command
    const paidCommand = tagCommand(context, tagOptions, originalCommand);

    // Register the command as usual
    const disposable = vscode.commands.registerCommand(
      "my-extension.paidCommand",
      paidCommand,
    );

    // Add the disposable to the context
    context.subscriptions.push(disposable);
  },
);
```

### Manual Workflow

#### Checking License Status

You can use the `getLicense` function to check license status directly:

```typescript
import { getLicense } from "@riff-tech/code-checkout";

// Get license data
const licenseData = await getLicense(context);

if (licenseData?.isValid) {
  // License is valid
  vscode.window.showInformationMessage(
    `License valid until ${licenseData.expiresOn}`,
  );
} else {
  // No valid license
  vscode.window.showWarningMessage("No valid license found");
}

// Force online validation
const validatedLicense = await getLicense(context, true);

// Check expiration
if (validatedLicense?.isExpired) {
  vscode.window.showErrorMessage("Your license has expired");
}
```

The `getLicense` function returns a `LicenseData` object containing:

- `isValid`: Whether the license is currently valid
- `licenseKey`: The active license key if one exists
- `isExpired`: Whether the license has expired
- `isOnlineValidationRequired`: If online validation is needed
- `lastValidated`: When the license was last validated
- `machineId`: Unique identifier for the current machine

#### Getting the Checkout URL

You can use the `getCheckoutUrl` function to get the checkout URL for your software:

```typescript
import { getCheckoutUrl, CheckoutUrlOptions } from "@riff-tech/code-checkout";

// 1. Optional - set custom success and cancel URLs
const checkoutUrlOptions: CheckoutUrlOptions = {
  customSuccessUrl: "https://example.com/success", // defaults to codecheckout.dev/activate
  customCancelUrl: "https://example.com/cancel", // defaults to redirect back to IDE
};

// 2. Generate the checkout URL
const checkoutUrl = await getCheckoutUrl(context, checkoutUrlOptions);

// 3. Open the checkout URL in the default browser
await vscode.env.openExternal(vscode.Uri.parse(url));
```

When using custom URLs, the following query parameters will be appended:

- `key=` - the license key (only for success URL)
- `ideName=` - the app scheme of the IDE (vscode, cursor, etc)
- `id=` - your extension ID

Example:

```
https://example.com/success?key=1234567890&ideName=vscode&id=publisher.my-extension
```

## 🛡️ Security Considerations

- Code obfuscation is provided but not encryption
- Obfuscation can be disabled by removing the `code-checkout-build` postcompile script
- We recommend implementing additional security measures for highly sensitive code

## 📝 License

MIT © Riff Tech, LLC

## 🌟 Support

- 🐛 Found a bug? [Open an issue](https://github.com/Riff-Technologies/code-checkout/issues)
- 💡 Have a feature request? [Let us know](https://github.com/Riff-Technologies/code-checkout/issues)
- 📧 Need help? [Contact support](mailto:shawn@riff-tech.com)

---

Made with ❤️ for the VSCode developer community
