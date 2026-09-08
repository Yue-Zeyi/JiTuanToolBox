# 极团工具箱｜服务接口约定

小程序前端默认使用 mock。联调时将 `config/runtime.js` 的 `useMockServices` 改为 `false`，并设置 `apiBaseUrl`。

## OCR

`POST /v1/ocr`

- 请求：`multipart/form-data`，字段名 `file`
- 成功：`{"text":"识别出的文字","requestId":"..."}`
- 失败：HTTP 4xx/5xx，响应 `{"code":"FILE_TOO_LARGE","message":"文件超过限制"}`

## 图片转 PDF

建议使用：

1. `POST /v1/pdf/tasks` 上传多张图片，返回任务 ID；
2. `GET /v1/pdf/tasks/{taskId}` 查询 `processing / success / failed`；
3. 成功时返回短期有效的 `downloadUrl`。

成功示例：

```json
{
  "name": "极团工具箱-1725600000.pdf",
  "count": 3,
  "size": 483920,
  "url": "https://cdn.example.com/temp/xxx.pdf",
  "expiresAt": "2026-09-06T12:00:00Z"
}
```

## 错误码建议

- `FILE_TOO_LARGE`：超过单文件或批量大小限制
- `UNSUPPORTED_FORMAT`：格式不支持
- `TASK_TIMEOUT`：处理超时，可重试
- `SERVICE_BUSY`：服务繁忙，稍后重试
- `RISK_REJECTED`：触发安全策略，需要友好提示用户

服务端不要长期保存原图，建议使用短期对象存储和自动过期清理策略。
