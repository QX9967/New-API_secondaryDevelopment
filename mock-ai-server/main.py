"""
Mock AI Provider Server (Proxy Mode)
转发请求到真实AI提供商，支持端到端加密测试
"""

import json
import time
import uuid
import os
import base64
from typing import Optional

import httpx
from fastapi import FastAPI, Request, Header
from fastapi.responses import StreamingResponse, JSONResponse, Response

app = FastAPI(title="模拟 AI 供应商")

client = httpx.AsyncClient(timeout=120.0)


@app.on_event("shutdown")
async def shutdown():
    await client.aclose()

# ============= 硬编码配置 =============
UPSTREAM_URL = "https://token-plan-cn.xiaomimimo.com"
UPSTREAM_KEY = "tp-cx8y8s5wi874di86v5lwqrerk1dx0y8xjegh0fq8gn1ndjzy"
ENCRYPTION_KEY = "Dgp47/nkakUdFT0EHXxIntZSt6+RXgULphevrfCgYiM="  # 填入你的加密密钥，留空则不加密
# =======================================


# ============= 加密支持 =============

def decrypt_data(ciphertext: bytes, key_base64: str) -> bytes:
    """AES-256-GCM 解密"""
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    key = base64.b64decode(key_base64)
    nonce = ciphertext[:12]
    actual_ciphertext = ciphertext[12:]
    aesgcm = AESGCM(key)
    return aesgcm.decrypt(nonce, actual_ciphertext, None)


def encrypt_data(plaintext: bytes, key_base64: str) -> bytes:
    """AES-256-GCM 加密"""
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    import secrets
    key = base64.b64decode(key_base64)
    nonce = secrets.token_bytes(12)
    aesgcm = AESGCM(key)
    ciphertext = aesgcm.encrypt(nonce, plaintext, None)
    return nonce + ciphertext


def print_separator(title: str):
    print()
    print("=" * 60)
    print(f"  {title}")
    print("=" * 60)


# ============= 路由 =============

@app.get("/")
async def root():
    return {
        "message": "模拟 AI 供应商服务器",
        "status": "运行中",
        "upstream": UPSTREAM_URL,
        "encryption_enabled": bool(ENCRYPTION_KEY)
    }


@app.get("/v1/models")
async def list_models():
    """转发模型列表请求"""
    headers = {"Authorization": f"Bearer {UPSTREAM_KEY}"}
    resp = await client.get(
        f"{UPSTREAM_URL}/v1/models",
        headers=headers,
        timeout=30.0
    )
    return resp.json()


@app.post("/v1/chat/completions")
async def chat_completions(
    request: Request,
    x_encryption_enabled: Optional[str] = Header(None)
):
    """转发聊天完成请求"""
    raw_body = await request.body()
    is_encrypted = x_encryption_enabled == "true"

    print_separator("收到请求")
    print(f"[请求头] X-Encryption-Enabled: {x_encryption_enabled}")
    print(f"[原始请求体长度]: {len(raw_body)} 字节")

    # 解密请求
    if is_encrypted and ENCRYPTION_KEY:
        try:
            print("\n[正在解密请求...]")
            print(f"[加密请求体 (十六进制)]: {raw_body[:50].hex()}...")
            decrypted_body = decrypt_data(raw_body, ENCRYPTION_KEY)
            print(f"[解密后请求体]:")
            print("-" * 40)
            print(decrypted_body.decode('utf-8'))
            print("-" * 40)
            body = decrypted_body
        except Exception as e:
            print(f"[解密失败]: {e}")
            return JSONResponse(
                status_code=400,
                content={"error": {"message": f"解密失败: {str(e)}"}}
            )
    else:
        body = raw_body
        print(f"[请求体 (明文)]:")
        print("-" * 40)
        print(body.decode('utf-8')[:300])
        print("-" * 40)

    # 解析请求
    stream = False
    try:
        req_data = json.loads(body)
        model = req_data.get("model", "unknown")
        stream = req_data.get("stream", False)
        messages = req_data.get("messages", [])
        reasoning_effort = req_data.get("reasoning_effort")
        thinking = req_data.get("thinking")
        last_msg = messages[-1].get("content", "")[:50] if messages else ""
        print(f"\n[请求信息]")
        print(f"  模型: {model}")
        print(f"  流式: {stream}")
        if reasoning_effort is not None:
            print(f"  reasoning_effort: {reasoning_effort}")
        if thinking is not None:
            print(f"  thinking: {thinking}")
        print(f"  消息: {last_msg}...")
    except:
        pass

    # 转发请求
    headers = {
        "Authorization": f"Bearer {UPSTREAM_KEY}",
        "Content-Type": "application/json",
    }

    print(f"\n[转发至]: {UPSTREAM_URL}")

    if stream:
        async def generate():
            async with client.stream(
                "POST",
                f"{UPSTREAM_URL}/v1/chat/completions",
                headers=headers,
                content=body,
                timeout=120.0
            ) as resp:
                chunk_count = 0
                async for line in resp.aiter_lines():
                    if line:
                        chunk_count += 1
                        payload = line.removeprefix("data: ").strip()
                        if not payload or payload == "[DONE]":
                            continue
                        if is_encrypted and ENCRYPTION_KEY:
                            try:
                                encrypted = encrypt_data(payload.encode('utf-8'), ENCRYPTION_KEY)
                                yield f"data: {encrypted.hex()}\n\n"
                                if chunk_count <= 3:
                                    print(f"[数据块 {chunk_count}] 已加密: {encrypted[:20].hex()}...")
                            except Exception as e:
                                print(f"[加密失败]: {e}")
                        else:
                            yield f"data: {payload}\n\n"
                            if chunk_count <= 3:
                                print(f"[数据块 {chunk_count}]: {payload[:60]}...")
                print(f"[总数据块数]: {chunk_count}")

        return StreamingResponse(
            generate(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache"}
        )
    else:
        try:
            resp = await client.post(
                f"{UPSTREAM_URL}/v1/chat/completions",
                headers=headers,
                content=body,
                timeout=120.0
            )
            response_data = resp.json()
        except Exception as e:
            print_separator("上游请求失败")
            print(f"  错误: {e}")
            return JSONResponse(
                status_code=502,
                content={"error": {"message": f"upstream request failed: {e}"}}
            )

        print_separator("响应")

        choice = response_data.get("choices", [{}])[0] if response_data.get("choices") else {}
        msg = choice.get("message", {})
        content = msg.get("content") or ""
        reasoning = msg.get("reasoning_content") or ""
        finish = choice.get("finish_reason", "?")
        print(f"  finish_reason: {finish}")
        print(f"  content ({len(content)} chars): {content}")
        if reasoning:
            print(f"  reasoning_content ({len(reasoning)} chars): {reasoning}")

        if is_encrypted and ENCRYPTION_KEY:
            try:
                response_json = json.dumps(response_data)
                encrypted = encrypt_data(response_json.encode('utf-8'), ENCRYPTION_KEY)
                print(f"\n[响应已加密]: {len(encrypted)} 字节")
                return Response(
                    content=encrypted,
                    media_type="application/json",
                    headers={"X-Encryption-Enabled": "true"}
                )
            except Exception as e:
                print(f"[加密失败]: {e}")
                return response_data
        else:
            return response_data


if __name__ == "__main__":
    import uvicorn

    print()
    print("=" * 60)
    print("  模拟 AI 供应商服务器")
    print("=" * 60)
    print(f"  上游地址:  {UPSTREAM_URL}")
    print(f"  加密: {'已启用' if ENCRYPTION_KEY else '未启用'}")
    print(f"  本地地址:  http://localhost:8080")
    print("=" * 60)
    print()

    uvicorn.run(app, host="0.0.0.0", port=8080)
