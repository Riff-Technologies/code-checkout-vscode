import * as vscode from "vscode";
import * as path from "path";
import {
  revokeLicense,
  validateLicense,
  getStoredLicense,
  generateLicenseKey,
  storeLicenseKey,
} from "../private/license-validator";
import { getApiUrl, isTestMode, setTestMode } from "../private/utils";

const WEB_URL = "https://codecheckout.dev";

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
  context: vscode.ExtensionContext,
  analytics: CommandAnalytics,
): Promise<void> {
  try {
    const url = await getApiUrl(context);
    const ANALYTICS_ENDPOINT = `${url}/analytics/events`;

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

    trackCommandAnalytics(context, {
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

export type CheckoutOptions = {
  testMode?: boolean;
  purchaseMdFile?: string;
  [key: string]: any;
};

/**
 * Injects the activate command into the extension
 * @param originalActivate - The original activate function
 * @param options - The options for the activate command
 */
export function injectCheckoutCommands(
  originalActivate: (context: vscode.ExtensionContext) => void,
  options?: CheckoutOptions,
) {
  return async (context: vscode.ExtensionContext) => {
    try {
      await setTestMode(context, options?.testMode || false);

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
      const { commandId: purchaseLicenseCommandId } = getExtensionInfo(
        context.extensionPath,
        "purchaseLicenseCommand",
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
            },
          ),
        ),
      );

      // Register a command for activating the license online with analytics
      context.subscriptions.push(
        vscode.commands.registerCommand(
          purchaseLicenseCommandId,
          wrapCommandWithAnalytics(
            context,
            purchaseLicenseCommandId,
            async () => {
              await activateLicenseOnline(context, options?.purchaseMdFile);
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

export type CheckoutUrlOptions = {
  customSuccessUrl?: string;
  customCancelUrl?: string;
  [key: string]: any;
};

/**
 * Gets the checkout URL for the extension
 * @param context - The VS Code extension context
 * @param customSuccessUrl - The custom success URL to use, which will be appended with `key`, `ideName`, and `id` (license key, ide app scheme, and extension id)
 * @param customCancelUrl - The custom cancel URL to use, which will be appended with `ideName` and `id` (ide app scheme and extension id)
 * @returns The checkout URL
 */
export async function getCheckoutUrl(
  context: vscode.ExtensionContext,
  options?: CheckoutUrlOptions,
) {
  try {
    // Store the license key before activating
    // this ensures that the key is always stored,
    // even if the user doesn't enter it or use the deeplink to activate it
    // If the license key is not validated on the server it will be useless anyway
    const licenseKey = generateLicenseKey();
    await storeLicenseKey(context, licenseKey);

    const apiUrl = await getApiUrl(context);
    const { id: extensionId, packageJSON } = context.extension;
    const name = packageJSON.displayName;
    const appScheme = vscode.env.uriScheme;
    const appUri = `${appScheme}://`;

    const { customSuccessUrl, customCancelUrl } = options || {};

    // Create and encode the redirect URI first
    const redirectUri = encodeURIComponent(
      `${appUri}${extensionId}/activate?key=${licenseKey}`,
    );
    const successUrl = customSuccessUrl
      ? `${customSuccessUrl}?key=${licenseKey}&ideName=${appScheme}&id=${extensionId}`
      : encodeURIComponent(
          `${WEB_URL}/activate?key=${licenseKey}&name=${name}&redirectUri=${redirectUri}`,
        );
    const cancelUrl = customCancelUrl
      ? `${customCancelUrl}?ideName=${appScheme}&id=${extensionId}`
      : encodeURIComponent(`${apiUrl}/ide-redirect?target=${appUri}`);
    const testParam = (await isTestMode(context)) ? "&testMode=true" : "";
    const purchaseUrl = `${apiUrl}/${extensionId}/checkout?licenseKey=${licenseKey}&successUrl=${successUrl}&cancelUrl=${cancelUrl}${testParam}`;

    console.log("purchaseUrl", purchaseUrl);
    const purchaseUrlObject = new URL(purchaseUrl);

    console.log("purchaseUrlObject", purchaseUrlObject);

    // fetch the purchase url
    const response = await fetch(purchaseUrlObject.toString());

    console.log("response", response);
    const { url } = await response.json();
    console.log("url", url);

    return url;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Failed to open activation website: ${errorMessage}`);
  }
}

/**
 * Opens the license activation website in the default web browser
 * @param context - The VS Code extension context
 * @param purchaseMdFile - The relative path to the purchase.md file from the extension root
 * @throws Error if unable to determine the extension ID, open the URL, or find the purchase file
 */
async function activateLicenseOnline(
  context: vscode.ExtensionContext,
  purchaseMdFile?: string,
): Promise<void> {
  try {
    const url = await getCheckoutUrl(context);
    if (purchaseMdFile) {
      // Resolve the purchase.md file path relative to the extension's installation directory
      const absolutePurchasePath = path.join(
        context.extensionPath,
        purchaseMdFile,
      );

      try {
        // Open the purchase.md file in markdown preview
        const purchaseDoc =
          await vscode.workspace.openTextDocument(absolutePurchasePath);

        // Open it directly in markdown preview mode
        await vscode.commands.executeCommand(
          "markdown.showPreview",
          purchaseDoc.uri,
        );

        // Show info message with button to open checkout URL
        const openButton = "Purchase Now";
        const result = await vscode.window.showInformationMessage(
          "Click to open the Checkout Page",
          openButton,
        );

        if (result === openButton) {
          await vscode.env.openExternal(vscode.Uri.parse(url));
        }
      } catch (error) {
        console.error(`Failed to open purchase file: ${error}`);
        // Fallback to direct URL open if file cannot be opened
        await vscode.env.openExternal(vscode.Uri.parse(url));
      }
    } else {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Preparing license activation...",
          cancellable: false,
        },
        async () => {
          await vscode.env.openExternal(vscode.Uri.parse(url));
        },
      );
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Failed to open activation website: ${errorMessage}`);
  }
}
