#!/bin/bash

# 测试 stock-trading-api 的 history 端点
echo "Testing /history endpoint..."

# 使用你的实际token（这里用假token测试，你需要替换）
TOKEN="test_token"
EMAIL="damonxu1982@gmail.com"

# 测试24小时历史
echo -e "\n=== Testing 24h history ==="
curl -s "https://jggzqhlkzqpfxxsrrhwh.supabase.co/functions/v1/stock-trading-api/history?hours=24" \
  -H "clerk-token: ${TOKEN}" \
  -H "x-user-email: ${EMAIL}" \
  -H "Content-Type: application/json" | python3 -m json.tool 2>&1 | head -100

echo -e "\n=== Done ==="
