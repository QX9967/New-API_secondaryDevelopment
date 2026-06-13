package middleware

import (
	"crypto/sha256"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
	"github.com/robfig/cron/v3"
)

var (
	cronParser        = cron.NewParser(cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow)
	classifyCache     = make(map[string]classifyCacheEntry)
	classifyCacheLock sync.Mutex
)

type classifyCacheEntry struct {
	level     string
	expiresAt time.Time
}

func StrategyMiddleware() func(c *gin.Context) {
	return func(c *gin.Context) {
		strategies := model.GetCachedStrategies()
		if len(strategies) == 0 {
			c.Next()
			return
		}

		var strategyModels []string
		var difficultyLevel string
		var intentStrategy *model.Strategy
		usingGroup := common.GetContextKeyString(c, constant.ContextKeyUsingGroup)
		if usingGroup == "" {
			usingGroup = common.GetContextKeyString(c, constant.ContextKeyTokenGroup)
		}

		for _, strategy := range strategies {
			if !strategy.Enabled {
				continue
			}

			switch strategy.Type {
			case "difficulty":
				if strategyModels != nil {
					continue
				}
				level, models, err := evaluateDifficultyStrategy(c, &strategy, usingGroup)
				if err != nil {
					continue
				}
				difficultyLevel = level
				strategyModels = models

			case "time":
				actions, err := evaluateTimeStrategy(&strategy)
				if err != nil || actions == nil {
					continue
				}
				if len(actions.UseModels) > 0 {
					strategyModels = actions.UseModels
				}
			case "intent":
				intentStrategy = &strategy
			}
		}

		if len(strategyModels) > 0 {
			common.SetContextKey(c, constant.ContextKeyStrategyModels, strategyModels)
		}
		if difficultyLevel != "" {
			common.SetContextKey(c, constant.ContextKeyStrategyDifficultyLevel, difficultyLevel)
		}
		if intentStrategy != nil {
			common.SetContextKey(c, constant.ContextKeyIntentStrategy, intentStrategy)
		}

		c.Next()
	}
}

func evaluateDifficultyStrategy(c *gin.Context, strategy *model.Strategy, group string) (string, []string, error) {
	messages, err := extractUserMessages(c)
	if err != nil || len(messages) == 0 {
		return "", nil, fmt.Errorf("no user messages found")
	}

	cacheKey := computeClassifyCacheKey(messages)
	if cached, ok := getCachedClassification(cacheKey); ok {
		models := getModelsForLevel(strategy.DifficultyModels, cached)
		return cached, models, nil
	}

	result, err := service.ClassifyDifficulty(
		strategy.Id,
		strategy.ClassifierType,
		strategy.ClassifierChannelId,
		strategy.ClassifierModel,
		strategy.ClassifierApiKey,
		strategy.ClassifierBaseUrl,
		strategy.ClassifierPrompt,
		strategy.ClassifierTimeout,
		group,
		messages,
	)
	if err != nil {
		return "", nil, err
	}

	setCachedClassification(cacheKey, result.Level)

	models := getModelsForLevel(strategy.DifficultyModels, result.Level)
	return result.Level, models, nil
}

type TimeActions struct {
	EnableModels   []string       `json:"enable_models,omitempty"`
	DisableModels  []string       `json:"disable_models,omitempty"`
	PriorityAdjust map[string]int `json:"priority_adjust,omitempty"`
	WeightAdjust   map[string]int `json:"weight_adjust,omitempty"`
	UseModels      []string       `json:"use_models,omitempty"`
}

func evaluateTimeStrategy(strategy *model.Strategy) (*TimeActions, error) {
	if strategy.CronExpr == "" {
		return nil, nil
	}

	schedule, err := cronParser.Parse(strategy.CronExpr)
	if err != nil {
		return nil, fmt.Errorf("invalid cron expression: %w", err)
	}

	loc := time.UTC
	if strategy.Timezone != "" {
		if l, err := time.LoadLocation(strategy.Timezone); err == nil {
			loc = l
		}
	}

	now := time.Now().In(loc)
	next := schedule.Next(now.Add(-time.Minute))
	if !next.Before(now.Add(time.Minute)) {
		return nil, nil
	}

	var actions TimeActions
	if strategy.TimeActions != "" {
		if err := common.Unmarshal([]byte(strategy.TimeActions), &actions); err != nil {
			return nil, fmt.Errorf("failed to parse time actions: %w", err)
		}
	}

	return &actions, nil
}

func extractUserMessages(c *gin.Context) ([]map[string]string, error) {
	var body map[string]interface{}
	if err := common.UnmarshalBodyReusable(c, &body); err != nil {
		return nil, err
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

	return messages, nil
}

func computeClassifyCacheKey(messages []map[string]string) string {
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

func getCachedClassification(key string) (string, bool) {
	classifyCacheLock.Lock()
	defer classifyCacheLock.Unlock()
	if entry, ok := classifyCache[key]; ok && time.Now().Before(entry.expiresAt) {
		return entry.level, true
	}
	return "", false
}

func setCachedClassification(key, level string) {
	classifyCacheLock.Lock()
	defer classifyCacheLock.Unlock()
	classifyCache[key] = classifyCacheEntry{
		level:     level,
		expiresAt: time.Now().Add(5 * time.Minute),
	}
}

func getModelsForLevel(difficultyModelsJSON string, level string) []string {
	var mapping map[string][]string
	if err := common.Unmarshal([]byte(difficultyModelsJSON), &mapping); err != nil {
		return nil
	}
	return mapping[level]
}
