#!/bin/bash

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${CYAN}========================================================${NC}"
echo -e "${CYAN}       FISH! APPRAISER ENGINE - BOOTSTRAPPER${NC}"
echo -e "${CYAN}              Maintained by VIXENLICOUS${NC}"
echo -e "${CYAN}========================================================${NC}"
echo ""

# Check for root privileges (required for apt-get)
if [ "$EUID" -ne 0 ]; then
    echo -e "${YELLOW}[WARN] Please run this script with sudo to allow package installations.${NC}"
    echo "Usage: sudo ./install.sh"
    exit 1
fi

# Detect package manager (Focusing on Debian/Ubuntu as the industry hosting standard)
if ! command -v apt-get &> /dev/null; then
    echo -e "${RED}[ERROR] This script currently targets APT package managers (Debian/Ubuntu).${NC}"
    echo "Please install Git and Node.js manually for your specific distro architecture."
    exit 1
fi

echo "[INFO] Validating system infrastructure..."

# Silently update package lists
apt-get update -y -q > /dev/null

# Ensure curl is installed for fetching external setup scripts
if ! command -v curl &> /dev/null; then
    echo "[INFO] Installing curl..."
    apt-get install -y curl > /dev/null
fi

# Check and Install Git
if ! command -v git &> /dev/null; then
    echo -e "${YELLOW}[INFO] Git not found. Pulling from official repositories...${NC}"
    apt-get install -y git
else
    echo -e "${GREEN}[OK] Git is installed.${NC}"
fi

# Check and Install Node.js (Using NodeSource to guarantee a modern LTS version)
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}[INFO] Node.js not found. Bootstrapping NodeSource 20.x LTS...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
else
    echo -e "${GREEN}[OK] Node.js is installed.${NC}"
fi

echo ""
echo "[INFO] System infrastructure validated."
echo "[INFO] Setting working directory to project root..."

# Dynamically set working directory to the parent of the Scripts folder
cd "$(dirname "$0")/.." || exit

echo "[INFO] Compiling Engine packages..."
echo ""

# Drop root privileges for npm install to prevent the node_modules folder from being locked to root
if [ -n "$SUDO_USER" ]; then
    su -c "npm install" "$SUDO_USER"
else
    npm install
fi

echo ""
echo -e "${GREEN}========================================================${NC}"
echo -e "${GREEN}[SUCCESS] Engine compilation complete!${NC}"
echo -e "${GREEN}========================================================${NC}"
echo ""