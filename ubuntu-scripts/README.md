# Ubuntu Setup Scripts for Double Tunnel

This directory contains the latest setup scripts for configuring your VPS instances for the Double Tunnel VPN.

## Scripts Overview

1.  **`vps-check.sh`**: Run this first on any new VPS to verify it meets the requirements (Ubuntu/Debian, root access, kernel support).
2.  **`manual-setup.sh`**: Installs all base dependencies (WireGuard, Docker, etc.) and enables IP forwarding. Run this before the configuration scripts.
3.  **`01-vps2-exit.sh`**: Configures the **Exit Node (VPS2)**.
4.  **`02-vps1-gateway.sh`**: Configures the **Gateway Node (VPS1)** with `wg-easy` and the tunnel to VPS2.

## How to use

### On VPS2 (Exit Node)
```bash
# 1. Check readiness
bash vps-check.sh

# 2. Install base dependencies
bash manual-setup.sh

# 3. Prepare (generate keys)
bash 01-vps2-exit.sh prepare

# 4. Configure (after getting VPS1 public key)
bash 01-vps2-exit.sh configure <VPS1_PUBLIC_KEY>
```

### On VPS1 (Gateway Node)
```bash
# 1. Check readiness
bash vps-check.sh

# 2. Install base dependencies
bash manual-setup.sh

# 3. Prepare (generate keys)
bash 02-vps1-gateway.sh prepare

# 4. Configure (after getting VPS2 public key and IP)
bash 02-vps1-gateway.sh configure <VPS2_PUBLIC_KEY>
```

## Standardized Interfaces
- **`wg0`**: Client interface (on VPS1) / Tunnel interface (on VPS2)
- **`wg1`**: Tunnel interface (on VPS1)

## Networking Fixes Included
- **Loose Reverse Path Filtering (`rp_filter=2`)** for correct multi-hop routing.
- **TCP MSS Clamping** to prevent fragmentation issues.
- **Explicit Forwarding Rules** to allow traffic between interfaces.
