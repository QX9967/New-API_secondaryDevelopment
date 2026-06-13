package model

import (
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
)

var (
	strategiesCache     []Strategy
	strategiesCacheLock sync.Mutex
	strategiesCacheTime time.Time
	strategiesCacheTTL  = 30 * time.Second
)

func InitStrategyCache() {
	strategies, err := GetAllEnabledStrategies()
	if err != nil {
		common.SysLog("failed to init strategy cache: " + err.Error())
		return
	}
	strategiesCacheLock.Lock()
	strategiesCache = strategies
	strategiesCacheTime = time.Now()
	strategiesCacheLock.Unlock()
}

func GetCachedStrategies() []Strategy {
	strategiesCacheLock.Lock()
	defer strategiesCacheLock.Unlock()

	if time.Since(strategiesCacheTime) > strategiesCacheTTL {
		strategies, err := GetAllEnabledStrategies()
		if err == nil {
			strategiesCache = strategies
			strategiesCacheTime = time.Now()
		}
	}

	result := make([]Strategy, len(strategiesCache))
	copy(result, strategiesCache)
	return result
}

func RefreshStrategyCache() {
	InitStrategyCache()
}
