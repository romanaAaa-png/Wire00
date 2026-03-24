const fs = require('fs');
const content = fs.readFileSync('src/App.tsx', 'utf8');

const startIdx = content.indexOf('  const startDeployment = async (isCleanInstall: boolean = false) => {');
const endIdx = content.indexOf('  const testConfiguration = async () => {');

if (startIdx === -1 || endIdx === -1) {
  console.error('Could not find start or end index');
  process.exit(1);
}

const newFunction = `  const startDeployment = async (isCleanInstall: boolean = false) => {
    if (!activeTunnel.vps1.password || !activeTunnel.vps2.password) {
      alert("Please provide root passwords for both servers.");
      return;
    }

    if (activeTunnel.vps1.ip === activeTunnel.vps2.ip) {
      alert("Double VPN requires two separate, dedicated servers. VPS1 and VPS2 cannot have the same IP address.");
      return;
    }

    setIsDeploying(true);
    cancelDeploymentRef.current = false;
    updateActiveTunnel({ status: 'deploying', logs: [], step: 0 });
    addLog(\`Starting Double VPN \${isCleanInstall ? 'Clean ' : ''}Deployment...\`, "info", "exchange");

    let currentTunnel = { ...activeTunnel };

    try {
      const checkCancel = () => {
        if (cancelDeploymentRef.current) {
          throw new Error('Deployment Cancelled');
        }
      };

      // Step 1: VPS2 install docker
      checkCancel();
      addLog("Step 1: VPS2 installing Docker...", "info", "vps2");
      await sshExecute(currentTunnel.vps2, \`
        apt-get update && apt-get install -y docker.io sshpass curl
        systemctl enable --now docker
        docker --version
      \`);
      addLog("Step 1 Complete: Docker installed on VPS2.", "success", "vps2");

      // Step 2: VPS2 install wireguard and wg-easy
      checkCancel();
      addLog("Step 2: VPS2 installing WireGuard & wg-easy...", "info", "vps2");
      await sshExecute(currentTunnel.vps2, \`
        apt-get install -y wireguard wireguard-tools
        wg --version
        docker pull weejewel/wg-easy
      \`);
      addLog("Step 2 Complete: WireGuard installed on VPS2.", "success", "vps2");

      // Step 3: VPS1 install docker
      checkCancel();
      addLog("Step 3: VPS1 installing Docker...", "info", "vps1");
      await sshExecute(currentTunnel.vps1, \`
        apt-get update && apt-get install -y docker.io sshpass curl
        systemctl enable --now docker
        docker --version
      \`);
      addLog("Step 3 Complete: Docker installed on VPS1.", "success", "vps1");

      // Step 4: VPS1 install wireguard and wg-easy
      checkCancel();
      addLog("Step 4: VPS1 installing WireGuard & wg-easy...", "info", "vps1");
      await sshExecute(currentTunnel.vps1, \`
        apt-get install -y wireguard wireguard-tools
        wg --version
        docker pull weejewel/wg-easy
      \`);
      addLog("Step 4 Complete: WireGuard installed on VPS1.", "success", "vps1");

      // Step 5 & 6: VPS1 connects to VPS2 to generate keys
      checkCancel();
      addLog("Step 5 & 6: VPS1 connecting to VPS2 via SSH to generate keys...", "info", "exchange");
      await sshExecute(currentTunnel.vps1, \`
        sshpass -p '\${currentTunnel.vps2.password}' ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 root@\${currentTunnel.vps2.ip} "
          mkdir -p /etc/wireguard
          wg genkey | tee /etc/wireguard/wg0.conf | wg pubkey > /etc/wireguard/wgpub2.key
          chmod 600 /etc/wireguard/wg0.conf
          echo 'VPS2 Keys generated successfully.'
        "
      \`);
      addLog("Step 5 & 6 Complete: VPS2 keys generated via VPS1.", "success", "exchange");

      // Step 7: VPS1 SCPs public key from VPS2
      checkCancel();
      addLog("Step 7: VPS1 copying wgpub2.key from VPS2...", "info", "exchange");
      await sshExecute(currentTunnel.vps1, \`
        mkdir -p /etc/wireguard
        sshpass -p '\${currentTunnel.vps2.password}' scp -o StrictHostKeyChecking=no root@\${currentTunnel.vps2.ip}:/etc/wireguard/wgpub2.key /etc/wireguard/wgpub2.key
      \`);
      addLog("Step 7 Complete: VPS1 received VPS2 public key.", "success", "exchange");

      // Step 8 & 9: VPS2 connects to VPS1 to generate keys
      checkCancel();
      addLog("Step 8 & 9: VPS2 connecting to VPS1 via SSH to generate keys...", "info", "exchange");
      await sshExecute(currentTunnel.vps2, \`
        sshpass -p '\${currentTunnel.vps1.password}' ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 root@\${currentTunnel.vps1.ip} "
          mkdir -p /etc/wireguard
          wg genkey | tee /etc/wireguard/wg0.conf | wg pubkey > /etc/wireguard/wgpub1.key
          chmod 600 /etc/wireguard/wg0.conf
          echo 'VPS1 Keys generated successfully.'
        "
      \`);
      addLog("Step 8 & 9 Complete: VPS1 keys generated via VPS2.", "success", "exchange");

      // Step 10: VPS2 SCPs public key from VPS1
      checkCancel();
      addLog("Step 10: VPS2 copying wgpub1.key from VPS1...", "info", "exchange");
      await sshExecute(currentTunnel.vps2, \`
        mkdir -p /etc/wireguard
        sshpass -p '\${currentTunnel.vps1.password}' scp -o StrictHostKeyChecking=no root@\${currentTunnel.vps1.ip}:/etc/wireguard/wgpub1.key /etc/wireguard/wgpub1.key
      \`);
      addLog("Step 10 Complete: VPS2 received VPS1 public key.", "success", "exchange");

      // Step 11: VPS1 connects to VPS2 to configure wg2.conf
      checkCancel();
      addLog("Step 11: VPS1 configuring wg2.conf on VPS2...", "info", "exchange");
      await sshExecute(currentTunnel.vps1, \`
        sshpass -p '\${currentTunnel.vps2.password}' ssh -o StrictHostKeyChecking=no root@\${currentTunnel.vps2.ip} "
          PRIV_KEY=\\\$(cat /etc/wireguard/wg0.conf)
          PEER_PUB=\\\$(cat /etc/wireguard/wgpub1.key)
          DEFAULT_IFACE=\\\$(ip route ls default | awk '{print \\$5}' | head -n 1)
          cat > /etc/wireguard/wg2.conf << EOF
[Interface]
PrivateKey = \\$PRIV_KEY
Address = 10.9.0.2/24
ListenPort = 51820
PostUp = iptables -A FORWARD -i wg2 -j ACCEPT; iptables -t nat -A POSTROUTING -o \\$DEFAULT_IFACE -j MASQUERADE
PostDown = iptables -D FORWARD -i wg2 -j ACCEPT; iptables -t nat -D POSTROUTING -o \\$DEFAULT_IFACE -j MASQUERADE

[Peer]
PublicKey = \\$PEER_PUB
AllowedIPs = 10.9.0.1/32, 10.8.0.0/24
EOF
          echo 'wg2.conf created on VPS2.'
        "
      \`);
      addLog("Step 11 Complete: wg2.conf created on VPS2.", "success", "exchange");

      // Step 12: VPS2 connects to VPS1 to configure wg1.conf
      checkCancel();
      addLog("Step 12: VPS2 configuring wg1.conf on VPS1...", "info", "exchange");
      await sshExecute(currentTunnel.vps2, \`
        sshpass -p '\${currentTunnel.vps1.password}' ssh -o StrictHostKeyChecking=no root@\${currentTunnel.vps1.ip} "
          PRIV_KEY=\\\$(cat /etc/wireguard/wg0.conf)
          PEER_PUB=\\\$(cat /etc/wireguard/wgpub2.key)
          cat > /etc/wireguard/wg1.conf << EOF
[Interface]
PrivateKey = \\$PRIV_KEY
Address = 10.9.0.1/24
ListenPort = 51820
FwMark = 51820
Table = off
PostUp = ip rule add not fwmark 51820 table 51820; ip route add default dev wg1 table 51820; iptables -t nat -A POSTROUTING -o wg1 -j MASQUERADE
PostDown = ip rule del not fwmark 51820 table 51820; ip route del default dev wg1 table 51820; iptables -t nat -D POSTROUTING -o wg1 -j MASQUERADE

[Peer]
PublicKey = \\$PEER_PUB
Endpoint = \${currentTunnel.vps2.ip}:51820
AllowedIPs = 0.0.0.0/0
PersistentKeepalive = 25
EOF
          echo 'wg1.conf created on VPS1.'
        "
      \`);
      addLog("Step 12 Complete: wg1.conf created on VPS1.", "success", "exchange");

      // Step 13: Launch wireguard on both VPS and verify secure tunnel
      checkCancel();
      addLog("Step 13: Launching WireGuard on both servers...", "info", "exchange");
      await sshExecute(currentTunnel.vps2, "systemctl enable wg-quick@wg2 && systemctl restart wg-quick@wg2");
      await sshExecute(currentTunnel.vps1, "systemctl enable wg-quick@wg1 && systemctl restart wg-quick@wg1");
      
      addLog("Verifying secure tunnel (VPS1 pinging VPS2)...", "info", "exchange");
      const pingRes = await sshExecute(currentTunnel.vps1, "ping -c 3 10.9.0.2");
      if (pingRes.code === 0) {
        addLog("Secure tunnel verified successfully!", "success", "exchange");
      } else {
        addLog("Tunnel verification failed. Ping to 10.9.0.2 did not succeed.", "warn", "exchange");
      }

      // Step 14: On VPS1 to configure wireguard for external peers interface
      checkCancel();
      addLog("Step 14: Configuring external peers interface (wg-easy) on VPS1...", "info", "vps1");
      await sshExecute(currentTunnel.vps1, \`
        docker stop wg-easy || true
        docker rm wg-easy || true
        echo "net.ipv4.ip_forward=1" > /etc/sysctl.d/99-wireguard.conf
        sysctl -p /etc/sysctl.d/99-wireguard.conf
        
        docker run -d \\
          --name=wg-easy \\
          -e WG_HOST=\${currentTunnel.vps1.ip} \\
          -e PASSWORD=admin \\
          -e WG_DEFAULT_DNS=1.1.1.1 \\
          -e WG_DEFAULT_ADDRESS=10.8.0.x \\
          -e WG_ALLOWED_IPS=0.0.0.0/0 \\
          -v ~/.wg-easy:/etc/wireguard \\
          -p 51821:51820/udp \\
          -p 51822:51821/tcp \\
          --cap-add=NET_ADMIN \\
          --cap-add=SYS_MODULE \\
          --sysctl="net.ipv4.conf.all.src_valid_mark=1" \\
          --sysctl="net.ipv4.ip_forward=1" \\
          --restart unless-stopped \\
          weejewel/wg-easy
      \`);
      addLog("Step 14 Complete: wg-easy started on VPS1.", "success", "vps1");

      updateActiveTunnel({ status: 'active' });
      addLog("Double VPN Deployment Successful!", "success", "exchange");
      setIsDeploying(false);
      setActiveTab("vps1");

    } catch (error: any) {
      if (error.message === 'Deployment Cancelled') {
        addLog("Deployment was cancelled by the user.", "warn", "exchange");
      } else {
        addLog(\`Deployment Failed: \${error.message}\`, "error", "exchange");
      }
      updateActiveTunnel({ status: 'failed' });
      setIsDeploying(false);
    }
  };
`;

const newContent = content.substring(0, startIdx) + newFunction + content.substring(endIdx);
fs.writeFileSync('src/App.tsx', newContent);
console.log('Replaced startDeployment successfully');
