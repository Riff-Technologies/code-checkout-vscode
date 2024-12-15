// your-package/src/index.ts
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

/**
 * Gets the command ID based on the extension's package.json
 * @param extensionPath - The path to the extension directory
 * @returns The fully qualified command ID
 */
function getCommandId(extensionPath: string): string {
  try {
    const packageJsonPath = path.join(extensionPath, "package.json");
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
    return `${packageJson.name}.activateLicenseCommand`;
  } catch (error) {
    throw new Error(
      `Failed to determine command ID from package.json: ${error}`
    );
  }
}

/**
 * Wraps the extension's activate function to inject additional commands
 */
export function injectActivateCommand(
  originalActivate: (context: vscode.ExtensionContext) => void
) {
  return (context: vscode.ExtensionContext) => {
    const commandId = getCommandId(context.extensionPath);

    context.subscriptions.push(
      vscode.commands.registerCommand(commandId, async () => {
        await vscode.window.showInformationMessage(
          "Your package command executed!"
        );
      })
    );

    // Call the original activate function
    originalActivate(context);
  };
}

/**
 * Decorator that automatically injects commands
 */
export function withActivateCommand() {
  return function (
    _target: unknown,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalActivate = descriptor.value as (
      context: vscode.ExtensionContext
    ) => void;
    descriptor.value = injectActivateCommand(originalActivate);
    return descriptor;
  };
}
