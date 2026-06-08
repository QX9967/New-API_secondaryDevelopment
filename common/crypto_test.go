package common

import (
	"testing"
)

func TestAESEncryptDecryptGCM(t *testing.T) {
	key, err := GenerateEncryptionKey()
	if err != nil {
		t.Fatalf("GenerateEncryptionKey failed: %v", err)
	}

	plaintext := []byte("Hello, World! This is a test message.")

	ciphertext, err := AESEncryptGCM(key, plaintext)
	if err != nil {
		t.Fatalf("AESEncryptGCM failed: %v", err)
	}

	decrypted, err := AESDecryptGCM(key, ciphertext)
	if err != nil {
		t.Fatalf("AESDecryptGCM failed: %v", err)
	}

	if string(decrypted) != string(plaintext) {
		t.Errorf("Decrypted text mismatch: got %s, want %s", string(decrypted), string(plaintext))
	}
}

func TestAESEncryptGCMInvalidKey(t *testing.T) {
	invalidKey := "short-key"
	plaintext := []byte("test")

	_, err := AESEncryptGCM(invalidKey, plaintext)
	if err == nil {
		t.Error("Expected error for invalid key length, got nil")
	}
}

func TestAESDecryptGCMInvalidCiphertext(t *testing.T) {
	key, _ := GenerateEncryptionKey()

	invalidCiphertext := []byte("short")
	_, err := AESDecryptGCM(key, invalidCiphertext)
	if err == nil {
		t.Error("Expected error for invalid ciphertext, got nil")
	}
}
