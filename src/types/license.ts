/**
 * Represents the status of a license
 */
export type LicenseStatus = "active" | "expired" | "revoked" | "grace";

/**
 * Interface for license data stored locally
 */
export interface LocalLicenseData {
  /** The license key */
  key: string;
  /** When the license was last validated online */
  lastValidated: string;
  /** When the license expires */
  expiresAt: string;
  /** Current status of the license */
  status: LicenseStatus;
  /** Grace period configuration in milliseconds */
  gracePeriodMs: number;
  /** Last time the license was used offline */
  lastOfflineUse?: string;
}

/**
 * Interface for license validation response from server
 */
export interface LicenseValidationResponse {
  /** Whether the license is valid */
  isValid: boolean;
  /** Optional message about the license status */
  message?: string;
  /** When the license expires */
  expiresAt: string;
  /** Whether the license has been revoked */
  isRevoked: boolean;
  /** Grace period in milliseconds for offline use */
  gracePeriodMs: number;
}

/**
 * Configuration options for license validation
 */
export interface LicenseValidationOptions {
  /** Whether to allow offline validation */
  allowOffline?: boolean;
  /** Whether to enforce strict validation (no grace period) */
  strict?: boolean;
  /** Custom grace period in milliseconds */
  gracePeriodMs?: number;
}

/**
 * Result of a license validation check
 */
export interface LicenseValidationResult {
  /** Whether the license is valid */
  isValid: boolean;
  /** Status of the license */
  status: LicenseStatus;
  /** Message explaining the validation result */
  message: string;
  /** Whether the validation was performed offline */
  wasOffline: boolean;
}
