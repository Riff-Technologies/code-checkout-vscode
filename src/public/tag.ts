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

export interface LicenseData {
  licenseKey?: string;
  isValid: boolean;
  expiresOn?: string;
  isExpired?: boolean;
  isOnlineValidationRequired?: boolean;
  lastValidated?: string;
  machineId?: string;
}

/**
 * Get the license information for the extension
 * @param context - The extension context
 * @param validateOnline - Whether to force online validation regardless of grace period
 * @returns License data object or null if no license is stored
 */
export async function getLicense(
  context: vscode.ExtensionContext,
  validateOnline = false,
): Promise<LicenseData | null> {
  const licenseKey = await getStoredLicense(context);
  if (!licenseKey) {
    return null;
  }

  try {
    // If online validation is requested or needed, perform it
    if (validateOnline || (await needsOnlineValidation(context))) {
      const validationResult = await validateLicense(context, licenseKey);
      return {
        licenseKey,
        ...validationResult,
        isOnlineValidationRequired: false,
        lastValidated: new Date().toISOString(),
      };
    }

    // Check if license is expired
    const isExpired = await isLicenseExpired(context);
    if (isExpired) {
      // For expired licenses, always validate online
      const validationResult = await validateLicense(context, licenseKey);
      return {
        licenseKey,
        ...validationResult,
        isOnlineValidationRequired: false,
        lastValidated: new Date().toISOString(),
      };
    }

    // Return offline validation result
    return {
      licenseKey,
      isValid: true,
      isExpired: false,
      isOnlineValidationRequired: await needsOnlineValidation(context),
      lastValidated: new Date().toISOString(),
    };
  } catch (error) {
    console.error("License validation failed:", error);
    return {
      licenseKey,
      isValid: false,
      isExpired: true,
      isOnlineValidationRequired: true,
      lastValidated: new Date().toISOString(),
    };
  }
}

/**
 * Options for tagging a function with license validation
 */
export interface TagOptions {
  type: "free" | "paid";
  activationMessage?: string;
  activationCtaTitle?: string;
  reactivationMessage?: string;
  reactivationCtaTitle?: string;
}

/**
 * Tags a function with license validation
 * @param context - The extension context
 * @param options - Configuration options for the tag
 * @param fn - Function to wrap with license validation
 * @returns Tagged function that performs license validation before execution
 */
export function tagCommand<T extends (...args: any[]) => any>(
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
    try {
      // Get and validate license
      const licenseData = await getLicense(context, false);

      // Handle no license case
      if (!licenseData || !licenseData.licenseKey) {
        const message =
          options.activationMessage || "This feature requires a valid license.";
        const ctaTitle = options.activationCtaTitle || "Purchase License";
        await showActivationPrompt(extensionName, message, ctaTitle);
        return undefined as UnwrapPromise<ReturnType<T>>;
      }

      // Handle expired or invalid license
      if (!licenseData.isValid || licenseData.isExpired) {
        const message =
          options.reactivationMessage || "Your license has expired.";
        const ctaTitle = options.reactivationCtaTitle || "Purchase License";
        await showActivationPrompt(extensionName, message, ctaTitle);
        return undefined as UnwrapPromise<ReturnType<T>>;
      }

      // Handle online validation requirement
      if (licenseData.isOnlineValidationRequired) {
        const validationResult = await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: "Validating license...",
            cancellable: false,
          },
          () => validateLicense(context, licenseData.licenseKey!),
        );

        if (!validationResult.isValid) {
          await showActivationPrompt(
            extensionName,
            validationResult.message || "Your license is invalid.",
            "Purchase License",
          );
          return undefined as UnwrapPromise<ReturnType<T>>;
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
        `Unable to validate license: ${error instanceof Error ? error.message : "Unknown error"}`,
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
  extensionName: string,
  message = "This feature requires a valid license.",
  ctaTitle = "Purchase License",
): Promise<void> {
  const response = await vscode.window.showInformationMessage(
    message,
    { modal: false },
    ctaTitle,
  );

  if (response === ctaTitle) {
    await vscode.commands.executeCommand(
      `${extensionName}.purchaseLicenseCommand`,
    );
  }
}
