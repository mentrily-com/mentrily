#!/bin/bash
CMD="$1"
INSTANCE_ID="i-0d5a5dd315aba5853"
REGION="ap-south-1"

COMMAND_ID=$(aws ssm send-command \
  --instance-ids "$INSTANCE_ID" \
  --document-name "AWS-RunShellScript" \
  --parameters commands=["$CMD"] \
  --region "$REGION" \
  --query "Command.CommandId" \
  --output text)

aws ssm wait command-executed --command-id "$COMMAND_ID" --instance-id "$INSTANCE_ID" --region "$REGION" || true
aws ssm get-command-invocation --command-id "$COMMAND_ID" --instance-id "$INSTANCE_ID" --region "$REGION" --query "StandardOutputContent" --output text
echo "STDERR:"
aws ssm get-command-invocation --command-id "$COMMAND_ID" --instance-id "$INSTANCE_ID" --region "$REGION" --query "StandardErrorContent" --output text
