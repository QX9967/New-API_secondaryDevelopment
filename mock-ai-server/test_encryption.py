"""测试加密解密功能"""

import base64
import json
import secrets

def generate_key():
    """生成32字节随机密钥，返回Base64编码"""
    key = secrets.token_bytes(32)
    return base64.b64encode(key).decode('utf-8')


def encrypt_data(plaintext: bytes, key_base64: str) -> bytes:
    """AES-256-GCM 加密"""
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    
    key = base64.b64decode(key_base64)
    nonce = secrets.token_bytes(12)
    
    aesgcm = AESGCM(key)
    ciphertext = aesgcm.encrypt(nonce, plaintext, None)
    return nonce + ciphertext


def decrypt_data(ciphertext: bytes, key_base64: str) -> bytes:
    """AES-256-GCM 解密"""
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    
    key = base64.b64decode(key_base64)
    nonce = ciphertext[:12]
    actual_ciphertext = ciphertext[12:]
    
    aesgcm = AESGCM(key)
    plaintext = aesgcm.decrypt(nonce, actual_ciphertext, None)
    return plaintext


def main():
    print("=" * 60)
    print("  Encryption Test")
    print("=" * 60)
    
    # 生成密钥
    key = generate_key()
    print(f"\n[Generated Key]: {key}")
    print(f"[Key Length]: {len(base64.b64decode(key))} bytes")
    
    # 测试数据
    test_data = {
        "model": "gpt-4",
        "messages": [
            {"role": "user", "content": "Hello, this is a test message!"}
        ],
        "stream": False
    }
    
    plaintext = json.dumps(test_data, indent=2).encode('utf-8')
    
    print(f"\n[Original Data]:")
    print("-" * 40)
    print(plaintext.decode('utf-8'))
    print("-" * 40)
    print(f"[Size]: {len(plaintext)} bytes")
    
    # 加密
    encrypted = encrypt_data(plaintext, key)
    
    print(f"\n[Encrypted Data]:")
    print("-" * 40)
    print(f"[Hex]: {encrypted.hex()}")
    print(f"[Size]: {len(encrypted)} bytes")
    print("-" * 40)
    
    # 解密
    decrypted = decrypt_data(encrypted, key)
    
    print(f"\n[Decrypted Data]:")
    print("-" * 40)
    print(decrypted.decode('utf-8'))
    print("-" * 40)
    
    # 验证
    if decrypted == plaintext:
        print("\n[SUCCESS] Encryption and decryption work correctly!")
    else:
        print("\n[FAILED] Decrypted data does not match original!")
    
    print("\n" + "=" * 60)
    print("  Use this key in both new-api and mock server:")
    print(f"  {key}")
    print("=" * 60)


if __name__ == "__main__":
    try:
        main()
    except ImportError:
        print("Installing cryptography...")
        import subprocess
        subprocess.run(["pip", "install", "cryptography", "-q"])
        main()
