#!/bin/bash

CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${CYAN}========================================================${NC}"
echo -e "${CYAN}       FISH! APPRAISER ENGINE - SERVER${NC}"
echo -e "${CYAN}              Maintained by VIXENLICOUS${NC}"
echo -e "${CYAN}========================================================${NC}"
echo ""

# Dynamically set working directory to the parent of the Scripts folder
cd "$(dirname "$0")/.." || exit

echo "[INFO] Working directory set to: $(pwd)"
echo "[INFO] Booting Node.js server..."
echo ""

node server.js

echo ""
echo -e "${YELLOW}[WARN] Server process terminated.${NC}"