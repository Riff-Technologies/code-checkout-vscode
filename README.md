# Paywall License Management System

A TypeScript package that provides robust license management functionality with support for offline validation and license revocation.

## Features

- Online license validation
- Offline support with configurable grace periods
- License revocation support
- Browser and Node.js storage implementations
- TypeScript support with strict type checking

## Installation

```bash
npm install your-package-name
```

## Usage

### Basic Setup

```typescript
import { createLicenseManager, LicenseManagerConfig } from "your-package-name";

// Browser setup
const browserConfig: LicenseManagerConfig = {
  apiEndpoint: "https://your-api.com/validate-license",
  storageType: "browser",
  storageKeyPrefix: "myapp_", // optional
};

const browserLicenseManager = createLicenseManager(browserConfig);

// Node.js setup
const nodeConfig: LicenseManagerConfig = {
  apiEndpoint: "https://your-api.com/validate-license",
  storageType: "node",
  storagePath: "/path/to/storage",
};

const nodeLicenseManager = createLicenseManager(nodeConfig);
```

### License Validation

```typescript
import { LicenseValidationOptions } from "your-package-name";

// Basic validation
try {
  const result = await licenseManager.validateLicense("YOUR-LICENSE-KEY");
  if (result.isValid) {
    console.log("License is valid!");
  } else {
    console.log(`License invalid: ${result.message}`);
  }
} catch (error) {
  console.error("Validation failed:", error);
}

// Validation with offline support
const options: LicenseValidationOptions = {
  allowOffline: true,
  gracePeriodMs: 7 * 24 * 60 * 60 * 1000, // 7 days
};

try {
  const result = await licenseManager.validateLicense(
    "YOUR-LICENSE-KEY",
    options,
  );
  if (result.wasOffline) {
    console.log("Using offline validation");
  }
  // Handle result...
} catch (error) {
  console.error("Validation failed:", error);
}
```

### License States

The system supports the following license states:

- `active`: License is valid and active
- `expired`: License has expired
- `revoked`: License has been revoked by the server
- `grace`: License is being used in offline mode within the grace period

### API Response Format

Your license validation API endpoint should return responses in the following format:

```typescript
interface LicenseValidationResponse {
  isValid: boolean;
  message?: string;
  expiresOn: string;
  isRevoked: boolean;
  gracePeriodMs: number;
}
```

## Security Considerations

1. Always validate licenses server-side for critical operations
2. Use HTTPS for all API communications
3. Implement rate limiting on your validation endpoint
4. Consider implementing additional security measures like license key signing

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
