#!/usr/bin/env node

import * as fs from "fs";
import * as path from "path";
import glob from "glob";
import { exec } from "child_process";
import { promisify } from "util";
import * as JavaScriptObfuscator from "javascript-obfuscator";

const execAsync = promisify(exec);

interface BuildOptions {
  buildDir: string;
  outputDir: string;
  packageJson: any;
}

/**
 * Gets build configuration from package.json or uses defaults
 * @returns BuildOptions object with configured directories
 */
function getBuildConfig(): BuildOptions {
  const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));

  // Check for custom configuration in package.json
  const config = packageJson.codeCheckout || {};

  return {
    buildDir: config.buildDir || "./build",
    outputDir: config.outputDir || "./out",
    packageJson,
  };
}

/**
 * Obfuscates JavaScript files
 * @param filePath - Path to the JavaScript file
 * @param outputPath - Path where the obfuscated file should be written
 */
async function obfuscateFile(
  filePath: string,
  outputPath: string
): Promise<void> {
  const code = fs.readFileSync(filePath, "utf8");
  const obfuscationResult = JavaScriptObfuscator.obfuscate(code, {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.75,
    deadCodeInjection: true,
    deadCodeInjectionThreshold: 0.4,
    debugProtection: true,
    debugProtectionInterval: 4000,
    disableConsoleOutput: true,
    identifierNamesGenerator: "hexadecimal",
    rotateStringArray: true,
    selfDefending: true,
    stringArray: true,
    stringArrayEncoding: ["base64"],
    stringArrayThreshold: 0.75,
    transformObjectKeys: true,
    unicodeEscapeSequence: false,
  });

  // Ensure the output directory exists
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  // log the first line of the obfuscationResult
  console.log(obfuscationResult.getObfuscatedCode().split("\n")[0]);

  fs.writeFileSync(outputPath, obfuscationResult.getObfuscatedCode());
}

/**
 * Processes all JavaScript files in a directory
 * @param options - Build configuration options
 */
async function processFiles(options: BuildOptions): Promise<void> {
  // Verify build directory exists
  if (!fs.existsSync(options.buildDir)) {
    throw new Error(`Build directory '${options.buildDir}' does not exist`);
  }

  const files = glob.sync("**/*.js", {
    cwd: options.buildDir,
    ignore: ["node_modules/**"],
    nodir: true,
  });

  if (files.length === 0) {
    console.warn(`No JavaScript files found in ${options.buildDir}`);
    console.warn("Make sure your TypeScript files have been compiled first.");
    return;
  }

  console.log(`Found ${files.length} JavaScript files to process`);

  for (const file of files) {
    const inputPath = path.join(options.buildDir, file);
    // Write obfuscated files back to the build directory
    const outputPath = path.join(options.buildDir, file);
    console.log(`Processing: ${file}`);
    await obfuscateFile(inputPath, outputPath);
    console.log(`Completed: ${file}`);
  }

  // Copy package.json and other necessary files to build directory
  const filesToCopy = ["package.json", "README.md", "LICENSE"];
  for (const file of filesToCopy) {
    if (fs.existsSync(file)) {
      fs.copyFileSync(file, path.join(options.buildDir, file));
    }
  }
}

/**
 * Ensures .vscodeignore exists and contains necessary exclusions
 */
async function updateVSCodeIgnore(): Promise<void> {
  const vscodeignorePath = ".vscodeignore";
  const requiredExclusions = [
    "src/**",
    "build/**",
    ".gitignore",
    ".git/**",
    "node_modules/**",
    "tsconfig.json",
    ".env",
  ];

  let content = "";
  if (fs.existsSync(vscodeignorePath)) {
    content = fs.readFileSync(vscodeignorePath, "utf8");
  }

  const lines = new Set(content.split("\n").map((line) => line.trim()));
  let modified = false;

  for (const exclusion of requiredExclusions) {
    if (!lines.has(exclusion)) {
      lines.add(exclusion);
      modified = true;
    }
  }

  if (modified) {
    const newContent =
      Array.from(lines)
        .filter((line) => line) // Remove empty lines
        .join("\n") + "\n";
    fs.writeFileSync(vscodeignorePath, newContent);
    console.log("Updated .vscodeignore with required exclusions");
  }
}

/**
 * Temporarily updates package.json to use build directory
 * @returns Function to restore original package.json
 */
function updatePackageJsonForBuild(): () => void {
  const packageJsonPath = "package.json";
  const originalContent = fs.readFileSync(packageJsonPath, "utf8");
  const packageJson = JSON.parse(originalContent);

  // Store original values
  const originalMain = packageJson.main;
  const originalTypes = packageJson.types;

  // Update paths to use build directory
  packageJson.main = packageJson.main?.replace(/^(\.\/)?src\//, "./build/");
  packageJson.types = packageJson.types?.replace(/^(\.\/)?src\//, "./build/");

  // Write updated package.json
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

  // Return function to restore original package.json
  return () => fs.writeFileSync(packageJsonPath, originalContent);
}

/**
 * Creates a VSIX package from the obfuscated code
 */
async function createVSIX(): Promise<void> {
  try {
    // Update .vscodeignore to exclude src directory
    await updateVSCodeIgnore();

    // Temporarily update package.json to use build directory
    const restorePackageJson = updatePackageJsonForBuild();

    try {
      // Run vsce package from project root
      console.log("Creating VSIX package...");
      await execAsync("vsce package");
      console.log("Successfully created VSIX package");
    } finally {
      // Restore original package.json
      restorePackageJson();
    }
  } catch (error) {
    console.error("Failed to create VSIX package:", error);
    throw error;
  }
}

/**
 * Verifies that required build tools are installed
 * @throws Error if any required tool is missing
 */
async function verifyTools(): Promise<void> {
  try {
    // output the version of vsce
    const vsceVersion = await execAsync("vsce --version");
    console.log("vsce version:", vsceVersion);
  } catch (error) {
    throw new Error(
      "vsce is not installed. Please install it with: npm install -g vsce"
    );
  }
}

/**
 * Compiles TypeScript files using tsc
 * @param buildDir - Directory where compiled JS should go
 * @throws Error if compilation fails
 */
async function compileTypeScript(buildDir: string): Promise<void> {
  try {
    console.log("Compiling TypeScript files...");
    // Ensure build directory exists
    fs.mkdirSync(buildDir, { recursive: true });
    // Use --outDir to specify build directory
    await execAsync(`tsc --sourceMap false --outDir ${buildDir}`);
    console.log("TypeScript compilation completed");
  } catch (error) {
    console.error("TypeScript compilation failed:", error);
    throw error;
  }
}

/**
 * Main build function
 */
async function build(): Promise<void> {
  try {
    const projectRoot = process.cwd();
    process.chdir(projectRoot);

    // Verify required tools are installed
    await verifyTools();

    const options = getBuildConfig();

    console.log("Current working directory:", process.cwd());
    console.log("Build configuration:", options);

    // Clean build directory
    if (fs.existsSync(options.buildDir)) {
      fs.rmSync(options.buildDir, { recursive: true });
    }

    // Compile TypeScript files to build directory
    await compileTypeScript(options.buildDir);

    // Process and obfuscate files in the build directory
    await processFiles(options);

    // Create VSIX from project root
    await createVSIX();

    console.log("Build completed successfully!");
  } catch (error) {
    console.error("Build failed:", error);
    process.exit(1);
  }
}

// Run build if this script is executed directly
if (require.main === module) {
  build();
}

export { build };
