#!/bin/bash
# Double Tunnel - VPS Readiness Check Script
# This script verifies if the VPS meets the requirements for Double VPN installation.

# Logging setup
LOG_DIR="/root/DTLogs"
LOG_FILE="$LOG_DIR/installation.txt"
mkdir -p "$LOG_DIR"
echo "--- Double Tunnel: System Readiness Check ---" >> "$LOG_FILE"
echo "Checking at: $(date)" >> "$LOG_FILE"

log_msg() {
  echo "$1" >> "$LOG_FILE"
  echo "$1"
}

log_msg "--- Double Tunnel: System Readiness Check ---"
log_msg "Checking at: $(date)"

# 1. Check for Root Privileges
if [ "$EUID" -ne 0 ]; then
  log_msg "[ERROR] This script must be run as root. Use 'sudo su' or 'sudo bash'."
  exit 1
else
  log_msg "[OK] Running as root."
fi

# 2. Check OS Distribution
if [ -f /etc/os-release ]; then
  . /etc/os-release
  if [[ "$ID" == "ubuntu" || "$ID" == "debian" ]]; then
    log_msg "[OK] OS: $PRETTY_NAME detected."
  else
    log_msg "[WARN] OS: $PRETTY_NAME detected. This system is optimized for Ubuntu/Debian."
  fi
else
  log_msg "[ERROR] Could not determine OS distribution."
fi

# 3. Check Kernel Version (WireGuard requires 5.6+ or module)
KERNEL_VER=$(uname -r)
log_msg "[INFO] Kernel Version: $KERNEL_VER"
if [[ $(echo "$KERNEL_VER" | cut -d. -f1) -ge 5 && $(echo "$KERNEL_VER" | cut -d. -f2) -ge 6 ]]; then
  log_msg "[OK] Kernel supports WireGuard natively."
else
  log_msg "[INFO] Kernel < 5.6. WireGuard module will be installed via DKMS."
fi

# 4. Check for Required Tools
for tool in curl iptables docker; do
  if command -v $tool >/dev/null 2>&1; then
    log_msg "[OK] Tool '$tool' is already installed."
  else
    log_msg "[INFO] Tool '$tool' is missing (will be installed during setup)."
  fi
done

# 5. Check IP Forwarding Capability
if [ -f /proc/sys/net/ipv4/ip_forward ]; then
  log_msg "[OK] IP Forwarding is supported by the kernel."
else
  log_msg "[ERROR] IP Forwarding is NOT supported. Double VPN will not work."
fi

# 6. Check for Port Conflicts (Standard Ports)
# Note: These are standard ports, adjust if you use custom ones.
for port in 22 51820 51821 51822; do
  if ss -tuln | grep -q ":$port "; then
    if [ "$port" -eq 22 ]; then
      log_msg "[OK] Port 22 (SSH) is active (Required for management)."
    else
      log_msg "[WARN] Port $port is already in use. Setup will attempt to reassign."
    fi
  else
    log_msg "[OK] Port $port is available."
  fi
done

log_msg ""
log_msg "--- Readiness Check Complete ---"
if [ "$ID" == "ubuntu" ] || [ "$ID" == "debian" ]; then
  log_msg "System is READY for installation."
else
  log_msg "System may require manual adjustments for non-Debian distributions."
fi
