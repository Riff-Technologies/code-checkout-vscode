import * as vscode from "vscode";
import {
  validateLicense,
  getStoredLicense,
  isLicenseExpired,
  needsOnlineValidation,
} from "../private/license-validator";

// Mock VSCode extension context
const mockContext: vscode.ExtensionContext = {
  extensionPath: "/fake/path",
  secrets: {
    store: jest.fn(),
    get: jest.fn<Thenable<string | undefined>, [string]>(),
    delete: jest.fn(),
  },
} as unknown as vscode.ExtensionContext;

// Mock fs module
jest.mock("fs", () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
}));

// Mock fetch
global.fetch = jest.fn();

describe("License Validator", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock the secret in VSCode storage
    (mockContext.secrets.get as jest.Mock).mockImplementation((key: string) => {
      if (key === "CODE_CHECKOUT_SECRET") {
        return Promise.resolve("test-secret");
      }
      return Promise.resolve(undefined);
    });

    // Mock fetch response
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          isValid: true,
          expiresAt: new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000,
          ).toISOString(),
        }),
    });
  });

  describe("validateLicense", () => {
    it("should fail if secret is not in storage", async () => {
      // Override the mock to return no secret
      (mockContext.secrets.get as jest.Mock).mockImplementation(() =>
        Promise.resolve(undefined),
      );

      await expect(validateLicense(mockContext, "valid-key")).rejects.toThrow(
        "CODE_CHECKOUT_SECRET is not set",
      );
    });

    it("should validate a license successfully online", async () => {
      const result = await validateLicense(mockContext, "valid-key");

      expect(result.isValid).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(1);
      // Verify API key derivation by checking fetch headers
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            "X-API-Key": expect.any(String),
          }),
        }),
      );
      expect(mockContext.secrets.store).toHaveBeenCalledTimes(3); // Stores key, expiry, and last validated
    });

    it("should handle invalid licenses from server", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            isValid: false,
            message: "Invalid license key",
          }),
      });

      const result = await validateLicense(mockContext, "invalid-key");

      expect(result.isValid).toBe(false);
      expect(result.message).toBe("Invalid license key");
      expect(mockContext.secrets.delete).toHaveBeenCalledTimes(3); // Clears stored data
    });

    it("should handle offline validation with valid stored license", async () => {
      // Mock network failure
      (global.fetch as jest.Mock).mockRejectedValue(new Error("Network error"));

      // Mock stored license data
      const storedKey = "stored-key";
      const futureDate = new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000,
      ).toISOString();
      const recentDate = new Date(
        Date.now() - 1 * 24 * 60 * 60 * 1000,
      ).toISOString();

      (mockContext.secrets.get as jest.Mock).mockImplementation(
        (key: string) => {
          switch (key) {
            case "CODE_CHECKOUT_SECRET":
              return Promise.resolve("test-secret");
            case "license-key":
              return Promise.resolve(storedKey);
            case "license-expires":
              return Promise.resolve(futureDate);
            case "license-last-validated":
              return Promise.resolve(recentDate);
            default:
              return Promise.resolve(null);
          }
        },
      );

      const result = await validateLicense(mockContext, storedKey);

      expect(result.isValid).toBe(true);
      expect(result.offlineGracePeriodUsed).toBe(true);
    });

    it("should reject offline validation with expired grace period", async () => {
      // Mock network failure
      (global.fetch as jest.Mock).mockRejectedValue(new Error("Network error"));

      // Mock stored license data with old validation date
      const storedKey = "stored-key";
      const futureDate = new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000,
      ).toISOString();
      const oldDate = new Date(
        Date.now() - 8 * 24 * 60 * 60 * 1000,
      ).toISOString();

      (mockContext.secrets.get as jest.Mock).mockImplementation(
        (key: string) => {
          switch (key) {
            case "CODE_CHECKOUT_SECRET":
              return Promise.resolve("test-secret");
            case "license-key":
              return Promise.resolve(storedKey);
            case "license-expires":
              return Promise.resolve(futureDate);
            case "license-last-validated":
              return Promise.resolve(oldDate);
            default:
              return Promise.resolve(null);
          }
        },
      );

      const result = await validateLicense(mockContext, storedKey);

      expect(result.isValid).toBe(false);
      expect(result.message).toContain("Offline grace period has expired");
    });
  });

  describe("getStoredLicense", () => {
    it("should return stored license key", async () => {
      const storedKey = "stored-key";
      (mockContext.secrets.get as jest.Mock).mockImplementation(
        (key: string) => {
          if (key === "license-key") {
            return Promise.resolve(storedKey);
          }
          return Promise.resolve("test-secret"); // Keep the secret available
        },
      );

      const result = await getStoredLicense(mockContext);

      expect(result).toBe(storedKey);
      expect(mockContext.secrets.get).toHaveBeenCalledWith("license-key");
    });

    it("should return undefined when no license is stored", async () => {
      (mockContext.secrets.get as jest.Mock).mockResolvedValue(undefined);

      const result = await getStoredLicense(mockContext);

      expect(result).toBeUndefined();
    });
  });

  describe("isLicenseExpired", () => {
    it("should return true for expired license", async () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // 1 day ago
      (mockContext.secrets.get as jest.Mock).mockImplementation(
        (key: string) => {
          switch (key) {
            case "license-key":
              return Promise.resolve("some-key");
            case "license-expires":
              return Promise.resolve(pastDate);
            case "license-last-validated":
              return Promise.resolve(pastDate);
            default:
              return Promise.resolve(null);
          }
        },
      );

      const result = await isLicenseExpired(mockContext);

      expect(result).toBe(true);
    });

    it("should return false for valid license", async () => {
      const futureDate = new Date(
        Date.now() + 24 * 60 * 60 * 1000,
      ).toISOString(); // 1 day from now
      (mockContext.secrets.get as jest.Mock).mockImplementation(
        (key: string) => {
          switch (key) {
            case "license-key":
              return Promise.resolve("some-key");
            case "license-expires":
              return Promise.resolve(futureDate);
            case "license-last-validated":
              return Promise.resolve(futureDate);
            default:
              return Promise.resolve(null);
          }
        },
      );

      const result = await isLicenseExpired(mockContext);

      expect(result).toBe(false);
    });
  });

  describe("needsOnlineValidation", () => {
    it("should return true when last validation is beyond grace period", async () => {
      const oldDate = new Date(
        Date.now() - 8 * 24 * 60 * 60 * 1000,
      ).toISOString(); // 8 days ago
      (mockContext.secrets.get as jest.Mock).mockImplementation(
        (key: string) => {
          switch (key) {
            case "license-key":
              return Promise.resolve("some-key");
            case "license-expires":
              return Promise.resolve(oldDate);
            case "license-last-validated":
              return Promise.resolve(oldDate);
            default:
              return Promise.resolve(null);
          }
        },
      );

      const result = await needsOnlineValidation(mockContext);

      expect(result).toBe(true);
    });

    it("should return false when last validation is within grace period", async () => {
      const recentDate = new Date(
        Date.now() - 1 * 24 * 60 * 60 * 1000,
      ).toISOString(); // 1 day ago
      (mockContext.secrets.get as jest.Mock).mockImplementation(
        (key: string) => {
          switch (key) {
            case "license-key":
              return Promise.resolve("some-key");
            case "license-expires":
              return Promise.resolve(recentDate);
            case "license-last-validated":
              return Promise.resolve(recentDate);
            default:
              return Promise.resolve(null);
          }
        },
      );

      const result = await needsOnlineValidation(mockContext);

      expect(result).toBe(false);
    });
  });
});
