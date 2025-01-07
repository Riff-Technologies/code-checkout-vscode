#!/bin/bash

# Validate input
if [ -z "$1" ]; then
    echo "Error: Target directory argument is required"
    echo "Usage: ./dev-setup.sh <target-directory>"
    exit 1
fi

TARGET_DIR="$1"

# Validate target directory exists
if [ ! -d "$TARGET_DIR" ]; then
    echo "Error: Target directory '$TARGET_DIR' does not exist"
    exit 1
fi

# Function to increment patch version
increment_version() {
    local version=$1
    local patch=$(echo "$version" | cut -d. -f3)
    local new_patch=$((patch + 1))
    echo "$(echo "$version" | cut -d. -f1,2).$new_patch"
}

# Bump package.json version
if [ -f "package.json" ]; then
    current_version=$(node -p "require('./package.json').version")
    new_version=$(increment_version "$current_version")
    # Use temporary file to maintain file formatting
    jq ".version = \"$new_version\"" package.json > temp.json && mv temp.json package.json
    echo "Bumped version from $current_version to $new_version"
else
    echo "Warning: package.json not found in current directory"
fi

# Clean up dist folder
if [ -d "dist" ]; then
    rm -rf dist
    echo "Deleted dist folder"
fi

# Remove old riff-code-checkout*.tgz files
rm -f riff-code-checkout*.tgz
echo "Removed old riff-code-checkout*.tgz files"

# Run npm pack
npm pack
echo "Ran npm pack"

# Change to target directory
cd "$TARGET_DIR" || exit 1
echo "Changed to directory: $TARGET_DIR"

# Clean up out folder
if [ -d "out" ]; then
    rm -rf out
    echo "Deleted out folder"
fi

# Git reset
git reset --hard
echo "Reset git repository"

# Remove .vsix files
rm -f ./*.vsix
echo "Removed .vsix files"

# Remove @riff from node_modules
if [ -d "./node_modules/@riff" ]; then
    rm -rf ./node_modules/@riff
    echo "Removed ./node_modules/@riff"
fi

# Install the newly packed package
echo "Installing new package version $new_version..."
yarn add ~/Developer/code-checkout/riff-code-checkout-"$new_version".tgz
echo "Installed riff-code-checkout-$new_version.tgz"

# Run code-checkout-init
echo "Initializing code-checkout..."
npx code-checkout-init
echo "Initialized code-checkout"

# Run yarn package
echo "Running yarn package..."
yarn package
echo "Completed yarn package"

echo "Setup complete!" 