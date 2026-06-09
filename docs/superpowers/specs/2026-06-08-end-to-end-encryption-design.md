# 端到端加密设计文档

## 概述

为new-api项目添加端到端加密功能，允许用户在渠道级别配置是否启用AES-256-GCM加密，确保请求和响应在传输过程中的安全性。

## 需求

- 在渠道配置中添加"启用加密"选项
- 只有配置了加密的渠道才进行加密处理
- 支持流式响应的加密/解密
- 使用AES-256-GCM算法

## 架构设计

### 1. 配置层级

**渠道级别配置**（在ChannelSettings中添加）：

```go
type ChannelSettings struct {
    // ... 现有字段
    EncryptionEnabled bool   `json:"encryption_enabled,omitempty"` // 是否启用加密
    EncryptionKey     string `json:"encryption_key,omitempty"`     // 加密密钥（Base64编码的32字节）
}
```

### 2. 加密算法

- **算法**：AES-256-GCM
- **密钥长度**：32字节（256位）
- **Nonce长度**：12字节
- **认证标签**：16字节

### 3. 数据格式

加密后的数据格式：
```
[12字节nonce][密文][16字节认证标签]
```

### 4. 流式响应处理

流式响应（SSE）格式：
```
data: [加密数据]\n\n
```

每个SSE事件单独加密，保持SSE格式不变。

## 实现步骤

### 1. 后端修改

#### 1.1 添加加密工具函数

在`common/crypto.go`中添加：
```go
// AESEncryptGCM AES-256-GCM加密
func AESEncryptGCM(key []byte, plaintext []byte) ([]byte, error)

// AESDecryptGCM AES-256-GCM解密
func AESDecryptGCM(key []byte, ciphertext []byte) ([]byte, error)

// GenerateEncryptionKey 生成随机加密密钥
func GenerateEncryptionKey() (string, error)
```

#### 1.2 修改渠道配置

在`dto/channel_settings.go`中添加：
```go
type ChannelSettings struct {
    // ... 现有字段
    EncryptionEnabled bool   `json:"encryption_enabled,omitempty"`
    EncryptionKey     string `json:"encryption_key,omitempty"`
}
```

#### 1.3 修改请求发送逻辑

在`relay/channel/api_request.go`的`DoApiRequest`函数中：
1. 检查渠道是否启用加密
2. 如果启用，加密请求体
3. 发送加密后的请求
4. 解密响应（支持流式）

#### 1.4 修改响应处理

在`relay/helper/stream_scanner.go`中：
1. 检测是否为加密响应
2. 解密每个SSE事件
3. 返回明文数据

### 2. 前端修改

#### 2.1 渠道编辑页面

在渠道编辑页面添加：
- **启用加密**开关
- **加密密钥**输入框（当启用加密时显示）
- **生成密钥**按钮

#### 2.2 密钥管理

- 密钥使用Base64编码存储
- 支持生成随机密钥
- 密钥验证（检查长度是否为32字节）

## 安全考虑

1. **密钥存储**：密钥存储在数据库中，建议对敏感字段加密存储
2. **密钥传输**：前端显示密钥时使用密码字段
3. **密钥验证**：验证密钥长度和格式
4. **错误处理**：加密/解密失败时返回明确错误信息

## 兼容性

1. **向后兼容**：未启用加密的渠道正常工作
2. **流式响应**：保持SSE格式，只加密data内容
3. **错误处理**：加密失败时返回原始响应

## 测试计划

1. 单元测试：加密/解密函数测试
2. 集成测试：请求/响应加密测试
3. 流式测试：流式响应加密测试
4. 兼容性测试：未加密渠道测试
