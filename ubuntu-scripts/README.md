# Double Tunnel VPN - Ubuntu Scripts

These scripts allow you to manually deploy the Double Tunnel VPN architecture on two fresh Ubuntu 20.04/22.04/24.04 servers.

## Architecture Overview
- **VPS1 (Gateway):** Runs `wg-easy` (for client connections on port 51821) and routes all internet-bound traffic through a WireGuard tunnel (`wg1`) to VPS2.
- **VPS2 (Exit Node):** Receives traffic from VPS1 via WireGuard (`wg2` on port 51820) and NATs it out to the public internet.

## Prerequisites
1. Two fresh Ubuntu servers (VPS1 and VPS2).
2. Root access to both servers.

## Step-by-Step Guide

### Step 1: Setup VPS2 (Exit Node)
1. SSH into **VPS2** as root.
2. Copy the `01-vps2-exit.sh` script to the server.
3. Make it executable and run it:
   ```bash
   chmod +x 01-vps2-exit.sh
   ./01-vps2-exit.sh
   ```
4. The script will install WireGuard, generate keys, and pause to ask for VPS1's Public Key. **Leave this terminal open** and proceed to Step 2.

### Step 2: Setup VPS1 (Gateway)
1. SSH into **VPS1** as root in a new terminal window.
2. Copy the `02-vps1-gateway.sh` script to the server.
3. Make it executable and run it:
   ```bash
   chmod +x 02-vps1-gateway.sh
   ./02-vps1-gateway.sh
   ```
4. The script will install Docker and WireGuard, generate keys, and output **VPS1's Public Key**.

### Step 3: Exchange Keys
1. Copy the **VPS1 Public Key** from the VPS1 terminal and paste it into the prompt waiting on the **VPS2 terminal**. Press Enter. VPS2 will finish its setup and start the `wg2` interface.
2. Copy the **VPS2 Public Key** and **VPS2 IP Address** and paste them into the prompts waiting on the **VPS1 terminal**. Press Enter. VPS1 will finish its setup, start the `wg1` interface, and launch the `wg-easy` Docker container.

### Step 4: Connect Clients
1. Open your web browser and navigate to the WG-Easy Web UI on VPS1:
   `http://<VPS1_IP>:51822`
2. Log in with the default password: `admin`
3. Create a new client configuration and download the `.conf` file or scan the QR code with the WireGuard app on your device.
4. Connect your device. Your IP address should now appear as the IP of **VPS2**.
