package channel

import (
	"bytes"
	"io"

	"github.com/QuantumNous/new-api/common"
)

func EncryptRequestBody(encryptionKey string, plaintext []byte) ([]byte, error) {
	return common.AESEncryptGCM(encryptionKey, plaintext)
}

func DecryptResponseBody(encryptionKey string, ciphertext []byte) ([]byte, error) {
	return common.AESDecryptGCM(encryptionKey, ciphertext)
}

func EncryptRequestReader(encryptionKey string, plaintext []byte) (io.Reader, error) {
	ciphertext, err := common.AESEncryptGCM(encryptionKey, plaintext)
	if err != nil {
		return nil, err
	}
	return bytes.NewReader(ciphertext), nil
}
