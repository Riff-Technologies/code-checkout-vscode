import { LicenseManager } from "../private/license-manager";
import { LicenseValidationResponse } from "../types/license";
import type { Storage } from "../private/license-manager";

// Mock fetch globally
global.fetch = jest.fn();

describe("LicenseManager", () => {
  let storage: jest.Mocked<Storage>;
  let manager: LicenseManager;
  const apiEndpoint = "https://api.example.com/validate";
  const mockLicenseKey = "TEST-LICENSE-KEY";

  beforeEach(() => {
    // Reset fetch mock
    (global.fetch as jest.Mock).mockReset();

    // Create mock storage
    storage = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    };

    // Create license manager instance
    manager = new LicenseManager(storage, apiEndpoint);
  });

  describe("validateLicense", () => {
    const mockValidResponse: LicenseValidationResponse = {
      isValid: true,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
      isRevoked: false,
      gracePeriodMs: 7 * 24 * 60 * 60 * 1000, // 7 days
      message: "License is valid",
    };

    it("should validate a license online successfully", async () => {
      // Mock successful API response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockValidResponse),
      });

      const result = await manager.validateLicense(mockLicenseKey);

      expect(result.isValid).toBe(true);
      expect(result.status).toBe("active");
      expect(result.wasOffline).toBe(false);
      expect(storage.setItem).toHaveBeenCalled();
    });

    it("should handle revoked licenses", async () => {
      const mockRevokedResponse = {
        ...mockValidResponse,
        isValid: false,
        isRevoked: true,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockRevokedResponse),
      });

      const result = await manager.validateLicense(mockLicenseKey);

      expect(result.isValid).toBe(false);
      expect(result.status).toBe("revoked");
      expect(storage.removeItem).toHaveBeenCalled();
    });

    it("should validate offline when online validation fails", async () => {
      // Mock failed API request
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error("Network error")
      );

      // Mock stored license data
      const mockStoredData = {
        key: mockLicenseKey,
        lastValidated: new Date().toISOString(),
        expiresAt: new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000
        ).toISOString(),
        status: "active",
        gracePeriodMs: 7 * 24 * 60 * 60 * 1000,
      };

      storage.getItem.mockResolvedValueOnce(JSON.stringify(mockStoredData));

      const result = await manager.validateLicense(mockLicenseKey, {
        allowOffline: true,
      });

      expect(result.isValid).toBe(true);
      expect(result.status).toBe("grace");
      expect(result.wasOffline).toBe(true);
    });

    it("should reject offline validation when grace period expired", async () => {
      // Mock failed API request
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error("Network error")
      );

      // Mock stored license data with old validation date
      const mockStoredData = {
        key: mockLicenseKey,
        lastValidated: new Date(
          Date.now() - 8 * 24 * 60 * 60 * 1000
        ).toISOString(), // 8 days ago
        expiresAt: new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000
        ).toISOString(),
        status: "active",
        gracePeriodMs: 7 * 24 * 60 * 60 * 1000, // 7 days grace period
      };

      storage.getItem.mockResolvedValueOnce(JSON.stringify(mockStoredData));

      const result = await manager.validateLicense(mockLicenseKey, {
        allowOffline: true,
      });

      expect(result.isValid).toBe(false);
      expect(result.status).toBe("expired");
      expect(result.wasOffline).toBe(true);
    });

    it("should reject offline validation for expired licenses", async () => {
      // Mock failed API request
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error("Network error")
      );

      // Mock stored license data with expired date
      const mockStoredData = {
        key: mockLicenseKey,
        lastValidated: new Date().toISOString(),
        expiresAt: new Date(Date.now() - 1000).toISOString(), // Expired
        status: "active",
        gracePeriodMs: 7 * 24 * 60 * 60 * 1000,
      };

      storage.getItem.mockResolvedValueOnce(JSON.stringify(mockStoredData));

      const result = await manager.validateLicense(mockLicenseKey, {
        allowOffline: true,
      });

      expect(result.isValid).toBe(false);
      expect(result.status).toBe("expired");
      expect(result.wasOffline).toBe(true);
    });

    it("should throw error when offline validation is not allowed", async () => {
      // Mock failed API request
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error("Network error")
      );

      await expect(manager.validateLicense(mockLicenseKey)).rejects.toThrow();
    });
  });

  describe("clearLicense", () => {
    it("should clear stored license data", async () => {
      await manager.clearLicense();
      expect(storage.removeItem).toHaveBeenCalled();
    });
  });
});
