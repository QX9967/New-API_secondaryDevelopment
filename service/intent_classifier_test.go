package service

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestIntentClassifierTimeoutUsesMinimumFloor(t *testing.T) {
	require.Equal(t, 15000, normalizeIntentClassifierTimeout(0))
	require.Equal(t, 15000, normalizeIntentClassifierTimeout(7000))
	require.Equal(t, 15000, normalizeIntentClassifierTimeout(15000))
	require.Equal(t, 20000, normalizeIntentClassifierTimeout(20000))
}

func TestNormalizeIntentResult(t *testing.T) {
	r1 := &IntentClassifyResult{Category: "non_work", SubCategory: "life_chat"}
	normalizeIntentResult(r1)
	require.Equal(t, "非工作", r1.Category)
	require.Equal(t, "生活聊天", r1.SubCategory)

	r2 := &IntentClassifyResult{Category: "work", SubCategory: "code_development"}
	normalizeIntentResult(r2)
	require.Equal(t, "工作", r2.Category)
	require.Equal(t, "代码开发", r2.SubCategory)

	r3 := &IntentClassifyResult{Category: "工作", SubCategory: "翻译"}
	normalizeIntentResult(r3)
	require.Equal(t, "工作", r3.Category)
	require.Equal(t, "翻译", r3.SubCategory)

	r4 := &IntentClassifyResult{Category: "unknown", SubCategory: "ambiguous"}
	normalizeIntentResult(r4)
	require.Equal(t, "未知", r4.Category)
	require.Equal(t, "模糊", r4.SubCategory)
}
