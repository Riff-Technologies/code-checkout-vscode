/**
 * Entry point for the code-checkout-vscode package.
 * This module provides the main functionality for the package.
 */

const publicFunctions = require("./src/public"); // Import all functions from src/public

// Export the main function and public functions
module.exports = {
  ...publicFunctions, // Spread the public functions into the exports
};
