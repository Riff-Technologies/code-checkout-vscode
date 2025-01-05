import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

/**
 * Gets the command ID based on the extension's package.json
 * @param extensionPath - The path to the extension directory
 * @returns The fully qualified command ID
 */
function getCommandId(extensionPath: string): string {
  try {
    const packageJsonPath = path.join(extensionPath, "package.json");
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
    return packageJson.name;
  } catch (error) {
    throw new Error(
      `Failed to determine command ID from package.json: ${error}`
    );
  }
}

const validateLicense = async (licenseKey: string): Promise<boolean> => {
  return true;
};

/**
 * Handles incoming URIs for the extension
 * @param uri - The URI to handle
 */
async function handleUri(
  uri: vscode.Uri,
  context: vscode.ExtensionContext
): Promise<void> {
  try {
    // Parse the URI path and query parameters
    const params = new URLSearchParams(uri.query);

    switch (uri.path) {
      case "/activate":
        const licenseKey = params.get("key");
        if (licenseKey) {
          const isValid = await validateLicense(licenseKey);
          if (isValid) {
            await storeLicenseKey(context.secrets, licenseKey);
            await vscode.window.showInformationMessage(
              "License activated successfully!"
            );
          } else {
            await vscode.window.showErrorMessage(
              "Invalid license key. Please try again."
            );
          }
        }
        break;

      default:
        console.log(`Unhandled URI path: ${uri.path}`);
        break;
    }
  } catch (error) {
    console.error("Error handling URI:", error);
    await vscode.window.showErrorMessage(
      "Failed to process the request. Please try again."
    );
  }
}

/**
 * Injects the activate command into the extension
 * @param originalActivate - The original activate function
 * @returns The wrapped activate function
 */
export function injectActivateCommand(
  originalActivate: (context: vscode.ExtensionContext) => void
) {
  return (context: vscode.ExtensionContext) => {
    const packageName = getCommandId(context.extensionPath);
    const commandId = `${packageName}.activateLicenseCommand`;

    // Register URI handler
    context.subscriptions.push(
      vscode.window.registerUriHandler({
        handleUri: async (uri: vscode.Uri) => {
          await handleUri(uri, context);
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
            // Add your license key format validation here
            return value.length > 0 ? null : "License key cannot be empty";
          },
        });

        if (!licenseKey) {
          return; // User cancelled
        }

        try {
          const isValid = await validateLicense(licenseKey);
          if (isValid) {
            await storeLicenseKey(context.secrets, licenseKey);
            await vscode.window.showInformationMessage(
              "License activated successfully!"
            );
          } else {
            await vscode.window.showErrorMessage(
              "Invalid license key. Please try again."
            );
          }
        } catch (error) {
          await vscode.window.showErrorMessage(
            "Failed to validate license. Please check your internet connection."
          );
        }
      })
    );

    // Call the original activate function
    originalActivate(context);
  };
}

/**
 * Stores the license key in VSCode's secret storage
 * @param secretStorage - VSCode's secret storage
 * @param licenseKey - The license key to store
 */
async function storeLicenseKey(
  secretStorage: vscode.SecretStorage,
  licenseKey: string
): Promise<void> {
  await secretStorage.store("license-key", licenseKey);
}

/**
 * Decorator that automatically injects commands
 */
export function withActivateCommand() {
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
