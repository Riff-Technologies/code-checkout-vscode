import * as vscode from "vscode";

/**
 * Options interface for the tag wrapper
 */
interface TagOptions {
  type: "paid" | "free";
}

/**
 * Higher-order function that wraps a function call and replaces it with an error message
 * @param options - Configuration options
 * @param fn - The function to wrap
 * @returns A new function that shows an error message instead of executing the original
 */
export function tagFunction<T extends (...args: any[]) => Promise<any>>(
  options: TagOptions,
  fn: T
): T {
  if (options.type === "free") {
    return fn;
  } else {
    return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
      await vscode.window.showErrorMessage("This function has been disabled");
      return undefined as ReturnType<T>;
    }) as T;
  }
}
