package service

import (
	"context"
	"crypto/sha256"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

var (
	intentClassifyCache     = make(map[string]IntentClassifyResult)
	intentClassifyCacheLock sync.Mutex
	intentClassifyCacheTTL  = 5 * time.Minute
	intentCacheEntries      = make(map[string]time.Time)
)

type IntentClassifyResult struct {
	Category         string  `json:"category"`
	SubCategory      string  `json:"subcategory"`
	Confidence       float64 `json:"confidence"`
	Reason           string  `json:"reason"`
	PromptTokens     int     `json:"prompt_tokens,omitempty"`
	CompletionTokens int     `json:"completion_tokens,omitempty"`
	ChannelId        int     `json:"channel_id,omitempty"`
	ChannelName      string  `json:"channel_name,omitempty"`
}

const defaultIntentClassifierPrompt = `Classify the user's request intent.
Return only JSON, no thinking, no explanation, no markdown:
{"category":"work|non_work|unknown","subcategory":"code_development|doc_writing|data_analysis|customer_service|meeting_summary|translation|research|other_work|entertainment|personal_study|life_chat|creative_writing|gaming|other_non_work|ambiguous","confidence":0-1,"reason":"中文简短原因"}
User request:
{{user_message}}`

func ClassifyIntentAsync(strategy *model.Strategy, requestId string, userMessages []map[string]string, group string, userId int) {
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
		result, classifyErr = classifyIntentViaIndependent(strategy.ClassifierApiKey, strategy.ClassifierBaseUrl, strategy.ClassifierModel, classifyMessages, strategy.ClassifierTimeout, strategy.ClassifierDisableThinking)
	} else {
		classifyErr = fmt.Errorf("intent strategy: invalid classifier configuration")
	}

	if classifyErr != nil {
		common.SysLog(fmt.Sprintf("[Intent] classification failed: %v", classifyErr))
		return
	}

	if result == nil {
		return
	}

	common.SysLog(fmt.Sprintf("[Intent] classification result: category=%s, sub=%s, confidence=%.2f", result.Category, result.SubCategory, result.Confidence))

	normalizeIntentResult(result)

	if result.Category != "工作" && result.Category != "非工作" && result.Category != "未知" {
		result.Category = "未知"
		result.SubCategory = "模糊"
	}

	setCachedIntentClassification(cacheKey, result)

	if err := model.UpdateLogIntent(requestId, result.Category, result.SubCategory, result.Confidence, result.Reason); err != nil {
		common.SysLog("failed to update log intent: " + err.Error())
	}

	// 记录系统调用消耗日志
	if userId > 0 {
		go func() {
			// 计算配额消耗
			quota := 0
			if result.PromptTokens > 0 || result.CompletionTokens > 0 {
				modelRatio, _, _ := ratio_setting.GetModelRatio(strategy.ClassifierModel)
				groupRatio := ratio_setting.GetGroupRatio("default")
				quota = int(float64(result.PromptTokens+result.CompletionTokens) * modelRatio * groupRatio)
			}

			model.RecordSystemConsumeLog(model.RecordSystemConsumeLogParams{
				SystemCallType:   "intent",
				UserId:           userId,
				RelatedRequestId: requestId,
				ModelName:        strategy.ClassifierModel,
				PromptTokens:     result.PromptTokens,
				CompletionTokens: result.CompletionTokens,
				Quota:            quota,
				ChannelId:        result.ChannelId,
				ChannelName:      result.ChannelName,
				Content:          fmt.Sprintf("Intent classification: %s/%s", result.Category, result.SubCategory),
				Other: map[string]interface{}{
					"category":    result.Category,
					"subcategory": result.SubCategory,
					"confidence":  result.Confidence,
					"reason":      result.Reason,
				},
			})
		}()
	}
}

var intentCategoryMap = map[string]string{
	"work":     "工作",
	"non_work": "非工作",
	"unknown":  "未知",
	"工作":       "工作",
	"非工作":      "非工作",
	"未知":       "未知",
}

var intentSubCategoryMap = map[string]string{
	"code_development": "代码开发",
	"doc_writing":      "文档撰写",
	"data_analysis":    "数据分析",
	"customer_service": "客户服务",
	"meeting_summary":  "会议总结",
	"translation":      "翻译",
	"research":         "技术调研",
	"other_work":       "其他工作",
	"entertainment":    "娱乐",
	"personal_study":   "个人学习",
	"life_chat":        "生活聊天",
	"creative_writing": "创意写作",
	"gaming":           "游戏",
	"other_non_work":   "其他非工作",
	"ambiguous":        "模糊",
	"代码开发":             "代码开发",
	"文档撰写":             "文档撰写",
	"数据分析":             "数据分析",
	"客户服务":             "客户服务",
	"会议总结":             "会议总结",
	"翻译":               "翻译",
	"技术调研":             "技术调研",
	"其他工作":             "其他工作",
	"娱乐":               "娱乐",
	"个人学习":             "个人学习",
	"生活聊天":             "生活聊天",
	"创意写作":             "创意写作",
	"游戏":               "游戏",
	"其他非工作":            "其他非工作",
	"模糊":               "模糊",
}

func normalizeIntentResult(result *IntentClassifyResult) {
	if v, ok := intentCategoryMap[result.Category]; ok {
		result.Category = v
	}
	if v, ok := intentSubCategoryMap[result.SubCategory]; ok {
		result.SubCategory = v
	}
}

func ExtractUserMessagesFromLog(requestBody string) []map[string]string {
	if requestBody == "" {
		return nil
	}
	var body map[string]interface{}
	if err := common.Unmarshal([]byte(requestBody), &body); err != nil {
		return extractUserMessagesFallback(requestBody)
	}
	return extractUserMessagesFromMap(body)
}

func normalizeIntentClassifierTimeout(timeout int) int {
	if timeout < 15000 {
		return 15000
	}
	return timeout
}

func ExtractUserMessagesFromRequest(request dto.Request) []map[string]string {
	if request == nil {
		return nil
	}
	switch r := request.(type) {
	case *dto.GeneralOpenAIRequest:
		return extractUserMessagesFromOpenAIRequest(r)
	case *dto.ClaudeRequest:
		return extractUserMessagesFromClaudeRequest(r)
	case *dto.GeminiChatRequest:
		return extractUserMessagesFromGeminiRequest(r)
	case *dto.OpenAIResponsesRequest:
		return extractUserMessagesFromResponsesRequest(r)
	default:
		return nil
	}
}

func extractUserMessagesFromOpenAIRequest(r *dto.GeneralOpenAIRequest) []map[string]string {
	if r == nil {
		return nil
	}
	var messages []map[string]string
	for _, message := range r.Messages {
		if message.Role != "user" || message.Content == nil {
			continue
		}
		parts := message.ParseContent()
		var textParts []string
		for _, part := range parts {
			if part.Type == dto.ContentTypeText && part.Text != "" {
				textParts = append(textParts, part.Text)
			}
		}
		if len(textParts) > 0 {
			messages = append(messages, map[string]string{
				"role":    "user",
				"content": strings.Join(textParts, "\n"),
			})
		}
	}
	return messages
}

func extractUserMessagesFromClaudeRequest(r *dto.ClaudeRequest) []map[string]string {
	if r == nil {
		return nil
	}
	var messages []map[string]string
	for _, message := range r.Messages {
		if message.Role != "user" {
			continue
		}
		content := message.GetStringContent()
		if content != "" {
			messages = append(messages, map[string]string{
				"role":    "user",
				"content": content,
			})
		}
	}
	return messages
}

func extractUserMessagesFromGeminiRequest(r *dto.GeminiChatRequest) []map[string]string {
	if r == nil {
		return nil
	}
	var messages []map[string]string
	for _, content := range r.Contents {
		if content.Role != "user" {
			continue
		}
		var textParts []string
		for _, part := range content.Parts {
			if part.Text != "" {
				textParts = append(textParts, part.Text)
			}
		}
		if len(textParts) > 0 {
			messages = append(messages, map[string]string{
				"role":    "user",
				"content": strings.Join(textParts, "\n"),
			})
		}
	}
	return messages
}

func extractUserMessagesFromResponsesRequest(r *dto.OpenAIResponsesRequest) []map[string]string {
	if r == nil {
		return nil
	}
	var messages []map[string]string
	if common.GetJsonType(r.Input) == "string" {
		var str string
		if err := common.Unmarshal(r.Input, &str); err == nil && str != "" {
			messages = append(messages, map[string]string{
				"role":    "user",
				"content": str,
			})
		}
		return messages
	}
	if common.GetJsonType(r.Input) != "array" {
		return messages
	}
	var inputs []dto.Input
	if err := common.Unmarshal(r.Input, &inputs); err != nil {
		return messages
	}
	for _, input := range inputs {
		if input.Role != "user" {
			continue
		}
		if common.GetJsonType(input.Content) == "string" {
			var str string
			if err := common.Unmarshal(input.Content, &str); err == nil && str != "" {
				messages = append(messages, map[string]string{
					"role":    "user",
					"content": str,
				})
			}
			continue
		}
		if common.GetJsonType(input.Content) != "array" {
			continue
		}
		var items []dto.MediaInput
		if err := common.Unmarshal(input.Content, &items); err != nil {
			continue
		}
		var textParts []string
		for _, item := range items {
			if item.Type == "input_text" && item.Text != "" {
				textParts = append(textParts, item.Text)
			}
		}
		if len(textParts) > 0 {
			messages = append(messages, map[string]string{
				"role":    "user",
				"content": strings.Join(textParts, "\n"),
			})
		}
	}
	return messages
}

func extractUserMessagesFallback(requestBody string) []map[string]string {
	var messages []map[string]string
	re := regexp.MustCompile(`"role"\s*:\s*"user"\s*,\s*"content"\s*:\s*"((?:[^"\\]|\\.)*)"`)
	matches := re.FindAllStringSubmatch(requestBody, -1)
	for _, match := range matches {
		if len(match) > 1 {
			content := match[1]
			content = strings.ReplaceAll(content, `\"`, `"`)
			content = strings.ReplaceAll(content, `\\`, `\`)
			content = strings.ReplaceAll(content, `\n`, "\n")
			content = strings.ReplaceAll(content, `\r`, "\r")
			content = strings.ReplaceAll(content, `\t`, "\t")
			if content != "" {
				messages = append(messages, map[string]string{
					"role":    "user",
					"content": content,
				})
			}
		}
	}
	return messages
}

func extractUserMessagesFromMap(body map[string]interface{}) []map[string]string {
	var messages []map[string]string
	if msgs, ok := body["messages"].([]interface{}); ok {
		for _, msg := range msgs {
			if m, ok := msg.(map[string]interface{}); ok {
				role, _ := m["role"].(string)
				if role != "user" {
					continue
				}
				switch v := m["content"].(type) {
				case string:
					if v != "" {
						messages = append(messages, map[string]string{
							"role":    "user",
							"content": v,
						})
					}
				case []interface{}:
					var textParts []string
					for _, part := range v {
						if p, ok := part.(map[string]interface{}); ok {
							if t, ok := p["text"].(string); ok && t != "" {
								textParts = append(textParts, t)
							}
						}
					}
					if len(textParts) > 0 {
						messages = append(messages, map[string]string{
							"role":    "user",
							"content": strings.Join(textParts, "\n"),
						})
					}
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

	result, err := classifyIntentViaIndependent(key, baseUrl, actualModel, messages, strategy.ClassifierTimeout, strategy.ClassifierDisableThinking)
	if err != nil {
		return nil, err
	}

	// 填充渠道信息
	result.ChannelId = channel.Id
	result.ChannelName = channel.Name

	return result, nil
}

func classifyIntentViaIndependent(apiKey, baseUrl, modelName string, messages []map[string]string, timeout int, disableThinking bool) (*IntentClassifyResult, error) {
	timeout = normalizeIntentClassifierTimeout(timeout)

	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(timeout)*time.Millisecond)
	defer cancel()

	requestBody := map[string]interface{}{
		"model":       modelName,
		"messages":    messages,
		"max_tokens":  500,
		"temperature": 0,
	}
	if disableThinking {
		requestBody["thinking"] = map[string]interface{}{"type": "disabled"}
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

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("intent classifier request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("intent classifier returned status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, fmt.Errorf("failed to read intent response: %w", err)
	}

	type Usage struct {
		PromptTokens     int `json:"prompt_tokens"`
		CompletionTokens int `json:"completion_tokens"`
	}
	type Choice struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	}
	type Response struct {
		Choices []Choice `json:"choices"`
		Usage   Usage    `json:"usage"`
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
		jsonContent := extractIntentJSON(content)
		if jsonContent == "" || common.Unmarshal([]byte(jsonContent), &result) != nil {
			return nil, fmt.Errorf("failed to parse intent result JSON: %w", err)
		}
	}

	// 填充 token 使用信息
	result.PromptTokens = respData.Usage.PromptTokens
	result.CompletionTokens = respData.Usage.CompletionTokens

	return &result, nil
}

func extractIntentJSON(content string) string {
	content = strings.TrimSpace(content)
	if strings.HasPrefix(content, "```") {
		lines := strings.Split(content, "\n")
		if len(lines) >= 3 {
			content = strings.Join(lines[1:len(lines)-1], "\n")
			content = strings.TrimSpace(content)
			if strings.HasPrefix(strings.ToLower(content), "json") {
				content = strings.TrimSpace(content[4:])
			}
		}
	}
	start := strings.Index(content, "{")
	end := strings.LastIndex(content, "}")
	if start >= 0 && end > start {
		return content[start : end+1]
	}
	return ""
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

const maxIntentCacheSize = 10000

func setCachedIntentClassification(key string, result *IntentClassifyResult) {
	intentClassifyCacheLock.Lock()
	defer intentClassifyCacheLock.Unlock()
	now := time.Now()
	for k, expires := range intentCacheEntries {
		if now.After(expires) {
			delete(intentClassifyCache, k)
			delete(intentCacheEntries, k)
		}
	}
	if len(intentClassifyCache) >= maxIntentCacheSize {
		for k := range intentClassifyCache {
			delete(intentClassifyCache, k)
			delete(intentCacheEntries, k)
			if len(intentClassifyCache) < maxIntentCacheSize/2 {
				break
			}
		}
	}
	intentClassifyCache[key] = *result
	intentCacheEntries[key] = now.Add(intentClassifyCacheTTL)
}
