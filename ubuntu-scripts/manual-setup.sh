#!/bin/bash
# Double Tunnel - Manual Installation & Verification Script
# This script is designed to be run manually on a fresh VPS (Ubuntu/Debian)
set -e

echo "======================================================"
echo "   DOUBLE TUNNEL - MANUAL INSTALLATION & VERIFICATION"
echo "======================================================"

# 1. Root Check
if [ "$EUID" -ne 0 ]; then
  echo "[ERROR] Please run as root (sudo su -)"
  exit 1
fi

# 2. System Update
echo "[1/7] Updating system packages..."
apt-get update && apt-get upgrade -y

# 3. Install Dependencies
echo "[2/7] Installing WireGuard, Docker, and Networking tools..."
apt-get install -y wireguard wireguard-tools docker.io docker-compose-v2 iptables iptables-persistent curl iproute2 resolvconf linux-headers-$(uname -r)

# 4. Enable IP Forwarding
echo "[3/7] Enabling IP Forwarding..."
echo "net.ipv4.ip_forward=1" > /etc/sysctl.d/99-double-tunnel.conf
sysctl -p /etc/sysctl.d/99-double-tunnel.conf

# 5. Verify Docker
echo "[4/7] Verifying Docker service..."
systemctl enable docker
systemctl start docker
if systemctl is-active --quiet docker; then
    echo "[OK] Docker is running."
else
    echo "[ERROR] Docker failed to start. Check 'journalctl -u docker'"
fi

# 6. Verify WireGuard Module
echo "[5/7] Verifying WireGuard kernel module..."
modprobe wireguard || true
if lsmod | grep -q wireguard; then
    echo "[OK] WireGuard module is loaded."
else
    echo "[ERROR] WireGuard module NOT found. You may need to reboot or install headers."
fi

echo "======================================================"
echo "   MANUAL PREPARATION COMPLETE"
echo "======================================================"
echo "You can now run the setup scripts (01-vps2-exit.sh or 02-vps1-gateway.sh)"
