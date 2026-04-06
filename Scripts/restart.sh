#!/bin/bash

CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}========================================================${NC}"
echo -e "${CYAN}       FISH! APPRAISER ENGINE - RESTART${NC}"
echo -e "${CYAN}              Maintained by VIXENLICOUS${NC}"
echo -e "${CYAN}========================================================${NC}"
echo ""

echo "[INFO] Terminating running instances of server.js..."
# Gracefully terminate the specific node script
pkill -f "node server.js"

# Give the OS a brief moment to clear the port
sleep 2

# Dynamically set working directory to the parent of the Scripts folder
cd "$(dirname "$0")/.." || exit

echo "[INFO] Booting fresh instance..."
echo ""
node server.js