#!/usr/bin/env node

// your-package/src/install.ts
const fs = require("fs");
const path = require("path");

interface VSCodeCommand {
  command: string;
  title: string;
  category?: string;
}

interface VSCodeConfiguration {
  title: string;
  properties: {
    [key: string]: {
      type: string;
      default: string;
      description: string;
      scope: string;
    };
  };
}

interface PackageJson {
  name: string;
  displayName?: string;
  contributes?: {
    commands?: VSCodeCommand[];
    configuration?: VSCodeConfiguration;
  };
  activationEvents?: string[];
  [key: string]: unknown;
}

/**
 * Gets the extension information from the host package.json
 * @returns Object containing extension name and display name
 */
function getExtensionInfo(): { name: string; displayName: string } {
  const packageJsonPath = path.join(process.cwd(), "package.json");

  if (!fs.existsSync(packageJsonPath)) {
    throw new Error("Could not find package.json in extension directory");
  }

  const packageJson: PackageJson = JSON.parse(
    fs.readFileSync(packageJsonPath, "utf-8"),
  );

  if (!packageJson.name) {
    throw new Error("Extension package.json must contain a name field");
  }

  return {
    name: packageJson.name,
    displayName: packageJson.displayName || packageJson.name,
  };
}

/**
 * Updates package.json to include the postcompile script
 * @param packageJsonPath - Path to package.json
 * @returns true if package.json was modified
 */
function ensurePostCompileScript(packageJsonPath: string): boolean {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  const postCompileScript = "code-checkout-build";

  if (packageJson.scripts?.postcompile === postCompileScript) {
    return false;
  }

  packageJson.scripts = {
    ...packageJson.scripts,
    postcompile: postCompileScript,
  };

  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  return true;
}

/**
 * Updates the host extension's package.json with new commands
 */
function updatePackageJson(): void {
  try {
    const { name, displayName } = getExtensionInfo();
    const packageJsonPath = path.join(process.cwd(), "package.json");

    // Add postcompile script
    const wasModified = ensurePostCompileScript(packageJsonPath);
    if (wasModified) {
      console.log("Added postcompile script to package.json");
    }

    const packageJson: PackageJson = JSON.parse(
      fs.readFileSync(packageJsonPath, "utf-8"),
    );

    // Initialize contributes if it doesn't exist
    if (!packageJson.contributes) {
      packageJson.contributes = {};
    }

    // Initialize commands if they don't exist
    if (!packageJson.contributes.commands) {
      packageJson.contributes.commands = [];
    }

    // Initialize configuration if it doesn't exist
    if (!packageJson.contributes.configuration) {
      packageJson.contributes.configuration = {
        title: displayName,
        properties: {
          [`${name}.license-key`]: {
            type: "string",
            default: "",
            description: "Enter your license key",
            scope: "global",
          },
        },
      };
    }

    // Create command using extension's name
    const activateLicenseCommand: VSCodeCommand = {
      command: `${name}.activateLicenseCommand`,
      title: `${displayName}: Activate License`,
    };

    const revokeLicenseCommand: VSCodeCommand = {
      command: `${name}.revokeLicenseCommand`,
      title: `${displayName}: Revoke License`,
    };

    const purchaseLicenseCommand: VSCodeCommand = {
      command: `${name}.purchaseLicenseCommand`,
      title: `${displayName}: Purchase License`,
    };

    const commands = [
      activateLicenseCommand,
      revokeLicenseCommand,
      purchaseLicenseCommand,
    ];
    for (const newCommand of commands) {
      // Check if command already exists
      const commandExists = packageJson.contributes.commands.some(
        (cmd) => cmd.command === newCommand.command,
      );

      if (!commandExists) {
        // Add the new command
        packageJson.contributes.commands.push(newCommand);
      }

      // Add activation events
      if (!packageJson.activationEvents) {
        packageJson.activationEvents = [];
      }

      const activationEvents = ["onUri"];

      // Add any missing activation events
      for (const event of activationEvents) {
        if (!packageJson.activationEvents.includes(event)) {
          packageJson.activationEvents.push(event);
          console.log(`Added activation event: ${event}`);
        }
      }
    }

    // Write back to package.json
    fs.writeFileSync(
      packageJsonPath,
      `${JSON.stringify(packageJson, null, 2)}\n`,
      "utf-8",
    );

    console.log(`Successfully updated package.json configuration`);
  } catch (error) {
    console.error("Failed to update package.json:", error);
    process.exit(1);
  }
}

// Run the update when this script is executed
updatePackageJson();

// Export for testing purposes
module.exports = {
  getExtensionInfo,
  updatePackageJson,
};
