import * as vscode from "vscode";

const API_ENDPOINT = "https://api.riff-tech.com/v1";
const DEV_API_ENDPOINT = "https://dev-api.riff-tech.com/v1";

export async function setTestMode(
  context: vscode.ExtensionContext,
  testMode: boolean,
) {
  await context.secrets.store("test-mode", testMode.toString());
}

export async function isTestMode(
  context: vscode.ExtensionContext,
): Promise<boolean> {
  const testMode = await context.secrets.get("test-mode");
  return testMode === "true";
}

export async function getApiUrl(
  context: vscode.ExtensionContext,
): Promise<string> {
  const testMode = await isTestMode(context);
  return testMode ? DEV_API_ENDPOINT : API_ENDPOINT;
}
