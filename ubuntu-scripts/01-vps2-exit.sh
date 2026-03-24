#!/bin/bash
# ==============================================================================
# VPS2 (Exit Node) Setup Script
# Run this on VPS2 as root.
# ==============================================================================

set -e

# Ensure script is run as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root"
  exit 1
fi

echo "[*] Updating system and installing WireGuard..."
apt-get update
apt-get install -y wireguard iptables iproute2

echo "[*] Enabling IP Forwarding..."
sed -i '/net.ipv4.ip_forward/d' /etc/sysctl.conf
echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf
sysctl -p

echo "[*] Generating WireGuard keys for VPS2..."
mkdir -p /etc/wireguard
chmod 700 /etc/wireguard

if [ ! -f /etc/wireguard/private.key ]; then
    wg genkey | tee /etc/wireguard/private.key | wg pubkey > /etc/wireguard/public.key
fi
chmod 600 /etc/wireguard/private.key

VPS2_PRIV=$(cat /etc/wireguard/private.key)
VPS2_PUB=$(cat /etc/wireguard/public.key)

# Detect default network interface for NAT
DEFAULT_IFACE=$(ip route ls | grep default | awk '{print $5}' | head -n 1)

echo ""
echo "================================================================="
echo " VPS2 PUBLIC KEY: $VPS2_PUB"
echo "================================================================="
echo ""
echo "Please enter the VPS1 Public Key (you will get this by running the VPS1 script):"
read -p "VPS1 Public Key: " VPS1_PUB

if [ -z "$VPS1_PUB" ]; then
    echo "Error: VPS1 Public Key cannot be empty."
    exit 1
fi

echo "[*] Creating /etc/wireguard/wg2.conf..."
cat <<EOF > /etc/wireguard/wg2.conf
[Interface]
PrivateKey = $VPS2_PRIV
Address = 10.9.0.2/24
ListenPort = 51820
PostUp = iptables -A FORWARD -i wg2 -j ACCEPT; iptables -A FORWARD -o wg2 -j ACCEPT; iptables -t nat -A POSTROUTING -o $DEFAULT_IFACE -j MASQUERADE
PostDown = iptables -D FORWARD -i wg2 -j ACCEPT || true; iptables -D FORWARD -o wg2 -j ACCEPT || true; iptables -t nat -D POSTROUTING -o $DEFAULT_IFACE -j MASQUERADE || true

[Peer]
PublicKey = $VPS1_PUB
AllowedIPs = 10.9.0.1/32, 10.8.0.0/24
EOF

chmod 600 /etc/wireguard/wg2.conf

echo "[*] Starting WireGuard interface wg2..."
systemctl enable wg-quick@wg2
systemctl restart wg-quick@wg2

echo ""
echo "[+] VPS2 Setup Complete! WireGuard is running on interface wg2."
echo "[+] Traffic from VPS1 will now be NAT'd out through $DEFAULT_IFACE."
