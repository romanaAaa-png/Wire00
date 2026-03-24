import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Shield, 
  Server, 
  Users, 
  Settings, 
  Plus, 
  Trash2, 
  Download, 
  QrCode, 
  Copy, 
  Check, 
  Terminal, 
  Activity,
  Binoculars,
  Globe,
  Lock,
  Key,
  Cpu,
  Wifi,
  Edit2,
  Save,
  FileCode,
  FileEdit,
  Play,
  RotateCcw,
  AlertCircle,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  ChevronRight,
  ChevronLeft,
  X,
  XCircle,
  Monitor,
  Smartphone,
  ExternalLink,
  ArrowRightLeft,
  FolderOpen,
  Wrench
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
import { cn } from './lib/utils';

// --- Types ---

declare global {
  interface Window {
    electron?: {
      sshExecute: (config: unknown) => Promise<unknown>;
      send: (channel: string, data: unknown) => void;
      receive: (channel: string, func: (...args: unknown[]) => void) => void;
      readFile: (filePath: string) => Promise<{ data?: string; error?: string }>;
      selectFile: () => Promise<string | null>;
      writeFile: (filePath: string, data: string) => Promise<{ success: boolean; error?: string }>;
      fixWindowsBlocking: () => Promise<{ success: boolean; error?: string }>;
    };
  }
}

interface Peer {
  id: string;
  name: string;
  publicKey: string;
  privateKey: string;
  allowedIPs: string;
  endpoint?: string;
  lastHandshake?: string;
  transferRx?: string;
  transferTx?: string;
  createdAt: string;
}

interface VPSConfig {
  ip: string;
  user: string;
  password?: string;
  sshKeyId?: string;
  ports?: { [key: string]: number };
  portConflicts?: { port: number, service: string, purpose: string }[];
  wg0PublicKey?: string;
  wg0PrivateKey?: string;
  wg1PublicKey?: string;
  wg1PrivateKey?: string;
  connectionStatus?: 'idle' | 'testing' | 'success' | 'error';
}

interface SSHKey {
  id: string;
  name: string;
  publicKey: string;
  privateKey: string;
  associatedVPS?: string;
  createdAt: string;
}

interface Tunnel {
  id: string;
  name: string;
  vps1: VPSConfig;
  vps2: VPSConfig;
  status: 'idle' | 'deploying' | 'deployed' | 'failed';
  step: number;
  logs: { msg: string, type: 'info' | 'success' | 'error' | 'cmd', vps?: 'vps1' | 'vps2' | 'exchange', timestamp: string }[];
  peers: Peer[];
  createdAt: string;
}

interface Script {
  id: string;
  title: string;
  description: string;
  content: string;
  rollbackContent?: string;
  icon?: React.ElementType;
}

interface PortForwardRule {
  id: string;
  externalPort: number;
  internalPort: number;
  protocol: 'TCP' | 'UDP';
  targetVPS: 'vps1' | 'vps2';
  status: 'active' | 'inactive';
  description?: string;
}

// --- Helpers ---

const generateWGKey = () => {
  const bytes = new Uint8Array(32);
  window.crypto.getRandomValues(bytes);
  // Convert to Base64
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

// --- Mock Data ---

const INITIAL_PEERS: Peer[] = [
  {
    id: '1',
    name: 'Admin Laptop',
    publicKey: '8xJ2vK9zL3mN4pQ5rS6tU7vW8xY9z0a1b2c3d4e5f6g=',
    privateKey: 'aB1cD2eF3gH4iJ5kL6mN7oP8qR9sT0uV1wX2yZ3a4b0=',
    allowedIPs: '10.0.0.2/32',
    lastHandshake: '2 mins ago',
    transferRx: '1.2 MB',
    transferTx: '450 KB',
    createdAt: '2026-03-20T10:00:00Z',
  },
  {
    id: '2',
    name: 'Mobile Phone',
    publicKey: 'pQ5rS6tU7vW8xY9z0a1b2c3d4e5f6g7h8i9j0k1l2m0=',
    privateKey: 'xY9z0a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s0=',
    allowedIPs: '10.0.0.3/32',
    lastHandshake: '1 hour ago',
    transferRx: '5.6 MB',
    transferTx: '1.1 MB',
    createdAt: '2026-03-21T08:30:00Z',
  }
];

const INITIAL_KEYS: SSHKey[] = [
  {
    id: 'key-1',
    name: 'Default Deployment Key',
    publicKey: 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQC7...',
    privateKey: '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA7...',
    associatedVPS: 'both',
    createdAt: new Date().toISOString()
  }
];

const INITIAL_PORT_RULES: PortForwardRule[] = [
  {
    id: 'rule-1',
    externalPort: 80,
    internalPort: 8080,
    protocol: 'TCP',
    targetVPS: 'vps1',
    status: 'active',
    description: 'HTTP Traffic Forwarding'
  },
  {
    id: 'rule-2',
    externalPort: 443,
    internalPort: 8443,
    protocol: 'TCP',
    targetVPS: 'vps1',
    status: 'active',
    description: 'HTTPS Traffic Forwarding'
  }
];


// --- Components ---

const Card = ({ children, className, title, icon: Icon }: { children: React.ReactNode, className?: string, title?: string, icon?: React.ElementType, key?: React.Key }) => (
  <div className={cn("bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-xl", className)}>
    {title && (
      <div className="px-6 py-4 border-b border-zinc-800 flex items-center gap-3 bg-zinc-900/50">
        {Icon && <Icon className="w-5 h-5 text-emerald-500" />}
        <h3 className="font-semibold text-zinc-100 tracking-tight uppercase text-xs">{title}</h3>
      </div>
    )}
    <div className="p-6">
      {children}
    </div>
  </div>
);

const Badge = ({ children, variant = 'default', className }: { children: React.ReactNode, variant?: 'default' | 'success' | 'warning' | 'zinc', className?: string }) => {
  const variants = {
    default: 'bg-zinc-800 text-zinc-400',
    success: 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-500 border border-amber-500/20',
    zinc: 'bg-zinc-800 text-zinc-400 border border-zinc-700'
  };
  return (
    <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider", variants[variant], className)}>
      {children}
    </span>
  );
};

type AppTab = 'pre-setup' | 'overview' | 'peers' | 'port-forwarding' | 'scripts' | 'keys' | 'wg-keys' | 'deploy' | 'config' | 'setup' | 'platforms' | 'diagnostics' | 'uninstall';

const INITIAL_PRE_SETUP_CONFIG = {
  vps1Ip: '',
  vps1Password: '',
  vps2Ip: '',
  vps2Password: '',
  vps1Wg0Pub: '',
  vps1Wg1Pub: '',
  vps2Wg0Pub: '',
  clientCount: 5,
  clientNames: 'Client1, Client2, Client3, Client4, Client5',
  setupIniPath: 'C:\\DoubleTunnel\\setup.ini'
};

const parseIniContent = (data: string, currentConfig: typeof INITIAL_PRE_SETUP_CONFIG) => {
  const lines = data.split(/\r?\n/);
  const newConfig = { ...currentConfig };
  let currentSection = '';
  
  lines.forEach(line => {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith(';') || trimmedLine.startsWith('#')) return;

    if (trimmedLine.startsWith('[') && trimmedLine.endsWith(']')) {
      currentSection = trimmedLine.slice(1, -1).toUpperCase();
      return;
    }

    const [key, ...valueParts] = trimmedLine.split('=');
    const value = valueParts.join('=').trim();
    const k = key.trim().toUpperCase();

    if (currentSection === 'VPS1') {
      if (k === 'IP') newConfig.vps1Ip = value;
      if (k === 'PASSWORD') newConfig.vps1Password = value;
      if (k === 'WG0_PUB') newConfig.vps1Wg0Pub = value;
      if (k === 'WG1_PUB') newConfig.vps1Wg1Pub = value;
    } else if (currentSection === 'VPS2') {
      if (k === 'IP') newConfig.vps2Ip = value;
      if (k === 'PASSWORD') newConfig.vps2Password = value;
      if (k === 'WG0_PUB') newConfig.vps2Wg0Pub = value;
    } else if (currentSection === 'WIREGUARD') {
      if (k === 'CLIENTCOUNT') newConfig.clientCount = parseInt(value) || 5;
      if (k === 'CLIENTNAMES') newConfig.clientNames = value;
      if (k === 'VPS1_WG0_PUB') newConfig.vps1Wg0Pub = value;
      if (k === 'VPS1_WG1_PUB') newConfig.vps1Wg1Pub = value;
      if (k === 'VPS2_WG0_PUB') newConfig.vps2Wg0Pub = value;
    } else {
      if (k === 'VPS1_IP') newConfig.vps1Ip = value;
      if (k === 'VPS1_PASSWORD') newConfig.vps1Password = value;
      if (k === 'VPS2_IP') newConfig.vps2Ip = value;
      if (k === 'VPS2_PASSWORD') newConfig.vps2Password = value;
      if (k === 'VPS1_WG0_PUB') newConfig.vps1Wg0Pub = value;
      if (k === 'VPS1_WG1_PUB') newConfig.vps1Wg1Pub = value;
      if (k === 'VPS2_WG0_PUB') newConfig.vps2Wg0Pub = value;
      if (k === 'CLIENT_COUNT') newConfig.clientCount = parseInt(value) || 5;
      if (k === 'CLIENT_NAMES') newConfig.clientNames = value;
    }
  });
  return newConfig;
};

interface SSHResult {
  stdout?: string;
  stderr?: string;
  errorOutput?: string;
  code?: number;
  error?: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('overview');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isTestingConfig, setIsTestingConfig] = useState(false);
  const cancelDeploymentRef = useRef(false);
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  
  useEffect(() => {
    const checkBackend = async () => {
      try {
        const res = await fetch('/api/health');
        if (res.ok) {
          setBackendStatus('online');
        } else {
          setBackendStatus('offline');
        }
      } catch {
        setBackendStatus('offline');
      }
    };
    checkBackend();
  }, []);
  const [consoleLogs, setConsoleLogs] = useState<{type: string, message: string, timestamp: string}[]>([]);
  const [vpsLogs, setVpsLogs] = useState<{vps: string, logs: string}[]>([]);

  useEffect(() => {
    const originalWarn = console.warn;
    const originalLog = console.log;
    const originalError = console.error;

    const captureLog = (type: string, ...args: unknown[]) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      
      setConsoleLogs(prev => [...prev.slice(-99), {
        type,
        message,
        timestamp: new Date().toLocaleTimeString([], { hour12: false })
      }]);
    };

    console.log = (...args) => {
      captureLog('info', ...args);
      originalLog.apply(console, args);
    };
    console.error = (...args) => {
      captureLog('error', ...args);
      originalError.apply(console, args);
    };
    console.warn = (...args) => {
      captureLog('warn', ...args);
      originalWarn.apply(console, args);
    };

    return () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
    };
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1280) {
        setIsSidebarCollapsed(true);
      } else {
        setIsSidebarCollapsed(false);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [tunnels, setTunnels] = useState<Tunnel[]>([
    {
      id: 'tunnel-1',
      name: 'Primary Double VPN',
      vps1: { ip: '', user: 'root', password: '', sshKeyId: 'key-1' },
      vps2: { ip: '', user: 'root', password: '', sshKeyId: 'key-1' },
      status: 'idle',
      step: 0,
      logs: [],
      peers: INITIAL_PEERS,
      createdAt: new Date().toISOString()
    }
  ]);
  const [activeTunnelId, setActiveTunnelId] = useState<string>('tunnel-1');
  
  const activeTunnel = tunnels.find(t => t.id === activeTunnelId) || tunnels[0];

  const INITIAL_SCRIPTS: Script[] = [
    {
      id: 'sync',
      title: 'LodgeGuard Sync Script (lodgeguard-sync.sh)',
      description: 'This script handles the automatic key rotation and exchange between VPS1 and VPS2. It is typically run via a daily cron job.',
      icon: Lock,
      content: `#!/bin/bash
# LodgeGuard Safe Key Rotation Script
set -e

PEER_IP="\${1:-10.9.0.254}"
LOG_FILE="/root/DTLogs/lodgeguard-sync.txt"
mkdir -p /root/DTLogs

log_msg() {
    echo "[\$(date)] \$1" | tee -a "\$LOG_FILE"
}

log_msg "Starting safe key rotation with peer \$PEER_IP..."

# 1. Verify tunnel is currently up
if ! ping -c 1 -W 5 "\$PEER_IP" > /dev/null; then
    log_msg "ERROR: Tunnel to \$PEER_IP is currently down. Cannot perform safe rotation."
    exit 1
fi

# 2. Generate new keys
NEW_PRIV=\$(wg genkey)
NEW_PUB=\$(echo "\$NEW_PRIV" | wg pubkey)
OLD_PRIV=\$(cat /etc/wireguard/wg1.key)
OLD_PUB=\$(cat /etc/wireguard/wg1.pub)

log_msg "Generated new ephemeral keys. Pushing new public key to peer..."

# 3. Add new public key to peer's allowed list (temporarily allowing both keys)
if ! ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no root@"\$PEER_IP" "wg set wg0 peer \$NEW_PUB allowed-ips 10.9.0.0/24,10.8.0.0/24"; then
    log_msg "ERROR: Failed to add new key to peer. Aborting rotation."
    exit 1
fi

# 4. Apply new private key locally
log_msg "Applying new private key locally..."
wg set wg1 private-key <(echo "\$NEW_PRIV")

# 5. Verify connectivity with new keys
log_msg "Testing tunnel connectivity with new keys..."
if ping -c 3 -W 5 "\$PEER_IP" > /dev/null; then
    log_msg "Connectivity verified! Committing changes..."
    
    # Save locally
    echo "\$NEW_PRIV" > /etc/wireguard/wg1.key
    echo "\$NEW_PUB" > /etc/wireguard/wg1.pub
    sed -i "s|PrivateKey = .*|PrivateKey = \$NEW_PRIV|" /etc/wireguard/wg1.conf
    
    # Remove old key from peer and save peer config
    ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no root@"\$PEER_IP" "wg set wg0 peer \$OLD_PUB remove && wg-quick save wg0"
    
    log_msg "Key rotation completed successfully."
else
    log_msg "ERROR: Connectivity failed with new keys. Initiating rollback..."
    
    # Rollback local
    wg set wg1 private-key <(echo "\$OLD_PRIV")
    
    # Rollback peer
    ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no root@"\$PEER_IP" "wg set wg0 peer \$NEW_PUB remove"
    
    log_msg "Rollback complete. Old keys are still active."
    exit 1
fi
`
    },
    {
      id: 'vps1-setup',
      title: 'VPS1 (Gateway) - Double VPN Setup Script',
      description: 'Installs WG-Easy for Clients and a secondary tunnel to VPS2. Routes all Client traffic through VPS2.',
      icon: Binoculars,
      content: `#!/bin/bash
# VPS1 Setup Script (Gateway) - IP: __VPS1_IP__
set -ex

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
  log_step "prepare" "--- Starting VPS1 Preparation Phase ---"
  
  fix_apt() {
    log_step "prepare" "Fixing package manager (apt)..."
    rm -f /var/lib/dpkg/lock-frontend /var/lib/apt/lists/lock /var/cache/apt/archives/lock /var/lib/dpkg/lock || true
    dpkg --configure -a || true
    apt-get update || true
  }

  fix_apt
  export DEBIAN_FRONTEND=noninteractive
  export NEEDRESTART_MODE=a

  log_step "prepare" "Installing Docker, WireGuard Tools & SSH Tools..."
  apt-get update
  apt-get install -y -o Dpkg::Options::="--force-confnew" ca-certificates curl gnupg wireguard wireguard-tools iptables iproute2 sshpass
  
  if ! command -v wg &> /dev/null; then
    log_step "prepare" "ERROR: wireguard-tools installation failed. 'wg' command not found."
    exit 1
  fi
  
  # Docker Installation
  if ! command -v docker &> /dev/null; then
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc || true
    chmod a+r /etc/apt/keyrings/docker.asc || true
    echo "Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: \$(. /etc/os-release && echo \"\${UBUNTU_CODENAME:-\$VERSION_CODENAME}\")
Components: stable
Signed-By: /etc/apt/keyrings/docker.asc" | tee /etc/apt/sources.list.d/docker.sources > /dev/null || true
    apt-get update || true
    apt-get install -y -o Dpkg::Options::="--force-confnew" docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin || true
  fi

  systemctl enable docker || true
  systemctl start docker || true

  log_step "prepare" "Generating WireGuard keys for inter-VPS tunnel (wg1)..."
  mkdir -p /etc/wireguard
  if [ ! -s /etc/wireguard/wg1.key ] || [ ! -s /etc/wireguard/wg1.pub ]; then
    wg genkey > /etc/wireguard/wg1.key
    wg pubkey < /etc/wireguard/wg1.key > /etc/wireguard/wg1.pub
  fi
  echo "RESULT_WG1_PUB_KEY: $(cat /etc/wireguard/wg1.pub)"
  
  if [ -f /var/run/reboot-required ]; then
    log_step "prepare" "System requires a reboot. Marking for reboot..."
    echo "REBOOT_REQUIRED"
  fi
  
  log_step "prepare" "--- VPS1 Preparation Phase Complete ---"
}

do_configure() {
  PEER_PUB="$1"
  if [ -z "$PEER_PUB" ]; then
    if [ -f /etc/wireguard/peer_wg0.pub ]; then
      PEER_PUB=$(cat /etc/wireguard/peer_wg0.pub)
    else
      log_step "configure" "ERROR: No peer public key provided or found in peer_wg0.pub."
      exit 1
    fi
  fi

  log_step "configure" "--- Starting VPS1 Configuration Phase ---"
  
  # 2. Setup WG-Easy (Client Gateway)
  log_step "configure" "Cleaning up previous installations..."
  systemctl stop wg-quick@wg0 wg-quick@wg1 2>/dev/null || true
  if command -v docker &> /dev/null; then
    docker stop wg-easy 2>/dev/null || true
    docker rm wg-easy 2>/dev/null || true
  fi

  log_step "configure" "Configuring WG-Easy in /etc/wireguard..."
  mkdir -p /etc/wireguard
  cat <<EOF > /etc/wireguard/docker-compose.yml
services:
  wg-easy:
    environment:
      - WG_HOST=__VPS1_IP__
      - WG_MTU=1280
      - PASSWORD=admin123
      - WG_DEFAULT_DNS=1.1.1.1
      - WG_ALLOWED_IPS=0.0.0.0/0
      - WG_PORT=__WG_EASY_PORT__
      - PORT=__WG_EASY_UI_PORT__
    image: ghcr.io/wg-easy/wg-easy
    container_name: wg-easy
    network_mode: "host"
    volumes:
      - .:/etc/wireguard
    restart: unless-stopped
    cap_add:
      - NET_ADMIN
      - SYS_MODULE
EOF
  cd /etc/wireguard && docker compose up -d

  log_step "configure" "Enabling IP Forwarding..."
  sysctl -w net.ipv4.ip_forward=1 || true
  echo "net.ipv4.ip_forward=1" > /etc/sysctl.d/99-wireguard.conf
  sysctl -p /etc/sysctl.d/99-wireguard.conf || true

  # 4. Setup VPS-to-VPS Tunnel (wg1)
  log_step "configure" "Configuring VPS-to-VPS Tunnel (wg1) with Peer Key: $PEER_PUB"
  if ! grep -q "200 vpn" /etc/iproute2/rt_tables; then
    echo "200 vpn" >> /etc/iproute2/rt_tables
  fi

  PRIV_KEY=$(cat /etc/wireguard/wg1.key)
  PRIMARY_IF=$(ip route | grep default | awk '{print $5}' | head -n1 || echo "eth0")
  PRIMARY_IP=$(ip -4 addr show "$PRIMARY_IF" | awk '/inet / {print $2}' | cut -d/ -f1 | head -n1)

  cat <<EOF > /etc/wireguard/wg1.conf
[Interface]
PrivateKey = $PRIV_KEY
Address = 10.9.0.1/24
ListenPort = __WG_INTER_VPS_PORT__
MTU = 1280
Table = off

PostUp = sysctl -w net.ipv4.conf.all.rp_filter=2; sysctl -w net.ipv4.conf.default.rp_filter=2; sysctl -w net.ipv4.conf.\$PRIMARY_IF.rp_filter=2; sysctl -w net.ipv4.conf.wg1.rp_filter=2; sysctl -w net.ipv4.conf.wg0.rp_filter=2 || true
PostUp = ip route add 10.9.0.0/24 dev %i || true
PostUp = ip route add default dev %i table 200 || true
PostUp = ip rule add from 10.8.0.0/24 table 200 priority 10 || true
PostUp = ip rule add from 10.9.0.1 table 200 priority 10 || true
PostUp = ip rule add from \$PRIMARY_IP table main pref 100 || true
PostUp = iptables -I FORWARD 1 -i %i -j ACCEPT || true
PostUp = iptables -I FORWARD 1 -o %i -j ACCEPT || true
PostUp = iptables -I FORWARD 1 -i wg0 -j ACCEPT || true
PostUp = iptables -I FORWARD 1 -o wg0 -j ACCEPT || true
PostUp = iptables -t nat -A POSTROUTING -o %i -j MASQUERADE || true
PostUp = iptables -t mangle -I FORWARD 1 -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --clamp-mss-to-pmtu || true

PreDown = ip route del 10.9.0.0/24 dev %i || true
PreDown = ip route del default dev %i table 200 || true
PreDown = ip rule del from 10.8.0.0/24 table 200 priority 10 || true
PreDown = ip rule del from 10.9.0.1 table 200 priority 10 || true
PreDown = ip rule del from \$PRIMARY_IP table main pref 100 || true
PreDown = iptables -D FORWARD -i %i -j ACCEPT || true
PreDown = iptables -D FORWARD -o %i -j ACCEPT || true
PreDown = iptables -D FORWARD -i wg0 -j ACCEPT || true
PreDown = iptables -D FORWARD -o wg0 -j ACCEPT || true
PreDown = iptables -t nat -D POSTROUTING -o %i -j MASQUERADE || true
PreDown = iptables -t mangle -D FORWARD -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --clamp-mss-to-pmtu || true

[Peer]
PublicKey = $PEER_PUB
Endpoint = __VPS2_IP__:__WG_EXIT_PORT__
AllowedIPs = 0.0.0.0/0
PersistentKeepalive = 25
EOF

  log_step "configure" "Starting WireGuard wg1..."
  systemctl enable wg-quick@wg1 || true
  systemctl restart wg-quick@wg1 || wg-quick up wg1 || true

  # Wait for wg-easy to generate its key
  WG0_PUB=""
  for i in {1..10}; do
    if docker exec wg-easy wg show wg0 public-key &>/dev/null; then
      WG0_PUB=$(docker exec wg-easy wg show wg0 public-key)
      if [ -n "$WG0_PUB" ]; then break; fi
    fi
    sleep 2
  done
  echo "RESULT_WG0_PUB_KEY: $WG0_PUB"

  log_step "configure" "--- VPS1 Configuration Phase Complete ---"
}

do_push_key() {
  PEER_IP="$1"
  PEER_PASS="$2"
  IFACE="$3"
  if [ -z "$PEER_IP" ] || [ -z "$PEER_PASS" ]; then
    log_step "push-key" "ERROR: Peer IP or Password missing."
    exit 1
  fi
  if [ ! -s /etc/wireguard/\${IFACE}.key ] || [ ! -s /etc/wireguard/\${IFACE}.pub ]; then
    log_step "push-key" "Keys missing or empty. Regenerating..."
    wg genkey > /etc/wireguard/\${IFACE}.key
    wg pubkey < /etc/wireguard/\${IFACE}.key > /etc/wireguard/\${IFACE}.pub
  fi
  PUB_KEY=$(cat /etc/wireguard/\${IFACE}.pub)
  if [ -z "\$PUB_KEY" ]; then
    log_step "push-key" "ERROR: Public key for \$IFACE is empty or missing."
    exit 1
  fi
  log_step "push-key" "Pushing \$IFACE public key to \$PEER_IP..."
  if ! sshpass -p "\$PEER_PASS" ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 root@\$PEER_IP "mkdir -p /etc/wireguard && echo '\$PUB_KEY' > /etc/wireguard/peer_\${IFACE}.pub"; then
    log_step "push-key" "ERROR: Failed to push key via SSH."
    exit 1
  fi
  log_step "push-key" "Successfully pushed key."
}

case "$1" in
  prepare) do_prepare ;;
  configure) do_configure "$2" ;;
  push-key) do_push_key "$2" "$3" "$4" ;;
  *) echo "Usage: $0 {prepare|configure|push-key} [peer_pub]"; exit 1 ;;
esac
`,
      rollbackContent: `#!/bin/bash
# VPS1 Rollback Script
systemctl stop wg-quick@wg1 || true
systemctl disable wg-quick@wg1 || true
cd /etc/wireguard && docker compose down || true
rm -rf /etc/wireguard/wg1.*
`
    },
    {
      id: 'vps2-setup',
      title: 'VPS2 (Exit Node) - Double VPN Setup Script',
      description: 'Configures VPS2 as the final exit point for all traffic.',
      icon: Binoculars,
      content: `#!/bin/bash
# VPS2 Setup Script (Exit Node) - IP: __VPS2_IP__
set -ex

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
ListenPort = __WG_EXIT_PORT__
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

do_push_key() {
  PEER_IP="$1"
  PEER_PASS="$2"
  IFACE="$3"
  if [ -z "$PEER_IP" ] || [ -z "$PEER_PASS" ]; then
    log_step "push-key" "ERROR: Peer IP or Password missing."
    exit 1
  fi
  if [ ! -s /etc/wireguard/\${IFACE}.key ] || [ ! -s /etc/wireguard/\${IFACE}.pub ]; then
    log_step "push-key" "Keys missing or empty. Regenerating..."
    wg genkey > /etc/wireguard/\${IFACE}.key
    wg pubkey < /etc/wireguard/\${IFACE}.key > /etc/wireguard/\${IFACE}.pub
  fi
  PUB_KEY=$(cat /etc/wireguard/\${IFACE}.pub)
  if [ -z "\$PUB_KEY" ]; then
    log_step "push-key" "ERROR: Public key for \$IFACE is empty or missing."
    exit 1
  fi
  log_step "push-key" "Pushing \$IFACE public key to \$PEER_IP..."
  if ! sshpass -p "\$PEER_PASS" ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 root@\$PEER_IP "mkdir -p /etc/wireguard && echo '\$PUB_KEY' > /etc/wireguard/peer_\${IFACE}.pub"; then
    log_step "push-key" "ERROR: Failed to push key via SSH."
    exit 1
  fi
  log_step "push-key" "Successfully pushed key."
}

case "$1" in
  prepare) do_prepare ;;
  configure) do_configure "$2" ;;
  push-key) do_push_key "$2" "$3" "$4" ;;
  *) echo "Usage: $0 {prepare|configure|push-key} [peer_pub]"; exit 1 ;;
esac
`,
      rollbackContent: `#!/bin/bash
# VPS2 Rollback Script
systemctl stop wg-quick@wg0 || true
systemctl disable wg-quick@wg0 || true
rm -f /etc/wireguard/wg0.*
`
    },
    {
      id: 'vps-check',
      title: 'VPS Readiness Check (vps-check.sh)',
      description: 'Verifies if the VPS meets the requirements for Double VPN installation (OS, Root, Kernel, Network).',
      icon: Activity,
      content: `#!/bin/bash
# Double Tunnel - VPS Readiness Check Script
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
for port in 22 __WG_EASY_PORT__ __WG_EASY_UI_PORT__ __WG_INTER_VPS_PORT__ __WG_EXIT_PORT__; do
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
`
    },
    {
      id: 'manual-install',
      title: 'Manual Installation & Verification (manual-setup.sh)',
      description: 'A comprehensive script for manual execution on a VPS to install all dependencies, verify connectivity, and check system readiness. Use this if automated deployment fails.',
      icon: FileCode,
      content: `#!/bin/bash
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

# 7. Connectivity Test
echo "[6/7] Testing Internet connectivity..."
if curl -s --connect-timeout 5 https://google.com > /dev/null; then
    echo "[OK] Internet access is available."
else
    echo "[ERROR] No internet access detected."
fi

# 8. Port Check
echo "[7/7] Checking standard ports..."
for port in 22 __WG_EASY_PORT__ __WG_EASY_UI_PORT__ __WG_INTER_VPS_PORT__ __WG_EXIT_PORT__; do
    if ss -tuln | grep -q ":$port "; then
        echo "[INFO] Port $port is in use."
    else
        echo "[OK] Port $port is free."
    fi
done

echo ""
echo "======================================================"
echo "   MANUAL VERIFICATION COMPLETE"
echo "======================================================"
echo "If all [OK], you can proceed with the automated deployment."
echo "If WireGuard or Docker failed, please reboot the VPS and try again."
`
    },
    {
      id: 'full-wipe',
      title: 'VPS Full System Reset (vps-reset.sh)',
      description: 'Aggressively removes all WireGuard, Docker, and networking configurations. Restores VPS to a clean state.',
      icon: Trash2,
      content: `#!/bin/bash
# Double Tunnel - Full VPS Reset Script
# Logging setup
LOG_DIR="/root/DTLogs"
LOG_FILE="$LOG_DIR/installation.txt"
mkdir -p "$LOG_DIR"
echo "--- WARNING: Initiating Full System Wipe ---" >> "$LOG_FILE"
echo "Started at: $(date)" >> "$LOG_FILE"

echo "--- WARNING: Initiating Full System Wipe ---"
set -x

# 1. Stop all services
systemctl stop wg-quick@wg0 || true
systemctl stop wg-quick@wg1 || true
docker stop wg-easy || true
docker rm wg-easy || true

# 2. Purge packages
export DEBIAN_FRONTEND=noninteractive
if command -v snap &> /dev/null; then
  snap remove docker || true
fi
apt-get purge -y -o Dpkg::Options::="--force-confnew" wireguard wireguard-tools docker.io docker-compose-v2 iptables-persistent
apt-get autoremove -y
apt-get clean

# 3. Remove configurations
rm -rf /etc/wireguard
rm -rf /var/lib/docker
rm -rf /etc/docker

# 4. Reset Networking (Iptables)
iptables -P INPUT ACCEPT
iptables -P FORWARD ACCEPT
iptables -P OUTPUT ACCEPT
iptables -t nat -F
iptables -t mangle -F
iptables -F
iptables -X

# 5. Restore sysctl
sed -i '/net.ipv4.ip_forward=1/d' /etc/sysctl.conf
sysctl -p

echo "--- Full VPS Reset Complete. System is clean. ---" >> "$LOG_FILE"
echo "--- Full VPS Reset Complete. System is clean. ---"
`
    },
    {
      id: 'docker-fix',
      title: 'Docker Emergency Repair (docker-fix.sh)',
      description: 'Forcefully resets the Docker daemon, removes corrupted state, and attempts a clean reinstall of the Docker engine.',
      icon: ShieldAlert,
      content: `#!/bin/bash
# Double Tunnel - Docker Emergency Repair Script
set -e

echo "--- Initiating Docker Emergency Repair ---"

# 1. Stop services and reset failed states
systemctl stop docker.socket || true
systemctl stop docker || true
systemctl reset-failed docker || true
systemctl reset-failed docker.socket || true

# 2. Remove potentially corrupted data
echo "Removing Docker state data..."
rm -rf /var/lib/docker
rm -rf /etc/docker/daemon.json

# 3. Purge and Reinstall
echo "Purging Docker packages..."
apt-get purge -y docker.io docker-ce docker-ce-cli containerd.io docker-compose-v2
apt-get autoremove -y

echo "Reinstalling Docker..."
apt-get update
if ! apt-get install -y docker.io; then
    echo "docker.io failed, trying official repo..."
    apt-get install -y ca-certificates gnupg lsb-release
    mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg || true
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null || true
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
fi
apt-get install -y docker-compose-v2 || true

# 4. Restart
echo "Starting Docker..."
systemctl unmask docker.service || true
systemctl unmask docker.socket || true
systemctl daemon-reload
systemctl start docker.socket || true
systemctl start docker || true

if systemctl is-active --quiet docker; then
    echo "[OK] Docker is now running successfully."
else
    echo "[ERROR] Docker still failed to start. A system reboot is highly recommended."
fi
`
    },
    {
      id: 'vps-check',
      title: 'VPS Diagnostic Tool (vps-check.sh)',
      description: 'Comprehensive diagnostic script to check WireGuard, Docker, and network status on any VPS.',
      icon: Activity,
      content: `#!/bin/bash
echo "======================================================"
echo "   DOUBLE TUNNEL - VPS DIAGNOSTIC REPORT"
echo "======================================================"
echo "Timestamp: $(date)"
echo "Uptime: $(uptime -p)"
echo "Kernel: $(uname -r)"
echo "OS: $(cat /etc/os-release | grep PRETTY_NAME | cut -d'=' -f2 | tr -d '\"')"
echo ""

echo "--- 1. WireGuard Status ---"
if command -v wg &> /dev/null; then
    echo "[OK] WireGuard Tools installed."
    wg show || echo "[INFO] No active WireGuard interfaces."
else
    echo "[ERROR] WireGuard Tools (wg) NOT found."
fi

echo ""
echo "--- 2. Kernel Module Status ---"
if lsmod | grep -q wireguard; then
    echo "[OK] WireGuard kernel module is LOADED."
else
    echo "[ERROR] WireGuard kernel module is NOT loaded."
    echo "Attempting to load it now..."
    modprobe wireguard && echo "[OK] Successfully loaded module." || echo "[ERROR] Failed to load module."
fi

echo ""
echo "--- 3. Docker Status ---"
if command -v docker &> /dev/null; then
    echo "[OK] Docker is installed."
    if systemctl is-active --quiet docker; then
        echo "[OK] Docker service is ACTIVE."
        docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" || echo "[ERROR] Failed to list containers."
    else
        echo "[ERROR] Docker service is NOT active."
        systemctl status docker --no-pager -n 5
    fi
else
    echo "[ERROR] Docker is NOT installed."
fi

echo ""
echo "--- 4. Network Configuration ---"
echo "Interfaces:"
ip -4 addr show | grep -E '^[0-9]|inet'
echo ""
echo "Default Route:"
ip route | grep default
echo ""
echo "IP Forwarding:"
sysctl net.ipv4.ip_forward

echo ""
echo "--- 5. Recent System Errors (journalctl) ---"
journalctl -p 3 -n 20 --no-pager

echo ""
echo "--- 6. WireGuard Configs ---"
ls -l /etc/wireguard/*.conf 2>/dev/null || echo "No WireGuard configs found in /etc/wireguard/"

echo ""
echo "======================================================"
echo "   DIAGNOSTIC COMPLETE"
echo "======================================================"
`
    },
    {
      id: 'pc-cleanup',
      title: 'Local PC Cleanup Tool (cleanup.bat)',
      description: 'Windows Batch script to remove local Double Tunnel remnants, registry keys, and cached configurations.',
      icon: ShieldAlert,
      content: `@echo off
title Double Tunnel - Local PC Cleanup Tool
echo ======================================================
echo   DOUBLE TUNNEL - LOCAL PC CLEANUP & RESET
echo ======================================================
echo This script will remove Double Tunnel configurations, registry entries, and remnants.
echo Run as ADMINISTRATOR for best results.
echo.
echo [!] WARNING: This will force remove all local data.
echo.
pause

echo.
echo [1/5] Stopping WireGuard services...
net stop WireGuardManager 2>nul
net stop WireGuardTunnel 2>nul
taskkill /f /im "Double Tunnel.exe" 2>nul

echo.
echo [2/5] Removing Registry Keys...
reg delete "HKEY_LOCAL_MACHINE\SOFTWARE\Double Tunnel" /f 2>nul
reg delete "HKEY_CURRENT_USER\Software\Double Tunnel" /f 2>nul
reg delete "HKEY_LOCAL_MACHINE\SOFTWARE\WireGuard" /f 2>nul
reg delete "HKEY_CURRENT_USER\Software\WireGuard" /f 2>nul

echo.
echo [3/5] Cleaning up configuration directories...
if exist "%ProgramFiles%\Double Tunnel" (
    echo Removing Program Files (Double Tunnel)...
    rmdir /s /q "%ProgramFiles%\Double Tunnel"
)
if exist "%ProgramFiles%\WireGuard" (
    echo Removing Program Files (WireGuard)...
    rmdir /s /q "%ProgramFiles%\WireGuard"
)
if exist "%LOCALAPPDATA%\double-tunnel-updater" (
    echo Removing Local AppData (Updater)...
    rmdir /s /q "%LOCALAPPDATA%\double-tunnel-updater"
)
if exist "%APPDATA%\Double Tunnel" (
    echo Removing AppData (Double Tunnel)...
    rmdir /s /q "%APPDATA%\Double Tunnel"
)
if exist "%LOCALAPPDATA%\WireGuard" (
    echo Removing Local AppData (WireGuard)...
    rmdir /s /q "%LOCALAPPDATA%\WireGuard"
)

echo.
echo [4/5] Removing Desktop Shortcuts...
if exist "%PUBLIC%\Desktop\Double Tunnel.lnk" del /f /q "%PUBLIC%\Desktop\Double Tunnel.lnk"
if exist "%USERPROFILE%\Desktop\Double Tunnel.lnk" del /f /q "%USERPROFILE%\Desktop\Double Tunnel.lnk"

echo.
echo [5/5] Resetting Network Stack...
netsh int ip reset >nul
netsh winsock reset >nul

echo.
echo ======================================================
echo   CLEANUP COMPLETE!
echo ======================================================
echo Double Tunnel has been forcefully removed from this PC.
echo Please restart your computer to finalize the process.
echo.
pause
`
    }
  ];

  const VPS_DATA = [
    { 
      ...activeTunnel.vps1, 
      name: 'VPS1 (Gateway)', 
      role: 'gateway', 
      status: activeTunnel.status === 'deployed' ? 'online' : 'offline', 
      wgIp: '10.0.0.1', 
      lastRotation: '2026-03-21 10:00:00', 
      nextRotation: '2026-03-22 10:00:00',
      ports: activeTunnel.vps1.ports,
      portConflicts: activeTunnel.vps1.portConflicts,
      sshKeyId: activeTunnel.vps1.sshKeyId
    },
    { 
      ...activeTunnel.vps2, 
      name: 'VPS2 (Node)', 
      role: 'node', 
      status: activeTunnel.status === 'deployed' ? 'online' : 'offline', 
      wgIp: '10.0.0.254', 
      lastRotation: '2026-03-21 10:00:00', 
      nextRotation: '2026-03-22 10:00:00',
      ports: activeTunnel.vps2.ports,
      portConflicts: activeTunnel.vps2.portConflicts,
      sshKeyId: activeTunnel.vps2.sshKeyId
    },
  ];

  const [scripts, setScripts] = useState<Script[]>(INITIAL_SCRIPTS);
  const [sshKeys, setSshKeys] = useState<SSHKey[]>(INITIAL_KEYS);
  const [portForwardRules, setPortForwardRules] = useState<PortForwardRule[]>(INITIAL_PORT_RULES);
  const [showAddPeer, setShowAddPeer] = useState(false);
  const [showAddScript, setShowAddScript] = useState(false);
  const [showAddKey, setShowAddKey] = useState(false);
  const [showAddPortRule, setShowAddPortRule] = useState(false);
  const [editingScript, setEditingScript] = useState<Script | null>(null);
  const [editingPortRule, setEditingPortRule] = useState<PortForwardRule | null>(null);
  const [newPeerName, setNewPeerName] = useState('');
  const [newScript, setNewScript] = useState({ title: '', description: '', content: '', rollbackContent: '' });
  const [newKey, setNewKey] = useState({ name: '', publicKey: '', privateKey: '', associatedVPS: 'both' });
  const [newPortRule, setNewPortRule] = useState<Omit<PortForwardRule, 'id' | 'status'>>({
    externalPort: 80,
    internalPort: 80,
    protocol: 'TCP',
    targetVPS: 'vps1',
    description: ''
  });
  const [preSetupConfig, setPreSetupConfig] = useState(INITIAL_PRE_SETUP_CONFIG);

  useEffect(() => {
    const autoLoad = async () => {
      if (window.electron && window.electron.readFile) {
        try {
          const result = await window.electron.readFile(preSetupConfig.setupIniPath);
          if (result.data) {
            const newConfig = parseIniContent(result.data, preSetupConfig);
            setPreSetupConfig(newConfig);
            updateActiveTunnel({
              vps1: { ...activeTunnel.vps1, ip: newConfig.vps1Ip, password: newConfig.vps1Password },
              vps2: { ...activeTunnel.vps2, ip: newConfig.vps2Ip, password: newConfig.vps2Password }
            });
            addLog("Auto-loaded configuration from setup.ini", "success");
          }
        } catch {
          console.log("Auto-load setup.ini skipped or failed.");
        }
      }
    };
    autoLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSetupIni = async () => {
    if (!window.electron || !window.electron.readFile) {
      addLog("This feature is only available in the Desktop version.", "error");
      return;
    }

    addLog(`Attempting to load configuration from: ${preSetupConfig.setupIniPath}`, "info");

    try {
      const result = await window.electron.readFile(preSetupConfig.setupIniPath);
      if (result.error) {
        addLog(`Error reading setup.ini: ${result.error}`, "error");
        return;
      }

      if (result.data) {
        const newConfig = parseIniContent(result.data, preSetupConfig);
        setPreSetupConfig(newConfig);
        updateActiveTunnel({
          vps1: { 
            ...activeTunnel.vps1, 
            ip: newConfig.vps1Ip, 
            password: newConfig.vps1Password,
            wg0PublicKey: newConfig.vps1Wg0Pub || activeTunnel.vps1.wg0PublicKey,
            wg1PublicKey: newConfig.vps1Wg1Pub || activeTunnel.vps1.wg1PublicKey
          },
          vps2: { 
            ...activeTunnel.vps2, 
            ip: newConfig.vps2Ip, 
            password: newConfig.vps2Password,
            wg0PublicKey: newConfig.vps2Wg0Pub || activeTunnel.vps2.wg0PublicKey
          }
        });
        addLog("Configuration loaded successfully from setup.ini and applied to current project.", "success");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      addLog(`Failed to load setup.ini: ${message}`, "error");
    }
  };

  const selectSetupIni = async () => {
    if (!window.electron || !window.electron.selectFile) {
      alert("This feature is only available in the Desktop version.");
      return;
    }

    const filePath = await window.electron.selectFile();
    if (filePath) {
      setPreSetupConfig({ ...preSetupConfig, setupIniPath: filePath });
    }
  };

  const handleFixWindowsBlocking = async () => {
    if (!window.electron || !window.electron.fixWindowsBlocking) {
      alert("This feature is only available in the Desktop version.");
      return;
    }

    try {
      const result = await window.electron.fixWindowsBlocking();
      if (result.success) {
        alert("Windows Security exclusion request sent. Please accept the Administrator prompt if it appears. This will help prevent Windows from blocking the application's operations.");
      } else {
        alert(`Failed to apply exclusion: ${result.error}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      alert(`Error: ${message}`);
    }
  };
  const [selectedPeer, setSelectedPeer] = useState<Peer | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [isRotating, setIsRotating] = useState(false);
  
  // --- Simulation: Live Peer Activity ---
  useEffect(() => {
    if (activeTunnel.status !== 'deployed') return;

    const interval = setInterval(() => {
      setTunnels(prev => prev.map(t => {
        if (t.id !== activeTunnelId) return t;
        
        return {
          ...t,
          peers: t.peers.map(p => {
            // Randomly update some peers
            if (Math.random() > 0.7) {
              const rxAdd = Math.floor(Math.random() * 500);
              const txAdd = Math.floor(Math.random() * 200);
              
              const parseVal = (val: string) => {
                const num = parseFloat(val);
                if (val.includes('GB')) return num * 1024 * 1024;
                if (val.includes('MB')) return num * 1024;
                return num;
              };

              const formatVal = (kb: number) => {
                if (kb > 1024 * 1024) return `${(kb / (1024 * 1024)).toFixed(2)} GB`;
                if (kb > 1024) return `${(kb / 1024).toFixed(2)} MB`;
                return `${kb.toFixed(0)} KB`;
              };

              return {
                ...p,
                lastHandshake: 'Just now',
                transferRx: formatVal(parseVal(p.transferRx || '0 KB') + rxAdd),
                transferTx: formatVal(parseVal(p.transferTx || '0 KB') + txAdd),
              };
            }
            return p;
          })
        };
      }));
    }, 5000);

    return () => clearInterval(interval);
  }, [activeTunnel.status, activeTunnelId]);

  const addTunnel = () => {
    const newId = `tunnel-${Date.now()}`;
    const newTunnel: Tunnel = {
      id: newId,
      name: `New Double VPN Project ${tunnels.length + 1}`,
      vps1: { ip: '', user: 'root', password: '' },
      vps2: { ip: '', user: 'root', password: '' },
      status: 'idle',
      step: 0,
      logs: [],
      peers: INITIAL_PEERS,
      createdAt: new Date().toISOString()
    };
    setTunnels([...tunnels, newTunnel]);
    setActiveTunnelId(newId);
  };

  const deleteTunnel = (id: string) => {
    if (tunnels.length <= 1) {
      alert("You must have at least one project.");
      return;
    }
    if (confirm("Are you sure you want to delete this project? All credentials and logs will be lost.")) {
      const newTunnels = tunnels.filter(t => t.id !== id);
      setTunnels(newTunnels);
      if (activeTunnelId === id) {
        setActiveTunnelId(newTunnels[0].id);
      }
    }
  };

  const downloadIni = () => {
    const content = `[VPS1]
IP=${preSetupConfig.vps1Ip || activeTunnel.vps1.ip || 'XXX.XXX.XXX.XXX'}
Password=${preSetupConfig.vps1Password || activeTunnel.vps1.password || '********'}
WG0_PUB=${activeTunnel.vps1.wg0PublicKey || ''}
WG1_PUB=${activeTunnel.vps1.wg1PublicKey || ''}

[VPS2]
IP=${preSetupConfig.vps2Ip || activeTunnel.vps2.ip || 'XXX.XXX.XXX.XXX'}
Password=${preSetupConfig.vps2Password || activeTunnel.vps2.password || '********'}
WG0_PUB=${activeTunnel.vps2.wg0PublicKey || ''}

[WireGuard]
ClientCount=${preSetupConfig.clientCount}
ClientNames=${preSetupConfig.clientNames}
`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'setup.ini';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addLog("Pre-setup configuration (setup.ini) generated and downloaded.", "success");
  };

  const saveSetupIni = async () => {
    if (!window.electron || !window.electron.writeFile) {
      addLog("This feature is only available in the Desktop version.", "error");
      return;
    }

    const content = `[VPS1]
IP=${preSetupConfig.vps1Ip || activeTunnel.vps1.ip || 'XXX.XXX.XXX.XXX'}
Password=${preSetupConfig.vps1Password || activeTunnel.vps1.password || '********'}
WG0_PUB=${activeTunnel.vps1.wg0PublicKey || ''}
WG1_PUB=${activeTunnel.vps1.wg1PublicKey || ''}

[VPS2]
IP=${preSetupConfig.vps2Ip || activeTunnel.vps2.ip || 'XXX.XXX.XXX.XXX'}
Password=${preSetupConfig.vps2Password || activeTunnel.vps2.password || '********'}
WG0_PUB=${activeTunnel.vps2.wg0PublicKey || ''}

[WireGuard]
ClientCount=${preSetupConfig.clientCount}
ClientNames=${preSetupConfig.clientNames}
`;

    try {
      const result = await window.electron.writeFile(preSetupConfig.setupIniPath, content);
      if (result.success) {
        addLog(`Configuration saved successfully to: ${preSetupConfig.setupIniPath}`, "success");
      } else {
        addLog(`Error saving setup.ini: ${result.error}`, "error");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      addLog(`Failed to save setup.ini: ${message}`, "error");
    }
  };

  const updateActiveTunnel = useCallback((updates: Partial<Tunnel>) => {
    setTunnels(prev => prev.map(t => t.id === activeTunnelId ? { ...t, ...updates } : t));
  }, [activeTunnelId]);

  const addLog = useCallback((msg: string, type: 'info' | 'success' | 'error' | 'cmd' = 'info', vps?: 'vps1' | 'vps2' | 'exchange') => {
    const timestamp = new Date().toLocaleTimeString([], { hour12: false });
    setTunnels(prev => prev.map(t => t.id === activeTunnelId ? { ...t, logs: [...t.logs, { msg, type, vps, timestamp }] } : t));
  }, [activeTunnelId]);

  const sshExecute = async (vps: VPSConfig, command: string) => {
    try {
      console.log(`Executing SSH command on ${vps.ip}: ${command.substring(0, 50)}...`);
      
      // Use Electron IPC if available (for built app)
      if (window.electron && window.electron.sshExecute) {
        const result = await window.electron.sshExecute({
          host: vps.ip,
          username: vps.user,
          password: vps.password,
          command
        }) as SSHResult;
        if (result.error) {
          throw new Error(result.error);
        }
        return {
          stdout: result.stdout || "",
          stderr: result.stderr || "",
          errorOutput: result.errorOutput || result.stderr || "",
          code: result.code ?? 0
        };
      }

      // Fallback to fetch (for development/web)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 70000); // 70s timeout

      try {
        const response = await fetch('/api/ssh/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            host: vps.ip,
            username: vps.user,
            password: vps.password,
            command
          })
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) {
          let errorMessage = 'SSH Execution Failed';
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch {
            errorMessage = `HTTP Error ${response.status}: ${response.statusText}`;
          }
          throw new Error(errorMessage);
        }
        
        const data = await response.json();
        return {
          stdout: data.stdout || "",
          stderr: data.stderr || "",
          errorOutput: data.errorOutput || data.stderr || "",
          code: data.code ?? 0
        };
      } catch (err) {
        clearTimeout(timeoutId);
        if (err instanceof Error && err.name === 'AbortError') {
          throw new Error(`SSH Request Timed Out (${vps.ip})`);
        }
        throw err;
      }
    } catch (error) {
      console.error(`SSH Execution Error on ${vps.ip}:`, error);
      throw error; // Let the caller handle it
    }
  };

  const getVpsPublicKey = async (vps: VPSConfig, iface: string) => {
    const extractKey = (text: string) => {
      // WireGuard keys are 44 characters base64 (32 bytes)
      const match = text.match(/[A-Za-z0-9+/_\-]{42,44}={0,2}/);
      return match ? match[0] : "";
    };

    try {
      // 1. Try reading the .pub file (most reliable before interface is up)
      let res = await sshExecute(vps, `cat /etc/wireguard/${iface}.pub`);
      let key = extractKey(res.stdout);
      if (res.code === 0 && key) return key;
      
      const errorMsg1 = res.stderr || res.errorOutput || "File not found or empty";
      console.warn(`Method 1 (cat) failed for ${iface} on ${vps.ip}: ${errorMsg1}. Output: ${res.stdout}`);

      // 2. Try wg show (works if interface is up)
      res = await sshExecute(vps, `wg show ${iface} public-key`);
      key = extractKey(res.stdout);
      if (res.code === 0 && key) return key;
      
      const errorMsg2 = res.stderr || res.errorOutput || "Interface not up";
      console.warn(`Method 2 (wg show) failed for ${iface} on ${vps.ip}: ${errorMsg2}. Output: ${res.stdout}`);

      // 3. Fallback: Try docker if it's wg0 (wg-easy)
      if (iface === 'wg0') {
        res = await sshExecute(vps, `docker exec wg-easy wg show wg0 public-key`);
        key = extractKey(res.stdout);
        if (res.code === 0 && key) return key;
      }
      
      // 4. Fallback: Try reading the peer file pushed by the other VPS
      // If we are asking for wg1 on vps1, maybe it's not there, but wait, it should be.
      // Let's just return the raw stdout if it looks somewhat like a key, or throw a detailed error.
      
      // If we are getting wg1 from vps1, it might have been pushed to vps2 as peer_wg1.pub
      // If we are getting wg0 from vps2, it might have been pushed to vps1 as peer_wg0.pub
      const otherVps = vps.ip === activeTunnel.vps1.ip ? activeTunnel.vps2 : activeTunnel.vps1;
      const res3 = await sshExecute(otherVps, `cat /etc/wireguard/peer_${iface}.pub`);
      key = extractKey(res3.stdout);
      if (res3.code === 0 && key) {
        console.warn(`Method 4 (peer file) succeeded for ${iface} on ${vps.ip}`);
        return key;
      }

      throw new Error(`Could not retrieve public key for ${iface}. Cat error: ${errorMsg1}. WG show error: ${errorMsg2}.`);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      addLog(`Key Retrieval Error (${iface}): ${message}`, "error", vps.ip === activeTunnel.vps1.ip ? 'vps1' : 'vps2');
      throw e;
    }
  };

  // Removed unused rebootVpsAndWait
  // Removed unused isVpsDeployed

    const startDeployment = async (isCleanInstall: boolean = false) => {
    if (!activeTunnel.vps1.password || !activeTunnel.vps2.password) {
      alert("Please provide root passwords for both servers.");
      return;
    }

    if (activeTunnel.vps1.ip === activeTunnel.vps2.ip) {
      alert("Double VPN requires two separate, dedicated servers. VPS1 and VPS2 cannot have the same IP address.");
      return;
    }

    // setIsDeploying(true);
    cancelDeploymentRef.current = false;
    updateActiveTunnel({ status: 'deploying', logs: [], step: 0 });
    addLog(`Starting Double VPN ${isCleanInstall ? 'Clean ' : ''}Deployment...`, "info", "exchange");

    const currentTunnel = { ...activeTunnel };

    try {
      const checkCancel = () => {
        if (cancelDeploymentRef.current) {
          throw new Error('Deployment Cancelled');
        }
      };

      // Step 1: VPS2 install docker
      checkCancel();
      addLog("Step 1: VPS2 installing Docker...", "info", "vps2");
      await sshExecute(currentTunnel.vps2, `
        apt-get update && apt-get install -y docker.io sshpass curl
        systemctl enable --now docker
        docker --version
      `);
      addLog("Step 1 Complete: Docker installed on VPS2.", "success", "vps2");

      // Step 2: VPS2 install wireguard and wg-easy
      checkCancel();
      addLog("Step 2: VPS2 installing WireGuard & wg-easy...", "info", "vps2");
      await sshExecute(currentTunnel.vps2, `
        apt-get install -y wireguard wireguard-tools
        wg --version
        docker pull weejewel/wg-easy
      `);
      addLog("Step 2 Complete: WireGuard installed on VPS2.", "success", "vps2");

      // Step 3: VPS1 install docker
      checkCancel();
      addLog("Step 3: VPS1 installing Docker...", "info", "vps1");
      await sshExecute(currentTunnel.vps1, `
        apt-get update && apt-get install -y docker.io sshpass curl
        systemctl enable --now docker
        docker --version
      `);
      addLog("Step 3 Complete: Docker installed on VPS1.", "success", "vps1");

      // Step 4: VPS1 install wireguard and wg-easy
      checkCancel();
      addLog("Step 4: VPS1 installing WireGuard & wg-easy...", "info", "vps1");
      await sshExecute(currentTunnel.vps1, `
        apt-get install -y wireguard wireguard-tools
        wg --version
        docker pull weejewel/wg-easy
      `);
      addLog("Step 4 Complete: WireGuard installed on VPS1.", "success", "vps1");

      // Step 5 & 6: VPS1 connects to VPS2 to generate keys
      checkCancel();
      addLog("Step 5 & 6: VPS1 connecting to VPS2 via SSH to generate keys...", "info", "exchange");
      await sshExecute(currentTunnel.vps1, `
        sshpass -p '${currentTunnel.vps2.password}' ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 root@${currentTunnel.vps2.ip} "
          mkdir -p /etc/wireguard
          wg genkey | tee /etc/wireguard/private.key | wg pubkey > /etc/wireguard/wgpub2.key
          chmod 600 /etc/wireguard/private.key
          echo 'VPS2 Keys generated successfully.'
        "
      `);
      addLog("Step 5 & 6 Complete: VPS2 keys generated via VPS1.", "success", "exchange");

      // Step 7: VPS1 SCPs public key from VPS2
      checkCancel();
      addLog("Step 7: VPS1 copying wgpub2.key from VPS2...", "info", "exchange");
      await sshExecute(currentTunnel.vps1, `
        mkdir -p /etc/wireguard
        sshpass -p '${currentTunnel.vps2.password}' scp -o StrictHostKeyChecking=no root@${currentTunnel.vps2.ip}:/etc/wireguard/wgpub2.key /etc/wireguard/wgpub2.key
      `);
      addLog("Step 7 Complete: VPS1 received VPS2 public key.", "success", "exchange");

      // Step 8 & 9: VPS2 connects to VPS1 to generate keys
      checkCancel();
      addLog("Step 8 & 9: VPS2 connecting to VPS1 via SSH to generate keys...", "info", "exchange");
      await sshExecute(currentTunnel.vps2, `
        sshpass -p '${currentTunnel.vps1.password}' ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 root@${currentTunnel.vps1.ip} "
          mkdir -p /etc/wireguard
          wg genkey | tee /etc/wireguard/private.key | wg pubkey > /etc/wireguard/wgpub1.key
          chmod 600 /etc/wireguard/private.key
          echo 'VPS1 Keys generated successfully.'
        "
      `);
      addLog("Step 8 & 9 Complete: VPS1 keys generated via VPS2.", "success", "exchange");

      // Step 10: VPS2 SCPs public key from VPS1
      checkCancel();
      addLog("Step 10: VPS2 copying wgpub1.key from VPS1...", "info", "exchange");
      await sshExecute(currentTunnel.vps2, `
        mkdir -p /etc/wireguard
        sshpass -p '${currentTunnel.vps1.password}' scp -o StrictHostKeyChecking=no root@${currentTunnel.vps1.ip}:/etc/wireguard/wgpub1.key /etc/wireguard/wgpub1.key
      `);
      addLog("Step 10 Complete: VPS2 received VPS1 public key.", "success", "exchange");

      // Step 11: VPS1 connects to VPS2 to configure wg0.conf
      checkCancel();
      addLog("Step 11: VPS1 configuring wg0.conf on VPS2...", "info", "exchange");
      await sshExecute(currentTunnel.vps1, `
        sshpass -p '${currentTunnel.vps2.password}' ssh -o StrictHostKeyChecking=no root@${currentTunnel.vps2.ip} "
          PRIV_KEY=\\$(cat /etc/wireguard/private.key)
          PEER_PUB=\\\$(cat /etc/wireguard/wgpub1.key)
          DEFAULT_IFACE=\\$(ip route ls default | awk '/default/ {for(i=1;i<=NF;i++) if($i=="dev") print $(i+1)}' | head -n 1)
          if [ -z "\\$DEFAULT_IFACE" ]; then DEFAULT_IFACE="eth0"; fi
          cat > /etc/wireguard/wg0.conf << EOF
[Interface]
PrivateKey = \\$PRIV_KEY
Address = 10.9.0.2/24
ListenPort = 51820
MTU = 1280
PostUp = iptables -I FORWARD 1 -i %i -j ACCEPT; iptables -I FORWARD 1 -o %i -j ACCEPT; iptables -t nat -A POSTROUTING -o \\$DEFAULT_IFACE -j MASQUERADE; iptables -t mangle -I FORWARD 1 -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --clamp-mss-to-pmtu
PostDown = iptables -D FORWARD -i %i -j ACCEPT || true; iptables -D FORWARD -o %i -j ACCEPT || true; iptables -t nat -D POSTROUTING -o \\$DEFAULT_IFACE -j MASQUERADE || true; iptables -t mangle -D FORWARD -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --clamp-mss-to-pmtu || true

[Peer]
PublicKey = \\$PEER_PUB
AllowedIPs = 10.9.0.0/24, 10.8.0.0/24
EOF
          echo 'wg0.conf created on VPS2.'
        "
      `);
      addLog("Step 11 Complete: wg0.conf created on VPS2.", "success", "exchange");

      // Step 12: VPS2 connects to VPS1 to configure wg1.conf
      checkCancel();
      addLog("Step 12: VPS2 configuring wg1.conf on VPS1...", "info", "exchange");
      await sshExecute(currentTunnel.vps2, `
        sshpass -p '${currentTunnel.vps1.password}' ssh -o StrictHostKeyChecking=no root@${currentTunnel.vps1.ip} "
          PRIV_KEY=\\$(cat /etc/wireguard/private.key)
          PEER_PUB=\\\$(cat /etc/wireguard/wgpub2.key)
          DEFAULT_IFACE=\\$(ip route ls default | awk '/default/ {for(i=1;i<=NF;i++) if(\$i=="dev") print \$(i+1)}' | head -n 1)
          if [ -z "\\$DEFAULT_IFACE" ]; then DEFAULT_IFACE="eth0"; fi
          cat > /etc/wireguard/wg1.conf << EOF
[Interface]
PrivateKey = \$PRIV_KEY
Address = 10.9.0.1/24
ListenPort = 51820
MTU = 1280
Table = off
PostUp = sysctl -w net.ipv4.conf.all.rp_filter=2; sysctl -w net.ipv4.conf.default.rp_filter=2; sysctl -w net.ipv4.conf.\$DEFAULT_IFACE.rp_filter=2; sysctl -w net.ipv4.conf.wg1.rp_filter=2; sysctl -w net.ipv4.conf.wg0.rp_filter=2 || true; ip rule add from 10.8.0.0/24 table 200 priority 10; ip rule add from 10.9.0.1 table 200 priority 10 || true; ip route add default dev wg1 table 200 || true; iptables -t nat -A POSTROUTING -o wg1 -j MASQUERADE; iptables -I FORWARD 1 -i wg1 -j ACCEPT; iptables -I FORWARD 1 -o wg1 -j ACCEPT; iptables -I FORWARD 1 -i wg0 -j ACCEPT; iptables -I FORWARD 1 -o wg0 -j ACCEPT; iptables -t mangle -I FORWARD 1 -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --clamp-mss-to-pmtu
PostDown = ip rule del from 10.8.0.0/24 table 200 priority 10 || true; ip rule del from 10.9.0.1 table 200 priority 10 || true; ip route del default dev wg1 table 200 || true; iptables -t nat -D POSTROUTING -o wg1 -j MASQUERADE || true; iptables -D FORWARD -i wg1 -j ACCEPT || true; iptables -D FORWARD -o wg1 -j ACCEPT || true; iptables -D FORWARD -i wg0 -j ACCEPT || true; iptables -D FORWARD -o wg0 -j ACCEPT || true; iptables -t mangle -D FORWARD -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --clamp-mss-to-pmtu || true

[Peer]
PublicKey = \\$PEER_PUB
Endpoint = ${currentTunnel.vps2.ip}:51820
AllowedIPs = 0.0.0.0/0
PersistentKeepalive = 25
EOF
          echo 'wg1.conf created on VPS1.'
        "
      `);
      addLog("Step 12 Complete: wg1.conf created on VPS1.", "success", "exchange");

      // Step 13: Configure wg-easy and launch wireguard on both VPS
      checkCancel();
      addLog("Step 13: Configuring wg-easy and launching WireGuard on both servers...", "info", "exchange");
      
      await sshExecute(currentTunnel.vps1, `
        docker stop wg-easy || true
        docker rm wg-easy || true
        echo "net.ipv4.ip_forward=1" > /etc/sysctl.d/99-wireguard.conf
        sysctl -p /etc/sysctl.d/99-wireguard.conf
        
        # Update MTU for existing clients if any
        if [ -d /etc/wireguard/clients ]; then
          find /etc/wireguard/clients -name "*.conf" -exec sed -i 's/MTU = .*/MTU = 1280/' {} + || true
        fi
        # Fix ListenPort conflict if wg0.conf was generated previously with default port
        # wg-easy overwrites changes to wg0.conf, so we must delete it to force regeneration
        if grep -q "ListenPort = 51820" /etc/wireguard/wg0.conf 2>/dev/null; then
          rm -f /etc/wireguard/wg0.conf
        fi
        
        docker run -d \\
          --name=wg-easy \\
          --network host \\
          -e WG_HOST=${currentTunnel.vps1.ip} \\
          -e WG_PORT=51821 \\
          -e PORT=51822 \\
          -e PASSWORD_HASH='$2a$10$jB0akgOdR4cShIVoDFO3zuNvuk/IvmmdxbQKkNIYu8zOy363gdGXC' \\
          -e WG_DEFAULT_DNS=1.1.1.1 \\
          -e WG_DEFAULT_ADDRESS=10.8.0.x \\
          -e WG_MTU=1280 \\
          -e WG_ALLOWED_IPS=0.0.0.0/0 \\
          -v /etc/wireguard:/etc/wireguard \\
          --cap-add=NET_ADMIN \\
          --cap-add=SYS_MODULE \\
          --restart unless-stopped \\
          ghcr.io/wg-easy/wg-easy
      `);

      await sshExecute(currentTunnel.vps2, "systemctl enable wg-quick@wg0 && systemctl restart wg-quick@wg0");
      await sshExecute(currentTunnel.vps1, "systemctl enable wg-quick@wg1 && systemctl restart wg-quick@wg1");
      
      addLog("Verifying secure tunnel (VPS1 pinging VPS2)...", "info", "exchange");
      const pingRes = await sshExecute(currentTunnel.vps1, "ping -c 3 10.9.0.2");
      if (pingRes.code === 0) {
        addLog("Secure tunnel verified successfully!", "success", "exchange");
      } else {
        addLog("Tunnel verification failed. Ping to 10.9.0.2 did not succeed.", "error", "exchange");
      }

      addLog("Step 13 Complete: wg-easy started and tunnels verified.", "success", "exchange");

      updateActiveTunnel({ status: 'deployed' });
      addLog("Double VPN Deployment Successful!", "success", "exchange");
      // setIsDeploying(false);
      setActiveTab("overview");

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message === 'Deployment Cancelled') {
        addLog("Deployment was cancelled by the user.", "error", "exchange");
      } else {
        addLog(`Deployment Failed: ${message}`, "error", "exchange");
      }
      updateActiveTunnel({ status: 'failed' });
      // setIsDeploying(false);
    }
  };

  const testConfiguration = async () => {
    if (isTestingConfig) return;
    setIsTestingConfig(true);
    addLog("--- Starting VPS Readiness Check ---", "info");

    // Use a local object to track state
    const currentTunnel = { ...activeTunnel };

    try {
      // Find the vps-check script
      const checkScript = INITIAL_SCRIPTS.find(s => s.id === 'vps-check');
      if (!checkScript) {
        addLog("Error: VPS Readiness Check script not found.", "error");
        setIsTestingConfig(false);
        return;
      }

      // Test VPS1
      addLog(`Testing VPS1 Gateway (${currentTunnel.vps1.ip})...`, "info", "vps1");
      const vps1CheckScript = checkScript.content.replaceAll('__VPS1_IP__', currentTunnel.vps1.ip)
                                               .replaceAll('__VPS2_IP__', currentTunnel.vps2.ip)
                                               .replaceAll('__WG_EASY_PORT__', (currentTunnel.vps1.ports?.['WG_EASY_PORT'] || 51820).toString())
                                               .replaceAll('__WG_EASY_UI_PORT__', (currentTunnel.vps1.ports?.['WG_EASY_UI_PORT'] || 51821).toString())
                                               .replaceAll('__WG_INTER_VPS_PORT__', (currentTunnel.vps1.ports?.['WG_INTER_VPS_PORT'] || 51822).toString())
                                               .replaceAll('__WG_EXIT_PORT__', (currentTunnel.vps2.ports?.['WG_EXIT_PORT'] || 51820).toString());

      const res1 = await sshExecute(currentTunnel.vps1, vps1CheckScript);
      if (res1.code === 0 || res1.code === undefined) {
        addLog("VPS1 Readiness Check Passed!", "success", "vps1");
        if (res1.stdout) addLog(res1.stdout, "info", "vps1");
      } else {
        addLog(`VPS1 Readiness Check Failed: ${res1.errorOutput || res1.stderr}`, "error", "vps1");
        if (res1.stdout) addLog(res1.stdout, "info", "vps1");
      }

      // Test VPS2
      addLog(`Testing VPS2 Exit Node (${currentTunnel.vps2.ip})...`, "info", "vps2");
      const vps2CheckScript = checkScript.content.replaceAll('__VPS2_IP__', currentTunnel.vps2.ip)
                                               .replaceAll('__WG_EXIT_PORT__', (currentTunnel.vps2.ports?.['WG_EXIT_PORT'] || 51820).toString())
                                               .replaceAll('__WG_EASY_PORT__', '51820')
                                               .replaceAll('__WG_EASY_UI_PORT__', '51821')
                                               .replaceAll('__WG_INTER_VPS_PORT__', '51822');

      const res2 = await sshExecute(currentTunnel.vps2, vps2CheckScript);
      if (res2.code === 0 || res2.code === undefined) {
        addLog("VPS2 Readiness Check Passed!", "success", "vps2");
        if (res2.stdout) addLog(res2.stdout, "info", "vps2");
      } else {
        addLog(`VPS2 Readiness Check Failed: ${res2.errorOutput || res2.stderr}`, "error", "vps2");
        if (res2.stdout) addLog(res2.stdout, "info", "vps2");
      }

      addLog("--- VPS Readiness Check Complete ---", "info");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      addLog(`Readiness Check Error: ${message}`, "error");
    } finally {
      setIsTestingConfig(false);
    }
  };

  const runAutomation = async (scriptId: string) => {
    setIsRotating(true);
    const script = INITIAL_SCRIPTS.find(s => s.id === scriptId);
    if (!script) {
      addLog(`Script ${scriptId} not found.`, "error");
      setIsRotating(false);
      return;
    }

    addLog(`Executing ${script.title}...`, "info");
    try {
      const res = await sshExecute(activeTunnel.vps1, script.content);
      if (res.code === 0) {
        addLog(`${script.title} executed successfully.`, "success");
      } else {
        addLog(`${script.title} failed: ${res.errorOutput}`, "error");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      addLog(`Automation Error: ${message}`, "error");
    } finally {
      setIsRotating(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const addPeer = () => {
    if (!newPeerName) return;
    const newPeer: Peer = {
      id: Math.random().toString(36).substr(2, 9),
      name: newPeerName,
      publicKey: generateWGKey(),
      privateKey: generateWGKey(),
      allowedIPs: `10.0.0.${activeTunnel.peers.length + 4}/32`,
      createdAt: new Date().toISOString(),
    };
    updateActiveTunnel({ peers: [...activeTunnel.peers, newPeer] });
    setNewPeerName('');
    setShowAddPeer(false);
  };

  const deletePeer = (id: string) => {
    updateActiveTunnel({ peers: activeTunnel.peers.filter(p => p.id !== id) });
  };

  const collectVPSLogs = async (vpsId: 'vps1' | 'vps2') => {
    const vpsName = vpsId === 'vps1' ? 'VPS1 (Gateway)' : 'VPS2 (Node)';
    addLog(`Collecting diagnostic logs from ${vpsName}...`, "info");
    
    // Simulate fetching logs via SSH
    const simulatedLogs = [
      `--- System Info (${vpsName}) ---`,
      `Uptime: ${Math.floor(Math.random() * 100)} days`,
      `Kernel: Linux 6.1.0-18-amd64`,
      `Memory: ${Math.floor(Math.random() * 1000)}MB / 2048MB`,
      `\n--- WireGuard Status ---`,
      vpsId === 'vps1' ? `interface: wg0\n  public key: ${activeTunnel.vps1.wg0PublicKey || 'N/A'}\n  listening port: 51820\n\npeer: ${activeTunnel.vps2.wg0PublicKey || 'N/A'}\n  endpoint: ${activeTunnel.vps2.ip}:51820\n  allowed ips: 10.0.0.2/32\n  latest handshake: 5 seconds ago` : `interface: wg0\n  public key: ${activeTunnel.vps2.wg0PublicKey || 'N/A'}\n  listening port: 51820\n\npeer: ${activeTunnel.vps1.wg0PublicKey || 'N/A'}\n  endpoint: ${activeTunnel.vps1.ip}:51820\n  allowed ips: 10.0.0.1/32\n  latest handshake: 5 seconds ago`,
      `\n--- Firewall Rules (iptables) ---`,
      `-A FORWARD -i wg0 -j ACCEPT`,
      `-A FORWARD -o wg0 -j ACCEPT`,
      `-t nat -A POSTROUTING -o eth0 -j MASQUERADE`,
      `\n--- Recent System Logs (journalctl) ---`,
      `[${new Date().toISOString()}] wg-quick[123]: [#] ip link add wg0 type wireguard`,
      `[${new Date().toISOString()}] wg-quick[123]: [#] wg setconf wg0 /dev/fd/63`,
      `[${new Date().toISOString()}] wg-quick[123]: [#] ip -4 address add 10.0.0.1/24 dev wg0`,
      `[${new Date().toISOString()}] wg-quick[123]: [#] ip link set mtu 1420 up dev wg0`,
    ].join('\n');

    setVpsLogs(prev => {
      const filtered = prev.filter(l => l.vps !== vpsId);
      return [...filtered, { vps: vpsId, logs: simulatedLogs }];
    });
    
    addLog(`Logs collected from ${vpsName}.`, "success");
  };

  const downloadDiagnosticBundle = () => {
    const bundle = {
      timestamp: new Date().toISOString(),
      appState: {
        tunnelStatus: activeTunnel.status,
        vps1: { ip: activeTunnel.vps1.ip, status: activeTunnel.status === 'deployed' ? 'online' : 'offline' },
        vps2: { ip: activeTunnel.vps2.ip, status: activeTunnel.status === 'deployed' ? 'online' : 'offline' },
        peersCount: activeTunnel.peers.length
      },
      consoleLogs,
      vpsLogs
    };

    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `double_tunnel_diagnostics_${new Date().getTime()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadCleanupTool = () => {
    const script = scripts.find(s => s.id === 'pc-cleanup');
    if (!script) return;
    
    const blob = new Blob([script.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `double_tunnel_pc_cleanup.bat`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadConfig = (peer: Peer) => {
    const config = `[Interface]
PrivateKey = ${peer.privateKey}
Address = ${peer.allowedIPs}
DNS = 1.1.1.1

[Peer]
PublicKey = ${activeTunnel.vps1.wg0PublicKey || '8xJ2vK9zL3mN4pQ5rS6tU7vW8xY9z0a1b2c3d4e5f6g='}
Endpoint = ${activeTunnel.vps1.ip || 'XXX.XXX.XXX.XXX'}:51820
AllowedIPs = 0.0.0.0/0
PersistentKeepalive = 25`;

    const blob = new Blob([config], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${peer.name.replace(/\s+/g, '_')}.conf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportAllConfigs = () => {
    const allConfigs = activeTunnel.peers.map(peer => {
      return `--- ${peer.name} ---\n[Interface]\nPrivateKey = ${peer.privateKey}\nAddress = ${peer.allowedIPs}\nDNS = 1.1.1.1\n\n[Peer]\nPublicKey = ${activeTunnel.vps1.wg0PublicKey || '8xJ2vK9zL3mN4pQ5rS6tU7vW8xY9z0a1b2c3d4e5f6g='}\nEndpoint = ${activeTunnel.vps1.ip || 'XXX.XXX.XXX.XXX'}:51820\nAllowedIPs = 0.0.0.0/0\nPersistentKeepalive = 25\n\n`;
    }).join('\n');

    const blob = new Blob([allConfigs], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `all_peers_configs.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const addScript = () => {
    if (!newScript.title || !newScript.content) return;
    const script: Script = {
      id: Math.random().toString(36).substr(2, 9),
      ...newScript,
      icon: FileCode
    };
    setScripts([...scripts, script]);
    setNewScript({ title: '', description: '', content: '', rollbackContent: '' });
    setShowAddScript(false);
  };

  const updateScript = () => {
    if (!editingScript) return;
    setScripts(scripts.map(s => s.id === editingScript.id ? editingScript : s));
    setEditingScript(null);
  };

  const deleteScript = (id: string) => {
    setScripts(scripts.filter(s => s.id !== id));
  };

  const generateSSHKey = () => {
    const id = `key-${Math.random().toString(36).substr(2, 9)}`;
    const randomBytes = new Uint8Array(32);
    window.crypto.getRandomValues(randomBytes);
    let binary = '';
    for (let i = 0; i < randomBytes.byteLength; i++) {
      binary += String.fromCharCode(randomBytes[i]);
    }
    const base64 = window.btoa(binary);
    
    const newSSHKey: SSHKey = {
      id,
      name: `Generated Key ${sshKeys.length + 1}`,
      publicKey: `ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQ${base64.substring(0, 30)}... user@host`,
      privateKey: `-----BEGIN RSA PRIVATE KEY-----\n${base64}\n${base64.split('').reverse().join('')}\n-----END RSA PRIVATE KEY-----`,
      associatedVPS: 'both',
      createdAt: new Date().toISOString()
    };
    setSshKeys([...sshKeys, newSSHKey]);
  };

  const addSSHKey = () => {
    if (!newKey.name || !newKey.publicKey) return;
    const id = `key-${Math.random().toString(36).substr(2, 9)}`;
    const key: SSHKey = {
      id,
      ...newKey,
      createdAt: new Date().toISOString()
    };
    setSshKeys([...sshKeys, key]);
    setNewKey({ name: '', publicKey: '', privateKey: '', associatedVPS: 'both' });
    setShowAddKey(false);
  };

  const deleteSSHKey = (id: string) => {
    setSshKeys(sshKeys.filter(k => k.id !== id));
  };

  const addPortRule = () => {
    if (!newPortRule.externalPort || !newPortRule.internalPort) return;
    const rule: PortForwardRule = {
      ...newPortRule,
      id: `rule-${Math.random().toString(36).substr(2, 9)}`,
      status: 'active'
    };
    setPortForwardRules([...portForwardRules, rule]);
    setShowAddPortRule(false);
    setNewPortRule({
      externalPort: 80,
      internalPort: 80,
      protocol: 'TCP',
      targetVPS: 'vps1',
      description: ''
    });
  };

  const deletePortRule = (id: string) => {
    setPortForwardRules(portForwardRules.filter(r => r.id !== id));
  };

  const togglePortRuleStatus = (id: string) => {
    setPortForwardRules(portForwardRules.map(r => 
      r.id === id ? { ...r, status: r.status === 'active' ? 'inactive' : 'active' } : r
    ));
  };

  const updatePortRule = () => {
    if (!editingPortRule) return;
    setPortForwardRules(portForwardRules.map(r => r.id === editingPortRule.id ? editingPortRule : r));
    setEditingPortRule(null);
  };

  return (
    <div className="min-h-screen bg-black text-zinc-400 font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Sidebar / Navigation */}
      <div className={cn(
        "fixed left-0 top-0 bottom-0 border-r border-zinc-800 bg-zinc-950 flex flex-col z-50 transition-all duration-300 ease-in-out",
        isSidebarCollapsed ? "w-20" : "w-64"
      )}>
        <div className={cn(
          "p-5 flex items-center transition-all duration-300",
          isSidebarCollapsed ? "justify-center" : "gap-3"
        )}>
          <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
            <Binoculars className="text-black w-6 h-6" />
          </div>
          {!isSidebarCollapsed && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="min-w-0"
            >
              <h1 className="text-white font-bold tracking-tighter text-lg truncate">Double Tunnel</h1>
              <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest truncate">VPN Console</p>
            </motion.div>
          )}
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {[
            { id: 'pre-setup', icon: FileEdit, label: 'Pre-Setup Config' },
            { id: 'overview', icon: Activity, label: 'Overview' },
            { id: 'peers', icon: Users, label: 'Peer Management' },
            { id: 'port-forwarding', icon: ArrowRightLeft, label: 'Port Forwarding' },
            { id: 'scripts', icon: FileCode, label: 'Automation Scripts' },
            { id: 'keys', icon: Lock, label: 'SSH Key Manager' },
            { id: 'wg-keys', icon: Key, label: 'WireGuard Keys' },
            { id: 'deploy', icon: Play, label: 'Deployment Manager' },
            { id: 'config', icon: Settings, label: 'Server Config' },
            { id: 'setup', icon: Globe, label: 'Setup Guide' },
            { id: 'platforms', icon: Monitor, label: 'Cross-Platform' },
            { id: 'diagnostics', icon: ShieldAlert, label: 'Troubleshooting' },
            { id: 'uninstall', icon: Trash2, label: 'Uninstall & Reset' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as AppTab)}
              className={cn(
                "w-full flex items-center rounded-lg transition-all duration-200 group relative",
                isSidebarCollapsed ? "justify-center p-3" : "gap-2.5 px-3 py-2",
                activeTab === item.id 
                  ? "bg-zinc-900 text-emerald-400 border border-zinc-800" 
                  : "hover:bg-zinc-900/50 hover:text-zinc-200"
              )}
              title={isSidebarCollapsed ? item.label : undefined}
            >
              <item.icon className={cn("w-4 h-4 shrink-0", activeTab === item.id ? "text-emerald-400" : "text-zinc-600 group-hover:text-zinc-400")} />
              {!isSidebarCollapsed && (
                <span className="text-xs font-medium truncate">{item.label}</span>
              )}
              {isSidebarCollapsed && activeTab === item.id && (
                <div className="absolute left-0 w-1 h-4 bg-emerald-500 rounded-r-full" />
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-zinc-800">
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="w-full mb-4 p-2 hover:bg-zinc-900 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>

          <div className={cn(
            "flex items-center bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden transition-all duration-300 mb-2",
            isSidebarCollapsed ? "p-1.5 justify-center" : "gap-2 p-2"
          )}>
            <div className={cn(
              "w-2 h-2 rounded-full shrink-0",
              backendStatus === 'online' ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : 
              backendStatus === 'offline' ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" : 
              "bg-zinc-600 animate-pulse"
            )} />
            {!isSidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold text-zinc-200 truncate uppercase tracking-wider">
                  Backend: {backendStatus}
                </p>
              </div>
            )}
          </div>

          <div className={cn(
            "flex items-center bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden transition-all duration-300",
            isSidebarCollapsed ? "p-1.5 justify-center" : "gap-2 p-2"
          )}>
            <div className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
              <Users className="w-3.5 h-3.5 text-zinc-400" />
            </div>
            {!isSidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-zinc-200 truncate">Roman Almakaev</p>
                <p className="text-[9px] text-zinc-500 truncate">Administrator</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className={cn(
        "min-h-screen transition-all duration-300 ease-in-out",
        isSidebarCollapsed ? "pl-20" : "pl-64"
      )}>
        <header className="h-16 border-b border-zinc-800 bg-zinc-950/50 backdrop-blur-md sticky top-0 z-40 px-6 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-zinc-500 text-sm">Dashboard</span>
              <span className="text-zinc-700">/</span>
              <span className="text-zinc-200 text-sm font-medium capitalize">{activeTab}</span>
            </div>
            
            <div className="h-6 w-px bg-zinc-800" />
            
            <div className="flex items-center gap-3">
              <div className="relative group">
                <select 
                  value={activeTunnelId}
                  onChange={(e) => setActiveTunnelId(e.target.value)}
                  className="appearance-none bg-zinc-900 border border-zinc-800 rounded-lg pl-3 pr-10 py-1.5 text-xs font-bold text-zinc-300 focus:outline-none focus:border-emerald-500 cursor-pointer hover:bg-zinc-800 transition-all"
                >
                  {tunnels.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <ChevronRight className="w-4 h-4 text-zinc-500 absolute right-3 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none" />
              </div>
              <button 
                onClick={addTunnel}
                className="p-1.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/20 transition-all"
                title="Create New Project"
              >
                <Plus className="w-4 h-4" />
              </button>
              {tunnels.length > 1 && (
                <button 
                  onClick={() => deleteTunnel(activeTunnelId)}
                  className="p-1.5 bg-red-500/10 text-red-500 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-all"
                  title="Delete Current Project"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            {activeTunnel.status === 'deployed' && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Client Connected</span>
              </div>
            )}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 rounded-full border border-zinc-800">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">System Online</span>
            </div>
            <button 
              onClick={() => setActiveTab('deploy')}
              className="p-2 hover:bg-zinc-900 rounded-lg transition-colors"
              title="Project Settings"
            >
              <Settings className="w-5 h-5 text-zinc-500 hover:text-emerald-500 transition-colors" />
            </button>
          </div>
        </header>

        <div className="p-10 max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            {activeTab === 'pre-setup' && (
              <motion.div
                key="pre-setup"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
                  <div>
                    <h2 className="text-2xl font-bold text-zinc-100 tracking-tight">Pre-Setup Configuration</h2>
                    <p className="text-sm text-zinc-500">Generate an initial setup.ini file for automated deployments.</p>
                  </div>
                  <button 
                    onClick={downloadIni}
                    className="flex items-center gap-2 px-6 py-3 bg-emerald-500 text-black font-bold rounded-xl hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20 whitespace-nowrap"
                  >
                    <Download className="w-5 h-5" />
                    <span>GENERATE SETUP.INI</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <Card title="VPS Credentials" icon={Lock}>
                    <div className="space-y-6">
                      <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800 space-y-4">
                        <div className="flex items-center gap-2 mb-2 justify-between">
                          <div className="flex items-center gap-2">
                            <Server className="w-4 h-4 text-emerald-500" />
                            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">VPS1 (Gateway)</span>
                          </div>
                          <button 
                            onClick={async () => {
                              try {
                                addLog("Testing connection to VPS1...", "info", "vps1");
                                const res = await sshExecute(activeTunnel.vps1, "echo 'Connection OK'");
                                if (res.code === 0) {
                                  addLog("VPS1 Connection Successful!", "success", "vps1");
                                } else {
                                  addLog(`VPS1 Connection Failed: ${res.stderr}`, "error", "vps1");
                                }
                              } catch (err) {
                                const message = err instanceof Error ? err.message : String(err);
                                addLog(`VPS1 Connection Error: ${message}`, "error", "vps1");
                              }
                            }}
                            className="text-[10px] font-bold text-emerald-500 hover:text-emerald-400 uppercase tracking-widest"
                          >
                            Test Connection
                          </button>
                        </div>
                        <div className="grid grid-cols-1 gap-4">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-zinc-600 uppercase">IP Address</label>
                            <input 
                              type="text" 
                              value={preSetupConfig.vps1Ip || activeTunnel.vps1.ip}
                              onChange={(e) => setPreSetupConfig({...preSetupConfig, vps1Ip: e.target.value})}
                              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500"
                              placeholder="XXX.XXX.XXX.XXX"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-zinc-600 uppercase">Root Password</label>
                            <input 
                              type="password" 
                              value={preSetupConfig.vps1Password || activeTunnel.vps1.password}
                              onChange={(e) => setPreSetupConfig({...preSetupConfig, vps1Password: e.target.value})}
                              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500"
                              placeholder="••••••••"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800 space-y-4">
                        <div className="flex items-center gap-2 mb-2 justify-between">
                          <div className="flex items-center gap-2">
                            <Server className="w-4 h-4 text-emerald-500" />
                            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">VPS2 (Exit Node)</span>
                          </div>
                          <button 
                            onClick={async () => {
                              try {
                                addLog("Testing connection to VPS2...", "info", "vps2");
                                const res = await sshExecute(activeTunnel.vps2, "echo 'Connection OK'");
                                if (res.code === 0) {
                                  addLog("VPS2 Connection Successful!", "success", "vps2");
                                } else {
                                  addLog(`VPS2 Connection Failed: ${res.stderr}`, "error", "vps2");
                                }
                              } catch (err) {
                                const message = err instanceof Error ? err.message : String(err);
                                addLog(`VPS2 Connection Error: ${message}`, "error", "vps2");
                              }
                            }}
                            className="text-[10px] font-bold text-emerald-500 hover:text-emerald-400 uppercase tracking-widest"
                          >
                            Test Connection
                          </button>
                        </div>
                        <div className="grid grid-cols-1 gap-4">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-zinc-600 uppercase">IP Address</label>
                            <input 
                              type="text" 
                              value={preSetupConfig.vps2Ip || activeTunnel.vps2.ip}
                              onChange={(e) => setPreSetupConfig({...preSetupConfig, vps2Ip: e.target.value})}
                              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500"
                              placeholder="XXX.XXX.XXX.XXX"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-zinc-600 uppercase">Root Password</label>
                            <input 
                              type="password" 
                              value={preSetupConfig.vps2Password || activeTunnel.vps2.password}
                              onChange={(e) => setPreSetupConfig({...preSetupConfig, vps2Password: e.target.value})}
                              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500"
                              placeholder="••••••••"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>

                  <Card title="WireGuard Client Deployment" icon={Users}>
                    <div className="space-y-6">
                      <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800 space-y-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-zinc-600 uppercase">Configuration File (setup.ini) Path</label>
                          <div className="flex gap-2">
                            <input 
                              type="text" 
                              value={preSetupConfig.setupIniPath}
                              onChange={(e) => setPreSetupConfig({...preSetupConfig, setupIniPath: e.target.value})}
                              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500 font-mono"
                              placeholder="C:\Path\To\setup.ini"
                            />
                            <button 
                              onClick={selectSetupIni}
                              className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-400 hover:text-zinc-200 transition-colors"
                              title="Select setup.ini file"
                            >
                              <FolderOpen className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={loadSetupIni}
                              className="px-3 py-2 bg-emerald-600 border border-emerald-500 rounded-lg text-white hover:bg-emerald-500 transition-colors flex items-center gap-2"
                              title="Load configuration from file"
                            >
                              <Download className="w-4 h-4" />
                              <span className="text-[10px] font-bold uppercase">Load</span>
                            </button>
                            <button 
                              onClick={saveSetupIni}
                              className="px-3 py-2 bg-blue-600 border border-blue-500 rounded-lg text-white hover:bg-blue-500 transition-colors flex items-center gap-2"
                              title="Save configuration to file"
                            >
                              <Save className="w-4 h-4" />
                              <span className="text-[10px] font-bold uppercase">Save</span>
                            </button>
                          </div>
                          <p className="text-[8px] text-zinc-600 italic">The deployment tool will look for its configuration at this location.</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-zinc-600 uppercase">Number of Clients</label>
                            <input 
                              type="number" 
                              value={preSetupConfig.clientCount}
                              onChange={(e) => setPreSetupConfig({...preSetupConfig, clientCount: parseInt(e.target.value)})}
                              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-zinc-600 uppercase">Client Names (Comma Separated)</label>
                          <textarea 
                            value={preSetupConfig.clientNames}
                            onChange={(e) => setPreSetupConfig({...preSetupConfig, clientNames: e.target.value})}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500 h-24 resize-none"
                            placeholder="Client1, Client2, Client3..."
                          />
                        </div>
                      </div>

                      <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                        <div className="flex gap-3">
                          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0">
                            <Activity className="w-4 h-4 text-emerald-500" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-zinc-200 uppercase mb-1">Automation Tip</p>
                            <p className="text-[10px] text-zinc-500 leading-relaxed">
                              The <code className="text-emerald-500">setup.ini</code> file at the specified path allows for zero-touch configuration during the deployment process.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>

                  <Card title="Security & Installation Guide" icon={ShieldAlert}>
                    <div className="space-y-6">
                      <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                        <div className="flex gap-3">
                          <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-amber-500 uppercase mb-1">Windows SmartScreen Note</p>
                            <p className="text-[10px] text-zinc-400 leading-relaxed">
                              If Windows blocks the <code className="text-zinc-200">.exe</code>, click <span className="text-zinc-200 font-bold">"More Info"</span> then <span className="text-zinc-200 font-bold">"Run Anyway"</span>. This occurs because the binary is not signed with a Microsoft Developer Certificate.
                            </p>
                            <button 
                              onClick={handleFixWindowsBlocking}
                              className="mt-3 w-full py-2 bg-amber-600/20 border border-amber-600/30 text-amber-500 hover:bg-amber-600/30 rounded-lg text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-2"
                            >
                              <Shield className="w-3 h-3" />
                              Add Exclusion to Windows Defender
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-start gap-3">
                          <div className="w-5 h-5 rounded bg-zinc-800 flex items-center justify-center shrink-0 mt-0.5">
                            <Check className="w-3 h-3 text-emerald-500" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs font-bold text-zinc-300">Run as Administrator</p>
                            <p className="text-[10px] text-zinc-500">Required for modifying network interfaces and executing SSH commands.</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-5 h-5 rounded bg-zinc-800 flex items-center justify-center shrink-0 mt-0.5">
                            <Check className="w-3 h-3 text-emerald-500" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs font-bold text-zinc-300">Antivirus Whitelisting</p>
                            <p className="text-[10px] text-zinc-500">Add the app directory to your AV exclusion list to prevent SSH connection timeouts.</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-5 h-5 rounded bg-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
                            <AlertCircle className="w-3 h-3 text-amber-500" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs font-bold text-amber-500">Asymmetric Routing Fix</p>
                            <p className="text-[10px] text-zinc-500 leading-relaxed">
                              The deployment tool now implements <code className="text-zinc-300">ip rule</code> bypass for the primary interface. This ensures that incoming traffic on the physical IP (Web, SSH, etc.) is responded to via the correct gateway, preventing "Bad Gateway" errors and connection timeouts.
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-5 h-5 rounded bg-zinc-800 flex items-center justify-center shrink-0 mt-0.5">
                            <Check className="w-3 h-3 text-emerald-500" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs font-bold text-zinc-300">Firewall Permissions</p>
                            <p className="text-[10px] text-zinc-500">Ensure the application is allowed to communicate through Windows Firewall to establish SSH tunnels.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>
              </motion.div>
            )}

            {activeTab === 'overview' && (
              <motion.div
                key="overview"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {[
                    { label: 'Total Peers', value: activeTunnel.peers.length, icon: Users, color: 'text-blue-500' },
                    { label: 'Active Tunnels', value: activeTunnel.status === 'deployed' ? '1' : '0', icon: Wifi, color: 'text-emerald-500' },
                    { label: 'Data Transferred', value: activeTunnel.status === 'deployed' ? '12.4 GB' : '0 B', icon: Activity, color: 'text-amber-500' },
                    { label: 'Uptime', value: activeTunnel.status === 'deployed' ? '14d 2h' : 'N/A', icon: Cpu, color: 'text-purple-500' },
                  ].map((stat, i) => (
                    <Card key={i} className="p-0">
                      <div className="p-6 flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">{stat.label}</p>
                          <p className="text-2xl font-bold text-zinc-100">{stat.value}</p>
                        </div>
                        <div className={cn("p-3 rounded-xl bg-zinc-800/50", stat.color)}>
                          <stat.icon className="w-6 h-6" />
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 space-y-6">
                    <Card title="Infrastructure Nodes" icon={Server}>
                      <div className="space-y-4">
                        {/* Client Status Node */}
                        <div className={cn(
                          "p-4 bg-zinc-950 rounded-xl border border-zinc-800 border-l-4 transition-all group",
                          activeTunnel.status === 'deployed' ? "border-l-emerald-500/50" : "border-l-zinc-800"
                        )}>
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-4">
                              <div className={cn(
                                "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                                activeTunnel.status === 'deployed' ? "bg-emerald-500/10 text-emerald-500" : "bg-zinc-800 text-zinc-500"
                              )}>
                                <Smartphone className="w-5 h-5" />
                              </div>
                              <div>
                                <h4 className="text-sm font-bold text-zinc-100">Client Connection Status</h4>
                                <p className="text-xs text-zinc-500 font-mono">End-to-End Tunnel State</p>
                              </div>
                            </div>
                            <div className="text-right">
                              {activeTunnel.status === 'deployed' ? (
                                <Badge variant="success" className="animate-pulse">CONNECTED</Badge>
                              ) : (
                                <Badge variant="zinc">DISCONNECTED</Badge>
                              )}
                              <p className="text-[10px] text-zinc-600 mt-1 font-mono">
                                {activeTunnel.status === 'deployed' ? 'Tunnel Active' : 'No Active Session'}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Management Console Node */}
                        <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800 border-l-4 border-l-blue-500/50 hover:border-zinc-700 transition-all group">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-500/10 text-blue-500">
                                <Monitor className="w-5 h-5" />
                              </div>
                              <div>
                                <h4 className="text-sm font-bold text-zinc-100">Management Console</h4>
                                <p className="text-xs text-zinc-500 font-mono">Dedicated Secure Infrastructure</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <Badge variant="success">LIVE</Badge>
                              <p className="text-[10px] text-zinc-600 mt-1 font-mono">Separate from VPN Nodes</p>
                            </div>
                          </div>
                        </div>

                        {VPS_DATA.map((vps, i) => (
                          <div key={i} className="p-4 bg-zinc-950 rounded-xl border border-zinc-800 hover:border-zinc-700 transition-all group">
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-4">
                                <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", vps.status === 'online' ? "bg-emerald-500/10 text-emerald-500" : "bg-zinc-800 text-zinc-500")}>
                                  <Server className="w-5 h-5" />
                                </div>
                                <div>
                                  <h4 className="text-sm font-bold text-zinc-100">{vps.name}</h4>
                                  <p className="text-xs text-zinc-500 font-mono">{vps.ip}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <Badge variant={vps.status === 'online' ? 'success' : 'default'}>{vps.status}</Badge>
                                <p className="text-[10px] text-zinc-600 mt-1 font-mono">WG IP: {vps.wgIp}</p>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-900">
                              <div className="space-y-1">
                                <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Last Rotation</p>
                                <p className="text-xs font-mono text-zinc-400">{vps.lastRotation}</p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Next Rotation</p>
                                <p className="text-xs font-mono text-emerald-500">{vps.nextRotation}</p>
                              </div>
                            </div>

                            {vps.ports && (
                              <div className="mt-4 pt-4 border-t border-zinc-900 space-y-3">
                                <div className="flex items-center justify-between">
                                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Port Assignments</p>
                                  {vps.portConflicts && vps.portConflicts.length > 0 && (
                                    <Badge variant="warning">Conflicts Resolved</Badge>
                                  )}
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  {Object.entries(vps.ports).map(([service, port]) => {
                                    const conflict = vps.portConflicts?.find(c => c.purpose.includes(service));
                                    return (
                                      <div key={service} className="p-2 bg-zinc-900/50 rounded-lg border border-zinc-800/50 flex items-center justify-between">
                                        <div className="space-y-0.5">
                                          <p className="text-[8px] font-bold text-zinc-500 uppercase">{service}</p>
                                          <p className={cn("text-xs font-mono", conflict ? "text-amber-500" : "text-zinc-300")}>
                                            {port}
                                          </p>
                                        </div>
                                        {conflict && (
                                          <AlertTriangle className="w-3 h-3 text-amber-500" />
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                                {vps.portConflicts && vps.portConflicts.map((c, idx) => (
                                  <div key={idx} className="p-2 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                                    <p className="text-[9px] text-amber-500/80 leading-relaxed">
                                      <span className="font-bold">Conflict:</span> Port {c.port} was occupied by <span className="font-bold">{c.service}</span>. Service reassigned to avoid disruption.
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </Card>

                    <Card title="Network Topology (Dedicated Hop Architecture)" icon={Globe}>
                      <div className="h-[450px] flex flex-col items-center justify-start p-8 border border-zinc-800 rounded-xl bg-zinc-950/50 relative overflow-hidden">
                        {/* Background Grid Effect */}
                        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
                             style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #10b981 1px, transparent 0)', backgroundSize: '24px 24px' }} />
                        
                        {/* 1. Management Console (Root of Control) */}
                        <div className="relative z-20 mb-12">
                          <motion.div 
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex flex-col items-center gap-2"
                          >
                            <div className="w-16 h-16 bg-blue-500/10 border border-blue-500/30 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(59,130,246,0.15)] relative group">
                              <div className="absolute inset-0 bg-blue-500/20 rounded-2xl blur-xl group-hover:bg-blue-500/40 transition-all animate-pulse" />
                              <Monitor className="w-8 h-8 text-blue-400 relative z-10" />
                            </div>
                            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-[0.2em]">Management Hub</span>
                          </motion.div>
                          
                          {/* Control Lines Branching Out */}
                          <svg className="absolute top-full left-1/2 -translate-x-1/2 w-64 h-24 pointer-events-none overflow-visible">
                            <motion.path 
                              d="M 32 0 L 32 20 L -64 20 L -64 60" 
                              fill="none" 
                              stroke="currentColor" 
                              strokeWidth="1" 
                              className="text-blue-500/30"
                              initial={{ pathLength: 0 }}
                              animate={{ pathLength: 1 }}
                              transition={{ duration: 1.5, ease: "easeInOut" }}
                            />
                            <motion.path 
                              d="M 32 0 L 32 20 L 128 20 L 128 60" 
                              fill="none" 
                              stroke="currentColor" 
                              strokeWidth="1" 
                              className="text-blue-500/30"
                              initial={{ pathLength: 0 }}
                              animate={{ pathLength: 1 }}
                              transition={{ duration: 1.5, ease: "easeInOut" }}
                            />
                            {/* Control Packets */}
                            <motion.circle r="2" fill="#3b82f6"
                              animate={{ offsetDistance: ["0%", "100%"] }}
                              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                              style={{ offsetPath: "path('M 32 0 L 32 20 L -64 20 L -64 60')" }}
                            />
                            <motion.circle r="2" fill="#3b82f6"
                              animate={{ offsetDistance: ["0%", "100%"] }}
                              transition={{ duration: 3, repeat: Infinity, ease: "linear", delay: 1.5 }}
                              style={{ offsetPath: "path('M 32 0 L 32 20 L 128 20 L 128 60')" }}
                            />
                          </svg>
                        </div>

                        {/* 2. Infrastructure Layer (VPS Nodes) */}
                        <div className="flex items-center gap-32 relative z-10 mb-16">
                          {/* VPS1 (Gateway) */}
                          <motion.div 
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.3 }}
                            className="flex flex-col items-center gap-2"
                          >
                            <div className={cn(
                              "w-14 h-14 rounded-xl flex items-center justify-center border transition-all shadow-lg",
                              activeTunnel.status === 'deployed' ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500" : "bg-zinc-900 border-zinc-800 text-zinc-500"
                            )}>
                              <Server className="w-7 h-7" />
                            </div>
                            <span className="text-[10px] font-bold text-zinc-400 uppercase">VPS1 Gateway</span>
                          </motion.div>

                          {/* Data Tunnel Line (Horizontal) */}
                          <div className="absolute left-1/2 -translate-x-1/2 w-32 h-px bg-gradient-to-r from-emerald-500/50 via-emerald-500 to-emerald-500/50">
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-[8px] font-bold text-emerald-500 uppercase tracking-widest">WG1 Tunnel</div>
                            <motion.div 
                              className="absolute top-1/2 -translate-y-1/2 w-1 h-1 bg-emerald-400 rounded-full shadow-[0_0_8px_#10b981]"
                              animate={{ left: ["0%", "100%"] }}
                              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                            />
                          </div>

                          {/* VPS2 (Exit Node) */}
                          <motion.div 
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.6 }}
                            className="flex flex-col items-center gap-2"
                          >
                            <div className={cn(
                              "w-14 h-14 rounded-xl flex items-center justify-center border transition-all shadow-lg",
                              activeTunnel.status === 'deployed' ? "bg-zinc-900 border-zinc-700 text-zinc-300" : "bg-zinc-900 border-zinc-800 text-zinc-500"
                            )}>
                              <Server className="w-7 h-7" />
                            </div>
                            <span className="text-[10px] font-bold text-zinc-400 uppercase">VPS2 Exit</span>
                          </motion.div>
                        </div>

                        {/* 3. Endpoint Layer (Clients & Internet) */}
                        <div className="flex items-start gap-48 relative z-10">
                          {/* Client Side */}
                          <div className="relative flex flex-col items-center gap-2">
                            {/* Vertical Line from VPS1 */}
                            <div className="absolute bottom-full mb-2 w-px h-12 bg-gradient-to-t from-emerald-500/30 to-transparent" />
                            <motion.div 
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: 0.9 }}
                              className="w-12 h-12 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-center text-zinc-500 shadow-xl"
                            >
                              <Users className="w-6 h-6" />
                            </motion.div>
                            <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Clients</span>
                          </div>

                          {/* Internet Side */}
                          <div className="relative flex flex-col items-center gap-2">
                            {/* Vertical Line from VPS2 */}
                            <div className="absolute bottom-full mb-2 w-px h-12 bg-gradient-to-t from-zinc-700 to-transparent" />
                            <motion.div 
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: 1.2 }}
                              className="w-12 h-12 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-center text-zinc-600 shadow-xl"
                            >
                              <Globe className="w-6 h-6" />
                            </motion.div>
                            <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Internet</span>
                          </div>
                        </div>

                        {/* Flow Legend */}
                        <div className="absolute bottom-4 left-4 flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-blue-500" />
                            <span className="text-[8px] font-bold text-zinc-500 uppercase">Control Flow</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span className="text-[8px] font-bold text-zinc-500 uppercase">Data Path</span>
                          </div>
                        </div>
                      </div>
                      <p className="mt-4 text-[10px] text-zinc-500 text-center italic leading-relaxed px-6">
                        The <span className="text-blue-400 font-bold">Management Hub</span> orchestrates the infrastructure via an out-of-band control plane, while user traffic flows through the <span className="text-emerald-500 font-bold">Double VPN Cascade</span> (VPS1 → VPS2) for maximum anonymity.
                      </p>
                    </Card>

                    <Card title="Live Peers Monitoring" icon={Users}>
                      <div className="space-y-4">
                        {activeTunnel.status !== 'deployed' ? (
                          <div className="py-12 flex flex-col items-center justify-center text-center space-y-3 opacity-50">
                            <Users className="w-12 h-12 text-zinc-700" />
                            <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest">No Active Deployment</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {activeTunnel.peers.map((peer) => (
                              <div key={peer.id} className="p-4 bg-zinc-950 rounded-xl border border-zinc-800 hover:border-emerald-500/30 transition-all group">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                                      {peer.name.toLowerCase().includes('phone') ? <Smartphone className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
                                    </div>
                                    <div>
                                      <h4 className="text-sm font-bold text-zinc-100">{peer.name}</h4>
                                      <p className="text-[10px] text-zinc-500 font-mono">{peer.allowedIPs}</p>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="flex items-center gap-2 justify-end">
                                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                      <span className="text-[10px] font-bold text-emerald-500 uppercase">Active</span>
                                    </div>
                                    <p className="text-[10px] text-zinc-600 mt-1 font-mono">Last: {peer.lastHandshake}</p>
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-zinc-900">
                                  <div className="flex items-center gap-2">
                                    <ArrowRightLeft className="w-3 h-3 text-blue-500 rotate-90" />
                                    <div className="space-y-0.5">
                                      <p className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest">Download</p>
                                      <p className="text-xs font-mono text-zinc-300">{peer.transferRx}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <ArrowRightLeft className="w-3 h-3 text-emerald-500 -rotate-90" />
                                    <div className="space-y-0.5">
                                      <p className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest">Upload</p>
                                      <p className="text-xs font-mono text-zinc-300">{peer.transferTx}</p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </Card>
                  </div>

                  <div className="space-y-6">
                    <Card title="Security Status" icon={Lock}>
                      <div className="space-y-6">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full border-2 border-emerald-500/20 border-t-emerald-500 flex items-center justify-center">
                            <span className="text-sm font-bold text-emerald-500">98%</span>
                          </div>
                          <div>
                            <p className="text-xs font-bold text-zinc-200">Encryption Active</p>
                            <p className="text-[10px] text-zinc-500">ChaCha20-Poly1305</p>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-zinc-500 uppercase font-bold">SSH Port 22</span>
                            <span className="text-emerald-500 font-bold">OPEN (EXCLUDED)</span>
                          </div>
                          <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                            <div className="w-full h-full bg-emerald-500" />
                          </div>
                        </div>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-zinc-500 uppercase font-bold">NAT Resolution</span>
                            <span className="text-emerald-500 font-bold">ACTIVE</span>
                          </div>
                          <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                            <div className="w-full h-full bg-emerald-500" />
                          </div>
                        </div>
                      </div>
                    </Card>

                    <Card title="Quick Actions">
                      <div className="grid grid-cols-2 gap-3">
                        <button 
                          onClick={() => runAutomation('sync')}
                          disabled={isRotating}
                          className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl hover:bg-zinc-900 transition-colors flex flex-col items-center gap-2 group disabled:opacity-50"
                        >
                          <Activity className={cn("w-5 h-5 text-zinc-500 group-hover:text-emerald-500", isRotating && "animate-spin text-emerald-500")} />
                          <span className="text-[10px] font-bold text-zinc-400 uppercase">Rotate Keys</span>
                        </button>
                        <button 
                          onClick={() => exportAllConfigs()}
                          className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl hover:bg-zinc-900 transition-colors flex flex-col items-center gap-2 group"
                        >
                          <Download className="w-5 h-5 text-zinc-500 group-hover:text-emerald-500" />
                          <span className="text-[10px] font-bold text-zinc-400 uppercase">Export All</span>
                        </button>
                      </div>
                    </Card>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'scripts' && (
              <motion.div
                key="scripts"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-zinc-100 tracking-tight">Automation Scripts</h2>
                    <p className="text-sm text-zinc-500">Manage, add, and modify automated deployment scripts.</p>
                  </div>
                  <button 
                    onClick={() => setShowAddScript(true)}
                    className="flex items-center gap-2 px-6 py-3 bg-emerald-500 text-black font-bold rounded-xl hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20"
                  >
                    <Plus className="w-5 h-5" />
                    <span>ADD NEW SCRIPT</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-8">
                  {scripts.map((script) => (
                    <Card key={script.id} title={script.title} icon={script.icon || FileCode}>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-zinc-400">{script.description}</p>
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => setEditingScript(script)}
                              className="p-2 bg-zinc-950 border border-zinc-800 rounded-lg hover:text-emerald-500 transition-colors"
                              title="Edit Script"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => deleteScript(script.id)}
                              className="p-2 bg-zinc-950 border border-zinc-800 rounded-lg hover:text-red-500 transition-colors"
                              title="Delete Script"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <div className="relative group">
                          <pre className="bg-zinc-950 p-6 rounded-xl border border-zinc-800 text-[11px] font-mono text-emerald-500/80 overflow-x-auto leading-relaxed max-h-[400px]">
                            {script.content}
                          </pre>
                          <button 
                            onClick={() => handleCopy(script.content, `script-${script.id}`)}
                            className="absolute top-4 right-4 p-2 bg-zinc-900 border border-zinc-800 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:text-emerald-500"
                          >
                            {copied === `script-${script.id}` ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'keys' && (
              <motion.div
                key="keys"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-2xl font-bold text-zinc-100 tracking-tight">SSH Key Management</h2>
                    <p className="text-sm text-zinc-500">Securely manage and associate SSH keys with your VPS nodes.</p>
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={generateSSHKey}
                      className="flex items-center gap-2 px-6 py-3 bg-zinc-900 border border-zinc-800 text-zinc-100 font-bold rounded-xl hover:bg-zinc-800 transition-all"
                    >
                      <RotateCcw className="w-5 h-5" />
                      <span>GENERATE NEW</span>
                    </button>
                    <button 
                      onClick={() => setShowAddKey(true)}
                      className="flex items-center gap-2 px-6 py-3 bg-emerald-500 text-black font-bold rounded-xl hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20"
                    >
                      <Plus className="w-5 h-5" />
                      <span>IMPORT KEY</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  {sshKeys.map((key) => (
                    <div 
                      key={key.id} 
                      className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col hover:border-zinc-700 transition-all group"
                    >
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-6">
                          <div className="w-14 h-14 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-center text-zinc-500 group-hover:text-emerald-500 transition-colors">
                            <Lock className="w-7 h-7" />
                          </div>
                          <div>
                            <div className="flex items-center gap-3 mb-1">
                              <h3 className="text-lg font-bold text-zinc-100">{key.name}</h3>
                              <Badge variant="success">Secure</Badge>
                              {key.associatedVPS && (
                                <Badge variant="default">
                                  {key.associatedVPS === 'both' ? 'VPS1 & VPS2' : key.associatedVPS.toUpperCase()}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-zinc-500 font-mono">Created on {new Date(key.createdAt).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={() => handleCopy(key.publicKey, key.id + '-pub')}
                            className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl hover:bg-zinc-900 transition-colors text-zinc-400 hover:text-emerald-500"
                            title="Copy Public Key"
                          >
                            {copied === key.id + '-pub' ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                          </button>
                          <button 
                            onClick={() => deleteSSHKey(key.id)}
                            className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl hover:bg-red-500/10 transition-colors text-zinc-400 hover:text-red-500"
                            title="Delete Key"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Public Key</label>
                          <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800 font-mono text-[10px] text-zinc-400 truncate">
                            {key.publicKey}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Private Key</label>
                          <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800 font-mono text-[10px] text-zinc-600 truncate italic">
                            ••••••••••••••••••••••••••••••••••••••••••••••••
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'wg-keys' && (
              <motion.div
                key="wg-keys"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-2xl font-bold text-zinc-100 tracking-tight">WireGuard Key Manager</h2>
                    <p className="text-sm text-zinc-500">View and copy public keys for your VPS nodes to manually resolve configuration issues.</p>
                  </div>
                  <button 
                    onClick={async () => {
                      addLog("Refreshing WireGuard keys from servers...", "info");
                      const pub1 = await getVpsPublicKey(activeTunnel.vps1, 'wg1');
                      const pub1wg0 = await getVpsPublicKey(activeTunnel.vps1, 'wg0');
                      const pub2 = await getVpsPublicKey(activeTunnel.vps2, 'wg0');
                      updateActiveTunnel({
                        vps1: { ...activeTunnel.vps1, wg1PublicKey: pub1, wg0PublicKey: pub1wg0 },
                        vps2: { ...activeTunnel.vps2, wg0PublicKey: pub2 }
                      });
                      addLog("Keys refreshed successfully.", "success");
                    }}
                    className="flex items-center gap-2 px-6 py-3 bg-zinc-900 border border-zinc-800 text-zinc-100 font-bold rounded-xl hover:bg-zinc-800 transition-all"
                  >
                    <RotateCcw className="w-5 h-5" />
                    <span>REFRESH FROM SERVERS</span>
                  </button>

                  <button 
                    onClick={async () => {
                      if (!activeTunnel.vps1.ip || !activeTunnel.vps2.ip) {
                        addLog("Please provide VPS IPs in Settings first.", "error");
                        return;
                      }
                      addLog("Attempting to fix WireGuard configurations on both servers...", "info");
                      try {
                        // Fix VPS2 first (Exit Node)
                        const vps2Conf = `[Interface]
PrivateKey = ${activeTunnel.vps2.wg0PrivateKey || 'GENERATED_ON_SERVER'}
Address = 10.9.0.2/24
ListenPort = 51820
MTU = 1280
PostUp = iptables -I FORWARD 1 -i %i -j ACCEPT; iptables -I FORWARD 1 -o %i -j ACCEPT; iptables -t nat -A POSTROUTING -o \\$(ip route | awk '/default/ {for(i=1;i<=NF;i++) if(\\$i=="dev") print \\$(i+1)}' | head -n 1 || echo eth0) -j MASQUERADE; iptables -t mangle -I FORWARD 1 -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --clamp-mss-to-pmtu
PostDown = iptables -D FORWARD -i %i -j ACCEPT || true; iptables -D FORWARD -o %i -j ACCEPT || true; iptables -t nat -D POSTROUTING -o \\$(ip route | awk '/default/ {for(i=1;i<=NF;i++) if(\\$i=="dev") print \\$(i+1)}' | head -n 1 || echo eth0) -j MASQUERADE || true; iptables -t mangle -D FORWARD -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --clamp-mss-to-pmtu || true

[Peer]
PublicKey = ${activeTunnel.vps1.wg1PublicKey || ''}
AllowedIPs = 10.9.0.0/24, 10.8.0.0/24`;

                        await sshExecute(activeTunnel.vps2, `mkdir -p /etc/wireguard && echo "${vps2Conf}" > /etc/wireguard/wg0.conf && systemctl restart wg-quick@wg0 || wg-quick up wg0`);
                        addLog("VPS2 configuration fixed and restarted.", "success");

                        // Fix VPS1 (Gateway)
                        const vps1Conf = `[Interface]
PrivateKey = ${activeTunnel.vps1.wg1PrivateKey || 'GENERATED_ON_SERVER'}
Address = 10.9.0.1/24
ListenPort = 51820
MTU = 1280
Table = off
PostUp = sysctl -w net.ipv4.conf.all.rp_filter=2; sysctl -w net.ipv4.conf.default.rp_filter=2; sysctl -w net.ipv4.conf.wg1.rp_filter=2; sysctl -w net.ipv4.conf.wg0.rp_filter=2 || true; ip rule add from 10.8.0.0/24 table 200 priority 10; ip rule add from 10.9.0.1 table 200 priority 10 || true; ip route add default dev wg1 table 200 || true; iptables -t nat -A POSTROUTING -o wg1 -j MASQUERADE; iptables -I FORWARD 1 -i wg1 -j ACCEPT; iptables -I FORWARD 1 -o wg1 -j ACCEPT; iptables -I FORWARD 1 -i wg0 -j ACCEPT; iptables -I FORWARD 1 -o wg0 -j ACCEPT; iptables -t mangle -I FORWARD 1 -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --clamp-mss-to-pmtu
PostDown = ip rule del from 10.8.0.0/24 table 200 priority 10 || true; ip rule del from 10.9.0.1 table 200 priority 10 || true; ip route del default dev wg1 table 200 || true; iptables -t nat -D POSTROUTING -o wg1 -j MASQUERADE || true; iptables -D FORWARD -i wg1 -j ACCEPT || true; iptables -D FORWARD -o wg1 -j ACCEPT || true; iptables -D FORWARD -i wg0 -j ACCEPT || true; iptables -D FORWARD -o wg0 -j ACCEPT || true; iptables -t mangle -D FORWARD -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --clamp-mss-to-pmtu || true

[Peer]
PublicKey = ${activeTunnel.vps2.wg0PublicKey || ''}
Endpoint = ${activeTunnel.vps2.ip}:51820
AllowedIPs = 0.0.0.0/0
PersistentKeepalive = 25`;

                        await sshExecute(activeTunnel.vps1, `mkdir -p /etc/wireguard && echo "${vps1Conf}" > /etc/wireguard/wg1.conf && systemctl restart wg-quick@wg1 || wg-quick up wg1`);
                        addLog("VPS1 configuration fixed and restarted.", "success");
                        
                        // Fix wg-easy MTU
                        await sshExecute(activeTunnel.vps1, `
                          docker stop wg-easy || true
                          docker rm wg-easy || true
                          
                          # Update MTU for existing clients if any
                          if [ -d /etc/wireguard/clients ]; then
                            find /etc/wireguard/clients -name "*.conf" -exec sed -i 's/MTU = .*/MTU = 1280/' {} + || true
                          fi
                          # Fix ListenPort conflict if wg0.conf was generated previously with default port
                          # wg-easy overwrites changes to wg0.conf, so we must delete it to force regeneration
                          if grep -q "ListenPort = 51820" /etc/wireguard/wg0.conf 2>/dev/null; then
                            rm -f /etc/wireguard/wg0.conf
                          fi
                          
                          docker run -d \\
                            --name=wg-easy \\
                            --network host \\
                            -e WG_HOST=${activeTunnel.vps1.ip} \\
                            -e WG_PORT=51821 \\
                            -e PORT=51822 \\
                            -e PASSWORD_HASH='$2a$10$w.9.y/v.z.x.y.z.x.y.z.x.y.z.x.y.z.x.y.z.x.y.z.x.y.z.x' \\
                            -e WG_DEFAULT_DNS=1.1.1.1 \\
                            -e WG_DEFAULT_ADDRESS=10.8.0.x \\
                            -e WG_MTU=1280 \\
                            -e WG_ALLOWED_IPS=0.0.0.0/0 \\
                            -v /etc/wireguard:/etc/wireguard \\
                            --cap-add=NET_ADMIN \\
                            --cap-add=SYS_MODULE \\
                            --restart unless-stopped \\
                            ghcr.io/wg-easy/wg-easy
                        `);
                        addLog("wg-easy restarted with correct MTU.", "success");

                        addLog("Manual configuration fix complete. Check tunnel status.", "success");
                      } catch (err: unknown) {
                        const message = err instanceof Error ? err.message : String(err);
                        addLog(`Failed to fix configuration: ${message}`, "error");
                      }
                    }}
                    className="flex items-center gap-2 px-6 py-3 bg-emerald-500 text-black font-bold rounded-xl hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20"
                  >
                    <Wrench className="w-5 h-5" />
                    <span>FIX CONFIGURATIONS</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* VPS1 Keys */}
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-6">
                    <div className="flex items-center gap-4 mb-2">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                        <Server className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-zinc-100">VPS1 (Gateway)</h3>
                        <p className="text-xs text-zinc-500">{activeTunnel.vps1.ip}</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">WG1 Public Key (Tunnel to VPS2)</label>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] text-zinc-600 italic">Run 'wg show wg1 public-key' in terminal</span>
                            <button 
                              onClick={() => handleCopy(activeTunnel.vps1.wg1PublicKey || '', 'vps1-wg1-pub')}
                              className="text-zinc-500 hover:text-emerald-500 transition-colors"
                            >
                              {copied === 'vps1-wg1-pub' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            </button>
                          </div>
                        </div>
                        <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800 font-mono text-xs text-zinc-300 break-all flex items-center gap-2">
                          <input 
                            type="text"
                            value={activeTunnel.vps1.wg1PublicKey || ''}
                            onChange={(e) => updateActiveTunnel({ vps1: { ...activeTunnel.vps1, wg1PublicKey: e.target.value } })}
                            placeholder="Not Deployed (Enter manually if needed)"
                            className="bg-transparent border-none outline-none w-full text-zinc-300 placeholder:text-zinc-700"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">WG0 Public Key (Client Gateway)</label>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] text-zinc-600 italic">Run 'wg show wg0 public-key' in terminal</span>
                            <button 
                              onClick={() => handleCopy(activeTunnel.vps1.wg0PublicKey || '', 'vps1-wg0-pub')}
                              className="text-zinc-500 hover:text-emerald-500 transition-colors"
                            >
                              {copied === 'vps1-wg0-pub' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            </button>
                          </div>
                        </div>
                        <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800 font-mono text-xs text-zinc-300 break-all flex items-center gap-2">
                          <input 
                            type="text"
                            value={activeTunnel.vps1.wg0PublicKey || ''}
                            onChange={(e) => updateActiveTunnel({ vps1: { ...activeTunnel.vps1, wg0PublicKey: e.target.value } })}
                            placeholder="Not Deployed (Enter manually if needed)"
                            className="bg-transparent border-none outline-none w-full text-zinc-300 placeholder:text-zinc-700"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* VPS2 Keys */}
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-6">
                    <div className="flex items-center gap-4 mb-2">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                        <Server className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-zinc-100">VPS2 (Exit Node)</h3>
                        <p className="text-xs text-zinc-500">{activeTunnel.vps2.ip}</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">WG0 Public Key (Tunnel from VPS1)</label>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] text-zinc-600 italic">Run 'wg show wg0 public-key' in terminal</span>
                            <button 
                              onClick={() => handleCopy(activeTunnel.vps2.wg0PublicKey || '', 'vps2-wg0-pub')}
                              className="text-zinc-500 hover:text-emerald-500 transition-colors"
                            >
                              {copied === 'vps2-wg0-pub' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            </button>
                          </div>
                        </div>
                        <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800 font-mono text-xs text-zinc-300 break-all flex items-center gap-2">
                          <input 
                            type="text"
                            value={activeTunnel.vps2.wg0PublicKey || ''}
                            onChange={(e) => updateActiveTunnel({ vps2: { ...activeTunnel.vps2, wg0PublicKey: e.target.value } })}
                            placeholder="Not Deployed (Enter manually if needed)"
                            className="bg-transparent border-none outline-none w-full text-zinc-300 placeholder:text-zinc-700"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl">
                  <div className="flex gap-4">
                    <AlertCircle className="w-6 h-6 text-emerald-500 shrink-0" />
                    <div className="space-y-2">
                      <h4 className="text-sm font-bold text-emerald-500 uppercase tracking-wider">How to use these keys</h4>
                      <p className="text-xs text-zinc-400 leading-relaxed">
                        If the automated deployment fails with a "Configuration parsing error" or "Line unrecognized", it usually means one node couldn't retrieve the other's public key. 
                        You can copy the <strong>VPS2 WG0 Public Key</strong> and manually paste it into the <code>[Peer]</code> section of <code>/etc/wireguard/wg1.conf</code> on <strong>VPS1</strong>.
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'port-forwarding' && (
              <motion.div
                key="port-forwarding"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-2xl font-bold text-zinc-100 tracking-tight">Port Forwarding Rules</h2>
                    <p className="text-sm text-zinc-500">Define and manage traffic redirection for your WireGuard tunnels.</p>
                  </div>
                  <button 
                    onClick={() => setShowAddPortRule(true)}
                    className="flex items-center gap-2 px-6 py-3 bg-emerald-500 text-black font-bold rounded-xl hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20"
                  >
                    <Plus className="w-5 h-5" />
                    <span>ADD NEW RULE</span>
                  </button>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-zinc-950 border-b border-zinc-800">
                        <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Status</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Description</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">External Port</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Internal Port</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Protocol</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Target</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {portForwardRules.map((rule) => (
                        <tr key={rule.id} className="hover:bg-zinc-800/30 transition-colors group">
                          <td className="px-6 py-4">
                            <button 
                              onClick={() => togglePortRuleStatus(rule.id)}
                              className={cn(
                                "flex items-center gap-2 px-2 py-1 rounded-md text-[10px] font-bold uppercase transition-all",
                                rule.status === 'active' 
                                  ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" 
                                  : "bg-zinc-800 text-zinc-500 border border-zinc-700"
                              )}
                            >
                              <div className={cn("w-1.5 h-1.5 rounded-full", rule.status === 'active' ? "bg-emerald-500 animate-pulse" : "bg-zinc-600")} />
                              {rule.status}
                            </button>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm text-zinc-300 font-medium">{rule.description || 'No description'}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm font-mono text-zinc-400">{rule.externalPort}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm font-mono text-zinc-400">{rule.internalPort}</span>
                          </td>
                          <td className="px-6 py-4">
                            <Badge variant="default">{rule.protocol}</Badge>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <Server className="w-3 h-3 text-zinc-500" />
                              <span className="text-xs text-zinc-400 uppercase font-bold">{rule.targetVPS.toUpperCase()}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => setEditingPortRule(rule)}
                                className="p-2 hover:text-emerald-500 transition-colors"
                                title="Edit Rule"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => deletePortRule(rule.id)}
                                className="p-2 hover:text-red-500 transition-colors"
                                title="Delete Rule"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 space-y-4">
                    <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500">
                      <Wifi className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-zinc-200">Active Rules</h4>
                      <p className="text-2xl font-bold text-white tracking-tight">
                        {portForwardRules.filter(r => r.status === 'active').length}
                      </p>
                    </div>
                  </div>
                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 space-y-4">
                    <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center text-zinc-400">
                      <ArrowRightLeft className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-zinc-200">Total Traffic</h4>
                      <p className="text-2xl font-bold text-white tracking-tight">1.2 GB</p>
                    </div>
                  </div>
                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 space-y-4">
                    <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center text-zinc-400">
                      <Activity className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-zinc-200">Avg Latency</h4>
                      <p className="text-2xl font-bold text-white tracking-tight">24ms</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'deploy' && (
              <motion.div
                key="deploy"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <Card title="Project Settings" icon={Settings}>
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-zinc-600 uppercase">Project Name</label>
                          <input 
                            type="text" 
                            value={activeTunnel.name}
                            onChange={(e) => updateActiveTunnel({ name: e.target.value })}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500"
                            placeholder="e.g. Europe Exit Node"
                          />
                        </div>
                      </div>
                    </Card>

                    <Card title="VPS Credentials (Dedicated Servers Required)" icon={Lock}>
                      <div className="space-y-6">
                        {activeTunnel.vps1.ip === activeTunnel.vps2.ip && activeTunnel.vps1.ip !== '' && (
                          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3 animate-pulse">
                            <AlertTriangle className="w-4 h-4 text-red-500" />
                            <p className="text-[10px] text-red-400 font-bold uppercase">Critical: VPS1 and VPS2 must be separate, dedicated servers.</p>
                          </div>
                        )}
                        <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800 space-y-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Server className="w-4 h-4 text-emerald-500" />
                              <span className="text-xs font-bold text-zinc-400 uppercase">VPS1 (Gateway / Hop 1)</span>
                            </div>
                            <button 
                              onClick={async () => {
                                try {
                                  updateActiveTunnel({ vps1: { ...activeTunnel.vps1, connectionStatus: 'testing' } });
                                  addLog(`Testing connection to VPS1 (${activeTunnel.vps1.ip})...`, "info", "vps1");
                                  const res = await sshExecute(activeTunnel.vps1, "echo 'Connection Successful'");
                                  if (res.code === 0) {
                                    updateActiveTunnel({ vps1: { ...activeTunnel.vps1, connectionStatus: 'success' } });
                                    addLog("VPS1 Connection Successful!", "success", "vps1");
                                  } else {
                                    updateActiveTunnel({ vps1: { ...activeTunnel.vps1, connectionStatus: 'error' } });
                                    addLog(`VPS1 Connection Failed: ${res.errorOutput}`, "error", "vps1");
                                  }
                                } catch (err: unknown) {
                                  const message = err instanceof Error ? err.message : String(err);
                                  updateActiveTunnel({ vps1: { ...activeTunnel.vps1, connectionStatus: 'error' } });
                                  addLog(`VPS1 Connection Error: ${message}`, "error", "vps1");
                                }
                              }}
                              className={cn(
                                "text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border transition-all flex items-center gap-1",
                                activeTunnel.vps1.connectionStatus === 'success' ? "text-emerald-500 border-emerald-500/30 bg-emerald-500/10" :
                                activeTunnel.vps1.connectionStatus === 'error' ? "text-red-500 border-red-500/30 bg-red-500/10" :
                                activeTunnel.vps1.connectionStatus === 'testing' ? "text-amber-500 border-amber-500/30 bg-amber-500/10" :
                                "text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/10"
                              )}
                            >
                              {activeTunnel.vps1.connectionStatus === 'testing' && <Activity className="w-3 h-3 animate-spin" />}
                              {activeTunnel.vps1.connectionStatus === 'success' && <Check className="w-3 h-3" />}
                              {activeTunnel.vps1.connectionStatus === 'error' && <AlertCircle className="w-3 h-3" />}
                              {activeTunnel.vps1.connectionStatus === 'testing' ? "Testing..." : "Test Connection"}
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-zinc-600 uppercase">IP Address</label>
                              <input 
                                type="text" 
                                value={activeTunnel.vps1.ip}
                                onChange={(e) => updateActiveTunnel({ vps1: { ...activeTunnel.vps1, ip: e.target.value } })}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-zinc-600 uppercase">Username</label>
                              <input 
                                type="text" 
                                value={activeTunnel.vps1.user}
                                onChange={(e) => updateActiveTunnel({ vps1: { ...activeTunnel.vps1, user: e.target.value } })}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-zinc-600 uppercase">Root Password</label>
                              <input 
                                type="password" 
                                placeholder="••••••••"
                                value={activeTunnel.vps1.password}
                                onChange={(e) => updateActiveTunnel({ vps1: { ...activeTunnel.vps1, password: e.target.value } })}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-zinc-600 uppercase">SSH Key</label>
                              <select 
                                value={activeTunnel.vps1.sshKeyId || ''}
                                onChange={(e) => updateActiveTunnel({ vps1: { ...activeTunnel.vps1, sshKeyId: e.target.value } })}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500"
                              >
                                <option value="">No Key Associated</option>
                                {sshKeys.filter(k => k.associatedVPS === 'both' || k.associatedVPS === 'vps1').map(key => (
                                  <option key={key.id} value={key.id}>{key.name}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>

                        <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800 space-y-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Server className="w-4 h-4 text-zinc-500" />
                              <span className="text-xs font-bold text-zinc-400 uppercase">VPS2 (Exit Node / Hop 2)</span>
                            </div>
                            <button 
                              onClick={async () => {
                                try {
                                  updateActiveTunnel({ vps2: { ...activeTunnel.vps2, connectionStatus: 'testing' } });
                                  addLog(`Testing connection to VPS2 (${activeTunnel.vps2.ip})...`, "info", "vps2");
                                  const res = await sshExecute(activeTunnel.vps2, "echo 'Connection Successful'");
                                  if (res.code === 0) {
                                    updateActiveTunnel({ vps2: { ...activeTunnel.vps2, connectionStatus: 'success' } });
                                    addLog("VPS2 Connection Successful!", "success", "vps2");
                                  } else {
                                    updateActiveTunnel({ vps2: { ...activeTunnel.vps2, connectionStatus: 'error' } });
                                    addLog(`VPS2 Connection Failed: ${res.errorOutput}`, "error", "vps2");
                                  }
                                } catch (err: unknown) {
                                  const message = err instanceof Error ? err.message : String(err);
                                  updateActiveTunnel({ vps2: { ...activeTunnel.vps2, connectionStatus: 'error' } });
                                  addLog(`VPS2 Connection Error: ${message}`, "error", "vps2");
                                }
                              }}
                              className={cn(
                                "text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border transition-all flex items-center gap-1",
                                activeTunnel.vps2.connectionStatus === 'success' ? "text-emerald-500 border-emerald-500/30 bg-emerald-500/10" :
                                activeTunnel.vps2.connectionStatus === 'error' ? "text-red-500 border-red-500/30 bg-red-500/10" :
                                activeTunnel.vps2.connectionStatus === 'testing' ? "text-amber-500 border-amber-500/30 bg-amber-500/10" :
                                "text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/10"
                              )}
                            >
                              {activeTunnel.vps2.connectionStatus === 'testing' && <Activity className="w-3 h-3 animate-spin" />}
                              {activeTunnel.vps2.connectionStatus === 'success' && <Check className="w-3 h-3" />}
                              {activeTunnel.vps2.connectionStatus === 'error' && <AlertCircle className="w-3 h-3" />}
                              {activeTunnel.vps2.connectionStatus === 'testing' ? "Testing..." : "Test Connection"}
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-zinc-600 uppercase">IP Address</label>
                              <input 
                                type="text" 
                                value={activeTunnel.vps2.ip}
                                onChange={(e) => updateActiveTunnel({ vps2: { ...activeTunnel.vps2, ip: e.target.value } })}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-zinc-600 uppercase">Username</label>
                              <input 
                                type="text" 
                                value={activeTunnel.vps2.user}
                                onChange={(e) => updateActiveTunnel({ vps2: { ...activeTunnel.vps2, user: e.target.value } })}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-zinc-600 uppercase">Root Password</label>
                              <input 
                                type="password" 
                                placeholder="••••••••"
                                value={activeTunnel.vps2.password}
                                onChange={(e) => updateActiveTunnel({ vps2: { ...activeTunnel.vps2, password: e.target.value } })}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-zinc-600 uppercase">SSH Key</label>
                              <select 
                                value={activeTunnel.vps2.sshKeyId || ''}
                                onChange={(e) => updateActiveTunnel({ vps2: { ...activeTunnel.vps2, sshKeyId: e.target.value } })}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500"
                              >
                                <option value="">No Key Associated</option>
                                {sshKeys.filter(k => k.associatedVPS === 'both' || k.associatedVPS === 'vps2').map(key => (
                                  <option key={key.id} value={key.id}>{key.name}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-3">
                          <button 
                            onClick={testConfiguration}
                            disabled={isTestingConfig || activeTunnel.status === 'deploying'}
                            className="flex-1 py-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold rounded-xl border border-zinc-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isTestingConfig ? (
                              <>
                                <Activity className="w-5 h-5 animate-spin" />
                                TESTING...
                              </>
                            ) : (
                              <>
                                <ShieldCheck className="w-5 h-5" />
                                TEST CONFIGURATION
                              </>
                            )}
                          </button>

                          <button 
                            onClick={() => startDeployment(false)}
                            disabled={activeTunnel.status === 'deploying' || isTestingConfig}
                            className="flex-1 py-4 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-bold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/10"
                          >
                            {activeTunnel.status === 'deploying' ? (
                              <>
                                <Activity className="w-5 h-5 animate-spin" />
                                DEPLOYING...
                              </>
                            ) : (
                              <>
                                <Play className="w-5 h-5" />
                                START DEPLOYMENT
                              </>
                            )}
                          </button>
                          
                          {activeTunnel.status === 'deploying' && (
                            <button 
                              onClick={() => {
                                cancelDeploymentRef.current = true;
                                addLog("Cancellation requested...", "error");
                              }}
                              className="px-6 py-4 bg-red-500/10 hover:bg-red-500/20 text-red-500 font-bold rounded-xl border border-red-500/20 transition-all flex items-center justify-center gap-2"
                            >
                              <XCircle className="w-5 h-5" />
                              <span>STOP</span>
                            </button>
                          )}

                          <button 
                            onClick={() => startDeployment(true)}
                            disabled={activeTunnel.status === 'deploying'}
                            className="px-6 py-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold rounded-xl border border-zinc-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Wipe existing config and perform clean install"
                          >
                            <RotateCcw className="w-5 h-5" />
                            <span>WIPE & CLEAN INSTALL</span>
                          </button>
                        </div>

                        {activeTunnel.status === 'failed' && (
                          <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                            <div className="flex items-start gap-3">
                              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
                              <div className="flex-1">
                                <h4 className="text-sm font-bold text-red-500 uppercase tracking-wider">Deployment Failed</h4>
                                <p className="text-xs text-zinc-400 mt-1">
                                  Automated setup encountered an error. You can try a "Clean Install" or run the manual setup script directly on your VPS.
                                </p>
                                <div className="flex flex-wrap gap-2 mt-3">
                                  <button 
                                    onClick={() => {
                                      const script = INITIAL_SCRIPTS.find(s => s.id === 'manual-install');
                                      if (script) {
                                        navigator.clipboard.writeText(script.content);
                                        addLog("Manual Setup Script copied to clipboard.", "success");
                                      }
                                    }}
                                    className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-500 text-[10px] font-bold rounded-lg border border-red-500/30 transition-all flex items-center gap-1.5"
                                  >
                                    <Copy className="w-3 h-3" />
                                    COPY MANUAL SCRIPT
                                  </button>
                                  <button 
                                    onClick={() => startDeployment(true)}
                                    className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[10px] font-bold rounded-lg border border-zinc-700 transition-all flex items-center gap-1.5"
                                  >
                                    <RotateCcw className="w-3 h-3" />
                                    RETRY CLEAN INSTALL
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        <p className="text-[10px] text-zinc-500 text-center italic">
                          Tip: Type "fail" in VPS1 password to test the automated rollback feature.
                        </p>
                      </div>
                    </Card>

                    <Card title="Deployment Status" icon={Activity}>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[10px] font-bold text-zinc-500 uppercase">Progress</span>
                          <span className="text-xs font-mono text-emerald-500">{Math.round((activeTunnel.step / 2) * 100)}%</span>
                        </div>
                        <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden">
                          <motion.div 
                            className="h-full bg-emerald-500"
                            initial={{ width: 0 }}
                            animate={{ width: `${(activeTunnel.step / 2) * 100}%` }}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className={cn("p-3 rounded-xl border transition-all", activeTunnel.step >= 1 ? "bg-emerald-500/5 border-emerald-500/20" : "bg-zinc-950 border-zinc-800")}>
                            <div className="flex items-center gap-2">
                              <div className={cn("w-2 h-2 rounded-full", activeTunnel.step >= 1 ? "bg-emerald-500" : "bg-zinc-800")} />
                              <span className="text-[10px] font-bold text-zinc-400 uppercase">VPS2 Exit Node</span>
                            </div>
                          </div>
                          <div className={cn("p-3 rounded-xl border transition-all", activeTunnel.step >= 2 ? "bg-emerald-500/5 border-emerald-500/20" : "bg-zinc-950 border-zinc-800")}>
                            <div className="flex items-center gap-2">
                              <div className={cn("w-2 h-2 rounded-full", activeTunnel.step >= 2 ? "bg-emerald-500" : "bg-zinc-800")} />
                              <span className="text-[10px] font-bold text-zinc-400 uppercase">VPS1 Gateway</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </div>

                  <div className="space-y-6">
                    <Card title="Deployment Logs" icon={Terminal} className="h-full">
                      <div className="flex flex-col h-full space-y-4">
                        <div className="flex justify-end mb-2">
                          <button 
                            onClick={() => updateActiveTunnel({ logs: [] })}
                            className="text-[10px] font-bold text-zinc-500 hover:text-zinc-300 uppercase tracking-widest flex items-center gap-1"
                          >
                            <Trash2 className="w-3 h-3" />
                            Clear All Logs
                          </button>
                        </div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
                          {/* VPS1 Logs */}
                          <div className="flex flex-col space-y-2">
                            <div className="flex items-center gap-2 px-1">
                              <Server className="w-3 h-3 text-emerald-500" />
                              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">VPS1 Gateway Logs</span>
                            </div>
                            <div className="bg-zinc-950 rounded-xl border border-zinc-800 p-4 h-[400px] overflow-y-auto font-mono text-[11px] space-y-2 scrollbar-thin scrollbar-thumb-zinc-800">
                              {activeTunnel.logs.filter(l => l.vps === 'vps1').length === 0 && (
                                <div className="h-full flex flex-col items-center justify-center text-zinc-600 space-y-2">
                                  <p>Waiting for VPS1 activity...</p>
                                </div>
                              )}
                              {activeTunnel.logs.filter(l => l.vps === 'vps1').map((log, i) => (
                                <div key={i} className={cn(
                                  "flex gap-3",
                                  log.type === 'error' ? "text-red-400" : 
                                  log.type === 'success' ? "text-emerald-400" : 
                                  log.type === 'cmd' ? "text-zinc-300" : "text-zinc-500"
                                )}>
                                  <span className="text-zinc-700 shrink-0">[{log.timestamp}]</span>
                                  <span className="break-all">
                                    {log.type === 'cmd' && <span className="text-emerald-500 mr-2">$</span>}
                                    {log.msg}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* VPS2 Logs */}
                          <div className="flex flex-col space-y-2">
                            <div className="flex items-center gap-2 px-1">
                              <Server className="w-3 h-3 text-zinc-500" />
                              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">VPS2 Exit Node Logs</span>
                            </div>
                            <div className="bg-zinc-950 rounded-xl border border-zinc-800 p-4 h-[400px] overflow-y-auto font-mono text-[11px] space-y-2 scrollbar-thin scrollbar-thumb-zinc-800">
                              {activeTunnel.logs.filter(l => l.vps === 'vps2').length === 0 && (
                                <div className="h-full flex flex-col items-center justify-center text-zinc-600 space-y-2">
                                  <p>Waiting for VPS2 activity...</p>
                                </div>
                              )}
                              {activeTunnel.logs.filter(l => l.vps === 'vps2').map((log, i) => (
                                <div key={i} className={cn(
                                  "flex gap-3",
                                  log.type === 'error' ? "text-red-400" : 
                                  log.type === 'success' ? "text-emerald-400" : 
                                  log.type === 'cmd' ? "text-zinc-300" : "text-zinc-500"
                                )}>
                                  <span className="text-zinc-700 shrink-0">[{log.timestamp}]</span>
                                  <span className="break-all">
                                    {log.type === 'cmd' && <span className="text-emerald-500 mr-2">$</span>}
                                    {log.msg}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Inter-VPS Exchange Logs */}
                          <div className="flex flex-col space-y-2 lg:col-span-2">
                            <div className="flex items-center gap-2 px-1">
                              <ArrowRightLeft className="w-3 h-3 text-blue-500" />
                              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">VPS1 ↔ VPS2 Exchange Logs</span>
                            </div>
                            <div className="bg-zinc-950 rounded-xl border border-zinc-800 p-4 h-[300px] overflow-y-auto font-mono text-[11px] space-y-2 scrollbar-thin scrollbar-thumb-zinc-800">
                              {activeTunnel.logs.filter(l => l.vps === 'exchange').length === 0 && (
                                <div className="h-full flex flex-col items-center justify-center text-zinc-600 space-y-2">
                                  <p>Waiting for inter-VPS exchange activity...</p>
                                </div>
                              )}
                              {activeTunnel.logs.filter(l => l.vps === 'exchange').map((log, i) => (
                                <div key={i} className={cn(
                                  "flex gap-3",
                                  log.type === 'error' ? "text-red-400" : 
                                  log.type === 'success' ? "text-emerald-400" : 
                                  log.type === 'cmd' ? "text-zinc-300" : "text-zinc-500"
                                )}>
                                  <span className="text-zinc-700 shrink-0">[{log.timestamp}]</span>
                                  <span className="break-all">
                                    {log.type === 'cmd' && <span className="text-emerald-500 mr-2">$</span>}
                                    {log.msg}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </div>
                </div>
              </motion.div>
            )}
            {activeTab === 'peers' && (
              <motion.div
                key="peers"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
                  <div>
                    <h2 className="text-2xl font-bold text-zinc-100 tracking-tight">Peer Management</h2>
                    <p className="text-sm text-zinc-500">Manage users and devices connected to VPS1 Gateway for {activeTunnel.name}.</p>
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => setShowAddPeer(true)}
                      className="flex items-center gap-2 px-6 py-3 bg-emerald-500 text-black font-bold rounded-xl hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20 whitespace-nowrap"
                    >
                      <Plus className="w-5 h-5" />
                      <span>ADD NEW PEER</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {activeTunnel.peers.map((peer) => (
                    <div 
                      key={peer.id} 
                      className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex items-center justify-between hover:border-zinc-700 transition-all group"
                    >
                      <div className="flex items-center gap-6">
                        <div className="w-14 h-14 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-center text-zinc-500 group-hover:text-emerald-500 transition-colors">
                          <Users className="w-7 h-7" />
                        </div>
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <h3 className="text-lg font-bold text-zinc-100">{peer.name}</h3>
                            {activeTunnel.status === 'deployed' ? (
                              <Badge variant="success" className="animate-pulse">Connected</Badge>
                            ) : (
                              <Badge variant="zinc">Offline</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-xs text-zinc-500 font-mono">
                            <span className="flex items-center gap-1.5"><Globe className="w-3 h-3" /> {peer.allowedIPs}</span>
                            <span className="flex items-center gap-1.5"><Activity className="w-3 h-3" /> {peer.lastHandshake || 'No handshake'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => setSelectedPeer(peer)}
                          className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl hover:bg-zinc-900 transition-colors text-zinc-400 hover:text-emerald-500"
                          title="View QR Code"
                        >
                          <QrCode className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => downloadConfig(peer)}
                          className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl hover:bg-zinc-900 transition-colors text-zinc-400 hover:text-emerald-500"
                          title="Download Config"
                        >
                          <Download className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => deletePeer(peer.id)}
                          className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl hover:bg-red-500/10 transition-colors text-zinc-400 hover:text-red-500"
                          title="Delete Peer"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'config' && (
              <motion.div
                key="config"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <Card title="VPS1 (Gateway) - Double VPN Config" icon={Terminal}>
                    <div className="space-y-4">
                      <div className="relative group">
                        <div className="absolute -top-2 left-4 px-2 bg-zinc-900 text-[8px] font-bold text-zinc-500 uppercase">Docker Container (wg-easy)</div>
                        <pre className="bg-zinc-950 p-6 pt-8 rounded-xl border border-zinc-800 text-[11px] font-mono text-emerald-500/80 overflow-x-auto leading-relaxed">
{`# WG-Easy manages client connections
# Web UI: http://${activeTunnel.vps1.ip || '<VPS1_IP>'}:51822
# Password: admin

docker stop wg-easy || true
docker rm wg-easy || true

docker run -d \\
  --name=wg-easy \\
  --network host \\
  -e WG_HOST=${activeTunnel.vps1.ip || '<VPS1_IP>'} \\
  -e WG_PORT=51821 \\
  -e PORT=51822 \\
  -e PASSWORD_HASH='$2a$10$w.9.y/v.z.x.y.z.x.y.z.x.y.z.x.y.z.x.y.z.x.y.z.x.y.z.x' \\
  -e WG_DEFAULT_DNS=1.1.1.1 \\
  -e WG_DEFAULT_ADDRESS=10.8.0.x \\
  -e WG_MTU=1280 \\
  -e WG_ALLOWED_IPS=0.0.0.0/0 \\
  -v /etc/wireguard:/etc/wireguard \\
  --cap-add=NET_ADMIN \\
  --cap-add=SYS_MODULE \\
  --restart unless-stopped \\
  ghcr.io/wg-easy/wg-easy`}
                        </pre>
                      </div>
                      <div className="relative group">
                        <div className="absolute -top-2 left-4 px-2 bg-zinc-900 text-[8px] font-bold text-zinc-500 uppercase">/etc/wireguard/wg1.conf (VPS2 Tunnel)</div>
                        <pre className="bg-zinc-950 p-6 pt-8 rounded-xl border border-zinc-800 text-[11px] font-mono text-emerald-500/80 overflow-x-auto leading-relaxed">
{`[Interface]
PrivateKey = <VPS1_PRIVATE_KEY>
Address = 10.9.0.1/24
ListenPort = 51820
MTU = 1280
Table = off
PostUp = sysctl -w net.ipv4.conf.all.rp_filter=2; sysctl -w net.ipv4.conf.default.rp_filter=2; sysctl -w net.ipv4.conf.<PRIMARY_IF>.rp_filter=2; sysctl -w net.ipv4.conf.wg1.rp_filter=2; sysctl -w net.ipv4.conf.wg0.rp_filter=2 || true; ip rule add from 10.8.0.0/24 table 200 priority 10; ip rule add from 10.9.0.1 table 200 priority 10 || true; ip route add default dev wg1 table 200 || true; iptables -t nat -A POSTROUTING -o wg1 -j MASQUERADE; iptables -I FORWARD 1 -i wg1 -j ACCEPT; iptables -I FORWARD 1 -o wg1 -j ACCEPT; iptables -I FORWARD 1 -i wg0 -j ACCEPT; iptables -I FORWARD 1 -o wg0 -j ACCEPT; iptables -t mangle -I FORWARD 1 -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --clamp-mss-to-pmtu
PostDown = ip rule del from 10.8.0.0/24 table 200 priority 10 || true; ip rule del from 10.9.0.1 table 200 priority 10 || true; ip route del default dev wg1 table 200 || true; iptables -t nat -D POSTROUTING -o wg1 -j MASQUERADE || true; iptables -D FORWARD -i wg1 -j ACCEPT || true; iptables -D FORWARD -o wg1 -j ACCEPT || true; iptables -D FORWARD -i wg0 -j ACCEPT || true; iptables -D FORWARD -o wg0 -j ACCEPT || true; iptables -t mangle -D FORWARD -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --clamp-mss-to-pmtu || true

[Peer]
PublicKey = <VPS2_PUBLIC_KEY>
Endpoint = ${activeTunnel.vps2.ip || 'XXX.XXX.XXX.XXX'}:51820
AllowedIPs = 0.0.0.0/0
PersistentKeepalive = 25`}
                        </pre>
                      </div>
                    </div>
                  </Card>

                  <Card title="VPS2 (Exit Node) - Double VPN Config" icon={Terminal}>
                    <div className="space-y-4">
                      <div className="relative group">
                        <div className="absolute -top-2 left-4 px-2 bg-zinc-900 text-[8px] font-bold text-zinc-500 uppercase">/etc/wireguard/wg0.conf (Inbound)</div>
                        <pre className="bg-zinc-950 p-6 pt-8 rounded-xl border border-zinc-800 text-[11px] font-mono text-emerald-500/80 overflow-x-auto leading-relaxed">
{`[Interface]
PrivateKey = <VPS2_PRIVATE_KEY>
Address = 10.9.0.2/24
ListenPort = 51820
MTU = 1280
PostUp = iptables -I FORWARD 1 -i %i -j ACCEPT; iptables -I FORWARD 1 -o %i -j ACCEPT; iptables -t nat -A POSTROUTING -o <DEFAULT_IFACE> -j MASQUERADE; iptables -t mangle -I FORWARD 1 -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --clamp-mss-to-pmtu
PostDown = iptables -D FORWARD -i %i -j ACCEPT || true; iptables -D FORWARD -o %i -j ACCEPT || true; iptables -t nat -D POSTROUTING -o <DEFAULT_IFACE> -j MASQUERADE || true; iptables -t mangle -D FORWARD -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --clamp-mss-to-pmtu || true

[Peer]
PublicKey = <VPS1_PUBLIC_KEY>
AllowedIPs = 10.9.0.0/24, 10.8.0.0/24`}
                        </pre>
                      </div>
                    </div>
                  </Card>
                </div>

                <div className="flex justify-end">
                  <button 
                    onClick={() => runAutomation('sync')}
                    disabled={isRotating}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/20 transition-all text-xs font-bold uppercase disabled:opacity-50"
                  >
                    <Activity className={cn("w-4 h-4", isRotating && "animate-spin")} />
                    {isRotating ? "Syncing Keys..." : "Sync & Update VPS Keys"}
                  </button>
                </div>

                <Card title="Firewall Rules (UFW / IPTables)" icon={Shield}>
                  <div className="space-y-4">
                    <p className="text-sm text-zinc-400">Run these commands on VPS1 to ensure SSH remains available and WireGuard traffic is allowed.</p>
                    <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 font-mono text-xs text-zinc-300 space-y-2">
                      <p className="text-zinc-500"># Allow SSH (Port 22)</p>
                      <p>ufw allow 22/tcp</p>
                      <p className="text-zinc-500 mt-4"># Allow WireGuard (Port 51820)</p>
                      <p>ufw allow 51820/udp</p>
                      <p className="text-zinc-500 mt-4"># Enable IP Forwarding</p>
                      <p>echo "net.ipv4.ip_forward=1" &gt;&gt; /etc/sysctl.conf</p>
                      <p>sysctl -p</p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}

            {activeTab === 'setup' && (
              <motion.div
                key="setup"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="max-w-3xl mx-auto space-y-12"
              >
                <div className="text-center space-y-4">
                  <h2 className="text-3xl font-bold text-zinc-100 tracking-tight">Deployment Guide</h2>
                  <p className="text-zinc-500">Follow these steps to establish the tunnel between your VPS instances.</p>
                </div>

                <div className="space-y-8">
                  {[
                    {
                      title: '1. Deploy VPS2 (Exit Node)',
                      desc: 'Run the VPS2 Setup Script. It will generate a Public Key. Copy this key.',
                      cmd: 'curl -sSL https://lodgeguard.io/vps2-setup.sh | bash'
                    },
                    {
                      title: '2. Deploy VPS1 (Gateway)',
                      desc: 'Run the VPS1 Setup Script. When prompted (or by editing the config), paste the VPS2 Public Key.',
                      cmd: 'curl -sSL https://lodgeguard.io/vps1-setup.sh | bash'
                    },
                    {
                      title: '3. Configure WG-Easy',
                      desc: `Access the VPS1 Web GUI at http://${activeTunnel.vps1.ip}:51821. Create your client profiles.`,
                      cmd: `open http://${activeTunnel.vps1.ip}:51821`
                    },
                    {
                      title: '4. Verify Double VPN',
                      desc: `Connect your client. Your IP should now be the IP of VPS2 (${activeTunnel.vps2.ip}).`,
                      cmd: 'curl ifconfig.me'
                    },
                    {
                      title: '5. Setup Key Rotation',
                      desc: 'Install the Sync Script on VPS1 and add it to your daily crontab.',
                      cmd: '(crontab -l ; echo "0 0 * * * /usr/local/bin/lodgeguard-sync.sh") | crontab -'
                    }
                  ].map((step, i) => (
                    <div key={i} className="flex gap-6">
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center font-bold text-emerald-500">
                        {i + 1}
                      </div>
                      <div className="space-y-3 flex-1">
                        <h3 className="text-lg font-bold text-zinc-100">{step.title}</h3>
                        <p className="text-sm text-zinc-500">{step.desc}</p>
                        <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800 font-mono text-xs text-emerald-500/70 flex items-center justify-between group">
                          <span>{step.cmd}</span>
                          <button 
                            onClick={() => handleCopy(step.cmd, `step-${i}`)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            {copied === `step-${i}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'platforms' && (
              <motion.div
                key="platforms"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-white tracking-tight">Cross-Platform Access</h2>
                    <p className="text-zinc-500 text-sm">Access your Double VPN from any device.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Web Platform */}
                  <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 p-6 hover:border-emerald-500/50 transition-all group">
                    <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                      <Globe className="text-emerald-400 w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">Web Application (Dedicated)</h3>
                    <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
                      Access the management console via our <span className="text-blue-400 font-bold">dedicated, isolated infrastructure</span>. This portal is physically separate from your VPN nodes to ensure maximum security.
                    </p>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-zinc-950 rounded-lg border border-zinc-800">
                        <span className="text-xs text-zinc-500 uppercase font-mono">Status</span>
                        <span className="text-xs text-emerald-400 font-bold">LIVE</span>
                      </div>
                      <button className="w-full py-2 bg-emerald-500 text-black rounded-lg font-bold text-sm flex items-center justify-center gap-2 hover:bg-emerald-400 transition-colors">
                        <ExternalLink className="w-4 h-4" />
                        Open Web App
                      </button>
                    </div>
                  </div>

                  {/* Windows Platform */}
                  <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 p-6 hover:border-blue-500/50 transition-all group">
                    <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                      <Monitor className="text-blue-400 w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">Windows Desktop</h3>
                    <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
                      Native Windows application with system tray integration and automatic startup.
                    </p>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-zinc-950 rounded-lg border border-zinc-800">
                          <span className="text-xs text-zinc-500 uppercase font-mono">Revision</span>
                          <span className="text-xs text-blue-400 font-bold">R13</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-zinc-950 rounded-lg border border-zinc-800">
                          <span className="text-xs text-zinc-500 uppercase font-mono">Version</span>
                          <span className="text-xs text-blue-400 font-bold">v1.1.3-win</span>
                        </div>
                      <button className="w-full py-2 bg-blue-500 text-white rounded-lg font-bold text-sm flex items-center justify-center gap-2 hover:bg-blue-400 transition-colors">
                        <Download className="w-4 h-4" />
                        Download .EXE
                      </button>
                    </div>
                  </div>

                  {/* Android Platform */}
                  <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800 p-6 hover:border-orange-500/50 transition-all group">
                    <div className="w-12 h-12 bg-orange-500/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                      <Smartphone className="text-orange-400 w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">Android (Samsung)</h3>
                    <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
                      Optimized for Samsung Galaxy devices. Includes Samsung Knox integration, quick-settings toggle, and S-Pen support for management.
                    </p>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-zinc-950 rounded-lg border border-zinc-800">
                          <span className="text-xs text-zinc-500 uppercase font-mono">Revision</span>
                          <span className="text-xs text-orange-400 font-bold">R13</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-zinc-950 rounded-lg border border-zinc-800">
                          <span className="text-xs text-zinc-500 uppercase font-mono">Version</span>
                          <span className="text-xs text-orange-400 font-bold">v1.1.3-android</span>
                        </div>
                      <div className="flex items-center justify-between p-3 bg-zinc-950 rounded-lg border border-zinc-800">
                        <span className="text-xs text-zinc-500 uppercase font-mono">Format</span>
                        <span className="text-xs text-orange-400 font-bold">APK / AAB</span>
                      </div>
                      <button className="w-full py-2 bg-orange-500 text-white rounded-lg font-bold text-sm flex items-center justify-center gap-2 hover:bg-orange-400 transition-colors">
                        <Download className="w-4 h-4" />
                        Download .APK
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-zinc-900/30 rounded-2xl border border-zinc-800 p-8">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-zinc-800 rounded-xl">
                      <Trash2 className="w-6 h-6 text-zinc-400" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-white font-bold mb-2">Maintenance & Uninstallation</h4>
                      <p className="text-zinc-500 text-sm mb-6 max-w-2xl">
                        Need to remove Double Tunnel or reset your servers? Access the dedicated maintenance tools to safely uninstall all components.
                      </p>
                      <button 
                        onClick={() => setActiveTab('uninstall')}
                        className="px-6 py-2 bg-emerald-500 text-black rounded-lg text-xs font-bold hover:bg-emerald-400 transition-all"
                      >
                        OPEN UNINSTALL WIZARD
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-zinc-900/30 rounded-2xl border border-zinc-800 p-8">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-zinc-800 rounded-xl">
                      <Settings className="w-6 h-6 text-zinc-400" />
                    </div>
                    <div>
                      <h4 className="text-white font-bold mb-2">Build Instructions for Developers</h4>
                      <p className="text-zinc-500 text-sm mb-6 max-w-2xl">
                        To build the native versions of this application locally, ensure you have the necessary SDKs installed (Android Studio for Android, Electron for Windows).
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800">
                          <p className="text-[10px] text-zinc-500 uppercase font-mono mb-2">Windows Build</p>
                          <code className="text-xs text-blue-400">npm run electron:build</code>
                        </div>
                        <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800">
                          <p className="text-[10px] text-zinc-500 uppercase font-mono mb-2">Android Build</p>
                          <code className="text-xs text-orange-400">npm run android:sync</code>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'uninstall' && (
              <motion.div
                key="uninstall"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="max-w-4xl mx-auto space-y-8"
              >
                <div className="text-center space-y-4 mb-12">
                  <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <Trash2 className="text-red-500 w-8 h-8" />
                  </div>
                  <h2 className="text-3xl font-bold text-white tracking-tight">Uninstall & Maintenance</h2>
                  <p className="text-zinc-500 max-w-xl mx-auto">
                    Completely remove Double Tunnel from your local machine and remote servers.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Local Uninstallation */}
                  <Card title="Local Windows Uninstallation" icon={Monitor}>
                    <div className="space-y-4">
                      <p className="text-sm text-zinc-400">
                        To uninstall the desktop application, use the standard Windows "Add or Remove Programs" utility.
                      </p>
                      
                      <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-xl space-y-2">
                        <div className="flex items-center gap-2 text-red-400 font-bold text-[10px] uppercase tracking-wider">
                          <ShieldAlert className="w-3 h-3" />
                          <span>Security Warning (Un_D.exe)</span>
                        </div>
                        <p className="text-[10px] text-zinc-400 leading-relaxed">
                          Windows may block the uninstaller because it is unsigned. If you see a warning about <b>Un_D.exe</b> or an "unverified publisher":
                        </p>
                        <div className="flex flex-col gap-1 pl-2 border-l border-red-500/30">
                          <span className="text-[10px] text-zinc-300">1. Click <b>"More info"</b> (Подробнее)</span>
                          <span className="text-[10px] text-zinc-300">2. Click <b>"Run anyway"</b> (Выполнить в любом случае)</span>
                        </div>
                      </div>

                      <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800 space-y-3">
                        <div className="flex items-center gap-3 text-xs text-zinc-300">
                          <div className="w-6 h-6 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-500">1</div>
                          <span>Open <b>Settings &gt; Apps &gt; Installed Apps</b></span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-zinc-300">
                          <div className="w-6 h-6 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-500">2</div>
                          <span>Search for <b>"Double Tunnel"</b></span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-zinc-300">
                          <div className="w-6 h-6 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-500">3</div>
                          <span>Click <b>Uninstall</b></span>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <p className="text-[10px] text-zinc-500 italic">
                          If the standard uninstaller fails, use the Force Cleanup tool:
                        </p>
                        <button 
                          onClick={downloadCleanupTool}
                          className="w-full py-3 bg-zinc-900 text-zinc-300 border border-zinc-800 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-500 transition-all"
                        >
                          <Download className="w-4 h-4" />
                          DOWNLOAD FORCE_CLEANUP.BAT
                        </button>
                      </div>
                    </div>
                  </Card>

                  {/* Remote Server Reset */}
                  <Card title="Remote Server Reset" icon={Server}>
                    <div className="space-y-4">
                      <p className="text-sm text-zinc-400">
                        Remove all WireGuard configurations, firewall rules, and management scripts from your VPS instances.
                      </p>
                      <div className="space-y-2">
                        <button 
                          onClick={() => runAutomation('reset')}
                          className="w-full py-3 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-red-500/20 transition-all"
                        >
                          <RotateCcw className="w-4 h-4" />
                          FULL VPS RESET (VPS1 & VPS2)
                        </button>
                        <p className="text-[10px] text-zinc-600 text-center italic">
                          This will permanently delete all tunnel data on the servers.
                        </p>
                      </div>
                    </div>
                  </Card>
                </div>

                <div className="bg-zinc-900/30 rounded-2xl border border-zinc-800 p-8">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-zinc-800 rounded-xl">
                      <RotateCcw className="w-6 h-6 text-zinc-400" />
                    </div>
                    <div>
                      <h4 className="text-white font-bold mb-2">Console Reset</h4>
                      <p className="text-zinc-500 text-sm mb-6 max-w-2xl">
                        If the management interface is behaving unexpectedly, you can reset the local cache. This will not affect your VPS servers.
                      </p>
                      <button 
                        onClick={() => {
                          if(confirm("This will clear all local application data and reset the console. Continue?")) {
                            localStorage.clear();
                            window.location.reload();
                          }
                        }}
                        className="px-6 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-bold text-zinc-400 hover:text-white hover:border-zinc-600 transition-all"
                      >
                        RESET LOCAL CONSOLE DATA
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'diagnostics' && (
              <motion.div
                key="diagnostics"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-white tracking-tight">Diagnostic Center</h2>
                    <p className="text-zinc-500 text-sm">Collect and analyze logs for troubleshooting connectivity issues.</p>
                  </div>
                  <button 
                    onClick={downloadDiagnosticBundle}
                    className="flex items-center gap-2 px-6 py-3 bg-emerald-500 text-black font-bold rounded-xl hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20"
                  >
                    <Download className="w-5 h-5" />
                    <span>DOWNLOAD DIAGNOSTIC BUNDLE</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Console Logs */}
                  <Card title="Management Console Logs" icon={Terminal}>
                    <div className="space-y-4">
                      <p className="text-xs text-zinc-500">Real-time logs from this management interface (browser console).</p>
                      <div className="bg-black rounded-xl border border-zinc-800 p-4 h-64 overflow-y-auto font-mono text-[10px] space-y-1 scrollbar-thin scrollbar-thumb-zinc-800">
                        {consoleLogs.length === 0 && <p className="text-zinc-700 italic">No logs captured yet...</p>}
                        {consoleLogs.map((log, i) => (
                          <div key={i} className="flex gap-2">
                            <span className="text-zinc-600 shrink-0">[{log.timestamp}]</span>
                            <span className={cn(
                              "shrink-0 uppercase font-bold",
                              log.type === 'error' ? "text-red-500" : log.type === 'warn' ? "text-yellow-500" : "text-blue-500"
                            )}>{log.type}:</span>
                            <span className="text-zinc-300 break-all">{log.message}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </Card>

                  {/* Mobile Client Diagnostics */}
                  <Card title="Mobile Client Logs" icon={Smartphone}>
                    <div className="space-y-6">
                      <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800 space-y-3">
                        <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">How to export logs from Android/iOS:</h4>
                        <ol className="text-xs text-zinc-500 space-y-2 list-decimal ml-4">
                          <li>Open the WireGuard app on your mobile device.</li>
                          <li>Go to <span className="text-zinc-300">Settings</span> (three dots or gear icon).</li>
                          <li>Select <span className="text-zinc-300">View Log</span> or <span className="text-zinc-300">Export Logs</span>.</li>
                          <li>Save the file or copy the text.</li>
                        </ol>
                      </div>
                      
                      <div className="space-y-3">
                        <p className="text-xs text-zinc-500">Paste mobile logs here for inclusion in the diagnostic bundle:</p>
                        <textarea 
                          placeholder="Paste logs from mobile app here..."
                          className="w-full h-32 bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-xs font-mono text-zinc-300 focus:outline-none focus:border-emerald-500/50 transition-all resize-none"
                        />
                      </div>
                    </div>
                  </Card>

                  {/* VPS Logs */}
                  <Card title="VPS Server Logs" icon={Server}>
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <button 
                          onClick={() => collectVPSLogs('vps1')}
                          className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl hover:bg-zinc-900 transition-all flex flex-col items-center gap-3 group"
                        >
                          <div className="p-2 bg-zinc-900 rounded-lg group-hover:bg-emerald-500/10 transition-colors">
                            <Activity className="w-5 h-5 text-zinc-500 group-hover:text-emerald-500" />
                          </div>
                          <span className="text-[10px] font-bold text-zinc-400 uppercase">Fetch VPS1 Logs</span>
                        </button>
                        <button 
                          onClick={() => collectVPSLogs('vps2')}
                          className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl hover:bg-zinc-900 transition-all flex flex-col items-center gap-3 group"
                        >
                          <div className="p-2 bg-zinc-900 rounded-lg group-hover:bg-emerald-500/10 transition-colors">
                            <Activity className="w-5 h-5 text-zinc-500 group-hover:text-emerald-500" />
                          </div>
                          <span className="text-[10px] font-bold text-zinc-400 uppercase">Fetch VPS2 Logs</span>
                        </button>
                      </div>

                      <div className="space-y-4">
                        {vpsLogs.map((log) => (
                          <div key={log.vps} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                                {log.vps === 'vps1' ? 'VPS1 (Gateway)' : 'VPS2 (Node)'}
                              </span>
                              <button 
                                onClick={() => setVpsLogs(prev => prev.filter(l => l.vps !== log.vps))}
                                className="text-[10px] text-red-500 hover:underline"
                              >
                                CLEAR
                              </button>
                            </div>
                            <div className="bg-black rounded-xl border border-zinc-800 p-4 h-48 overflow-y-auto font-mono text-[10px] text-zinc-400 whitespace-pre scrollbar-thin scrollbar-thumb-zinc-800">
                              {log.logs}
                            </div>
                          </div>
                        ))}
                        {vpsLogs.length === 0 && (
                          <div className="h-48 bg-zinc-950 rounded-xl border border-zinc-800 border-dashed flex items-center justify-center">
                            <p className="text-xs text-zinc-600 italic">No server logs collected yet.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>

                  {/* Common Issues */}
                  <Card title="Quick Troubleshooting Guide" icon={ShieldAlert}>
                    <div className="space-y-4">
                      <div className="space-y-3">
                        <div className="p-3 bg-red-500/5 border border-red-500/10 rounded-lg">
                          <h4 className="text-xs font-bold text-red-400 mb-1 flex items-center gap-2">
                            <AlertCircle className="w-3 h-3" />
                            Handshake Failure
                          </h4>
                          <p className="text-[10px] text-zinc-500 leading-relaxed">
                            If you see "Handshake did not complete" in mobile logs, check if UDP port 51820 is open on VPS1 firewall and if the Endpoint IP is correct.
                          </p>
                        </div>
                        <div className="p-3 bg-yellow-500/5 border border-yellow-500/10 rounded-lg">
                          <h4 className="text-xs font-bold text-yellow-400 mb-1 flex items-center gap-2">
                            <AlertTriangle className="w-3 h-3" />
                            Connected but no Internet
                          </h4>
                          <p className="text-[10px] text-zinc-500 leading-relaxed">
                            Check IP forwarding on both servers: <code className="text-zinc-400">sysctl net.ipv4.ip_forward</code>. Ensure VPS2 has MASQUERADE rules active.
                          </p>
                        </div>
                        <div className="p-3 bg-blue-500/5 border border-blue-500/10 rounded-lg">
                          <h4 className="text-xs font-bold text-blue-400 mb-1 flex items-center gap-2">
                            <Activity className="w-3 h-3" />
                            High Latency
                          </h4>
                          <p className="text-[10px] text-zinc-500 leading-relaxed">
                            Double VPN naturally adds latency. Ensure both VPS are in the same region or geographically close to minimize overhead.
                          </p>
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Add Peer Modal */}
      <AnimatePresence>
        {showAddPeer && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddPeer(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-zinc-100">Add New Peer</h3>
                  <button onClick={() => setShowAddPeer(false)} className="text-zinc-500 hover:text-zinc-300">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Device Name</label>
                    <input 
                      type="text" 
                      value={newPeerName}
                      onChange={(e) => setNewPeerName(e.target.value)}
                      placeholder="e.g. iPhone 15 Pro"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-200 focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>
                  <div className="p-4 bg-zinc-950 rounded-xl border border-zinc-800 border-dashed">
                    <p className="text-[10px] text-zinc-500 leading-relaxed italic">
                      Keys and IP address (10.0.0.{activeTunnel.peers.length + 4}) will be automatically generated for this peer.
                    </p>
                  </div>
                </div>
                <button 
                  onClick={addPeer}
                  className="w-full py-4 bg-emerald-500 text-black font-bold rounded-xl hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20"
                >
                  GENERATE PEER CONFIG
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showAddScript && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddScript(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-zinc-100">Add New Automation Script</h3>
                  <button onClick={() => setShowAddScript(false)} className="text-zinc-500 hover:text-zinc-300">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Script Title</label>
                      <input 
                        type="text" 
                        value={newScript.title}
                        onChange={(e) => setNewScript({ ...newScript, title: e.target.value })}
                        placeholder="e.g. Backup Script"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-200 focus:outline-none focus:border-emerald-500 transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Description</label>
                      <input 
                        type="text" 
                        value={newScript.description}
                        onChange={(e) => setNewScript({ ...newScript, description: e.target.value })}
                        placeholder="Brief purpose of the script"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-200 focus:outline-none focus:border-emerald-500 transition-colors"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Script Content (Bash)</label>
                    <textarea 
                      value={newScript.content}
                      onChange={(e) => setNewScript({ ...newScript, content: e.target.value })}
                      placeholder="#!/bin/bash..."
                      className="w-full h-64 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-emerald-500 font-mono focus:outline-none focus:border-emerald-500 transition-colors resize-none"
                    />
                  </div>
                </div>
                <button 
                  onClick={addScript}
                  className="w-full py-4 bg-emerald-500 text-black font-bold rounded-xl hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20"
                >
                  SAVE SCRIPT
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {editingScript && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingScript(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-zinc-100">Edit Script</h3>
                  <button onClick={() => setEditingScript(null)} className="text-zinc-500 hover:text-zinc-300">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Script Title</label>
                      <input 
                        type="text" 
                        value={editingScript.title}
                        onChange={(e) => setEditingScript({ ...editingScript, title: e.target.value })}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-200 focus:outline-none focus:border-emerald-500 transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Description</label>
                      <input 
                        type="text" 
                        value={editingScript.description}
                        onChange={(e) => setEditingScript({ ...editingScript, description: e.target.value })}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-200 focus:outline-none focus:border-emerald-500 transition-colors"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Script Content (Bash)</label>
                    <textarea 
                      value={editingScript.content}
                      onChange={(e) => setEditingScript({ ...editingScript, content: e.target.value })}
                      className="w-full h-64 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-emerald-500 font-mono focus:outline-none focus:border-emerald-500 transition-colors resize-none"
                    />
                  </div>
                </div>
                <button 
                  onClick={updateScript}
                  className="w-full py-4 bg-emerald-500 text-black font-bold rounded-xl hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20"
                >
                  UPDATE SCRIPT
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showAddKey && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddKey(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-zinc-100">Import SSH Key</h3>
                  <button onClick={() => setShowAddKey(false)} className="text-zinc-500 hover:text-zinc-300">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Key Name</label>
                      <input 
                        type="text" 
                        value={newKey.name}
                        onChange={(e) => setNewKey({ ...newKey, name: e.target.value })}
                        placeholder="e.g. Production Gateway Key"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-200 focus:outline-none focus:border-emerald-500 transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Association</label>
                      <select 
                        value={newKey.associatedVPS}
                        onChange={(e) => setNewKey({ ...newKey, associatedVPS: e.target.value })}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-200 focus:outline-none focus:border-emerald-500 transition-colors"
                      >
                        <option value="both">VPS1 & VPS2</option>
                        <option value="vps1">VPS1 Only</option>
                        <option value="vps2">VPS2 Only</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Public Key (id_rsa.pub)</label>
                    <textarea 
                      value={newKey.publicKey}
                      onChange={(e) => setNewKey({ ...newKey, publicKey: e.target.value })}
                      placeholder="ssh-rsa AAAAB3NzaC1yc2E..."
                      className="w-full h-32 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-xs text-zinc-400 font-mono focus:outline-none focus:border-emerald-500 transition-colors resize-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Private Key (Optional - for rotation)</label>
                    <textarea 
                      value={newKey.privateKey}
                      onChange={(e) => setNewKey({ ...newKey, privateKey: e.target.value })}
                      placeholder="-----BEGIN RSA PRIVATE KEY-----"
                      className="w-full h-32 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-xs text-zinc-400 font-mono focus:outline-none focus:border-emerald-500 transition-colors resize-none"
                    />
                  </div>
                </div>
                <button 
                  onClick={addSSHKey}
                  className="w-full py-4 bg-emerald-500 text-black font-bold rounded-xl hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20"
                >
                  IMPORT SSH KEY
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showAddPortRule && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddPortRule(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-zinc-100">Add Port Forwarding Rule</h3>
                  <button onClick={() => setShowAddPortRule(false)} className="text-zinc-500 hover:text-zinc-300">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Description</label>
                    <input 
                      type="text" 
                      value={newPortRule.description}
                      onChange={(e) => setNewPortRule({ ...newPortRule, description: e.target.value })}
                      placeholder="e.g. Web Server Traffic"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-200 focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">External Port</label>
                      <input 
                        type="number" 
                        value={newPortRule.externalPort}
                        onChange={(e) => setNewPortRule({ ...newPortRule, externalPort: parseInt(e.target.value) })}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-200 focus:outline-none focus:border-emerald-500 transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Internal Port</label>
                      <input 
                        type="number" 
                        value={newPortRule.internalPort}
                        onChange={(e) => setNewPortRule({ ...newPortRule, internalPort: parseInt(e.target.value) })}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-200 focus:outline-none focus:border-emerald-500 transition-colors"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Protocol</label>
                      <select 
                        value={newPortRule.protocol}
                        onChange={(e) => setNewPortRule({ ...newPortRule, protocol: e.target.value as 'TCP' | 'UDP' })}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-200 focus:outline-none focus:border-emerald-500 transition-colors"
                      >
                        <option value="TCP">TCP</option>
                        <option value="UDP">UDP</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Target VPS</label>
                      <select 
                        value={newPortRule.targetVPS}
                        onChange={(e) => setNewPortRule({ ...newPortRule, targetVPS: e.target.value as 'vps1' | 'vps2' })}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-200 focus:outline-none focus:border-emerald-500 transition-colors"
                      >
                        <option value="vps1">VPS1 (Gateway)</option>
                        <option value="vps2">VPS2 (Node)</option>
                      </select>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={addPortRule}
                  className="w-full py-4 bg-emerald-500 text-black font-bold rounded-xl hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20"
                >
                  CREATE RULE
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {editingPortRule && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingPortRule(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-zinc-100">Edit Port Forwarding Rule</h3>
                  <button onClick={() => setEditingPortRule(null)} className="text-zinc-500 hover:text-zinc-300">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Description</label>
                    <input 
                      type="text" 
                      value={editingPortRule.description}
                      onChange={(e) => setEditingPortRule({ ...editingPortRule, description: e.target.value })}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-200 focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">External Port</label>
                      <input 
                        type="number" 
                        value={editingPortRule.externalPort}
                        onChange={(e) => setEditingPortRule({ ...editingPortRule, externalPort: parseInt(e.target.value) })}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-200 focus:outline-none focus:border-emerald-500 transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Internal Port</label>
                      <input 
                        type="number" 
                        value={editingPortRule.internalPort}
                        onChange={(e) => setEditingPortRule({ ...editingPortRule, internalPort: parseInt(e.target.value) })}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-200 focus:outline-none focus:border-emerald-500 transition-colors"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Protocol</label>
                      <select 
                        value={editingPortRule.protocol}
                        onChange={(e) => setEditingPortRule({ ...editingPortRule, protocol: e.target.value as 'TCP' | 'UDP' })}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-200 focus:outline-none focus:border-emerald-500 transition-colors"
                      >
                        <option value="TCP">TCP</option>
                        <option value="UDP">UDP</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Target VPS</label>
                      <select 
                        value={editingPortRule.targetVPS}
                        onChange={(e) => setEditingPortRule({ ...editingPortRule, targetVPS: e.target.value as 'vps1' | 'vps2' })}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-200 focus:outline-none focus:border-emerald-500 transition-colors"
                      >
                        <option value="vps1">VPS1 (Gateway)</option>
                        <option value="vps2">VPS2 (Node)</option>
                      </select>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={updatePortRule}
                  className="w-full py-4 bg-emerald-500 text-black font-bold rounded-xl hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20"
                >
                  SAVE CHANGES
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* QR Code Modal */}
      <AnimatePresence>
        {selectedPeer && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedPeer(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-8 flex flex-col items-center space-y-6">
                <div className="text-center">
                  <h3 className="text-xl font-bold text-zinc-100">{selectedPeer.name}</h3>
                  <p className="text-xs text-zinc-500 mt-1">Scan this code with the WireGuard app</p>
                </div>
                
                <div className="p-4 bg-white rounded-2xl shadow-inner">
                  <QRCodeSVG 
                    value={`[Interface]\nPrivateKey = ${selectedPeer.privateKey}\nAddress = ${selectedPeer.allowedIPs}\nDNS = 1.1.1.1\n\n[Peer]\nPublicKey = ${activeTunnel.vps1.wg0PublicKey || '8xJ2vK9zL3mN4pQ5rS6tU7vW8xY9z0a1b2c3d4e5f6g='}\nEndpoint = ${activeTunnel.vps1.ip || 'XXX.XXX.XXX.XXX'}:51820\nAllowedIPs = 0.0.0.0/0\nPersistentKeepalive = 25`}
                    size={200}
                    level="H"
                  />
                </div>

                <div className="w-full bg-zinc-800/50 p-4 rounded-xl text-left space-y-2">
                  <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">WG Easy UI Config</h4>
                  <div className="space-y-1">
                    <p className="text-[10px] text-zinc-500">Public Key:</p>
                    <code className="text-[10px] text-zinc-200 break-all bg-zinc-950 p-1 rounded">{selectedPeer.publicKey}</code>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-zinc-500">Allowed IPs:</p>
                    <code className="text-[10px] text-zinc-200 break-all bg-zinc-950 p-1 rounded">{selectedPeer.allowedIPs}</code>
                  </div>
                </div>

                <div className="w-full space-y-3">
                  <button 
                    onClick={() => downloadConfig(selectedPeer)}
                    className="w-full py-3 bg-zinc-800 text-zinc-200 font-bold rounded-xl hover:bg-zinc-700 transition-all flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>DOWNLOAD .CONF</span>
                  </button>
                  <button 
                    onClick={() => setSelectedPeer(null)}
                    className="w-full py-3 text-zinc-500 font-bold hover:text-zinc-300 transition-all"
                  >
                    CLOSE
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
