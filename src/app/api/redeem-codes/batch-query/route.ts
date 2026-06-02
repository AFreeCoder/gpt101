import { enforceMinIntervalRateLimit } from '@/shared/lib/rate-limit';
import {
  normalizeRedeemCode,
  validateRedeemCodeFormat,
} from '@/shared/lib/redeem-code';
import { respData, respErr } from '@/shared/lib/resp';
import {
  maskRedeemCodeUsagePublicResult,
  normalizeRedeemCodeBatchInput,
  queryRedeemCodeUsageBatch,
} from '@/shared/models/redeem-code';

type QueryRedeemCodeUsageBatch = typeof queryRedeemCodeUsageBatch;

const PUBLIC_BATCH_QUERY_RATE_LIMIT_INTERVAL_MS = Number(
  process.env.REDEEM_CODE_PUBLIC_BATCH_QUERY_MIN_INTERVAL_MS || 3000
);
const DEFAULT_PUBLIC_BATCH_QUERY_RATE_LIMIT_INTERVAL_MS = 3000;

const PUBLIC_BATCH_QUERY_ERRORS = new Set([
  '最多查询 100 个卡密',
  '卡密格式不正确',
]);

function getClientIp(req: Request) {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-real-ip') ||
    ''
  );
}

function getBatchQueryInput(body: any) {
  return Array.isArray(body.codes)
    ? body.codes
    : typeof body.text === 'string'
      ? body.text
      : '';
}

function countBatchQueryInput(input: string[] | string) {
  const lines = Array.isArray(input) ? input : input.split(/\r?\n/);
  return lines.map((line) => String(line).trim()).filter(Boolean).length;
}

function getPublicBatchQueryRateLimitIntervalMs() {
  return Number.isFinite(PUBLIC_BATCH_QUERY_RATE_LIMIT_INTERVAL_MS)
    ? PUBLIC_BATCH_QUERY_RATE_LIMIT_INTERVAL_MS
    : DEFAULT_PUBLIC_BATCH_QUERY_RATE_LIMIT_INTERVAL_MS;
}

function normalizePublicBatchQueryCodes(input: string[] | string) {
  const codes = normalizeRedeemCodeBatchInput(input).map((code) =>
    normalizeRedeemCode(code)
  );

  if (codes.some((code) => !validateRedeemCodeFormat(code))) {
    throw new Error('卡密格式不正确');
  }

  return codes;
}

function recordPublicBatchQueryAudit(args: {
  req: Request;
  count: number;
  outcome: 'success' | 'failed' | 'rate_limited';
  message?: string;
}) {
  console.info('[redeem-code-public-batch-query]', {
    outcome: args.outcome,
    count: args.count,
    clientIp: getClientIp(args.req),
    userAgent: args.req.headers.get('user-agent') || '',
    message: args.message,
  });
}

function publicRateLimitResponse(limited: Response) {
  return Response.json(
    { code: -1, message: '查询过于频繁，请稍后重试' },
    {
      status: 429,
      headers: {
        'cache-control': 'no-store',
        'retry-after': limited.headers.get('retry-after') || '1',
      },
    }
  );
}

export async function handlePublicRedeemCodeBatchQuery(
  req: Request,
  queryUsageBatch: QueryRedeemCodeUsageBatch = queryRedeemCodeUsageBatch
) {
  let count = 0;

  try {
    const body = await req.json();
    const input = getBatchQueryInput(body);
    count = countBatchQueryInput(input);
    const codes = normalizePublicBatchQueryCodes(input);
    count = codes.length;

    const limited = enforceMinIntervalRateLimit(req, {
      intervalMs: getPublicBatchQueryRateLimitIntervalMs(),
      keyPrefix: 'redeem-code-public-batch-query',
    });
    if (limited) {
      recordPublicBatchQueryAudit({
        req,
        count,
        outcome: 'rate_limited',
        message: 'too_many_requests',
      });
      return publicRateLimitResponse(limited);
    }

    const result = await queryUsageBatch(codes);
    recordPublicBatchQueryAudit({ req, count, outcome: 'success' });
    return respData(maskRedeemCodeUsagePublicResult(result));
  } catch (err: any) {
    const message = PUBLIC_BATCH_QUERY_ERRORS.has(err?.message)
      ? err.message
      : '查询失败，请稍后重试';
    recordPublicBatchQueryAudit({
      req,
      count,
      outcome: 'failed',
      message,
    });
    return respErr(message);
  }
}

export async function POST(req: Request) {
  return handlePublicRedeemCodeBatchQuery(req);
}
