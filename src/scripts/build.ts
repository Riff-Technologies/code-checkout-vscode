#!/usr/bin/env node

import * as fs from "fs";
import * as path from "path";
import glob from "glob";
import * as JavaScriptObfuscator from "javascript-obfuscator";

interface TSConfig {
  compilerOptions?: {
    outDir?: string;
  };
}

/**
 * Gets the output directory from tsconfig.json
 * @returns The configured outDir or "./out" as default
 */
function getOutputDir(): string {
  try {
    const tsConfig: TSConfig = JSON.parse(
      fs.readFileSync("tsconfig.json", "utf8")
    );
    return tsConfig.compilerOptions?.outDir || "./out";
  } catch (error) {
    console.warn("Could not read tsconfig.json, using default outDir: ./out");
    return "./out";
  }
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

  fs.writeFileSync(outputPath, obfuscationResult.getObfuscatedCode());
}

/**
 * Processes all JavaScript files in the output directory
 */
async function processFiles(): Promise<void> {
  const outDir = getOutputDir();

  if (!fs.existsSync(outDir)) {
    throw new Error(`Output directory '${outDir}' does not exist`);
  }

  const files = glob.sync("**/*.js", {
    cwd: outDir,
    ignore: ["node_modules/**"],
    nodir: true,
  });

  if (files.length === 0) {
    console.warn(`No JavaScript files found in ${outDir}`);
    return;
  }

  console.log(`Found ${files.length} JavaScript files to process`);

  for (const file of files) {
    const filePath = path.join(outDir, file);
    console.log(`Processing: ${file}`);
    await obfuscateFile(filePath, filePath);
    console.log(`Completed: ${file}`);
  }
}

/**
 * Main build function
 */
async function build(): Promise<void> {
  try {
    const projectRoot = process.cwd();
    process.chdir(projectRoot);
    await processFiles();
  } catch (error) {
    console.error("Build failed:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  build();
}

export { build };
