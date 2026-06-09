# Mock AI Provider Server

代理模式的模拟服务器，支持端到端加密测试。

## 启动

```bash
cd mock-ai-server
pip install -r requirements.txt
python main.py
```

启动时会提示配置：

```
============================================================
  Mock AI Provider Server Setup
============================================================

  Step 1: Upstream API Key
  ─────────────────────────────────────────
  Upstream URL: https://www.packyapi.com

  Enter the API key for upstream (packyapi.com):
  Key: sk-w2XQ58U5edcBVOmaWMo7zg5U1WwNL0PD3iLDVfF38wJGrdiy

  [OK] Upstream key: sk-w2XQ58U5edcBVOm...

  Step 2: Encryption Setup
  ─────────────────────────────────────────
  Do you want to enable encryption? (y/n): y

  Enter the encryption key:
  Key: E/c4Irg/kv43iCeRYEulhMJCfLV5TUC0b6O0joRXGsc=

  [OK] Encryption enabled

============================================================
  Configuration Summary
============================================================
  Upstream URL:  https://www.packyapi.com
  Upstream Key:  sk-w2XQ58U5edcBVOm...
  Encryption:    Enabled
============================================================

  In new-api channel settings:
  - Base URL: http://localhost:8080
  - API Key: any-value (e.g. 'test')
  - Enable Encryption: Yes
  - Encryption Key: E/c4Irg/kv43iCeRYEulhMJCfLV5TUC0b6O0joRXGsc=
```

## 在 new-api 中配置

| 字段 | 值 |
|------|-----|
| Base URL | `http://localhost:8080` |
| API Key | 任意值（如 `test`） |
| 启用加密 | ✅ |
| 加密密钥 | 与模拟服务器相同 |

## 测试流程

1. 启动模拟服务器，输入上游 key 和加密 key
2. 在 new-api 创建渠道，配置相同的加密 key
3. 发送请求
4. 模拟服务器会显示加密前后的数据

## 生成加密密钥

```bash
python test_encryption.py
```
