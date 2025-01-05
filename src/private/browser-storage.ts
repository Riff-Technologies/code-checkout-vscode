import { Storage } from "./license-manager";

/**
 * Browser-based implementation of the Storage interface using localStorage
 */
export class BrowserStorage implements Storage {
  private prefix: string;

  /**
   * Creates a new instance of BrowserStorage
   * @param prefix - Prefix for storage keys to avoid conflicts
   */
  constructor(prefix = "paywall_") {
    this.prefix = prefix;
  }

  /**
   * Gets an item from localStorage
   * @param key - The key to retrieve
   * @returns The stored value or null if not found
   */
  public async getItem(key: string): Promise<string | null> {
    return localStorage.getItem(this.prefix + key);
  }

  /**
   * Sets an item in localStorage
   * @param key - The key to store
   * @param value - The value to store
   */
  public async setItem(key: string, value: string): Promise<void> {
    localStorage.setItem(this.prefix + key, value);
  }

  /**
   * Removes an item from localStorage
   * @param key - The key to remove
   */
  public async removeItem(key: string): Promise<void> {
    localStorage.removeItem(this.prefix + key);
  }
}
