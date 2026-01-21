#!/bin/bash

# TagTime CLI Installer
# Usage: curl -fsSL https://tagtime.ai/install-cli.sh | bash

set -e

INSTALL_DIR="${HOME}/.local/bin"
BINARY_NAME="tt"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

# Detect OS and architecture
detect_platform() {
    OS=$(uname -s | tr '[:upper:]' '[:lower:]')
    ARCH=$(uname -m)
    
    case "$OS" in
        linux)
            OS="linux"
            ;;
        darwin)
            OS="darwin"
            ;;
        msys*|mingw*|cygwin*)
            OS="windows"
            ;;
        *)
            error "Unsupported operating system: $OS"
            ;;
    esac
    
    case "$ARCH" in
        x86_64|amd64)
            ARCH="x64"
            ;;
        arm64|aarch64)
            ARCH="arm64"
            ;;
        *)
            error "Unsupported architecture: $ARCH"
            ;;
    esac
    
    echo "${OS}-${ARCH}"
}

# Check if Node.js is available (fallback installation method)
check_node() {
    if command -v node &> /dev/null; then
        return 0
    fi
    return 1
}

# Check if bun is available
check_bun() {
    if command -v bun &> /dev/null; then
        return 0
    fi
    return 1
}

# Install via npm (requires Node.js)
install_via_npm() {
    info "Installing via npm..."
    npm install -g @tagtime/cli
    info "Installed successfully via npm!"
    echo ""
    echo "Run 'tt --help' to get started."
}

# Install via bun
install_via_bun() {
    info "Installing via bun..."
    bun install -g @tagtime/cli
    info "Installed successfully via bun!"
    echo ""
    echo "Run 'tt --help' to get started."
}

# Download and install standalone binary
install_standalone() {
    PLATFORM=$(detect_platform)
    DOWNLOAD_URL="https://github.com/tagtime/tagtime/releases/latest/download/tt-${PLATFORM}"
    
    info "Downloading TagTime CLI for ${PLATFORM}..."
    
    # Create install directory if it doesn't exist
    mkdir -p "$INSTALL_DIR"
    
    # Download binary
    if command -v curl &> /dev/null; then
        curl -fsSL "$DOWNLOAD_URL" -o "${INSTALL_DIR}/${BINARY_NAME}"
    elif command -v wget &> /dev/null; then
        wget -q "$DOWNLOAD_URL" -O "${INSTALL_DIR}/${BINARY_NAME}"
    else
        error "Neither curl nor wget found. Please install one of them."
    fi
    
    # Make executable
    chmod +x "${INSTALL_DIR}/${BINARY_NAME}"
    
    info "Installed to ${INSTALL_DIR}/${BINARY_NAME}"
    
    # Check if install directory is in PATH
    if [[ ":$PATH:" != *":${INSTALL_DIR}:"* ]]; then
        warn "${INSTALL_DIR} is not in your PATH"
        echo ""
        echo "Add the following to your shell profile (~/.bashrc, ~/.zshrc, etc.):"
        echo ""
        echo "  export PATH=\"\$PATH:${INSTALL_DIR}\""
        echo ""
    fi
    
    info "Installation complete!"
    echo ""
    echo "Run 'tt --help' to get started."
}

main() {
    echo ""
    echo "  ╔════════════════════════════════════╗"
    echo "  ║     TagTime CLI Installer          ║"
    echo "  ╚════════════════════════════════════╝"
    echo ""
    
    # Try different installation methods
    if check_bun; then
        install_via_bun
    elif check_node; then
        install_via_npm
    else
        warn "Node.js/Bun not found. Installing standalone binary..."
        install_standalone
    fi
}

main "$@"
