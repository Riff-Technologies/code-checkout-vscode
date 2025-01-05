import * as vscode from "vscode";
import {
  validateLicense,
  getStoredLicense,
  isLicenseExpired,
  needsOnlineValidation,
} from "../private/license-validator";

/**
 * Options interface for the tag wrapper
 */
interface TagOptions {
  type: "paid" | "free" | "free-trial";
}

/**
 * Higher-order function that wraps a function call and validates licensing before execution
 * @param options - Configuration options
 * @param fn - The function to wrap
 * @returns A new function that validates licensing before executing the original
 */
export function tagFunction<T extends (...args: any[]) => Promise<any>>(
  options: TagOptions,
  fn: T
): T {
  if (options.type === "free") {
    return fn;
  }

  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    // Get the extension context
    const extension = vscode.extensions.getExtension("your-extension-id");
    if (!extension) {
      throw new Error("Extension not found");
    }
    await extension.activate();
    const context = extension.exports.context;

    // Check stored license
    const licenseKey = await getStoredLicense(context);
    if (!licenseKey) {
      await showActivationPrompt();
      return undefined as ReturnType<T>;
    }

    try {
      // Check if license is expired
      const expired = await isLicenseExpired(context);
      if (expired) {
        await showActivationPrompt("Your license has expired.");
        return undefined as ReturnType<T>;
      }

      // Check if we need to validate online
      const needsValidation = await needsOnlineValidation(context);
      if (needsValidation) {
        const validationResult = await validateLicense(context, licenseKey);
        if (!validationResult.isValid) {
          await showActivationPrompt(
            validationResult.message || "Your license is invalid."
          );
          return undefined as ReturnType<T>;
        }
      }

      // License is valid, execute the original function
      return fn(...args);
    } catch (error) {
      console.error("License validation failed:", error);
      await vscode.window.showErrorMessage(
        `Unable to validate license: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      return undefined as ReturnType<T>;
    }
  }) as T;
}

/**
 * Shows the activation prompt with a button to trigger the activate command
 * @param message - Optional custom message to display
 */
async function showActivationPrompt(
  message = "This feature requires a valid license."
): Promise<void> {
  const activate = "Activate License";
  const response = await vscode.window.showInformationMessage(
    message,
    { modal: false },
    activate
  );

  if (response === activate) {
    await vscode.commands.executeCommand("your-extension.activate");
  }
}
