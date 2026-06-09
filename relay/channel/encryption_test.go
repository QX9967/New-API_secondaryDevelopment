package channel

import (
	"io"
	"testing"

	"github.com/QuantumNous/new-api/common"
)

func TestEncryptRequestBody(t *testing.T) {
	key, err := common.GenerateEncryptionKey()
	if err != nil {
		t.Fatalf("GenerateEncryptionKey failed: %v", err)
	}

	plaintext := []byte(`{"model":"gpt-4","messages":[{"role":"user","content":"Hello"}]}`)

	encrypted, err := EncryptRequestBody(key, plaintext)
	if err != nil {
		t.Fatalf("EncryptRequestBody failed: %v", err)
	}

	if len(encrypted) == 0 {
		t.Error("Encrypted data is empty")
	}

	decrypted, err := common.AESDecryptGCM(key, encrypted)
	if err != nil {
		t.Fatalf("AESDecryptGCM failed: %v", err)
	}

	if string(decrypted) != string(plaintext) {
		t.Errorf("Decrypted text mismatch: got %s, want %s", string(decrypted), string(plaintext))
	}
}

func TestDecryptResponseBody(t *testing.T) {
	key, err := common.GenerateEncryptionKey()
	if err != nil {
		t.Fatalf("GenerateEncryptionKey failed: %v", err)
	}

	plaintext := []byte(`{"choices":[{"message":{"content":"Hello!"}}]}`)

	encrypted, err := common.AESEncryptGCM(key, plaintext)
	if err != nil {
		t.Fatalf("AESEncryptGCM failed: %v", err)
	}

	decrypted, err := DecryptResponseBody(key, encrypted)
	if err != nil {
		t.Fatalf("DecryptResponseBody failed: %v", err)
	}

	if string(decrypted) != string(plaintext) {
		t.Errorf("Decrypted text mismatch: got %s, want %s", string(decrypted), string(plaintext))
	}
}

func TestEncryptRequestReader(t *testing.T) {
	key, err := common.GenerateEncryptionKey()
	if err != nil {
		t.Fatalf("GenerateEncryptionKey failed: %v", err)
	}

	plaintext := []byte(`{"model":"gpt-4","messages":[{"role":"user","content":"Hello"}]}`)

	reader, err := EncryptRequestReader(key, plaintext)
	if err != nil {
		t.Fatalf("EncryptRequestReader failed: %v", err)
	}

	encrypted, err := io.ReadAll(reader)
	if err != nil {
		t.Fatalf("ReadAll failed: %v", err)
	}

	if len(encrypted) == 0 {
		t.Error("Encrypted data is empty")
	}

	decrypted, err := common.AESDecryptGCM(key, encrypted)
	if err != nil {
		t.Fatalf("AESDecryptGCM failed: %v", err)
	}

	if string(decrypted) != string(plaintext) {
		t.Errorf("Decrypted text mismatch: got %s, want %s", string(decrypted), string(plaintext))
	}
}
