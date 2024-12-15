#!/usr/bin/env node

// your-package/src/install.ts
const fs = require("fs");
const path = require("path");

interface VSCodeCommand {
  command: string;
  title: string;
  category?: string;
}

interface PackageJson {
  name: string;
  displayName?: string;
  contributes?: {
    commands?: VSCodeCommand[];
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
    fs.readFileSync(packageJsonPath, "utf-8")
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
 * Updates the host extension's package.json with new commands
 */
function updatePackageJson(): void {
  try {
    const { name, displayName } = getExtensionInfo();
    const packageJsonPath = path.join(process.cwd(), "package.json");
    const packageJson: PackageJson = JSON.parse(
      fs.readFileSync(packageJsonPath, "utf-8")
    );

    // Initialize contributes.commands if they don't exist
    if (!packageJson.contributes) {
      packageJson.contributes = {};
    }
    if (!packageJson.contributes.commands) {
      packageJson.contributes.commands = [];
    }

    // Create command using extension's name
    const newCommand: VSCodeCommand = {
      command: `${name}.activateLicenseCommand`,
      title: `${displayName}: Activate License`,
    };

    // Check if command already exists
    const commandExists = packageJson.contributes.commands.some(
      (cmd) => cmd.command === newCommand.command
    );

    if (!commandExists) {
      // Add the new command
      packageJson.contributes.commands.push(newCommand);

      // Add activation event
      if (!packageJson.activationEvents) {
        packageJson.activationEvents = [];
      }

      const activationEvent = `onCommand:${newCommand.command}`;
      if (!packageJson.activationEvents.includes(activationEvent)) {
        packageJson.activationEvents.push(activationEvent);
      }

      // Write back to package.json
      fs.writeFileSync(
        packageJsonPath,
        `${JSON.stringify(packageJson, null, 2)}\n`,
        "utf-8"
      );

      console.log(
        `Successfully added command ${newCommand.command} to package.json`
      );
    }
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
