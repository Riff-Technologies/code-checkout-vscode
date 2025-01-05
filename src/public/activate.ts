import * as vscode from "vscode";
import * as path from "path";
import { LicenseManager } from "../private/license-manager";
import { VSCodeStorage } from "../private/vscode-storage";

/**
 * Gets the command ID based on the extension's package.json
 * @param extensionPath - The path to the extension directory
 * @returns The fully qualified command ID and package name
 */
function getExtensionInfo(extensionPath: string): {
  commandId: string;
  packageName: string;
} {
  try {
    const packageJson = require(path.join(extensionPath, "package.json"));
    return {
      packageName: packageJson.name,
      commandId: `${packageJson.name}.activateLicense`,
    };
  } catch (error) {
    throw new Error(
      `Failed to determine command ID from package.json: ${error}`
    );
  }
}

/**
 * Handles incoming URIs for the extension
 * @param uri - The URI to handle
 * @param licenseManager - The license manager instance
 */
async function handleUri(
  uri: vscode.Uri,
  licenseManager: LicenseManager
): Promise<void> {
  try {
    const params = new URLSearchParams(uri.query);

    switch (uri.path) {
      case "/activate":
        const licenseKey = params.get("key");
        if (!licenseKey) {
          throw new Error("No license key provided");
        }

        const result = await licenseManager.validateLicense(licenseKey);
        if (result.isValid) {
          await vscode.window.showInformationMessage(
            "License activated successfully!"
          );
        } else {
          await vscode.window.showErrorMessage(
            `License validation failed: ${result.message}`
          );
        }
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
      }`
    );
  }
}

/**
 * Injects the activate command into the extension
 * @param originalActivate - The original activate function
 * @param apiEndpoint - The license validation API endpoint
 * @returns The wrapped activate function
 */
export function injectActivateCommand(
  originalActivate: (context: vscode.ExtensionContext) => void
) {
  return (context: vscode.ExtensionContext) => {
    // get the api endpoint from the environment
    const apiEndpoint = process.env.API_ENDPOINT;
    if (!apiEndpoint) {
      throw new Error("API_ENDPOINT is not set");
    }
    const { commandId } = getExtensionInfo(context.extensionPath);

    // Initialize storage and license manager
    const storage = new VSCodeStorage(context);
    const licenseManager = new LicenseManager(storage, apiEndpoint);

    // Register URI handler
    context.subscriptions.push(
      vscode.window.registerUriHandler({
        handleUri: async (uri: vscode.Uri) => {
          await handleUri(uri, licenseManager);
        },
      })
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
          const result = await licenseManager.validateLicense(licenseKey, {
            allowOffline: true,
          });

          if (result.isValid) {
            await vscode.window.showInformationMessage(
              result.wasOffline
                ? "License validated offline successfully!"
                : "License activated successfully!"
            );
          } else {
            await vscode.window.showErrorMessage(
              `License validation failed: ${result.message}`
            );
          }
        } catch (error) {
          await vscode.window.showErrorMessage(
            `Failed to validate license: ${
              error instanceof Error ? error.message : "Unknown error"
            }`
          );
        }
      })
    );

    // Call the original activate function
    originalActivate(context);
  };
}

/**
 * Decorator that automatically injects commands
 * @param apiEndpoint - The license validation API endpoint
 */
export function withActivateCommand(apiEndpoint: string) {
  return function (
    _target: unknown,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalActivate = descriptor.value as (
      context: vscode.ExtensionContext
    ) => void;
    descriptor.value = injectActivateCommand(originalActivate);
    return descriptor;
  };
}
