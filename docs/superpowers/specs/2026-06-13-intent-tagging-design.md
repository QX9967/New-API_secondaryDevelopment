# Intent Tagging — Request Intent Classification for Audit

## Problem

Company-provided AI models are funded by the company for work purposes. There is currently no mechanism to detect or audit whether users are using these resources for non-work content. We need a post-hoc classification system that labels each request with a work/non-work intent tag for compliance auditing.

## Goals

1. Classify every API request with a two-level intent tag (work/non-work + subcategory)
2. Classification is asynchronous — does not add latency to user requests
3. Results are stored in the Log table for efficient querying and filtering
4. Admin dashboard provides filtering, statistics, and audit views
5. Leverages the existing Strategy/classifier infrastructure to minimize new code

## Non-Goals

- Real-time blocking/intercepting of non-work requests (future phase)
- Alerting/notifications on detection (future phase)
- Model response analysis (only user request messages are analyzed)

---

## Tag System

Two-level hierarchical tags with predefined categories:

```
work (工作)
├── code_development    — 代码开发、调试、Code Review
├── doc_writing         — 文档撰写、报告、邮件
├── data_analysis       — 数据分析、报表、SQL 查询
├── customer_service    — 客户沟通、工单处理
├── meeting_summary     — 会议纪要、总结
├── translation         — 工作相关翻译
├── research            — 技术调研、方案对比
└── other_work          — 其他工作内容

non_work (非工作)
├── entertainment       — 娱乐、聊天、讲故事
├── personal_study      — 个人学习（非工作相关）
├── life_chat           — 日常闲聊、情感咨询
├── creative_writing    — 创意写作（非工作）
├── gaming              — 游戏相关
└── other_non_work      — 其他非工作内容

unknown (无法判定)
└── ambiguous           — 内容模糊，无法明确分类
```

Classifier output format:
```json
{
  "category": "work",
  "subcategory": "code_development",
  "confidence": 0.92,
  "reason": "User is requesting Python code refactoring for a web application"
}
```

---

## Data Model Changes

### Log model (`model/log.go`) — add 4 fields

```go
IntentCategory    string  `json:"intent_category" gorm:"size:32;index;default:''"`
IntentSubCategory string  `json:"intent_sub_category" gorm:"size:64;default:''"`
IntentConfidence  float64 `json:"intent_confidence" gorm:"default:0"`
IntentReason      string  `json:"intent_reason" gorm:"size:512;default:''"`
```

- `IntentCategory`: `work` / `non_work` / `empty` (not yet classified)
- `IntentSubCategory`: specific subcategory tag
- `IntentConfidence`: 0.0–1.0, classification confidence
- `IntentReason`: brief explanation for audit trail

These are stored as direct columns (not in the `Other` JSON blob) because audit queries need to filter/sort/aggregate by these fields efficiently.

### Strategy model (`model/strategy.go`) — new type

- Add `"intent"` as a valid `Type` value alongside `"difficulty"` and `"time"`
- Reuse existing fields: `ClassifierType`, `ClassifierChannelId`, `ClassifierModel`, `ClassifierApiKey`, `ClassifierBaseUrl`, `ClassifierPrompt`, `ClassifierTimeout`
- Add optional `IntentLabels` (TEXT, JSON) for future custom label definitions

### Database migration

- `ALTER TABLE logs ADD COLUMN intent_category VARCHAR(32) DEFAULT ''`
- `ALTER TABLE logs ADD COLUMN intent_sub_category VARCHAR(64) DEFAULT ''`
- `ALTER TABLE logs ADD COLUMN intent_confidence DOUBLE DEFAULT 0`
- `ALTER TABLE logs ADD COLUMN intent_reason VARCHAR(512) DEFAULT ''`
- `CREATE INDEX idx_logs_intent_category ON logs(intent_category)`
- Must work on SQLite, MySQL, and PostgreSQL

---

## Execution Flow

### Classification trigger point

In `service/text_quota.go` → `PostTextConsumeQuota()`, after `model.RecordConsumeLog()`:

```go
// Existing: write consume log
model.RecordConsumeLog(...)

// New: async intent classification
if intentStrategy != nil && logDetailEnabled {
    go service.ClassifyIntentAsync(
        intentStrategy,
        requestId,
        userMessages,
        group,
    )
}
```

Similarly in `service/quota.go` → `PostAudioConsumeQuota()` for audio requests.

### Classification service (`service/intent_classifier.go`)

```go
func ClassifyIntentAsync(strategy *model.Strategy, requestId string,
    userMessages []map[string]string, group string) {

    // 1. Check cache (SHA256 hash of user messages, 5min TTL)
    cacheKey := computeIntentCacheKey(userMessages)
    if cached, ok := getCachedIntentClassification(cacheKey); ok {
        model.UpdateLogIntent(requestId, cached)
        return
    }

    // 2. Build classification messages
    messages := buildIntentClassifyMessages(strategy.ClassifierPrompt, userMessages)

    // 3. Call AI classifier (reuse classifyViaChannel/classifyViaIndependent)
    result, err := classifyViaChannelOrIndependent(strategy, messages, group)

    // 4. Handle result
    if err != nil {
        // Log error, don't fail
        return
    }

    // 5. Cache result
    setCachedIntentClassification(cacheKey, result)

    // 6. Update Log record
    model.UpdateLogIntent(requestId, result)
}
```

### Default classification prompt

```
You are a request intent classifier for a corporate AI system.
Classify the user's request into work or non-work categories.

Categories:
- work: Professional tasks related to job responsibilities
  Subcategories: code_development, doc_writing, data_analysis, customer_service,
  meeting_summary, translation, research, other_work
- non_work: Personal, entertainment, or non-job-related tasks
  Subcategories: entertainment, personal_study, life_chat, creative_writing,
  gaming, other_non_work
- unknown: Ambiguous or cannot be determined
  Subcategory: ambiguous

Return only JSON:
{"category": "work|non_work|unknown", "subcategory": "...", "confidence": 0.0-1.0, "reason": "brief reason in Chinese"}
```

### Key design decisions

1. **Async goroutine**: Classification runs in background, never blocks user requests
2. **SHA256 cache**: Same content within 5 minutes uses cached result (reuses existing pattern from `middleware/strategy.go`)
3. **Graceful failure**: Classification errors are logged but never affect business flow
4. **Sampling**: Configurable via `IntentSampleRate` setting (0-100%), default 100%
5. **Requires LogDetailEnabled**: Needs `RequestBody` to extract user messages
6. **Intent strategy lookup**: Cache the enabled intent strategy to avoid DB query per request

---

## Admin UI

### Strategy management page

- Add `"意图分类 (Intent)"` option to Strategy type dropdown
- When selected, show classifier config (same as difficulty strategy)
- Provide default prompt template with the tag system description

### Log list page enhancements

- New `意图` column displaying `category/subcategory`
- Filter by intent category (multi-select: work / non_work / unknown)
- Filter by intent subcategory
- Filter by confidence threshold

### Statistics dashboard (new page or section)

- Pie chart: work vs non_work vs unknown distribution
- Bar chart: subcategory breakdown
- Time-series: intent distribution trends over time
- Cross-filter by: time range, user, user group, model

### Audit views (Phase 2)

- High-risk user list (non_work ratio > configurable threshold)
- Low-confidence request list (for manual review)
- Per-user intent history

---

## Configuration

### System settings (in `setting/`)

| Setting | Default | Description |
|---|---|---|
| `IntentClassificationEnabled` | `false` | Master switch |
| `IntentSampleRate` | `100` | Classification sample rate (0-100%) |
| `IntentConfidenceThreshold` | `0.7` | Below this, mark as needs-review |

### Strategy configuration

- One Strategy record with `Type = "intent"` is active at a time
- Uses the same classifier config UI as difficulty strategies
- Default prompt is provided; admin can customize for their organization's context

---

## File Changes Summary

| File | Change |
|---|---|
| `model/log.go` | Add 4 intent fields to Log struct, add `UpdateLogIntent()` |
| `model/strategy.go` | Add `"intent"` type, add `IntentLabels` field |
| `model/main.go` | Migration for new columns + index |
| `service/intent_classifier.go` | **New file** — `ClassifyIntentAsync()`, cache, prompt |
| `service/text_quota.go` | Trigger async classification after `RecordConsumeLog()` |
| `service/quota.go` | Trigger async classification for audio requests |
| `setting/constant.go` | Add intent-related setting keys |
| `setting/operation.go` | Add intent setting getters/setters |
| `web/default/src/...` | Strategy form: add intent type; Log list: add intent column + filters; Statistics: intent charts |

---

## Phasing

### Phase 1 (this spec)
- Backend: Log model fields, Strategy type, async classifier service
- Integration: text_quota.go and quota.go trigger points
- Basic admin: Strategy form intent type, Log list intent column + filters

### Phase 2 (future)
- Statistics dashboard with charts
- Audit views (high-risk users, low-confidence list)
- Alerting via webhook/email
- Real-time blocking/interception option

---

## Open Questions

None — all design decisions confirmed with user.
