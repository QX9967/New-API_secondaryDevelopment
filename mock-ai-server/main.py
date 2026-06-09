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

app = FastAPI(title="Mock AI Provider")

client = httpx.AsyncClient(timeout=120.0)


@app.on_event("shutdown")
async def shutdown():
    await client.aclose()

# ============= 硬编码配置 =============
UPSTREAM_URL = "https://token-plan-cn.xiaomimimo.com"
UPSTREAM_KEY = "tp-cx8y8s5wi874di86v5lwqrerk1dx0y8xjegh0fq8gn1ndjzy"
ENCRYPTION_KEY = "Dgp47/nkakUdFT0EHXxIntZSt6+RXgULphevrfCgYiM="  # 填入你的加密密钥，留空则不加密
# =======================================


# ============= Encryption Support =============

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


# ============= Routes =============

@app.get("/")
async def root():
    return {
        "message": "Mock AI Provider Server",
        "status": "running",
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

    print_separator("REQUEST RECEIVED")
    print(f"[Header] X-Encryption-Enabled: {x_encryption_enabled}")
    print(f"[Raw Body Length]: {len(raw_body)} bytes")

    # 解密请求
    if is_encrypted and ENCRYPTION_KEY:
        try:
            print("\n[Decrypting request...]")
            print(f"[Encrypted Body (hex)]: {raw_body[:50].hex()}...")
            decrypted_body = decrypt_data(raw_body, ENCRYPTION_KEY)
            print(f"[Decrypted Body]:")
            print("-" * 40)
            print(decrypted_body.decode('utf-8'))
            print("-" * 40)
            body = decrypted_body
        except Exception as e:
            print(f"[Decryption Error]: {e}")
            return JSONResponse(
                status_code=400,
                content={"error": {"message": f"Decryption failed: {str(e)}"}}
            )
    else:
        body = raw_body
        print(f"[Body (plaintext)]:")
        print("-" * 40)
        print(body.decode('utf-8')[:300])
        print("-" * 40)

    # 解析请求
    try:
        req_data = json.loads(body)
        model = req_data.get("model", "unknown")
        stream = req_data.get("stream", False)
        messages = req_data.get("messages", [])
        last_msg = messages[-1].get("content", "")[:50] if messages else ""
        print(f"\n[Request Info]")
        print(f"  Model: {model}")
        print(f"  Stream: {stream}")
        print(f"  Message: {last_msg}...")
    except:
        stream = False

    # 转发请求
    headers = {
        "Authorization": f"Bearer {UPSTREAM_KEY}",
        "Content-Type": "application/json",
    }

    print(f"\n[Forwarding to]: {UPSTREAM_URL}")

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
                                    print(f"[Chunk {chunk_count}] Encrypted: {encrypted[:20].hex()}...")
                            except Exception as e:
                                print(f"[Encryption Error]: {e}")
                        else:
                            yield f"data: {payload}\n\n"
                            if chunk_count <= 3:
                                print(f"[Chunk {chunk_count}]: {payload[:60]}...")
                print(f"[Total Chunks]: {chunk_count}")

        return StreamingResponse(
            generate(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache"}
        )
    else:
        resp = await client.post(
            f"{UPSTREAM_URL}/v1/chat/completions",
            headers=headers,
            content=body,
            timeout=120.0
        )
        response_data = resp.json()

        print_separator("RESPONSE")

        if is_encrypted and ENCRYPTION_KEY:
            try:
                response_json = json.dumps(response_data)
                print(f"[Response (plaintext)]:")
                print("-" * 40)
                print(response_json[:300])
                print("-" * 40)
                encrypted = encrypt_data(response_json.encode('utf-8'), ENCRYPTION_KEY)
                print(f"[Response (encrypted)]:")
                print(f"  Length: {len(encrypted)} bytes")
                print(f"  Hex: {encrypted[:50].hex()}...")
                return Response(
                    content=encrypted,
                    media_type="application/json",
                    headers={"X-Encryption-Enabled": "true"}
                )
            except Exception as e:
                print(f"[Encryption Error]: {e}")
                return response_data
        else:
            print(f"[Response (plaintext)]:")
            print("-" * 40)
            print(json.dumps(response_data, indent=2)[:300])
            print("-" * 40)
            return response_data


if __name__ == "__main__":
    import uvicorn

    print()
    print("=" * 60)
    print("  Mock AI Provider Server")
    print("=" * 60)
    print(f"  Upstream:  {UPSTREAM_URL}")
    print(f"  Encryption: {'Enabled' if ENCRYPTION_KEY else 'Disabled'}")
    print(f"  Local:     http://localhost:8080")
    print("=" * 60)
    print()

    uvicorn.run(app, host="0.0.0.0", port=8080)
