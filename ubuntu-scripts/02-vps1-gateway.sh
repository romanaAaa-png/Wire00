#!/bin/bash
# ==============================================================================
# VPS1 (Gateway) Setup Script
# Run this on VPS1 as root.
# ==============================================================================

set -e

# Ensure script is run as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root"
  exit 1
fi

echo "[*] Updating system and installing dependencies..."
apt-get update
apt-get install -y wireguard iptables iproute2 curl

echo "[*] Installing Docker (if not present)..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
fi

echo "[*] Enabling IP Forwarding..."
sed -i '/net.ipv4.ip_forward/d' /etc/sysctl.conf
echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf
sysctl -p

echo "[*] Generating WireGuard keys for VPS1..."
mkdir -p /etc/wireguard
chmod 700 /etc/wireguard

if [ ! -f /etc/wireguard/private.key ]; then
    wg genkey | tee /etc/wireguard/private.key | wg pubkey > /etc/wireguard/public.key
fi
chmod 600 /etc/wireguard/private.key

VPS1_PRIV=$(cat /etc/wireguard/private.key)
VPS1_PUB=$(cat /etc/wireguard/public.key)
VPS1_IP=$(curl -s -4 ifconfig.me)

echo ""
echo "================================================================="
echo " VPS1 PUBLIC KEY: $VPS1_PUB"
echo " VPS1 PUBLIC IP:  $VPS1_IP"
echo "================================================================="
echo ""
echo "Please enter the VPS2 Public Key (from the VPS2 script):"
read -p "VPS2 Public Key: " VPS2_PUB

echo "Please enter the VPS2 IP Address:"
read -p "VPS2 IP Address: " VPS2_IP

if [ -z "$VPS2_PUB" ] || [ -z "$VPS2_IP" ]; then
    echo "Error: VPS2 Public Key and IP Address cannot be empty."
    exit 1
fi

echo "[*] Creating /etc/wireguard/wg1.conf (Tunnel to VPS2)..."
cat <<EOF > /etc/wireguard/wg1.conf
[Interface]
PrivateKey = $VPS1_PRIV
Address = 10.9.0.1/24
ListenPort = 51820
Table = off
PostUp = sysctl -w net.ipv4.conf.all.rp_filter=2; sysctl -w net.ipv4.conf.default.rp_filter=2; ip rule add from 10.8.0.0/24 table 200 priority 10; ip rule add from 10.0.0.0/24 table 200 priority 10 || true; ip route add default dev wg1 table 200 || true; iptables -t nat -A POSTROUTING -o wg1 -j MASQUERADE; iptables -I FORWARD 1 -i wg1 -j ACCEPT; iptables -I FORWARD 1 -o wg1 -j ACCEPT; iptables -I FORWARD 1 -i wg0 -j ACCEPT; iptables -I FORWARD 1 -o wg0 -j ACCEPT
PostDown = ip rule del from 10.8.0.0/24 table 200 priority 10 || true; ip rule del from 10.0.0.0/24 table 200 priority 10 || true; ip route del default dev wg1 table 200 || true; iptables -t nat -D POSTROUTING -o wg1 -j MASQUERADE || true; iptables -D FORWARD -i wg1 -j ACCEPT || true; iptables -D FORWARD -o wg1 -j ACCEPT || true; iptables -D FORWARD -i wg0 -j ACCEPT || true; iptables -D FORWARD -o wg0 -j ACCEPT || true

[Peer]
PublicKey = $VPS2_PUB
Endpoint = $VPS2_IP:51820
AllowedIPs = 0.0.0.0/0
PersistentKeepalive = 25
EOF

chmod 600 /etc/wireguard/wg1.conf

echo "[*] Starting WireGuard interface wg1..."
systemctl enable wg-quick@wg1
systemctl restart wg-quick@wg1

echo "[*] Starting WG-Easy (Client VPN Gateway)..."
docker stop wg-easy 2>/dev/null || true
docker rm wg-easy 2>/dev/null || true

# Pre-hashed password for 'admin'
ADMIN_HASH='$2a$10$jB0akgOdR4cShIVoDFO3zuNvuk/IvmmdxbQKkNIYu8zOy363gdGXC'

docker run -d \
  --name=wg-easy \
  --network host \
  -e WG_HOST=$VPS1_IP \
  -e WG_PORT=51821 \
  -e PORT=51822 \
  -e PASSWORD_HASH="$ADMIN_HASH" \
  -e WG_DEFAULT_DNS=1.1.1.1 \
  -e WG_DEFAULT_ADDRESS=10.8.0.x \
  -e WG_MTU=1280 \
  -e WG_ALLOWED_IPS=0.0.0.0/0 \
  -v /etc/wireguard:/etc/wireguard \
  --cap-add=NET_ADMIN \
  --cap-add=SYS_MODULE \
  --restart unless-stopped \
  ghcr.io/wg-easy/wg-easy

echo ""
echo "[+] VPS1 Setup Complete!"
echo "[+] WG-Easy Web UI: http://$VPS1_IP:51822"
echo "[+] Default Password: admin"
echo ""
echo "================================================================="
echo " WG Easy UI Configuration Details"
echo "================================================================="
echo " Public Key: $VPS1_PUB"
echo " Endpoint: $VPS1_IP:51820"
echo " Allowed IPs: 0.0.0.0/0"
echo "================================================================="
echo "[+] You can now log in to the Web UI, create clients, and connect."

echo ""
echo "[*] Verifying tunnel connectivity..."
if ping -c 3 10.9.0.2 &> /dev/null; then
    echo "[+] Tunnel is UP! Successfully pinged VPS2 (10.9.0.2) through the WireGuard tunnel."
else
    echo "[-] Tunnel verification failed. Could not ping VPS2 (10.9.0.2)."
    echo "    Please check your configuration, keys, and ensure UDP port 51820 is open on VPS2."
fi

