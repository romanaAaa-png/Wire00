# Ubuntu Setup Scripts for Double Tunnel v2.0.0

This directory contains the latest setup scripts for configuring your VPS instances for the Double Tunnel VPN.

## Scripts Overview

1.  **`vps-check.sh`**: Run this first on any new VPS to verify it meets the requirements (Ubuntu/Debian, root access, kernel support).
2.  **`manual-setup.sh`**: Installs all base dependencies (WireGuard, Docker, etc.) and enables IP forwarding. Run this before the configuration scripts.
3.  **`01-vps2-exit.sh`**: Configures the **Exit Node (VPS2)**.
4.  **`02-vps1-gateway.sh`**: Configures the **Gateway Node (VPS1)** with `wg-easy` and the tunnel to VPS2.

## How to use

### Option 1: Interactive Setup (Recommended)
The **`interactive-setup.sh`** script is the easiest way to manually configure your VPS. It will guide you through the process, generate keys, and ask for the peer's information.

1.  **On VPS2 (Exit Node):**
    ```bash
    curl -O https://ais-dev-ee3mffqb4uxgmtykuty4vn-678364466913.europe-west2.run.app/ubuntu-scripts/interactive-setup.sh
    chmod +x interactive-setup.sh
    sudo ./interactive-setup.sh
    ```
    *   Choose **2** for VPS2.
    *   Copy the **Public Key** it generates.
    *   Keep this terminal open.

2.  **On VPS1 (Gateway):**
    ```bash
    curl -O https://ais-dev-ee3mffqb4uxgmtykuty4vn-678364466913.europe-west2.run.app/ubuntu-scripts/interactive-setup.sh
    chmod +x interactive-setup.sh
    sudo ./interactive-setup.sh
    ```
    *   Choose **1** for VPS1.
    *   Copy the **Public Key** it generates.
    *   When asked for the peer key, paste the key from **VPS2**.
    *   Enter the **Public IP of VPS2**.

3.  **Back on VPS2:**
    *   Answer **y** when asked if you have the other key.
    *   Paste the key from **VPS1**.

### Option 2: Step-by-Step Manual Installation
If you prefer to use the individual scripts:

#### On VPS2 (Exit Node)
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
- **`wg-gate`**: Client interface (on VPS1, managed by wg-easy)
- **`wg-tun1`**: Tunnel interface (on VPS1)
- **`wg-tun2`**: Tunnel interface (on VPS2)

## Networking Fixes Included
- **Loose Reverse Path Filtering (`rp_filter=2`)** for correct multi-hop routing.
- **TCP MSS Clamping** to prevent fragmentation issues.
- **Explicit Forwarding Rules** to allow traffic between interfaces.
