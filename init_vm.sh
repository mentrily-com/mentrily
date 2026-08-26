#!/bin/bash
exec > >(tee /var/log/user-data.log|logger -t user-data -s 2>/dev/console) 2>&1
set -ex

# 1. Update OS & enable cgroup v1 for Judge0 sandbox isolate
sed -i 's/GRUB_CMDLINE_LINUX_DEFAULT="/GRUB_CMDLINE_LINUX_DEFAULT="systemd.unified_cgroup_hierarchy=0 systemd.legacy_systemd_cgroup_controller=1 /g' /etc/default/grub
update-grub || true

# 2. Fix Oracle Cloud iptables to permit ports 80 & 443
iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT || true
iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT || true
netfilter-persistent save || true

# 3. Setup Anti-Idle Reclamation Keepalive Service (Maintains ~22% baseline load with lowest priority)
apt-get update -y
apt-get install -y stress-ng ca-certificates curl gnupg lsb-release git jq ufw

cat << 'KEEPALIVE' > /etc/systemd/system/oci-keepalive.service
[Unit]
Description=OCI Always Free Anti-Idle Keepalive Service
After=network.target

[Service]
Type=simple
Nice=19
CPUSchedulingPolicy=idle
ExecStart=/usr/bin/stress-ng --cpu 2 --cpu-load 22 --vm 1 --vm-bytes 2G --quiet
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
KEEPALIVE

systemctl daemon-reload
systemctl enable oci-keepalive.service
systemctl start oci-keepalive.service

# 4. Install Docker and Docker Compose
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 5. Configure Docker Log Rotation
cat << 'DAEMON' > /etc/docker/daemon.json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "20m",
    "max-file": "3"
  }
}
DAEMON

systemctl enable docker
systemctl restart docker
usermod -aG docker ubuntu

# 6. Daily Automated Cleanup Cron
cat << 'CRON' > /etc/cron.daily/docker-cleanup
#!/bin/bash
docker image prune -af --filter "until=24h"
docker container prune -f
CRON
chmod +x /etc/cron.daily/docker-cleanup

# 7. Create App Directories
mkdir -p /opt/blockscode/judge0
mkdir -p /opt/blockscode/backend
mkdir -p /opt/blockscode/caddy

# 8. Setup Caddyfile for api.mentrily.com and judge.mentrily.com
cat << 'CADDY' > /opt/blockscode/caddy/Caddyfile
api.mentrily.com {
    reverse_proxy backend:3000 {
        header_up X-Forwarded-Proto https
        header_up X-Real-IP {remote_host}
    }
}

judge.mentrily.com {
    reverse_proxy judge0-server:2358 {
        header_up X-Forwarded-Proto https
        header_up X-Real-IP {remote_host}
    }
}
CADDY

# 9. Setup Judge0 configuration
cd /opt/blockscode/judge0
wget -qO judge0.conf https://github.com/judge0/judge0/releases/download/v1.13.1/judge0.conf || true
sed -i 's/^AUTHN_TOKEN=.*/AUTHN_TOKEN="cdf65ebb8d5bc27865f532c4589cc039ce0eea19a5c542c1ee0b4718c7085a50"/' judge0.conf || true
sed -i 's/^AUTHN_HEADER=.*/AUTHN_HEADER="X-Auth-Token"/' judge0.conf || true
echo 'REDIS_PASSWORD=1a8a356c14d1028cfcca4cc2730331bda5969508d0f4972f' >> judge0.conf
echo 'POSTGRES_PASSWORD=3863b5c8faae93910312b426cb495ebbbd5eb9b2eab9f9ed' >> judge0.conf

# 10. Setup master docker-compose.yml
cat << 'COMPOSE' > /opt/blockscode/docker-compose.yml
version: '3.8'

services:
  caddy:
    image: caddy:2-alpine
    container_name: caddy_proxy
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./caddy/Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    networks:
      - app_network

  backend:
    image: ghcr.io/mentrily-com/mentrily/backend:latest
    container_name: blockscode_backend
    restart: always
    env_file:
      - ./backend.env
    environment:
      - NODE_ENV=production
      - PORT=3000
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - CODE_EXECUTION_ENGINE=judge0
      - JUDGE0_API_URL=http://judge0-server:2358
      - JUDGE0_AUTH_TOKEN=cdf65ebb8d5bc27865f532c4589cc039ce0eea19a5c542c1ee0b4718c7085a50
    depends_on:
      - redis
      - judge0-server
    networks:
      - app_network

  redis:
    image: redis:7-alpine
    container_name: backend_redis
    restart: always
    command: ["redis-server", "--maxmemory", "1gb", "--maxmemory-policy", "volatile-lru"]
    volumes:
      - backend_redis_data:/data
    networks:
      - app_network

  judge0-server:
    image: judge0/judge0:1.13.1
    container_name: judge0_server
    restart: always
    privileged: true
    volumes:
      - ./judge0/judge0.conf:/judge0.conf:ro
      - judge0_isolate:/var/local/lib/isolate
    depends_on:
      - judge0-db
      - judge0-redis
    networks:
      - app_network

  judge0-workers:
    image: judge0/judge0:1.13.1
    container_name: judge0_workers
    command: ["./scripts/workers"]
    restart: always
    privileged: true
    volumes:
      - ./judge0/judge0.conf:/judge0.conf:ro
      - judge0_isolate:/var/local/lib/isolate
    depends_on:
      - judge0-db
      - judge0-redis
    networks:
      - app_network

  judge0-db:
    image: postgres:16.2
    container_name: judge0_postgres
    restart: always
    env_file:
      - ./judge0/judge0.conf
    volumes:
      - judge0_db_data:/var/lib/postgresql/data/
    networks:
      - app_network

  judge0-redis:
    image: redis:7.2.4
    container_name: judge0_redis
    restart: always
    command: ["bash", "-c", 'docker-entrypoint.sh --appendonly no --requirepass "$$REDIS_PASSWORD"']
    env_file:
      - ./judge0/judge0.conf
    volumes:
      - judge0_redis_data:/data
    networks:
      - app_network

volumes:
  caddy_data:
  caddy_config:
  backend_redis_data:
  judge0_db_data:
  judge0_redis_data:
  judge0_isolate:

networks:
  app_network:
    driver: bridge
COMPOSE

chown -R ubuntu:ubuntu /opt/blockscode
