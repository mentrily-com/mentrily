#!/bin/bash
OLD_INSTANCE_ID="i-0699591dd88fda9c0"
AMI_ID="ami-06cc5ebfb8571a147"
SUBNET_ID="subnet-00dac7063962283ab"
SG_ID="sg-04968992655aae0d1"
KEY_NAME="selfhost-tools-key"
IAM_PROFILE="Judge0SSMProfile"

echo "Terminating old instance $OLD_INSTANCE_ID..."
aws ec2 terminate-instances --instance-ids $OLD_INSTANCE_ID > /dev/null

cat << 'USERDATA' > userdata.sh
#!/bin/bash
exec > >(tee /var/log/user-data.log|logger -t user-data -s 2>/dev/console) 2>&1
set -x

# 1. Update and install Docker
apt-get update -y
apt-get install -y apt-transport-https ca-certificates curl software-properties-common wget jq
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | apt-key add -
add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" -y
apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Also install standalone docker-compose for convenience
curl -L "https://github.com/docker/compose/releases/download/v2.24.5/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# 2. Setup Judge0 CE 1.13.1
mkdir -p /opt/judge0/judge0-v1.13.1
cd /opt/judge0/judge0-v1.13.1

# Download release files
wget -qO judge0.conf https://github.com/judge0/judge0/releases/download/v1.13.1/judge0.conf
wget -qO docker-compose.yml https://github.com/judge0/judge0/releases/download/v1.13.1/docker-compose.yml

# Set Auth Token and IPs
sed -i 's/^AUTHN_TOKEN=.*/AUTHN_TOKEN="cdf65ebb8d5bc27865f532c4589cc039ce0eea19a5c542c1ee0b4718c7085a50"/' judge0.conf
sed -i 's/^AUTHN_HEADER=.*/AUTHN_HEADER="X-Auth-Token"/' judge0.conf
# Allow internal VPC subnet 172.31.0.0/16
sed -i 's/^ALLOW_IP=.*/ALLOW_IP="172.31.0.0\/16, 127.0.0.1"/' judge0.conf
# Configure redis password to match the one generated previously (or keep a static one)
echo 'REDIS_PASSWORD=1a8a356c14d1028cfcca4cc2730331bda5969508d0f4972f' >> judge0.conf
echo 'POSTGRES_PASSWORD=3863b5c8faae93910312b426cb495ebbbd5eb9b2eab9f9ed' >> judge0.conf

# Modify docker-compose.yml to include the isolate shared volume
cat << 'DOCKERCOMPOSE' > docker-compose.yml
x-logging:
  &default-logging
  logging:
    driver: json-file
    options:
      max-size: 100M

services:
  server:
    image: judge0/judge0:1.13.1
    volumes:
      - ./judge0.conf:/judge0.conf:ro
      - isolate:/var/local/lib/isolate
    ports:
      - "2358:2358"
    privileged: true
    <<: *default-logging
    restart: always

  workers:
    image: judge0/judge0:1.13.1
    command: ["./scripts/workers"]
    volumes:
      - ./judge0.conf:/judge0.conf:ro
      - isolate:/var/local/lib/isolate
    privileged: true
    <<: *default-logging
    restart: always

  db:
    image: postgres:16.2
    env_file: judge0.conf
    volumes:
      - data:/var/lib/postgresql/data/
    <<: *default-logging
    restart: always

  redis:
    image: redis:7.2.4
    command: [
      "bash", "-c",
      'docker-entrypoint.sh --appendonly no --requirepass "$$REDIS_PASSWORD"'
    ]
    env_file: judge0.conf
    <<: *default-logging
    restart: always

volumes:
  data:
  isolate:
DOCKERCOMPOSE

# Start Judge0
docker-compose up -d
USERDATA

echo "Launching new Ubuntu 20.04 instance for Judge0 CE..."
NEW_INSTANCE_ID=$(aws ec2 run-instances \
  --image-id $AMI_ID \
  --instance-type m7i-flex.large \
  --subnet-id $SUBNET_ID \
  --security-group-ids $SG_ID \
  --key-name $KEY_NAME \
  --iam-instance-profile Name=$IAM_PROFILE \
  --user-data file://userdata.sh \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=judge0-ce}]' \
  --query 'Instances[0].InstanceId' \
  --output text)

echo "New Instance ID: $NEW_INSTANCE_ID"

echo "Waiting for instance to be running..."
aws ec2 wait instance-running --instance-ids $NEW_INSTANCE_ID

NEW_IP=$(aws ec2 describe-instances --instance-ids $NEW_INSTANCE_ID --query 'Reservations[0].Instances[0].PrivateIpAddress' --output text)
echo "New Private IP: $NEW_IP"
echo $NEW_IP > new_judge0_ip.txt
