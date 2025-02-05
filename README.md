# code-checkout 🔐

> Add professional licensing and paywalls to your VSCode extensions in minutes!

[![npm version](https://badge.fury.io/js/code-checkout.svg)](https://badge.fury.io/js/code-checkout)
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

- 💼 [Create a free account](https://code-checkout.com/login) to get started
- 🖥️ Web Dashboard - Manage licenses, track usage, and view analytics
- 🛠️ CLI Tools - Powerful command-line interface for automation
- 📊 Analytics - Track user engagement with your commands

Visit [code-checkout.com](https://code-checkout.com) to learn more about the full platform capabilities.

## 📦 Installation

```bash
npm install code-checkout
```

## 🚀 Quick Start

### 1. Create Your Account

Sign up for a free account at [code-checkout.com](https://code-checkout.com/login).

### 2. Install the Package

```bash
npm install code-checkout
```

### 3. Initialize Your Project

Run our setup wizard to configure your extension:

```bash
npx code-checkout-init
```

### 4. Wrap Your Activation

```typescript
export const activate = injectCheckoutCommands(
  (context: vscode.ExtensionContext) => {
    // Your existing activation code
  },
);
```

### 5. Tag Your Premium Commands

```typescript
const paidFunction = tagCommand(
  context,
  { type: "paid" },
  originalCommandFunction,
);
```

Now you're ready to publish your extension! 🎉

## 🔧 How It Works

### Command Integration

The package automatically adds three commands to your extension:

- `activateLicenseCommand` - Handles license key entry
- `revokeLicenseCommand` - Manages license removal
- `purchaseOnlineCommand` - Directs users to your purchase portal

### License Management

- 🌐 Server-side validation for maximum security
- 🕒 Offline grace period
- 💻 Machine ID tracking for license enforcement
- 🚦 Background validation to avoid disrupting user flow

### Build Process

Post-compilation processing automatically:

- 🔒 Obfuscates your JavaScript code
- 🛡️ Protects license validation logic
- 🚧 Secures command execution paths

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
