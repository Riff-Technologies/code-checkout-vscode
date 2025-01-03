import * as vscode from "vscode";

/**
 * Options interface for the tag wrapper
 */
interface TagOptions {
  type: "paid" | "free" | "free-trial";
}

/**
 * Response from license validation
 */
interface LicenseValidationResponse {
  isValid: boolean;
  message?: string;
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
    const secretStorage = await getSecretStorage();
    const licenseKey = await secretStorage.get("license-key");

    if (!licenseKey) {
      await showActivationPrompt();
      return undefined as ReturnType<T>;
    }

    try {
      const isValid = await validateLicense(licenseKey);
      if (!isValid) {
        await showActivationPrompt("Your license key is invalid or expired.");
        return undefined as ReturnType<T>;
      }

      // License is valid, execute the original function
      return fn(...args);
    } catch (error) {
      console.error("License validation failed:", error);
      await vscode.window.showErrorMessage(
        "Unable to validate license. Please check your internet connection."
      );
      return undefined as ReturnType<T>;
    }
  }) as T;
}

/**
 * Gets the secret storage for the extension
 * @returns The secret storage instance
 */
async function getSecretStorage(): Promise<vscode.SecretStorage> {
  const extension = vscode.extensions.getExtension("your-extension-id");
  if (!extension) {
    throw new Error("Extension not found");
  }

  await extension.activate();
  return extension.exports.secretStorage;
}

/**
 * Validates the license key with the server
 * @param licenseKey - The license key to validate
 * @returns Whether the license is valid
 */
async function validateLicense(licenseKey: string): Promise<boolean> {
  try {
    // Mock API request - replace with actual API endpoint
    const response = await fetch(
      "https://api.yourserver.com/validate-license",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ licenseKey }),
      }
    );

    if (!response.ok) {
      throw new Error("License validation failed");
    }

    const data = (await response.json()) as LicenseValidationResponse;
    return data.isValid;
  } catch (error) {
    console.error("License validation error:", error);
    throw error;
  }
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
