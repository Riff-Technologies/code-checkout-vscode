import { BrowserStorage } from "../private/browser-storage";
import { NodeStorage } from "../private/node-storage";
import * as fs from "fs/promises";
import * as path from "path";
import os from "os";

describe("Storage Implementations", () => {
  describe("BrowserStorage", () => {
    let storage: BrowserStorage;
    const testPrefix = "test_";

    beforeEach(() => {
      // Clear localStorage before each test
      localStorage.clear();
      storage = new BrowserStorage(testPrefix);
    });

    it("should store and retrieve items", async () => {
      const key = "testKey";
      const value = "testValue";

      await storage.setItem(key, value);
      const retrieved = await storage.getItem(key);

      expect(retrieved).toBe(value);
      expect(localStorage.getItem(testPrefix + key)).toBe(value);
    });

    it("should return null for non-existent items", async () => {
      const retrieved = await storage.getItem("nonexistent");
      expect(retrieved).toBeNull();
    });

    it("should remove items", async () => {
      const key = "testKey";
      const value = "testValue";

      await storage.setItem(key, value);
      await storage.removeItem(key);

      const retrieved = await storage.getItem(key);
      expect(retrieved).toBeNull();
      expect(localStorage.getItem(testPrefix + key)).toBeNull();
    });
  });

  describe("NodeStorage", () => {
    let storage: NodeStorage;
    let tempDir: string;

    beforeEach(async () => {
      // Create a temporary directory for testing
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "license-test-"));
      storage = new NodeStorage(tempDir);
    });

    afterEach(async () => {
      // Clean up temporary directory after each test
      await fs.rm(tempDir, { recursive: true, force: true });
    });

    it("should store and retrieve items", async () => {
      const key = "testKey";
      const value = "testValue";

      await storage.setItem(key, value);
      const retrieved = await storage.getItem(key);

      expect(retrieved).toBe(value);

      // Verify file exists
      const filePath = path.join(tempDir, `${key}.json`);
      const fileExists = await fs
        .access(filePath)
        .then(() => true)
        .catch(() => false);
      expect(fileExists).toBe(true);
    });

    it("should return null for non-existent items", async () => {
      const retrieved = await storage.getItem("nonexistent");
      expect(retrieved).toBeNull();
    });

    it("should remove items", async () => {
      const key = "testKey";
      const value = "testValue";

      await storage.setItem(key, value);
      await storage.removeItem(key);

      const retrieved = await storage.getItem(key);
      expect(retrieved).toBeNull();

      // Verify file doesn't exist
      const filePath = path.join(tempDir, `${key}.json`);
      const fileExists = await fs
        .access(filePath)
        .then(() => true)
        .catch(() => false);
      expect(fileExists).toBe(false);
    });

    it("should handle concurrent operations", async () => {
      const key = "testKey";
      const values = Array.from({ length: 10 }, (_, i) => `value${i}`);

      // Perform multiple concurrent write operations
      await Promise.all(values.map((value) => storage.setItem(key, value)));

      // The final value should be the last one written
      const retrieved = await storage.getItem(key);
      expect(retrieved).toBe(values[values.length - 1]);
    });

    it("should create storage directory if it doesn't exist", async () => {
      const newTempDir = path.join(tempDir, "nested", "storage");
      const newStorage = new NodeStorage(newTempDir);

      await newStorage.setItem("test", "value");

      const dirExists = await fs
        .access(newTempDir)
        .then(() => true)
        .catch(() => false);
      expect(dirExists).toBe(true);
    });
  });
});
