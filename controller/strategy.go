package controller

import (
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

func GetAllStrategies(c *gin.Context) {
	strategies, err := model.GetAllStrategies()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    strategies,
	})
}

func GetStrategy(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	strategy, err := model.GetStrategyById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    strategy,
	})
}

func CreateStrategy(c *gin.Context) {
	var strategy model.Strategy
	if err := c.ShouldBindJSON(&strategy); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := strategy.Insert(); err != nil {
		common.ApiError(c, err)
		return
	}
	model.RefreshStrategyCache()
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    strategy,
	})
}

func UpdateStrategy(c *gin.Context) {
	var strategy model.Strategy
	if err := c.ShouldBindJSON(&strategy); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := strategy.Update(); err != nil {
		common.ApiError(c, err)
		return
	}
	model.RefreshStrategyCache()
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    strategy,
	})
}

func DeleteStrategy(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	strategy := model.Strategy{Id: id}
	if err := strategy.Delete(); err != nil {
		common.ApiError(c, err)
		return
	}
	model.RefreshStrategyCache()
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
}

func TestClassifier(c *gin.Context) {
	var req struct {
		ClassifierType      string `json:"classifier_type"`
		ClassifierChannelId int    `json:"classifier_channel_id"`
		ClassifierModel     string `json:"classifier_model"`
		ClassifierApiKey    string `json:"classifier_api_key"`
		ClassifierBaseUrl   string `json:"classifier_base_url"`
		ClassifierPrompt    string `json:"classifier_prompt"`
		ClassifierTimeout   int    `json:"classifier_timeout"`
		TestMessage         string `json:"test_message"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}

	if req.ClassifierTimeout == 0 {
		req.ClassifierTimeout = 10000
	}

	messages := []map[string]string{
		{"role": "user", "content": req.TestMessage},
	}

	result, err := service.ClassifyDifficulty(
		0,
		req.ClassifierType,
		req.ClassifierChannelId,
		req.ClassifierModel,
		req.ClassifierApiKey,
		req.ClassifierBaseUrl,
		req.ClassifierPrompt,
		req.ClassifierTimeout,
		"default",
		messages,
		0,  // 测试调用，不需要 userId
		"", // 测试调用，不需要 requestId
	)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    result,
	})
}

func GetStrategyLogs(c *gin.Context) {
	strategyId, _ := strconv.Atoi(c.Query("strategy_id"))
	page, _ := strconv.Atoi(c.DefaultQuery("p", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("size", "20"))

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	logs, total, err := model.GetStrategyLogs(strategyId, page, pageSize)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    logs,
		"total":   total,
	})
}
