#!/bin/bash
# Double Tunnel - Interactive Setup Script
# This script guides you through the manual installation process for Double Tunnel v2.0.0.

set -e

# Colors for better readability
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}======================================================${NC}"
echo -e "${BLUE}   DOUBLE TUNNEL - INTERACTIVE MANUAL SETUP v2.0.0${NC}"
echo -e "${BLUE}======================================================${NC}"

# 1. Root Check
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}[ERROR] Please run as root (sudo su -)${NC}"
  exit 1
fi

echo -e "\n${BLUE}Step 1: Identify this VPS role${NC}"
echo "1) VPS1 (Gateway / Entry Node) - This is where your clients connect."
echo "2) VPS2 (Exit Node) - This is where your traffic exits to the internet."
read -p "Select role [1-2]: " ROLE_CHOICE

if [ "$ROLE_CHOICE" == "1" ]; then
    ROLE="VPS1"
    IFACE="wg-tun1"
    PEER_IFACE="wg-tun2"
elif [ "$ROLE_CHOICE" == "2" ]; then
    ROLE="VPS2"
    IFACE="wg-tun2"
    PEER_IFACE="wg-tun1"
else
    echo -e "${RED}Invalid choice. Exiting.${NC}"
    exit 1
fi

echo -e "\n${BLUE}Step 2: Preparing System (Installing dependencies)${NC}"
apt-get update
apt-get install -y wireguard wireguard-tools iptables curl iproute2 sshpass docker.io docker-compose-v2

# Enable IP Forwarding
echo "net.ipv4.ip_forward=1" > /etc/sysctl.d/99-double-tunnel.conf
sysctl -p /etc/sysctl.d/99-double-tunnel.conf || true

echo -e "\n${BLUE}Step 3: Generating WireGuard Keys for $ROLE${NC}"
mkdir -p /etc/wireguard
if [ ! -s /etc/wireguard/${IFACE}.key ]; then
    wg genkey > /etc/wireguard/${IFACE}.key
    wg pubkey < /etc/wireguard/${IFACE}.key > /etc/wireguard/${IFACE}.pub
    echo -e "${GREEN}[OK] Keys generated.${NC}"
else
    echo -e "${GREEN}[OK] Keys already exist.${NC}"
fi

MY_PUB_KEY=$(cat /etc/wireguard/${IFACE}.pub)

echo -e "\n${BLUE}======================================================${NC}"
echo -e "${GREEN}ACTION REQUIRED:${NC}"
echo -e "Your Public Key for $ROLE is:"
echo -e "${BLUE}$MY_PUB_KEY${NC}"
echo -e "------------------------------------------------------"
echo -e "1. Copy the key above."
echo -e "2. Go to the OTHER VPS and run this script."
echo -e "3. When prompted, paste the key you just copied."
echo -e "======================================================${NC}"

read -p "Do you have the OTHER VPS's Public Key ready? (y/n): " READY
if [[ "$READY" != "y" && "$READY" != "Y" ]]; then
    echo -e "\n${BLUE}Please run this script on the other VPS first.${NC}"
    echo -e "Once you have the other key, run this script again and choose 'y'."
    exit 0
fi

read -p "Paste the OTHER VPS's Public Key here: " PEER_PUB_KEY

if [ -z "$PEER_PUB_KEY" ]; then
    echo -e "${RED}Error: Peer Public Key cannot be empty.${NC}"
    exit 1
fi

# Save the peer key
echo "$PEER_PUB_KEY" > /etc/wireguard/peer_${IFACE}.pub

echo -e "\n${BLUE}Step 4: Finalizing Configuration for $ROLE${NC}"

if [ "$ROLE" == "VPS1" ]; then
    # VPS1 Configuration
    read -p "Enter VPS2 Public IP Address: " VPS2_IP
    if [ -z "$VPS2_IP" ]; then echo -e "${RED}Error: IP required.${NC}"; exit 1; fi
    
    PRIMARY_IF=$(ip route | grep default | awk '{print $5}' | head -n1 || echo "eth0")
    PRIMARY_IP=$(ip -4 addr show "$PRIMARY_IF" | awk '/inet / {print $2}' | cut -d/ -f1 | head -n1)
    PRIV_KEY=$(cat /etc/wireguard/wg-tun1.key)

    cat <<EOF > /etc/wireguard/wg-tun1.conf
[Interface]
PrivateKey = $PRIV_KEY
Address = 10.9.0.1/24
ListenPort = 51820
MTU = 1280
Table = off

PostUp = sysctl -w net.ipv4.conf.all.rp_filter=2; sysctl -w net.ipv4.conf.default.rp_filter=2; sysctl -w net.ipv4.conf.$PRIMARY_IF.rp_filter=2; sysctl -w net.ipv4.conf.wg-tun1.rp_filter=2; sysctl -w net.ipv4.conf.wg-gate.rp_filter=2 || true
PostUp = ip route add 10.9.0.0/24 dev %i || true
PostUp = ip route add default dev %i table 200 || true
PostUp = ip rule add from 10.8.0.0/24 table 200 priority 10 || true
PostUp = ip rule add from 10.9.0.1 table 200 priority 10 || true
PostUp = ip rule add from $PRIMARY_IP table main pref 100 || true
PostUp = iptables -I FORWARD 1 -i %i -j ACCEPT || true
PostUp = iptables -I FORWARD 1 -o %i -j ACCEPT || true
PostUp = iptables -I FORWARD 1 -i wg-gate -j ACCEPT || true
PostUp = iptables -I FORWARD 1 -o wg-gate -j ACCEPT || true
PostUp = iptables -t nat -A POSTROUTING -o %i -j MASQUERADE || true
PostUp = iptables -t mangle -I FORWARD 1 -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --clamp-mss-to-pmtu || true

PreDown = ip route del 10.9.0.0/24 dev %i || true
PreDown = ip route del default dev %i table 200 || true
PreDown = ip rule del from 10.8.0.0/24 table 200 priority 10 || true
PreDown = ip rule del from 10.9.0.1 table 200 priority 10 || true
PreDown = ip rule del from $PRIMARY_IP table main pref 100 || true
PreDown = iptables -D FORWARD -i %i -j ACCEPT || true
PreDown = iptables -D FORWARD -o %i -j ACCEPT || true
PreDown = iptables -D FORWARD -i wg-gate -j ACCEPT || true
PreDown = iptables -D FORWARD -o wg-gate -j ACCEPT || true
PreDown = iptables -t nat -D POSTROUTING -o %i -j MASQUERADE || true
PreDown = iptables -t mangle -D FORWARD -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --clamp-mss-to-pmtu || true

[Peer]
PublicKey = $PEER_PUB_KEY
Endpoint = $VPS2_IP:51820
AllowedIPs = 0.0.0.0/0
PersistentKeepalive = 25
EOF
    systemctl enable wg-quick@wg-tun1 || true
    systemctl restart wg-quick@wg-tun1 || wg-quick up wg-tun1 || true
    echo -e "${GREEN}[OK] VPS1 Tunnel (wg-tun1) is UP.${NC}"

    # Start wg-easy
    echo -e "\n${BLUE}Step 5: Starting wg-easy (Client Gateway on wg-gate)${NC}"
    MY_IP=$(curl -s https://ifconfig.me)
    docker run -d \
      --name=wg-easy \
      --network host \
      -e WG_HOST=$MY_IP \
      -e WG_MTU=1280 \
      -e PASSWORD=admin123 \
      -e WG_DEVICE=wg-gate \
      -v /etc/wireguard:/etc/wireguard \
      --cap-add=NET_ADMIN \
      --cap-add=SYS_MODULE \
      --restart unless-stopped \
      ghcr.io/wg-easy/wg-easy || true
    echo -e "${GREEN}[OK] wg-easy is running. Access UI at http://$MY_IP:51821${NC}"

else
    # VPS2 Configuration
    PRIMARY_IF=$(ip route | grep default | awk '{print $5}' | head -n1 || echo "eth0")
    PRIV_KEY=$(cat /etc/wireguard/wg-tun2.key)

    cat <<EOF > /etc/wireguard/wg-tun2.conf
[Interface]
PrivateKey = $PRIV_KEY
Address = 10.9.0.2/24
ListenPort = 51820
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
PublicKey = $PEER_PUB_KEY
AllowedIPs = 10.9.0.0/24, 10.8.0.0/24
EOF
    systemctl enable wg-quick@wg-tun2 || true
    systemctl restart wg-quick@wg-tun2 || wg-quick up wg-tun2 || true
    echo -e "${GREEN}[OK] VPS2 Tunnel (wg-tun2) is UP.${NC}"
fi

echo -e "\n${GREEN}======================================================${NC}"
echo -e "${GREEN}   SETUP COMPLETE FOR $ROLE${NC}"
echo -e "${GREEN}======================================================${NC}"
echo "Verify connectivity by pinging the other VPS:"
if [ "$ROLE" == "VPS1" ]; then
    echo "ping 10.9.0.2"
else
    echo "ping 10.9.0.1"
fi
