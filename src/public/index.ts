import { tagFunction } from "./tag";
import { withActivateCommand, injectActivateCommand } from "./activate";
import { LicenseManager } from "../private/license-manager";
import { BrowserStorage } from "../private/browser-storage";
import { NodeStorage } from "../private/node-storage";
import {
  LicenseStatus,
  LicenseValidationOptions,
  LicenseValidationResult,
} from "../types/license";

export {
  tagFunction,
  withActivateCommand,
  injectActivateCommand,
  LicenseStatus,
  LicenseValidationOptions,
  LicenseValidationResult,
};

/**
 * Configuration options for creating a license manager
 */
export interface LicenseManagerConfig {
  /** API endpoint for license validation */
  apiEndpoint: string;
  /** Storage type to use */
  storageType: "browser" | "node";
  /** Storage path for Node.js storage (required if storageType is "node") */
  storagePath?: string;
  /** Storage key prefix (optional) */
  storageKeyPrefix?: string;
}

/**
 * Creates a new license manager instance
 * @param config - Configuration options
 * @returns A new LicenseManager instance
 */
export function createLicenseManager(
  config: LicenseManagerConfig
): LicenseManager {
  if (config.storageType === "node" && !config.storagePath) {
    throw new Error("storagePath is required for Node.js storage");
  }

  const storage =
    config.storageType === "browser"
      ? new BrowserStorage(config.storageKeyPrefix)
      : new NodeStorage(config.storagePath as string);

  return new LicenseManager(storage, config.apiEndpoint);
}
