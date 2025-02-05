# code-checkout SDK docs

## Overview

`code-checkout` is a package designed to help VSCode extension developers implement license-based paywalls for their extension's commands. It provides a seamless way to gate specific functionality behind different license tiers (free or paid) while handling all the complexities of license management and validation.

## Implementation Flow

### 1. Installation & Setup

1. Install the package in your VSCode extension project:

   ```bash
   npm install code-checkout
   ```

2. Run the initialization script:

   ```bash
   npx code-checkout-init
   ```

   This script automatically:

   - Adds a `postcompile` script to your `package.json` for code obfuscation
   - Configures required VSCode commands in your extension:
     - `activateLicenseCommand`: Handles license key entry and storage
     - `revokeLicenseCommand`: Manages license key removal
     - `purchaseOnlineCommand`: Directs users to the purchase portal

### 2. Integration

1. Wrap your extension's `activate` function with the provided `injectCheckoutCommands`:

   ```typescript
   export const activate = injectCheckoutCommands(
     (context: vscode.ExtensionContext) => {
       // Your existing activation code
     },
   );
   ```

2. Tag commands that require licensing using the `tagCommand` decorator:

   ```typescript
   const paidFunction = tagCommand(
     context,
     { type: "paid" },
     originalCommandFunction,
   );
   ```

### 3. License Management

- **Storage**: License keys are stored in VSCode's global workspace configuration, to allow users to view and edit them in Settings
- **Validation**:
  - License keys are validated against the server when commands are executed
  - A 7-day grace period allows offline usage after the last successful validation
  - Machine IDs are tracked to enforce license usage limits
  - Failed validations trigger user prompts for license acquisition

### 4. Build Process

The package automatically handles code protection through:

- Post-compilation JavaScript obfuscation
- Secure license validation logic
- Protected command execution paths

### 5. User Experience

When users attempt to access gated functionality:

1. Server license validation is usually done in the background to avoid disrupting the user's flow
2. The system checks for a valid license
3. If no valid license exists:
   - Users receive a notification
   - They are directed to the purchase portal
   - After purchase, the license is automatically activated in their VSCode environment

## Security Features

- Server-side license validation
- Machine ID tracking for license enforcement
- Code obfuscation to protect the extension's code
- Grace period for offline usage

## Security considerations

- code-checkout does not provide encryption of your code, only obfuscation (which can be opted out of by removing the `code-checkout-build` postcompile script in your `package.json`)
- We are considering adding a feature to better secure the host extension's code. If you want this feature, please let us know by creating a feature request Issue!
