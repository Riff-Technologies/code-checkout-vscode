import * as vscode from "vscode";

const API_ENDPOINT = "https://api.riff.codes/validate-license"; // Your actual API endpoint

interface ValidationResult {
  isValid: boolean;
  message?: string;
  expiresAt?: string;
  offlineGracePeriodUsed?: boolean;
}

interface LicenseData {
  key: string;
  expiresAt: string;
  lastValidated: string;
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
  await context.secrets.store("license-key", data.key);
  await context.secrets.store("license-expires", data.expiresAt);
  await context.secrets.store("license-last-validated", data.lastValidated);
}

/**
 * Clears stored license data
 */
async function clearLicenseData(
  context: vscode.ExtensionContext,
): Promise<void> {
  await context.secrets.delete("license-key");
  await context.secrets.delete("license-expires");
  await context.secrets.delete("license-last-validated");
}

/**
 * Gets stored license data
 */
async function getLicenseData(
  context: vscode.ExtensionContext,
): Promise<LicenseData | null> {
  const key = await context.secrets.get("license-key");
  const expiresAt = await context.secrets.get("license-expires");
  const lastValidated = await context.secrets.get("license-last-validated");

  if (!key || !expiresAt || !lastValidated) {
    return null;
  }

  return {
    key,
    expiresAt,
    lastValidated,
  };
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
  gracePeriodDays = 7,
): Promise<ValidationResult> {
  try {
    try {
      const MOCK_MODE = true;
      if (MOCK_MODE) {
        return {
          isValid: true,
          message: "License validated offline using grace period",
          expiresAt: new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000,
          ).toISOString(),
        };
      }
      // Attempt online validation using license key as API key
      const response = await fetch(API_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${licenseKey}`, // Use license key as Bearer token
        },
      });

      if (!response.ok) {
        throw new Error("License validation failed");
      }

      const result = await response.json();

      if (result.isValid) {
        // Store the license data
        await storeLicenseData(context, {
          key: licenseKey,
          expiresAt: result.expiresAt,
          lastValidated: new Date().toISOString(),
        });
      } else {
        // Clear any existing license if validation failed
        await clearLicenseData(context);
      }

      return {
        isValid: result.isValid,
        message: result.message,
        expiresAt: result.expiresAt,
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
      const expirationDate = new Date(existingLicense.expiresAt);
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
        expiresAt: existingLicense.expiresAt,
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
  return context.secrets.get("license-key");
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

  return new Date(data.expiresAt) <= new Date();
}

/**
 * Checks if the license needs online validation
 * @param gracePeriodDays - Number of days to allow between online validations
 */
export async function needsOnlineValidation(
  context: vscode.ExtensionContext,
  gracePeriodDays = 7,
): Promise<boolean> {
  const data = await getLicenseData(context);
  if (!data) {
    return true;
  }

  const lastValidated = new Date(data.lastValidated);
  const gracePeriodMs = gracePeriodDays * 24 * 60 * 60 * 1000;
  return Date.now() - lastValidated.getTime() > gracePeriodMs;
}
