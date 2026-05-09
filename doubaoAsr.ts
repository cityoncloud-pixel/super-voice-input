import { apiError } from '../errors.js'
import { randomUUID } from 'node:crypto'

// Doubao / Volcengine ASR "大模型录音文件识别(标准版)"：submit -> query
// PDF 显示：
// - submit: POST JSON body(user/audio/request) + headers(X-Api-Key, X-Api-Resource-Id, X-Api-Request-Id, X-Api-Sequence=-1)
// - query : POST {} + headers(X-Api-Key, X-Api-Resource-Id, X-Api-Request-Id)
// - response body: { audio_info, result:{ text, ... } }（错误时用 header X-Api-Status-Code / X-Api-Message）

type DoubaoSubmitBodyResponse = { request_id?: string } | any
type DoubaoQueryBodyResponse =
  | {
      audio_info?: { duration?: number }
      result?: { text?: string }
    }
  | any

function newRequestId() {
  return randomUUID()
}

export async function doubaoSubmit(params: {
  apiKey: string
  resourceId: string
  audioUrl: string
  audioFormat?: string
  userId: string
}) {
  const url = 'https://openspeech.bytedance.com/api/v3/auc/bigmodel/submit'
  const requestId = newRequestId()

  const body = {
    user: { uid: params.userId },
    audio: {
      url: params.audioUrl,
      format: params.audioFormat ?? 'webm',
    },
    request: {
      model_name: 'bigmodel',
      enable_itn: TrueIfAvailable(),
    },
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'X-Api-Key': params.apiKey,
      'X-Api-Resource-Id': params.resourceId,
      'X-Api-Request-Id': requestId,
      'X-Api-Sequence': '-1',
    },
    body: JSON.stringify(body),
  })

  const text = await res.text()
  let json: DoubaoSubmitBodyResponse = {}
  if (text) {
    try {
      json = JSON.parse(text)
    } catch {
      // ignore
    }
  }

  if (!res.ok) {
    return apiError('INTERNAL_ERROR', 'doubao submit failed', {
      httpStatus: res.status,
      statusCode: res.headers.get('X-Api-Status-Code'),
      message: res.headers.get('X-Api-Message'),
      body: text?.slice?.(0, 300),
    })
  }

  const statusCode = res.headers.get('X-Api-Status-Code')
  if (statusCode && statusCode !== '20000000') {
    return apiError('INTERNAL_ERROR', 'doubao submit failed', {
      url,
      requestId,
      resourceId: params.resourceId,
      audioUrl: params.audioUrl,
      statusCode,
      message: res.headers.get('X-Api-Message'),
      body: text?.slice?.(0, 300),
    })
  }

  return { ok: true as const, requestId: json?.request_id ?? requestId }
}

export type DoubaoQueryResult =
  | { ok: true; text: string; durationMs?: number; statusCode?: string | null }
  | { ok: false; pending: true; statusCode?: string | null; message?: string | null }
  | { ok: false; error: ReturnType<typeof apiError>['error'] }

export async function doubaoQuery(params: {
  apiKey: string
  resourceId: string
  requestId: string
}): Promise<DoubaoQueryResult> {
  const url = 'https://openspeech.bytedance.com/api/v3/auc/bigmodel/query'

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'X-Api-Key': params.apiKey,
      'X-Api-Resource-Id': params.resourceId,
      'X-Api-Request-Id': params.requestId,
    },
    body: JSON.stringify({}),
  })

  const text = await res.text()
  let json: DoubaoQueryBodyResponse
  try {
    json = text ? JSON.parse(text) : {}
  } catch {
    return {
      ok: false,
      error: apiError('INTERNAL_ERROR', 'doubao query bad json', { body: text.slice(0, 300) }).error,
    }
  }

  const statusCode = res.headers.get('X-Api-Status-Code')
  const message = res.headers.get('X-Api-Message')

  // Per doc:
  // - 20000000: success
  // - 20000001: processing
  // - 20000002: queued
  // - 20000003: silent audio (no speech)
  if (!res.ok) {
    return {
      ok: false,
      error: apiError('INTERNAL_ERROR', 'doubao query failed', {
        httpStatus: res.status,
        statusCode,
        message,
        body: text.slice(0, 300),
      }).error,
    }
  }

  if (statusCode === '20000001' || statusCode === '20000002') {
    return { ok: false, pending: true, statusCode, message }
  }

  if (statusCode && statusCode !== '20000000') {
    const code = statusCode === '20000003' ? 'BAD_REQUEST' : 'INTERNAL_ERROR'
    return {
      ok: false,
      error: apiError(code, 'doubao query failed', {
        url,
        requestId: params.requestId,
        resourceId: params.resourceId,
        statusCode,
        message,
        body: text.slice(0, 300),
      }).error,
    }
  }

  const out = (json?.result?.text ?? '').trim()
  if (!out) {
    return {
      ok: false,
      error: apiError('INTERNAL_ERROR', 'doubao query empty result', { statusCode, message }).error,
    }
  }

  return { ok: true as const, text: out, durationMs: json?.audio_info?.duration, statusCode }
}

function TrueIfAvailable() {
  // keep JSON stable; some docs show enable_itn: true
  return true
}
