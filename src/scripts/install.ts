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
    authentication?: {
      uriHandler?: Record<string, never>;
    };
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
 * Validates and processes command line arguments
 * @returns The secret provided as a command line argument
 * @throws Error if secret is not provided
 */
function getSecretFromArgs(): string {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    throw new Error(
      "Secret parameter is required. Usage: code-checkout-install <secret>"
    );
  }
  return args[0];
}

/**
 * Ensures .env file exists and updates the secret while preserving other variables
 * @param secret The secret to store in .env
 */
function updateEnvFile(secret: string): void {
  const envPath = path.join(process.cwd(), ".env");
  let envContent = "";
  const secretKey = "CODE_CHECKOUT_SECRET";

  // Read existing .env content if it exists
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, "utf-8");
  }

  // Split content into lines and parse existing variables
  const envLines = envContent.split("\n").filter(Boolean);
  const envVars = new Map<string, string>();

  // Parse existing variables
  for (const line of envLines) {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const [, key, value] = match;
      envVars.set(key.trim(), value.trim());
    }
  }

  // Update or add the secret
  envVars.set(secretKey, `"${secret}"`);

  // Convert back to .env format
  const newContent = Array.from(envVars.entries())
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  fs.writeFileSync(envPath, `${newContent}\n`, "utf-8");
  console.log(
    `Successfully ${
      envVars.has(secretKey) ? "updated" : "added"
    } ${secretKey} in .env file`
  );
}

/**
 * Ensures .vscodeignore exists and contains .env
 */
function updateVSCodeIgnore(): void {
  const vscodeignorePath = path.join(process.cwd(), ".vscodeignore");
  let content = "";

  // Read existing content if file exists
  if (fs.existsSync(vscodeignorePath)) {
    content = fs.readFileSync(vscodeignorePath, "utf-8");
  }

  // Add .env if not already present
  if (!content.includes(".env")) {
    content = `${content.trim()}\n.env\n`;
    fs.writeFileSync(vscodeignorePath, content, "utf-8");
    console.log("Added .env to .vscodeignore");
  }
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
    const secret = getSecretFromArgs();
    updateEnvFile(secret);
    updateVSCodeIgnore();

    const { name, displayName } = getExtensionInfo();
    const packageJsonPath = path.join(process.cwd(), "package.json");

    // Add postcompile script
    const wasModified = ensurePostCompileScript(packageJsonPath);
    if (wasModified) {
      console.log("Added postcompile script to package.json");
    }

    const packageJson: PackageJson = JSON.parse(
      fs.readFileSync(packageJsonPath, "utf-8")
    );

    // Initialize contributes if it doesn't exist
    if (!packageJson.contributes) {
      packageJson.contributes = {};
    }

    // Initialize commands if they don't exist
    if (!packageJson.contributes.commands) {
      packageJson.contributes.commands = [];
    }

    // Add URI handler configuration
    if (!packageJson.contributes.authentication) {
      packageJson.contributes.authentication = {};
    }
    packageJson.contributes.authentication.uriHandler = {};

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
    }

    // Add activation events
    if (!packageJson.activationEvents) {
      packageJson.activationEvents = [];
    }

    const activationEvents = [`onCommand:${newCommand.command}`, "onUri"];

    // Add any missing activation events
    for (const event of activationEvents) {
      if (!packageJson.activationEvents.includes(event)) {
        packageJson.activationEvents.push(event);
        console.log(`Added activation event: ${event}`);
      }
    }

    // Write back to package.json
    fs.writeFileSync(
      packageJsonPath,
      `${JSON.stringify(packageJson, null, 2)}\n`,
      "utf-8"
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
