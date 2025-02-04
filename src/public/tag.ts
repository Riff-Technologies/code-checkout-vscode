import * as vscode from "vscode";
import {
  validateLicense,
  getStoredLicense,
  isLicenseExpired,
  needsOnlineValidation,
} from "../private/license-validator";

/**
 * Type helper to unwrap a Promise type
 */
type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;

/**
 * Options for tagging a function with license validation
 */
interface TagOptions {
  type: "free" | "paid";
}

/**
 * Tags a function with license validation
 * @param options - Configuration options for the tag
 * @param fn - Function to wrap with license validation
 * @returns Tagged function that performs license validation before execution
 */
export function tagFunction<T extends (...args: any[]) => any>(
  context: vscode.ExtensionContext,
  options: TagOptions,
  fn: T,
): T {
  // Free functions pass through without validation
  if (options.type === "free") {
    return fn;
  }

  // get just the extension name
  const { id: extensionId } = context.extension;
  const extensionNameComponents = extensionId.split(".");
  if (extensionNameComponents.length < 2) {
    throw new Error("Invalid extension ID");
  }
  const extensionName = extensionNameComponents[1];

  return (async (
    ...args: Parameters<T>
  ): Promise<UnwrapPromise<ReturnType<T>>> => {
    // Check stored license
    const licenseKey = await getStoredLicense(context);
    if (!licenseKey) {
      const message = "This feature requires a valid license.";
      await showActivationPrompt(message, extensionName);
      return undefined as UnwrapPromise<ReturnType<T>>;
    }

    try {
      // Check if license is expired
      const expired = await isLicenseExpired(context);
      if (expired) {
        // For expired licenses, we must validate against the server
        const validationResult = await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: "Validating license...",
            cancellable: false,
          },
          () => validateLicense(context, licenseKey),
        );

        if (!validationResult.isValid) {
          const message = "Your license has expired.";
          await showActivationPrompt(message, extensionName);
          return undefined as UnwrapPromise<ReturnType<T>>;
        }
      } else {
        // License not expired, check if we need online validation
        const needsOnline = await needsOnlineValidation(context);
        if (needsOnline) {
          // Outside grace period - must wait for server validation
          const validationResult = await vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Notification,
              title: "Validating license...",
              cancellable: false,
            },
            () => validateLicense(context, licenseKey),
          );

          if (!validationResult.isValid) {
            await showActivationPrompt(
              validationResult.message || "Your license is invalid.",
              extensionName,
            );
            return undefined as UnwrapPromise<ReturnType<T>>;
          }
        } else {
          // Within grace period - validate in background
          validateLicense(context, licenseKey).catch((error) => {
            console.error("Background license validation failed:", error);
          });
        }
      }

      // Execute the original function and handle both sync and async results
      const result = fn(...args);
      return result instanceof Promise
        ? ((await result) as UnwrapPromise<ReturnType<T>>)
        : (result as UnwrapPromise<ReturnType<T>>);
    } catch (error) {
      console.error("License validation failed:", error);
      await vscode.window.showErrorMessage(
        `Unable to validate license: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
      return undefined as UnwrapPromise<ReturnType<T>>;
    }
  }) as T;
}

/**
 * Shows the activation prompt with a button to trigger the activate command
 * @param message - Optional custom message to display
 */
async function showActivationPrompt(
  message = "This feature requires a valid license.",
  extensionName: string,
): Promise<void> {
  const purchase = "Purchase License";
  const response = await vscode.window.showInformationMessage(
    message,
    { modal: false },
    purchase,
  );

  if (response === purchase) {
    await vscode.commands.executeCommand(
      `${extensionName}.purchaseLicenseCommand`,
    );
  }
}
