import * as fs from "fs/promises";
import * as path from "path";
import { Storage } from "./license-manager";

/**
 * Node.js-based implementation of the Storage interface using the file system
 */
export class NodeStorage implements Storage {
  private storagePath: string;

  /**
   * Creates a new instance of NodeStorage
   * @param storagePath - Directory path for storing license data
   */
  constructor(storagePath: string) {
    this.storagePath = storagePath;
  }

  /**
   * Gets the full path for a storage key
   * @param key - The storage key
   * @returns The full file path
   */
  private getFilePath(key: string): string {
    return path.join(this.storagePath, `${key}.json`);
  }

  /**
   * Ensures the storage directory exists
   */
  private async ensureDirectory(): Promise<void> {
    try {
      await fs.access(this.storagePath);
    } catch {
      await fs.mkdir(this.storagePath, { recursive: true });
    }
  }

  /**
   * Gets an item from file storage
   * @param key - The key to retrieve
   * @returns The stored value or null if not found
   */
  public async getItem(key: string): Promise<string | null> {
    try {
      const filePath = this.getFilePath(key);
      const data = await fs.readFile(filePath, "utf-8");
      return data;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }

  /**
   * Sets an item in file storage
   * @param key - The key to store
   * @param value - The value to store
   */
  public async setItem(key: string, value: string): Promise<void> {
    await this.ensureDirectory();
    const filePath = this.getFilePath(key);
    await fs.writeFile(filePath, value, "utf-8");
  }

  /**
   * Removes an item from file storage
   * @param key - The key to remove
   */
  public async removeItem(key: string): Promise<void> {
    try {
      const filePath = this.getFilePath(key);
      await fs.unlink(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }
}
