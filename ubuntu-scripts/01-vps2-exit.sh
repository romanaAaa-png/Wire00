#!/bin/bash
# VPS2 Setup Script (Exit Node)
# This script configures VPS2 as the final exit point for all traffic.
# Standardized to use wg0 for the tunnel to VPS1.

set -ex

# --- Configuration Variables ---
# You can edit these or the script will try to detect them
VPS2_IP="${1:-$(curl -s https://ifconfig.me)}"
WG_EXIT_PORT="${2:-51820}"
# -------------------------------

# Logging setup
LOG_DIR="/root/DTLogs"
LOG_FILE="$LOG_DIR/installation.txt"
mkdir -p "$LOG_DIR"

log_step() {
  local action="$1"
  local message="$2"
  echo "[$(date)] [$action] $message" >> "$LOG_FILE"
  echo "[$action] $message"
}

do_prepare() {
  log_step "prepare" "--- Starting VPS2 Preparation Phase ---"
  
  fix_apt() {
    log_step "prepare" "Fixing package manager (apt)..."
    rm -f /var/lib/dpkg/lock-frontend /var/lib/apt/lists/lock /var/cache/apt/archives/lock /var/lib/dpkg/lock || true
    dpkg --configure -a || true
    apt-get update || true
  }

  fix_apt
  export DEBIAN_FRONTEND=noninteractive
  export NEEDRESTART_MODE=a

  log_step "prepare" "Installing WireGuard & Tools..."
  apt-get update
  apt-get install -y -o Dpkg::Options::="--force-confnew" wireguard wireguard-tools iptables curl iproute2 sshpass
  
  if ! command -v wg &> /dev/null; then
    log_step "prepare" "ERROR: wireguard-tools installation failed. 'wg' command not found."
    exit 1
  fi

  log_step "prepare" "Generating WireGuard keys for inter-VPS tunnel (wg0)..."
  mkdir -p /etc/wireguard
  if [ ! -s /etc/wireguard/wg0.key ] || [ ! -s /etc/wireguard/wg0.pub ]; then
    wg genkey > /etc/wireguard/wg0.key
    wg pubkey < /etc/wireguard/wg0.key > /etc/wireguard/wg0.pub
  fi
  echo "RESULT_WG0_PUB_KEY: $(cat /etc/wireguard/wg0.pub)"
  
  if [ -f /var/run/reboot-required ]; then
    log_step "prepare" "System requires a reboot. Marking for reboot..."
    echo "REBOOT_REQUIRED"
  fi
  
  log_step "prepare" "--- VPS2 Preparation Phase Complete ---"
}

do_configure() {
  PEER_PUB="$1"
  if [ -z "$PEER_PUB" ]; then
    if [ -f /etc/wireguard/peer_wg1.pub ]; then
      PEER_PUB=$(cat /etc/wireguard/peer_wg1.pub)
    else
      log_step "configure" "ERROR: No peer public key provided or found in peer_wg1.pub."
      echo "Usage: $0 configure [PEER_PUBLIC_KEY]"
      exit 1
    fi
  fi

  log_step "configure" "--- Starting VPS2 Configuration Phase ---"
  
  log_step "configure" "Enabling IP Forwarding..."
  sysctl -w net.ipv4.ip_forward=1 || true
  echo "net.ipv4.ip_forward=1" > /etc/sysctl.d/99-wireguard.conf
  sysctl -p /etc/sysctl.d/99-wireguard.conf || true

  log_step "configure" "Configuring WireGuard (wg0) as Exit Node with Peer Key: $PEER_PUB"
  mkdir -p /etc/wireguard
  systemctl stop wg-quick@wg0 2>/dev/null || true

  PRIV_KEY=$(cat /etc/wireguard/wg0.key)
  PRIMARY_IF=$(ip route | grep default | awk '{print $5}' | head -n1 || echo "eth0")

  cat <<EOF > /etc/wireguard/wg0.conf
[Interface]
PrivateKey = $PRIV_KEY
Address = 10.9.0.2/24
ListenPort = $WG_EXIT_PORT
MTU = 1280

PostUp = iptables -I FORWARD 1 -i %i -j ACCEPT || true
PostUp = iptables -I FORWARD 1 -o %i -j ACCEPT || true
PostUp = iptables -t nat -A POSTROUTING -o $PRIMARY_IF -j MASQUERADE || true
PostUp = iptables -t mangle -I FORWARD 1 -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --clamp-mss-to-pmtu || true

PreDown = iptables -D FORWARD -i %i -j ACCEPT || true
PreDown = iptables -D FORWARD -o %i -j ACCEPT || true
PreDown = iptables -t nat -D POSTROUTING -o $PRIMARY_IF -j MASQUERADE || true
PreDown = iptables -t mangle -D FORWARD -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --clamp-mss-to-pmtu || true

[Peer]
PublicKey = $PEER_PUB
AllowedIPs = 10.9.0.0/24, 10.8.0.0/24
EOF

  log_step "configure" "Starting WireGuard wg0..."
  systemctl enable wg-quick@wg0 || true
  systemctl restart wg-quick@wg0 || wg-quick up wg0 || true

  log_step "configure" "--- VPS2 Configuration Phase Complete ---"
}

case "$1" in
  prepare) do_prepare ;;
  configure) do_configure "$2" ;;
  *) echo "Usage: $0 {prepare|configure} [peer_pub]"; exit 1 ;;
esac
