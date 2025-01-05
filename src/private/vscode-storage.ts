import * as vscode from "vscode";
import { Storage } from "./license-validator";

/**
 * VSCode-based implementation of the Storage interface using vscode.secrets
 */
export class VSCodeStorage implements Storage {
  private prefix: string;
  private secretStorage: vscode.SecretStorage;

  /**
   * Creates a new instance of VSCodeStorage
   * @param context - The VSCode extension context
   * @param prefix - Prefix for storage keys to avoid conflicts
   */
  constructor(context: vscode.ExtensionContext, prefix = "code_checkout_") {
    this.secretStorage = context.secrets;
    this.prefix = prefix;
  }

  /**
   * Gets an item from VSCode secret storage
   * @param key - The key to retrieve
   * @returns The stored value or null if not found
   */
  public async getItem(key: string): Promise<string | null> {
    const value = await this.secretStorage.get(this.prefix + key);
    return value ?? null;
  }

  /**
   * Sets an item in VSCode secret storage
   * @param key - The key to store
   * @param value - The value to store
   */
  public async setItem(key: string, value: string): Promise<void> {
    await this.secretStorage.store(this.prefix + key, value);
  }

  /**
   * Removes an item from VSCode secret storage
   * @param key - The key to remove
   */
  public async removeItem(key: string): Promise<void> {
    await this.secretStorage.delete(this.prefix + key);
  }
}
