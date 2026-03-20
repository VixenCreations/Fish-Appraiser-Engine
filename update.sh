#!/bin/bash

# ANSI Color Codes
CYAN='\033[0;36m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${CYAN}========================================================${NC}"
echo -e "${CYAN}       FISH! APPRAISER ENGINE - AUTO UPDATER${NC}"
echo -e "${CYAN}              Maintained by VIXENLICOUS${NC}"
echo -e "${CYAN}========================================================${NC}"
echo ""

# Check if Git is installed
if ! command -v git &> /dev/null; then
    echo -e "${RED}[ERROR] Git is not installed on this system.${NC}"
    echo "Please install Git to use the auto-updater."
    exit 1
fi

echo "[INFO] Contacting GitHub repository..."
echo ""

# Pull the latest changes
# Fetch latest data and force the local folder to match GitHub exactly
git fetch --all
git reset --hard origin/main

echo ""
echo -e "${GREEN}========================================================${NC}"
echo -e "${GREEN}[SUCCESS] Engine is up to date!${NC}"
echo -e "${GREEN}========================================================${NC}"
echo ""

# Prompt to boot the server
read -p "Would you like to start the Appraiser Engine now? (y/n): " -n 1 -r
echo ""
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "[INFO] Booting Node.js server..."
    node server.js
else
    echo "Exiting updater."
fi