cd /home/ubuntu/vm-home-backup/project/T5_TuyaOS-3.13.6/software/TuyaOS/apps/tuyaos_demo_wukong_ai/scripts

export TUYA_MCP_ENDPOINT=https://mcp.tuyacn.com
export TUYA_MCP_ACCESS_ID=98d71965b00318345e8a2c988d4d46b8b4e42397d90a7808e709a15bfabcf2f3
export TUYA_MCP_ACCESS_SECRET=kySHnlh9IMogW2NRAqRbsSL87EwS0VQz

export PEIBAN_MCP_ENDPOINT=http://127.0.0.1:3000/mcp
export PEIBAN_MCP_HMAC_SECRET=和后端AI_GATEWAY_HMAC_SECRET一致的值

# 本地单设备测试可先用这个；生产应从涂鸦meta或映射表解析真实设备ID
export PEIBAN_DEFAULT_DEVICE_ID=mock_robot_001

python3 peiban_tuya_mcp_service.py