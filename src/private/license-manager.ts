import {
  LicenseStatus,
  LocalLicenseData,
  LicenseValidationResponse,
  LicenseValidationOptions,
  LicenseValidationResult,
} from "../types/license";

/**
 * Default grace period of 7 days in milliseconds
 */
const DEFAULT_GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Manages license validation, storage, and offline capabilities
 */
export class LicenseManager {
  private storage: Storage;
  private apiEndpoint: string;
  private storageKey: string;

  /**
   * Creates a new instance of LicenseManager
   * @param storage - Storage implementation for persisting license data
   * @param apiEndpoint - Endpoint for license validation
   * @param storageKey - Key used to store license data
   */
  constructor(
    storage: Storage,
    apiEndpoint: string,
    storageKey = "license_data"
  ) {
    this.storage = storage;
    this.apiEndpoint = apiEndpoint;
    this.storageKey = storageKey;
  }

  /**
   * Validates a license key with the server
   * @param licenseKey - The license key to validate
   * @returns The validation response from the server
   */
  private async validateWithServer(
    licenseKey: string
  ): Promise<LicenseValidationResponse> {
    try {
      const response = await fetch(this.apiEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ licenseKey }),
      });

      if (!response.ok) {
        throw new Error("License validation failed");
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Failed to validate license: ${error}`);
    }
  }

  /**
   * Stores license data locally
   * @param data - The license data to store
   */
  private async storeLicenseData(data: LocalLicenseData): Promise<void> {
    await this.storage.setItem(this.storageKey, JSON.stringify(data));
  }

  /**
   * Retrieves stored license data
   * @returns The stored license data or null if not found
   */
  private async getStoredLicenseData(): Promise<LocalLicenseData | null> {
    const data = await this.storage.getItem(this.storageKey);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Validates a license offline using stored data
   * @param storedData - The stored license data
   * @param options - Validation options
   * @returns The validation result
   */
  private validateOffline(
    storedData: LocalLicenseData,
    options: LicenseValidationOptions
  ): LicenseValidationResult {
    const now = new Date();
    const expiresAt = new Date(storedData.expiresAt);
    const lastValidated = new Date(storedData.lastValidated);
    const gracePeriodMs = options.gracePeriodMs ?? storedData.gracePeriodMs;

    // Check if license is expired
    if (now > expiresAt) {
      return {
        isValid: false,
        status: "expired",
        message: "License has expired",
        wasOffline: true,
      };
    }

    // Check if we're within grace period
    const timeSinceLastValidation = now.getTime() - lastValidated.getTime();
    if (timeSinceLastValidation <= gracePeriodMs) {
      return {
        isValid: true,
        status: "grace",
        message: "License validated offline within grace period",
        wasOffline: true,
      };
    }

    return {
      isValid: false,
      status: "expired",
      message: "License requires online validation - grace period expired",
      wasOffline: true,
    };
  }

  /**
   * Validates a license key
   * @param licenseKey - The license key to validate
   * @param options - Validation options
   * @returns The validation result
   */
  public async validateLicense(
    licenseKey: string,
    options: LicenseValidationOptions = {}
  ): Promise<LicenseValidationResult> {
    try {
      // Try online validation first
      const serverResponse = await this.validateWithServer(licenseKey);

      // Handle revoked license
      if (serverResponse.isRevoked) {
        // Clear stored data for revoked license
        await this.storage.removeItem(this.storageKey);
        return {
          isValid: false,
          status: "revoked",
          message: "License has been revoked",
          wasOffline: false,
        };
      }

      // Store the updated license data
      const licenseData: LocalLicenseData = {
        key: licenseKey,
        lastValidated: new Date().toISOString(),
        expiresAt: serverResponse.expiresAt,
        status: serverResponse.isValid ? "active" : "expired",
        gracePeriodMs: serverResponse.gracePeriodMs || DEFAULT_GRACE_PERIOD_MS,
      };
      await this.storeLicenseData(licenseData);

      return {
        isValid: serverResponse.isValid,
        status: serverResponse.isValid ? "active" : "expired",
        message: serverResponse.message || "License validated successfully",
        wasOffline: false,
      };
    } catch (error) {
      // Handle offline validation if allowed
      if (options.allowOffline) {
        const storedData = await this.getStoredLicenseData();
        if (storedData && storedData.key === licenseKey) {
          return this.validateOffline(storedData, options);
        }
      }

      throw error;
    }
  }

  /**
   * Clears stored license data
   */
  public async clearLicense(): Promise<void> {
    await this.storage.removeItem(this.storageKey);
  }
}

/**
 * Interface for storage implementations
 */
export interface Storage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}
