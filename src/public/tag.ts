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
  console.log(
    "[getLicense] Starting license check with validateOnline:",
    validateOnline,
  );

  const licenseKey = await getStoredLicense(context);
  console.log(
    "[getLicense] Retrieved stored license:",
    licenseKey ? "Found" : "Not found",
  );

  if (!licenseKey) {
    console.log("[getLicense] No license key found, returning null");
    return null;
  }

  try {
    // If online validation is requested or needed, perform it
    const needsOnline = await needsOnlineValidation(context);
    console.log("[getLicense] Needs online validation:", needsOnline);

    if (validateOnline || needsOnline) {
      console.log("[getLicense] Performing online validation");
      const validationResult = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Validating license...",
          cancellable: false,
        },
        () => validateLicense(context, licenseKey),
      );
      console.log("[getLicense] Online validation result:", validationResult);
      return {
        licenseKey,
        ...validationResult,
        isOnlineValidationRequired: false,
        lastValidated: new Date().toISOString(),
      };
    }

    // Check if license is expired
    const isExpired = await isLicenseExpired(context);
    console.log("[getLicense] License expired check:", isExpired);

    if (isExpired) {
      console.log("[getLicense] License expired, performing online validation");
      const validationResult = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Validating license...",
          cancellable: false,
        },
        () => validateLicense(context, licenseKey),
      );
      console.log(
        "[getLicense] Expired license validation result:",
        validationResult,
      );
      return {
        licenseKey,
        ...validationResult,
        isOnlineValidationRequired: false,
        lastValidated: new Date().toISOString(),
      };
    }

    // Return offline validation result
    const needsValidation = await needsOnlineValidation(context);
    console.log(
      "[getLicense] Final needs online validation check:",
      needsValidation,
    );

    // validate the license in the background
    validateLicense(context, licenseKey);

    const result = {
      licenseKey,
      isValid: true,
      isExpired: false,
      isOnlineValidationRequired: needsValidation,
      lastValidated: new Date().toISOString(),
    };
    console.log("[getLicense] Returning offline validation result:", result);
    return result;
  } catch (error) {
    console.error("[getLicense] License validation failed:", error);
    const errorResult = {
      licenseKey,
      isValid: false,
      isExpired: true,
      isOnlineValidationRequired: true,
      lastValidated: new Date().toISOString(),
    };
    console.log("[getLicense] Returning error result:", errorResult);
    return errorResult;
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
    console.log("[tagCommand] Free function, skipping validation");
    return fn;
  }

  // get just the extension name
  const { id: extensionId } = context.extension;
  const extensionNameComponents = extensionId.split(".");
  if (extensionNameComponents.length < 2) {
    console.error("[tagCommand] Invalid extension ID:", extensionId);
    throw new Error("Invalid extension ID");
  }
  const extensionName =
    extensionNameComponents[extensionNameComponents.length - 1];
  console.log("[tagCommand] Extension name:", extensionName);

  return (async (
    ...args: Parameters<T>
  ): Promise<UnwrapPromise<ReturnType<T>>> => {
    try {
      console.log("[tagCommand] Starting license validation");
      // Get and validate license

      const licenseData = await getLicense(context, false);

      console.log("[tagCommand] License data:", {
        hasLicense: !!licenseData,
        hasLicenseKey: !!licenseData?.licenseKey,
        isValid: licenseData?.isValid,
        isExpired: licenseData?.isExpired,
        isOnlineValidationRequired: licenseData?.isOnlineValidationRequired,
      });

      // Handle no license case
      if (!licenseData || !licenseData.licenseKey) {
        console.log("[tagCommand] No license found");
        const message =
          options.activationMessage || "This feature requires a valid license.";
        const ctaTitle = options.activationCtaTitle || "Purchase License";
        await showActivationPrompt(extensionName, message, ctaTitle);
        return undefined as UnwrapPromise<ReturnType<T>>;
      }

      // Handle expired or invalid license
      if (!licenseData.isValid || licenseData.isExpired) {
        console.log("[tagCommand] License invalid or expired");
        const message =
          options.reactivationMessage || "Your license has expired.";
        const ctaTitle = options.reactivationCtaTitle || "Purchase License";
        await showActivationPrompt(extensionName, message, ctaTitle);
        return undefined as UnwrapPromise<ReturnType<T>>;
      }

      // Handle online validation requirement
      if (licenseData.isOnlineValidationRequired) {
        console.log("[tagCommand] Online validation required");
        const validationResult = await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: "Validating license...",
            cancellable: false,
          },
          () => validateLicense(context, licenseData.licenseKey!),
        );
        console.log("[tagCommand] Online validation result:", validationResult);

        if (!validationResult.isValid) {
          console.log("[tagCommand] Online validation failed");
          await showActivationPrompt(
            extensionName,
            validationResult.message || "Your license is invalid.",
            "Purchase License",
          );
          return undefined as UnwrapPromise<ReturnType<T>>;
        }
      }

      console.log(
        "[tagCommand] License validation successful, executing function",
      );
      // Execute the original function and handle both sync and async results
      const result = fn(...args);
      return result instanceof Promise
        ? ((await result) as UnwrapPromise<ReturnType<T>>)
        : (result as UnwrapPromise<ReturnType<T>>);
    } catch (error) {
      console.error("[tagCommand] License validation failed:", error);
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
