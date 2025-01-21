import * as vscode from "vscode";
import * as path from "path";
import {
  revokeLicense,
  validateLicense,
  getStoredLicense,
  generateLicenseKey,
} from "../private/license-validator";

const API_URL = "https://api.riff-tech.com/v1";

interface CommandAnalytics {
  extensionId: string;
  commandId: string;
  timestamp: string;
  hasValidLicense: boolean;
}

/**
 * Tracks command execution analytics
 * @param analytics - The analytics data to track
 */
async function trackCommandAnalytics(
  analytics: CommandAnalytics,
): Promise<void> {
  try {
    const ANALYTICS_ENDPOINT = "https://api.riff-tech.com/v1/analytics/events";

    await fetch(ANALYTICS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(analytics),
    });
  } catch (error) {
    // Silently fail analytics to not impact user experience
    console.error("Failed to track analytics:", error);
  }
}

/**
 * Wraps a command to include analytics tracking
 * @param context - The extension context
 * @param commandId - The ID of the command being wrapped
 * @param callback - The original command callback
 */
function wrapCommandWithAnalytics(
  context: vscode.ExtensionContext,
  commandId: string,
  callback: (...args: any[]) => any,
): (...args: any[]) => Promise<any> {
  return async (...args: any[]) => {
    const hasValidLicense = (await getStoredLicense(context)) !== undefined;

    await trackCommandAnalytics({
      extensionId: context.extension.id,
      commandId,
      timestamp: new Date().toISOString(),
      hasValidLicense,
    });

    return callback(...args);
  };
}

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
 * @param originalActivate - The original activate function
 */
export function injectCheckoutCommands(
  originalActivate: (context: vscode.ExtensionContext) => void,
) {
  return async (context: vscode.ExtensionContext) => {
    try {
      let handlerRegistered = false;
      const originalRegisterUriHandler = vscode.window.registerUriHandler;
      const originalRegisterCommand = vscode.commands.registerCommand;

      // Override the command registration to add analytics
      (vscode.commands.registerCommand as any) = (
        commandId: string,
        callback: (...args: any[]) => any,
        thisArg?: any,
      ) => {
        const wrappedCallback = wrapCommandWithAnalytics(
          context,
          commandId,
          callback,
        );
        return originalRegisterCommand.call(
          vscode.commands,
          commandId,
          wrappedCallback,
          thisArg,
        );
      };

      (vscode.window.registerUriHandler as any) = (
        handler: vscode.UriHandler,
      ) => {
        handlerRegistered = true;
        const originalHandleUri = handler.handleUri;
        handler.handleUri = async (uri: vscode.Uri) => {
          if (uri.path === "/activate") {
            await handleUri(uri, context);
          } else {
            await originalHandleUri.call(handler, uri);
          }
        };

        return originalRegisterUriHandler.call(vscode.window, handler);
      };

      // Call the original activate function
      originalActivate(context);

      // Restore original functions
      vscode.window.registerUriHandler = originalRegisterUriHandler;
      vscode.commands.registerCommand = originalRegisterCommand;

      // Register our own handler if none was registered
      if (!handlerRegistered) {
        context.subscriptions.push(
          vscode.window.registerUriHandler({
            handleUri: async (uri: vscode.Uri) => {
              await handleUri(uri, context);
            },
          }),
        );
      }

      const { commandId: activateLicenseCommandId } = getExtensionInfo(
        context.extensionPath,
        "activateLicenseCommand",
      );
      const { commandId: revokeLicenseCommandId } = getExtensionInfo(
        context.extensionPath,
        "revokeLicenseCommand",
      );
      const { commandId: activateOnlineCommandId } = getExtensionInfo(
        context.extensionPath,
        "activateOnlineCommand",
      );

      // Register command for manual activation with analytics
      context.subscriptions.push(
        vscode.commands.registerCommand(
          activateLicenseCommandId,
          wrapCommandWithAnalytics(
            context,
            activateLicenseCommandId,
            async () => {
              const licenseKey = await vscode.window.showInputBox({
                prompt: "Enter your license key",
                placeHolder: "XXXXXXXX-XXXXXXXXXXX",
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
            },
          ),
        ),
      );

      // Register a command for revoking the license with analytics
      context.subscriptions.push(
        vscode.commands.registerCommand(
          revokeLicenseCommandId,
          wrapCommandWithAnalytics(
            context,
            revokeLicenseCommandId,
            async () => {
              await revokeLicense(context);
              await vscode.window.showInformationMessage(
                "License revoked successfully!",
              );
            },
          ),
        ),
      );

      // Register a command for activating the license online with analytics
      context.subscriptions.push(
        vscode.commands.registerCommand(
          activateOnlineCommandId,
          wrapCommandWithAnalytics(
            context,
            activateOnlineCommandId,
            async () => {
              await activateLicenseOnline(context);
            },
          ),
        ),
      );
    } catch (error) {
      console.error("Failed to initialize license management:", error);
      throw error;
    }
  };
}

/**
 * Decorator that automatically injects commands
 */
export function withActivateCommand() {
  return function (
    _target: unknown,
    _propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalActivate = descriptor.value as (
      context: vscode.ExtensionContext,
    ) => void;
    descriptor.value = injectCheckoutCommands(originalActivate);
    return descriptor;
  };
}

/**
 * Opens the license activation website in the default web browser
 * @param context - The VS Code extension context
 * @throws Error if unable to determine the extension ID or open the URL
 */
async function activateLicenseOnline(
  context: vscode.ExtensionContext,
): Promise<void> {
  try {
    const { id: extensionId } = context.extension;
    const appScheme = vscode.env.uriScheme;
    const licenseKey = generateLicenseKey();
    const appUri = `${appScheme}://`;
    const successUrl = `${API_URL}/ide-redirect?target=${appUri}${extensionId}/activate?key=${licenseKey}`;
    const cancelUrl = `${API_URL}/ide-redirect?target=${appUri}`;
    const purchaseUrl = `${API_URL}/v1/${extensionId}/checkout?licenseKey=${licenseKey}&successUrl=${successUrl}&cancelUrl=${cancelUrl}`;

    // fetch the purchase url
    const response = await fetch(purchaseUrl.toString());

    console.log("response", response);
    const { url } = await response.json();

    await vscode.env.openExternal(vscode.Uri.parse(url));
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Failed to open activation website: ${errorMessage}`);
  }
}
