import * as vscode from "vscode";
import * as path from "path";
import { validateLicense } from "../private/license-validator";

/**
 * Gets the command ID based on the extension's package.json
 */
function getExtensionInfo(
  extensionPath: string,
  commandName: string,
): {
  commandId: string;
  packageName: string;
} {
  try {
    const packageJson = require(path.join(extensionPath, "package.json"));
    return {
      packageName: packageJson.name,
      commandId: `${packageJson.name}.${commandName}`,
    };
  } catch (error) {
    throw new Error(
      `Failed to determine command ID from package.json: ${error}`,
    );
  }
}

/**
 * Handles the result of license validation and shows appropriate messages
 * @param result - The validation result from validateLicense
 * @returns True if the license is valid, false otherwise
 */
async function handleLicenseValidationResult(result: {
  isValid: boolean;
  message?: string;
}): Promise<boolean> {
  if (result.isValid) {
    await vscode.window.showInformationMessage(
      "License activated successfully!",
    );
    return true;
  } else {
    await vscode.window.showErrorMessage(
      `License validation failed: ${result.message || "Invalid license"}`,
    );
    return false;
  }
}

/**
 * Handles incoming URIs for the extension
 */
async function handleUri(
  uri: vscode.Uri,
  context: vscode.ExtensionContext,
): Promise<void> {
  try {
    const params = new URLSearchParams(uri.query);

    const handleActivate = async () => {
      const licenseKey = params.get("key");
      if (!licenseKey) {
        throw new Error("No license key provided");
      }

      const result = await validateLicense(context, licenseKey);
      await handleLicenseValidationResult(result);
    };

    switch (uri.path) {
      case "/activate":
        await handleActivate();
        break;

      default:
        console.log(`Unhandled URI path: ${uri.path}`);
        break;
    }
  } catch (error) {
    console.error("Error handling URI:", error);
    await vscode.window.showErrorMessage(
      `Failed to process the request: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    );
  }
}

/**
 * Injects the activate command into the extension
 * @param secret - The secret used for license validation
 * @param originalActivate - The original activate function
 */
export function injectCheckoutCommands(
  secret: string,
  originalActivate: (context: vscode.ExtensionContext) => void,
) {
  return async (context: vscode.ExtensionContext) => {
    // Store the secret in VSCode's secret storage
    await context.secrets.store("CODE_CHECKOUT_SECRET", secret);

    const storedSecret = await context.secrets.get("CODE_CHECKOUT_SECRET");

    console.log(`Stored secret: ${storedSecret}`);
    if (!storedSecret) {
      throw new Error("Failed to store secret in VSCode's secret storage");
    }

    try {
      const { commandId } = getExtensionInfo(
        context.extensionPath,
        "activateLicenseCommand",
      );

      // Register URI handler
      context.subscriptions.push(
        vscode.window.registerUriHandler({
          handleUri: async (uri: vscode.Uri) => {
            await handleUri(uri, context);
          },
        }),
      );

      // Register command for manual activation
      context.subscriptions.push(
        vscode.commands.registerCommand(commandId, async () => {
          const licenseKey = await vscode.window.showInputBox({
            prompt: "Enter your license key",
            placeHolder: "XXXX-XXXX-XXXX-XXXX",
            ignoreFocusOut: true,
            validateInput: (value: string) => {
              return value.trim().length > 0
                ? null
                : "License key cannot be empty";
            },
          });

          if (!licenseKey) {
            return; // User cancelled
          }

          try {
            const result = await validateLicense(context, licenseKey);
            await handleLicenseValidationResult(result);
          } catch (error) {
            await vscode.window.showErrorMessage(
              `Failed to validate license: ${
                error instanceof Error ? error.message : "Unknown error"
              }`,
            );
          }
        }),
      );
    } catch (error) {
      console.error("Failed to initialize license management:", error);
      throw error;
    } finally {
      // Call the original activate function
      originalActivate(context);
    }
  };
}

/**
 * Decorator that automatically injects commands
 * @param secret - The secret used for license validation
 */
export function withActivateCommand(secret: string) {
  return function (
    _target: unknown,
    _propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalActivate = descriptor.value as (
      context: vscode.ExtensionContext,
    ) => void;
    descriptor.value = injectCheckoutCommands(secret, originalActivate);
    return descriptor;
  };
}
