package service

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

const defaultClassifierPrompt = `You are a request complexity classifier. Based on the user's request content, determine its complexity level.

Classification criteria:
- simple: Simple Q&A, translation, formatting, short text processing, greetings
- medium: Code generation, text analysis, medium-length reasoning tasks, explanations
- hard: Complex math derivation, multi-step programming, long document analysis, system design, architecture

Return only JSON: {"level": "simple|medium|hard", "reason": "brief reason"}`

type ClassifierResult struct {
	Level  string `json:"level"`
	Reason string `json:"reason"`
}

func ClassifyDifficulty(strategyId int, classifierType string, channelId int, modelName, apiKey, baseUrl, customPrompt string, timeout int, userMessages []map[string]string) (*ClassifierResult, error) {
	start := time.Now()

	prompt := defaultClassifierPrompt
	if customPrompt != "" {
		prompt = customPrompt
	}

	classifyMessages := buildClassifyMessages(prompt, userMessages)

	var result *ClassifierResult
	var classifyErr error

	if classifierType == "channel" && channelId > 0 {
		result, classifyErr = classifyViaChannel(channelId, modelName, classifyMessages, timeout)
	} else if classifierType == "independent" && apiKey != "" {
		result, classifyErr = classifyViaIndependent(apiKey, baseUrl, modelName, classifyMessages, timeout)
	} else {
		return nil, fmt.Errorf("invalid classifier configuration")
	}

	latencyMs := int(time.Since(start).Milliseconds())

	go func() {
		log := &model.StrategyLog{
			StrategyId: strategyId,
			LatencyMs:  latencyMs,
		}
		if result != nil {
			log.Result = result.Level
		}
		if classifyErr != nil {
			log.Error = classifyErr.Error()
			log.Result = "fallback"
		}
		model.CreateStrategyLog(log)
	}()

	if classifyErr != nil {
		return nil, classifyErr
	}

	if result.Level != "simple" && result.Level != "medium" && result.Level != "hard" {
		return nil, fmt.Errorf("invalid classification level: %s", result.Level)
	}

	return result, nil
}

func buildClassifyMessages(systemPrompt string, userMessages []map[string]string) []map[string]string {
	messages := []map[string]string{
		{"role": "system", "content": systemPrompt},
	}
	count := 0
	for i := len(userMessages) - 1; i >= 0 && count < 3; i-- {
		if userMessages[i]["role"] == "user" {
			content := userMessages[i]["content"]
			if len(content) > 500 {
				content = content[:500] + "..."
			}
			messages = append(messages, map[string]string{"role": "user", "content": content})
			count++
		}
	}
	return messages
}

func classifyViaChannel(channelId int, modelName string, messages []map[string]string, timeout int) (*ClassifierResult, error) {
	channel, err := model.CacheGetChannel(channelId)
	if err != nil || channel == nil {
		return nil, fmt.Errorf("classifier channel not found: %d", channelId)
	}

	key := channel.Key
	baseUrl := ""
	if channel.BaseURL != nil {
		baseUrl = *channel.BaseURL
	}

	return classifyViaIndependent(key, baseUrl, modelName, messages, timeout)
}

func classifyViaIndependent(apiKey, baseUrl, modelName string, messages []map[string]string, timeout int) (*ClassifierResult, error) {
	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(timeout)*time.Millisecond)
	defer cancel()

	requestBody := map[string]interface{}{
		"model":       modelName,
		"messages":    messages,
		"max_tokens":  100,
		"temperature": 0,
	}

	jsonBytes, err := common.Marshal(requestBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	url := strings.TrimRight(baseUrl, "/") + "/v1/chat/completions"
	if baseUrl == "" {
		url = "https://api.openai.com/v1/chat/completions"
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, strings.NewReader(string(jsonBytes)))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)

	client := &http.Client{Timeout: time.Duration(timeout) * time.Millisecond}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("classifier request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("classifier returned status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
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
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	if len(respData.Choices) == 0 {
		return nil, fmt.Errorf("no choices in classifier response")
	}

	content := respData.Choices[0].Message.Content

	var result ClassifierResult
	if err := common.Unmarshal([]byte(content), &result); err != nil {
		content = strings.TrimSpace(content)
		if strings.Contains(content, "simple") {
			result.Level = "simple"
		} else if strings.Contains(content, "hard") {
			result.Level = "hard"
		} else {
			result.Level = "medium"
		}
	}

	return &result, nil
}
