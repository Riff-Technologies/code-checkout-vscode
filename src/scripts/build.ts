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
  sourceDir: string;
  packageJson: any;
}

/**
 * Gets build configuration from package.json or uses defaults
 * @returns BuildOptions object with configured directories
 */
function getBuildConfig(): BuildOptions {
  const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));

  const config = packageJson.codeCheckout || {};

  return {
    buildDir: config.buildDir || "./build",
    sourceDir: config.sourceDir || "./src",
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

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, obfuscationResult.getObfuscatedCode());
}

/**
 * Processes all JavaScript files in a directory
 * @param options - Build configuration options
 */
async function processFiles(options: BuildOptions): Promise<void> {
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
    const outputPath = path.join(options.buildDir, file);
    console.log(`Processing: ${file}`);
    await obfuscateFile(inputPath, outputPath);
    console.log(`Completed: ${file}`);
  }
}

/**
 * Deletes the specified directory
 * @param directory - Path of the directory to delete
 */
function deleteDirectory(directory: string): void {
  if (fs.existsSync(directory)) {
    fs.rmSync(directory, { recursive: true, force: true });
    console.log(`Deleted directory: ${directory}`);
  }
}

/**
 * Updates the `main` field in package.json temporarily
 * @param newMain - Temporary value for the `main` field
 * @returns Function to restore the original package.json content
 */
function updatePackageJsonMain(newMain: string): () => void {
  const packageJsonPath = "package.json";
  const originalContent = fs.readFileSync(packageJsonPath, "utf8");
  const packageJson = JSON.parse(originalContent);

  const originalMain = packageJson.main;
  packageJson.main = newMain;

  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  console.log(`Temporarily updated package.json 'main' field to '${newMain}'`);

  return () => {
    fs.writeFileSync(packageJsonPath, originalContent);
    console.log(
      `Restored original package.json 'main' field to '${originalMain}'`
    );
  };
}

/**
 * Creates a VSIX package using vsce
 */
async function createVSIX(): Promise<void> {
  try {
    console.log("Creating VSIX package...");
    await execAsync("vsce package");
    console.log("Successfully created VSIX package");
  } catch (error) {
    console.error("Failed to create VSIX package:", error);
    throw error;
  }
}

/**
 * Main build function
 */
async function build(): Promise<void> {
  let restorePackageJsonMain: (() => void) | null = null;

  try {
    const projectRoot = process.cwd();
    process.chdir(projectRoot);

    const options = getBuildConfig();

    // Step 1: Run `tsc` to build to `build` directory
    if (fs.existsSync(options.buildDir)) {
      deleteDirectory(options.buildDir);
    }
    console.log("Compiling TypeScript files...");
    await execAsync(`tsc --outDir ${options.buildDir}`);
    console.log("TypeScript compilation completed");

    // Step 2: Obfuscate the JavaScript files in `build`
    await processFiles(options);

    // Step 3: Backup the original `src` directory
    const backupDir = `${options.sourceDir}_backup`;
    if (fs.existsSync(backupDir)) {
      deleteDirectory(backupDir);
    }
    if (fs.existsSync(options.sourceDir)) {
      fs.renameSync(options.sourceDir, backupDir);
      console.log(`Backed up '${options.sourceDir}' to '${backupDir}'`);
    }

    // Step 4: Replace the original `src` directory with obfuscated files
    deleteDirectory(options.sourceDir);
    fs.mkdirSync(options.sourceDir, { recursive: true });

    glob
      .sync("**/*", { cwd: options.buildDir, nodir: true })
      .forEach((file) => {
        const src = path.join(options.buildDir, file);
        const dest = path.join(options.sourceDir, file);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(src, dest);
      });
    console.log(
      `Replaced '${options.sourceDir}' with contents of '${options.buildDir}'`
    );

    // Step 5: Temporarily update `package.json` main field
    restorePackageJsonMain = updatePackageJsonMain("./src/extension.js");

    // Step 6: Run `vsce package` to create the `.vsix` file
    await createVSIX();

    // Step 7: Restore the original `src` directory
    deleteDirectory(options.sourceDir);
    fs.renameSync(backupDir, options.sourceDir);
    console.log(`Restored original '${options.sourceDir}' from backup`);

    // Step 8: Restore the original package.json `main` field
    if (restorePackageJsonMain) {
      restorePackageJsonMain();
    }
  } catch (error) {
    console.error("Build failed:", error);

    // Restore the original `src` directory if backup exists
    const options = getBuildConfig();
    const backupDir = `${options.sourceDir}_backup`;
    if (fs.existsSync(backupDir)) {
      deleteDirectory(options.sourceDir);
      fs.renameSync(backupDir, options.sourceDir);
      console.log(`Restored original '${options.sourceDir}' after failure`);
    }

    // Restore package.json `main` field if needed
    if (restorePackageJsonMain) {
      restorePackageJsonMain();
    }

    process.exit(1);
  }
}

if (require.main === module) {
  build();
}

export { build };
