import * as vscode from "vscode";
import * as os from "os";
import * as crypto from "crypto";

const API_ENDPOINT = "https://api.riff-tech.com/v1/validate";
const DEV_API_ENDPOINT = "https://dev-api.riff-tech.com/v1/validate";

interface ValidationResult {
  isValid: boolean;
  message?: string;
  expiresOn?: string;
  offlineGracePeriodUsed?: boolean;
}

interface LicenseData {
  key: string;
  expiresOn: string;
  lastValidated: string;
  machineId: string;
}

/**
 * Generates a unique machine identifier based on hardware information
 * This ID will persist across extension reinstalls
 */
async function generateMachineId(): Promise<string> {
  // Combine multiple system-specific values
  const values = [
    os.hostname(),
    os.platform(),
    os.arch(),
    os.cpus()[0]?.model || "",
    os.totalmem().toString(),
    // Get VSCode's machineId which is stable across VSCode reinstalls
    vscode.env.machineId,
    // Get VSCode's sessionId which is stable across extension reinstalls
    vscode.env.sessionId,
  ];

  // Create a hash of the combined values
  const hash = crypto.createHash("sha256");
  values.forEach((value) => hash.update(value));
  return hash.digest("hex");
}

/**
 * Generates a unique license key
 * @returns A unique license key
 */
export function generateLicenseKey(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  return `${timestamp}-${random}`.toUpperCase();
}

/**
 * Interface for storage implementations to persist license data
 */
export interface Storage {
  /**
   * Gets an item from storage
   * @param key - The key to retrieve
   * @returns Promise resolving to the stored value or null if not found
   */
  getItem(key: string): Promise<string | null>;

  /**
   * Sets an item in storage
   * @param key - The key to store
   * @param value - The value to store
   */
  setItem(key: string, value: string): Promise<void>;

  /**
   * Removes an item from storage
   * @param key - The key to remove
   */
  removeItem(key: string): Promise<void>;
}

/**
 * Stores license data in VSCode's secret storage
 */
async function storeLicenseData(
  context: vscode.ExtensionContext,
  data: LicenseData,
): Promise<void> {
  const config = vscode.workspace.getConfiguration(
    context.extension.packageJSON.name,
  );
  await config.update(
    "license-key",
    data.key,
    vscode.ConfigurationTarget.Global,
  );
  await context.secrets.store("license-expires", data.expiresOn);
  await context.secrets.store("license-last-validated", data.lastValidated);
  await context.secrets.store("license-machine-id", data.machineId);
}

/**
 * Clears stored license data
 */
async function clearLicenseData(
  context: vscode.ExtensionContext,
): Promise<void> {
  const config = vscode.workspace.getConfiguration(
    context.extension.packageJSON.name,
  );
  await config.update("license-key", "", vscode.ConfigurationTarget.Global);
  await context.secrets.delete("license-expires");
  await context.secrets.delete("license-last-validated");
  await context.secrets.delete("license-machine-id");
}

/**
 * Gets stored license data
 */
async function getLicenseData(
  context: vscode.ExtensionContext,
): Promise<LicenseData | null> {
  const config = vscode.workspace.getConfiguration(
    context.extension.packageJSON.name,
  );
  const key = config.get<string>("license-key", "");
  const expiresOn = await context.secrets.get("license-expires");
  const lastValidated = await context.secrets.get("license-last-validated");
  const machineId = await context.secrets.get("license-machine-id");

  if (!key || !expiresOn || !lastValidated || !machineId) {
    return null;
  }

  return {
    key,
    expiresOn,
    lastValidated,
    machineId,
  };
}

/**
 * Revokes the stored license
 */
export async function revokeLicense(
  context: vscode.ExtensionContext,
): Promise<void> {
  // show a confirmation dialog
  const result = await vscode.window.showInformationMessage(
    "Are you sure you want to revoke your license?",
    { modal: true },
    "Revoke License",
  );
  if (result === "Revoke License") {
    await clearLicenseData(context);
    await vscode.window.showInformationMessage("License revoked successfully!");
  }
}

/**
 * Validates a license key with the server
 * @param context - The extension context
 * @param licenseKey - The license key to validate (will be used as API key)
 * @param gracePeriodDays - Number of days to allow offline usage
 */
export async function validateLicense(
  context: vscode.ExtensionContext,
  licenseKey: string,
  testMode = false,
  gracePeriodDays = 3,
): Promise<ValidationResult> {
  try {
    try {
      let response: Response | undefined;
      const machineId = await generateMachineId();

      const MOCK_MODE = false;
      if (MOCK_MODE) {
        response = new Response(
          JSON.stringify({
            isValid: true,
            message: "MOCK - License validated offline using grace period",
            expiresOn: new Date(
              Date.now() + 30 * 24 * 60 * 60 * 1000,
            ).toISOString(),
          }),
        );
      } else {
        // Add logging to debug request
        const requestBody = {
          machineId,
          sessionId: vscode.env.sessionId,
          extensionId: context.extension.id,
          environment: {
            ideVersion: vscode.version,
            ideName: vscode.env.appName,
            extensionVersion: context.extension.packageJSON.version,
            platform: os.platform(),
            release: os.release(),
          },
        };

        const endpoint = testMode ? DEV_API_ENDPOINT : API_ENDPOINT;
        console.log("License validation request:", {
          endpoint,
          licenseKey: "***", // masked for security
          body: requestBody,
        });

        response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${licenseKey}`,
          },
          body: JSON.stringify(requestBody),
        });
      }

      // Add response validation
      if (!response) {
        throw new Error("No response received from license validation");
      }

      // Log response status and headers
      console.log("License validation response:", {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });

      if (response.status === 403) {
        // Clear any existing license if validation failed
        await clearLicenseData(context);
        throw new Error("Invalid license key");
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `License validation failed: ${response.status} - ${errorText}`,
        );
      }

      // Parse JSON response directly since Content-Type is now correct
      const result = await response.json();

      // Log the successful parse
      console.log("Successfully parsed response:", result);

      if (result.isValid) {
        // Store the license data with machine ID
        await storeLicenseData(context, {
          key: licenseKey,
          expiresOn: result.expiresOn,
          lastValidated: new Date().toISOString(),
          machineId,
        });
      } else {
        // Clear any existing license if validation failed
        await clearLicenseData(context);
      }

      return {
        isValid: result.isValid,
        message: result.message,
        expiresOn: result.expiresOn,
      };
    } catch (networkError) {
      // Handle offline scenario
      const existingLicense = await getLicenseData(context);

      // If there's no existing license data, we can't provide offline access
      if (!existingLicense) {
        return {
          isValid: false,
          message:
            "License validation requires internet connection for first-time activation",
        };
      }

      // Check if the provided key matches the stored key
      if (existingLicense.key !== licenseKey) {
        return {
          isValid: false,
          message: "License key mismatch during offline validation",
        };
      }

      // Check if the license is expired
      const expirationDate = new Date(existingLicense.expiresOn);
      if (expirationDate <= new Date()) {
        return {
          isValid: false,
          message:
            "License has expired. Online validation required for renewal.",
        };
      }

      // Check if we're within the grace period
      const lastValidated = new Date(existingLicense.lastValidated);
      const gracePeriodMs = gracePeriodDays * 24 * 60 * 60 * 1000;
      if (Date.now() - lastValidated.getTime() > gracePeriodMs) {
        return {
          isValid: false,
          message:
            "Offline grace period has expired. Please connect to the internet to validate your license.",
        };
      }

      // License is valid within grace period
      return {
        isValid: true,
        message: "License validated offline using grace period",
        expiresOn: existingLicense.expiresOn,
        offlineGracePeriodUsed: true,
      };
    }
  } catch (error) {
    throw new Error(
      `Failed to validate license: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    );
  }
}

/**
 * Gets the stored license key if any
 */
export async function getStoredLicense(
  context: vscode.ExtensionContext,
): Promise<string | undefined> {
  const config = vscode.workspace.getConfiguration(
    context.extension.packageJSON.name,
  );
  return config.get<string>("license-key", "");
}

/**
 * Checks if the stored license is expired
 */
export async function isLicenseExpired(
  context: vscode.ExtensionContext,
): Promise<boolean> {
  const data = await getLicenseData(context);
  if (!data) {
    return true;
  }

  return new Date(data.expiresOn) <= new Date();
}

/**
 * Checks if the license needs online validation
 * @param gracePeriodDays - Number of days to allow between online validations
 */
export async function needsOnlineValidation(
  context: vscode.ExtensionContext,
  gracePeriodDays = 3,
): Promise<boolean> {
  const data = await getLicenseData(context);
  if (!data) {
    return true;
  }

  const lastValidated = new Date(data.lastValidated);
  const gracePeriodMs = gracePeriodDays * 24 * 60 * 60 * 1000;
  return Date.now() - lastValidated.getTime() > gracePeriodMs;
}
