package service

import (
	"context"
	"crypto/sha256"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

var (
	intentClassifyCache     = make(map[string]IntentClassifyResult)
	intentClassifyCacheLock sync.Mutex
	intentClassifyCacheTTL  = 5 * time.Minute
	intentCacheEntries      = make(map[string]time.Time)
)

type IntentClassifyResult struct {
	Category    string  `json:"category"`
	SubCategory string  `json:"subcategory"`
	Confidence  float64 `json:"confidence"`
	Reason      string  `json:"reason"`
}

const defaultIntentClassifierPrompt = `You are a request intent classifier for a corporate AI system. Your job is to determine whether the user's request is work-related or personal/non-work.

Classification categories:

work (工作):
- code_development: Code writing, debugging, code review, DevOps
- doc_writing: Documents, reports, emails, presentations
- data_analysis: Data analysis, SQL, reports, charts
- customer_service: Customer communication, ticket handling
- meeting_summary: Meeting notes, summaries
- translation: Work-related translation
- research: Technical research, solution comparison
- other_work: Other work-related tasks

non_work (非工作):
- entertainment: Entertainment, jokes, stories, roleplay
- personal_study: Personal learning (not job-related)
- life_chat: Casual conversation, emotional advice
- creative_writing: Creative writing (non-work)
- gaming: Gaming related
- other_non_work: Other non-work tasks

unknown (无法判定):
- ambiguous: Content is ambiguous or cannot be determined

Return only JSON:
{"category": "work|non_work|unknown", "subcategory": "...", "confidence": 0.0-1.0, "reason": "brief reason in Chinese"}`

func ClassifyIntentAsync(strategy *model.Strategy, requestId string, userMessages []map[string]string, group string) {
	if !common.IntentClassificationEnabled {
		return
	}
	if requestId == "" {
		return
	}
	if common.IntentSampleRate < 100 && common.IntentSampleRate > 0 {
		if hash := computeIntentHash(requestId); int(hash%100) >= common.IntentSampleRate {
			return
		}
	}

	cacheKey := computeIntentCacheKey(userMessages)
	if cached, ok := getCachedIntentClassification(cacheKey); ok {
		if err := model.UpdateLogIntent(requestId, cached.Category, cached.SubCategory, cached.Confidence, cached.Reason); err != nil {
			common.SysLog("failed to update log intent from cache: " + err.Error())
		}
		return
	}

	prompt := defaultIntentClassifierPrompt
	if strategy.ClassifierPrompt != "" {
		prompt = strategy.ClassifierPrompt
	}

	classifyMessages := buildIntentClassifyMessages(prompt, userMessages)

	var result *IntentClassifyResult
	var classifyErr error

	if strategy.ClassifierType == "channel" {
		if strategy.ClassifierChannelId > 0 || strategy.ClassifierModel != "" {
			result, classifyErr = classifyIntentViaChannel(strategy, classifyMessages, group)
		} else {
			classifyErr = fmt.Errorf("intent strategy: channel type requires channelId or modelName")
		}
	} else if strategy.ClassifierType == "independent" && strategy.ClassifierApiKey != "" {
		result, classifyErr = classifyIntentViaIndependent(strategy.ClassifierApiKey, strategy.ClassifierBaseUrl, strategy.ClassifierModel, classifyMessages, strategy.ClassifierTimeout)
	} else {
		classifyErr = fmt.Errorf("intent strategy: invalid classifier configuration")
	}

	if classifyErr != nil {
		common.SysLog("intent classification failed: " + classifyErr.Error())
		return
	}

	if result == nil {
		return
	}

	if result.Category != "work" && result.Category != "non_work" && result.Category != "unknown" {
		result.Category = "unknown"
		result.SubCategory = "ambiguous"
	}

	setCachedIntentClassification(cacheKey, result)

	if err := model.UpdateLogIntent(requestId, result.Category, result.SubCategory, result.Confidence, result.Reason); err != nil {
		common.SysLog("failed to update log intent: " + err.Error())
	}
}

func ExtractUserMessagesFromLog(requestBody string) []map[string]string {
	if requestBody == "" {
		return nil
	}
	var body map[string]interface{}
	if err := common.Unmarshal([]byte(requestBody), &body); err != nil {
		return nil
	}
	var messages []map[string]string
	if msgs, ok := body["messages"].([]interface{}); ok {
		for _, msg := range msgs {
			if m, ok := msg.(map[string]interface{}); ok {
				role, _ := m["role"].(string)
				content, _ := m["content"].(string)
				if role == "user" && content != "" {
					messages = append(messages, map[string]string{
						"role":    role,
						"content": content,
					})
				}
			}
		}
	}
	return messages
}

func buildIntentClassifyMessages(systemPrompt string, userMessages []map[string]string) []map[string]string {
	messages := []map[string]string{
		{"role": "system", "content": systemPrompt},
	}
	count := 0
	for i := len(userMessages) - 1; i >= 0 && count < 5; i-- {
		if userMessages[i]["role"] == "user" {
			content := userMessages[i]["content"]
			if len(content) > 800 {
				content = content[:800] + "..."
			}
			messages = append(messages, map[string]string{"role": "user", "content": content})
			count++
		}
	}
	return messages
}

func classifyIntentViaChannel(strategy *model.Strategy, messages []map[string]string, group string) (*IntentClassifyResult, error) {
	var channel *model.Channel
	var err error

	if strategy.ClassifierChannelId > 0 {
		channel, err = model.CacheGetChannel(strategy.ClassifierChannelId)
		if err != nil || channel == nil {
			return nil, fmt.Errorf("intent classifier channel not found: %d", strategy.ClassifierChannelId)
		}
	} else if strategy.ClassifierModel != "" {
		if group == "" {
			group = "default"
		}
		channel, err = model.GetRandomSatisfiedChannel(group, strategy.ClassifierModel, 0)
		if err != nil || channel == nil {
			return nil, fmt.Errorf("no channel found for intent classifier model: %s", strategy.ClassifierModel)
		}
	} else {
		return nil, fmt.Errorf("either channel_id or model name is required for intent classifier")
	}

	key := channel.Key
	baseUrl := ""
	if channel.BaseURL != nil {
		baseUrl = *channel.BaseURL
	}

	actualModel := strategy.ClassifierModel
	if actualModel == "" {
		models := channel.GetModels()
		if len(models) > 0 {
			actualModel = models[0]
		} else {
			return nil, fmt.Errorf("intent classifier channel has no models configured")
		}
	}

	return classifyIntentViaIndependent(key, baseUrl, actualModel, messages, strategy.ClassifierTimeout)
}

func classifyIntentViaIndependent(apiKey, baseUrl, modelName string, messages []map[string]string, timeout int) (*IntentClassifyResult, error) {
	if timeout <= 0 {
		timeout = 10000
	}

	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(timeout)*time.Millisecond)
	defer cancel()

	requestBody := map[string]interface{}{
		"model":       modelName,
		"messages":    messages,
		"max_tokens":  150,
		"temperature": 0,
	}

	jsonBytes, err := common.Marshal(requestBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal intent request: %w", err)
	}

	url := strings.TrimRight(baseUrl, "/") + "/v1/chat/completions"
	if baseUrl == "" {
		url = "https://api.openai.com/v1/chat/completions"
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, strings.NewReader(string(jsonBytes)))
	if err != nil {
		return nil, fmt.Errorf("failed to create intent request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)

	client := &http.Client{Timeout: time.Duration(timeout) * time.Millisecond}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("intent classifier request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("intent classifier returned status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read intent response: %w", err)
	}

	type Choice struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	}
	type Response struct {
		Choices []Choice `json:"choices"`
	}

	var respData Response
	if err := common.Unmarshal(body, &respData); err != nil {
		return nil, fmt.Errorf("failed to parse intent response: %w", err)
	}

	if len(respData.Choices) == 0 {
		return nil, fmt.Errorf("no choices in intent classifier response")
	}

	content := respData.Choices[0].Message.Content
	var result IntentClassifyResult
	if err := common.Unmarshal([]byte(content), &result); err != nil {
		return nil, fmt.Errorf("failed to parse intent result JSON: %w", err)
	}

	return &result, nil
}

func computeIntentCacheKey(messages []map[string]string) string {
	var sb strings.Builder
	for _, m := range messages {
		if m["role"] == "user" {
			content := m["content"]
			if len(content) > 200 {
				content = content[:200]
			}
			sb.WriteString(content)
		}
	}
	hash := sha256.Sum256([]byte(sb.String()))
	return fmt.Sprintf("%x", hash[:8])
}

func computeIntentHash(s string) uint32 {
	h := sha256.Sum256([]byte(s))
	return uint32(h[0])<<24 | uint32(h[1])<<16 | uint32(h[2])<<8 | uint32(h[3])
}

func getCachedIntentClassification(key string) (*IntentClassifyResult, bool) {
	intentClassifyCacheLock.Lock()
	defer intentClassifyCacheLock.Unlock()
	if expires, ok := intentCacheEntries[key]; ok && time.Now().Before(expires) {
		if result, ok := intentClassifyCache[key]; ok {
			return &result, true
		}
	}
	return nil, false
}

func setCachedIntentClassification(key string, result *IntentClassifyResult) {
	intentClassifyCacheLock.Lock()
	defer intentClassifyCacheLock.Unlock()
	intentClassifyCache[key] = *result
	intentCacheEntries[key] = time.Now().Add(intentClassifyCacheTTL)
}
