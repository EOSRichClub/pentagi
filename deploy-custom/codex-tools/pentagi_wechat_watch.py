#!/usr/bin/env python3
import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import ssl
import string
import subprocess
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path('/opt/pentagi')
STATE_PATH = ROOT / 'codex-tools' / 'flow_watch_state.json'
ENV_PATH = ROOT / '.env'
TOKEN_PATH = ROOT / 'codex-tools' / 'api_token.secret'
STALE_MINUTES = int(os.getenv('PENTAGI_WECHAT_STALE_MINUTES', '30'))
TOOLCALL_SOFT_LIMIT = int(os.getenv('PENTAGI_WECHAT_TOOLCALL_SOFT_LIMIT', '100'))
CONTINUE_MESSAGE = os.getenv('PENTAGI_AUTO_CONTINUE_MESSAGE', '继续推进')
GRAPHQL_URL = os.getenv('PENTAGI_GRAPHQL_URL', 'https://127.0.0.1:8443/api/v1/graphql')
AUTO_CONTINUE_ENABLED = os.getenv('PENTAGI_AUTO_CONTINUE_ON_ITERATION_LIMIT', '1') not in {
    '0', 'false', 'False', 'no', 'NO',
}
USE_AGENTS_ON_CONTINUE = os.getenv('PENTAGI_AUTO_CONTINUE_USE_AGENTS', '1') not in {
    '0', 'false', 'False', 'no', 'NO',
}


def load_env(path):
    data = {}
    if path.exists():
        for raw in path.read_text(encoding='utf-8', errors='replace').splitlines():
            line = raw.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            key, value = line.split('=', 1)
            data[key] = value.strip().strip('"').strip("'")
    return data


def psql_json(sql):
    cmd = [
        'docker', 'exec', 'pgvector', 'psql', '-U', 'postgres',
        '-d', 'pentagidb', '-t', '-A', '-c', f'COPY ({sql}) TO STDOUT',
    ]
    return subprocess.check_output(cmd, text=True)


def psql_exec(sql):
    cmd = [
        'docker', 'exec', 'pgvector', 'psql', '-U', 'postgres',
        '-d', 'pentagidb', '-t', '-A', '-c', sql,
    ]
    return subprocess.check_output(cmd, text=True).strip()


def parse_ts(value):
    if not value:
        return None
    value = value.replace(' ', 'T')
    if value.endswith('+00'):
        value += ':00'
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def load_state():
    if STATE_PATH.exists():
        try:
            return json.loads(STATE_PATH.read_text(encoding='utf-8'))
        except (OSError, json.JSONDecodeError):
            return {}
    return {}


def save_state(state):
    tmp = STATE_PATH.with_suffix('.tmp')
    tmp.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding='utf-8')
    tmp.replace(STATE_PATH)


def send_wechat(webhook, text):
    payload = json.dumps(
        {'msgtype': 'text', 'text': {'content': text}},
        ensure_ascii=False,
    ).encode('utf-8')
    request = urllib.request.Request(
        webhook,
        data=payload,
        method='POST',
        headers={'Content-Type': 'application/json'},
    )
    with urllib.request.urlopen(request, timeout=15) as response:
        body = response.read().decode('utf-8', 'replace')
    result = json.loads(body)
    if result.get('errcode') != 0:
        raise RuntimeError(f"WeCom rejected message: {result.get('errcode')} {result.get('errmsg')}")
    return result


def normalize_message(value):
    return re.sub(r'\s+', '', value or '').strip('。.!！')


def is_iteration_limit_message(value):
    text = value or ''
    lower = text.lower()
    english = 'iteration limit' in lower and (
        '100' in lower or 'multi-turn chain' in lower or '智能体' in text
    )
    chinese = bool(re.search(r'(智能体|agent|消息|轮次).{0,20}(上限|限制)', text, re.I))
    # Exact product phrasing variants (EN / mixed CN).
    product = bool(re.search(
        r"can.?t continue this multi-turn chain because I.?m too close to the AI",
        text,
        re.I,
    ))
    return english or chinese or product


def already_continued(row):
    answer_id = int(row.get('last_answer_id') or 0)
    input_id = int(row.get('last_input_id') or 0)
    return (
        input_id > answer_id
        and normalize_message(row.get('last_input_message')) == normalize_message(CONTINUE_MESSAGE)
    )


def event_id_for(row, status):
    marker = row.get('last_answer_id') or row.get('updated_at') or 'unknown'
    return f"{row['kind']}:{row['id']}:{status}:{marker}"


def describe_subject(row):
    title = row.get('flow_title') or f"Flow {row.get('flow_id')}"
    if row['kind'] == 'assistant':
        subject = f"助手 #{row['assistant_id']}《{row.get('assistant_title') or '未命名'}》"
    else:
        subject = f"任务流 #{row['flow_id']}《{title}》"
    return title, subject


def build_notification(row, event, reason):
    title, subject = describe_subject(row)
    return (
        "PentAGI 通知\n"
        f"事件：{event}\n"
        f"对象：{subject}\n"
        f"任务流：#{row.get('flow_id')}《{title}》\n"
        f"模型：{row.get('model_provider_name') or row.get('model_provider_type') or '未知'}\n"
        f"状态：{row.get('status') or 'unknown'}\n"
        f"原因：{reason}\n"
        f"更新时间：{row.get('updated_at')}\n"
        f"工具调用：总计 {row.get('toolcalls_total') or 0}，失败 {row.get('toolcalls_failed') or 0}"
    )


def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode('ascii')


def make_jwt_signing_key(global_salt: str) -> bytes:
    password = '|'.join([
        '4c1e9cb77df7f9a58fcc5f52d40af685',
        global_salt,
        '09784e190148d13d48885aa47cf8a297',
    ]).encode('utf-8')
    salt = f'pentagi.jwt.signing|{global_salt}'.encode('utf-8')
    return hashlib.pbkdf2_hmac('sha512', password, salt, 210000, dklen=32)


def generate_token_id(length=10) -> str:
    alphabet = string.digits + string.ascii_letters
    return ''.join(secrets.choice(alphabet) for _ in range(length))


def mint_api_token(global_salt: str, token_id: str, uid: int, rid: int, uhash: str, ttl: int) -> str:
    now = int(time_now())
    header = {'alg': 'HS256', 'typ': 'JWT'}
    claims = {
        'tid': token_id,
        'rid': rid,
        'uid': uid,
        'uhash': uhash,
        'exp': now + ttl,
        'iat': now,
        'sub': 'api_token',
    }
    signing_input = f"{b64url(json.dumps(header, separators=(',', ':')).encode())}." \
                    f"{b64url(json.dumps(claims, separators=(',', ':')).encode())}"
    key = make_jwt_signing_key(global_salt)
    sig = hmac.new(key, signing_input.encode('ascii'), hashlib.sha256).digest()
    return f"{signing_input}.{b64url(sig)}"


def time_now() -> int:
    return int(datetime.now(timezone.utc).timestamp())


def ensure_api_token(env: dict) -> str:
    token = (
        os.getenv('PENTAGI_API_TOKEN')
        or env.get('PENTAGI_API_TOKEN')
        or (TOKEN_PATH.read_text(encoding='utf-8').strip() if TOKEN_PATH.exists() else '')
    )
    if token:
        return token

    global_salt = env.get('COOKIE_SIGNING_SALT') or ''
    if not global_salt or global_salt == 'salt':
        raise RuntimeError('COOKIE_SIGNING_SALT missing; cannot mint automation API token')

    row = psql_exec("SELECT id || '|' || role_id || '|' || hash FROM users WHERE id=1 AND status='active' LIMIT 1;")
    if not row:
        raise RuntimeError('admin user id=1 not found')
    uid_s, rid_s, uhash = row.split('|', 2)
    uid, rid = int(uid_s), int(rid_s)
    token_id = generate_token_id()
    ttl = 3 * 365 * 24 * 3600  # 3 years
    jwt_token = mint_api_token(global_salt, token_id, uid, rid, uhash, ttl)
    name = 'pentagi-wechat-watch-auto-continue'
    psql_exec(
        "INSERT INTO api_tokens (token_id, user_id, role_id, name, ttl, status) "
        f"VALUES ('{token_id}', {uid}, {rid}, '{name}', {ttl}, 'active') "
        "ON CONFLICT (token_id) DO NOTHING;"
    )
    TOKEN_PATH.write_text(jwt_token + '\n', encoding='utf-8')
    TOKEN_PATH.chmod(0o600)

    # Keep .env in sync for operator visibility (do not print token).
    env_lines = ENV_PATH.read_text(encoding='utf-8', errors='replace').splitlines() if ENV_PATH.exists() else []
    key = 'PENTAGI_API_TOKEN'
    replaced = False
    out = []
    for line in env_lines:
        if line.startswith(key + '='):
            out.append(f'{key}={jwt_token}')
            replaced = True
        else:
            out.append(line)
    if not replaced:
        out.append(f'{key}={jwt_token}')
    ENV_PATH.write_text('\n'.join(out) + '\n', encoding='utf-8')
    return jwt_token


def call_assistant(token: str, flow_id: int, assistant_id: int, message: str, use_agents: bool) -> dict:
    payload = {
        'query': (
            'mutation callAssistant('
            '$flowId: ID!, $assistantId: ID!, $input: String!, $useAgents: Boolean!, $resourceIds: [ID!]'
            ') { callAssistant(flowId: $flowId, assistantId: $assistantId, input: $input, '
            'useAgents: $useAgents, resourceIds: $resourceIds) }'
        ),
        'variables': {
            'flowId': str(flow_id),
            'assistantId': str(assistant_id),
            'input': message,
            'useAgents': bool(use_agents),
            'resourceIds': [],
        },
    }
    body = json.dumps(payload).encode('utf-8')
    request = urllib.request.Request(
        GRAPHQL_URL,
        data=body,
        method='POST',
        headers={
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {token}',
        },
    )
    ctx = ssl._create_unverified_context()
    try:
        with urllib.request.urlopen(request, timeout=30, context=ctx) as response:
            raw = response.read().decode('utf-8', 'replace')
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode('utf-8', 'replace')
        raise RuntimeError(f'GraphQL HTTP {exc.code}: {raw[:500]}') from exc
    data = json.loads(raw)
    if data.get('errors'):
        raise RuntimeError(f"GraphQL errors: {data['errors']}")
    result = (data.get('data') or {}).get('callAssistant')
    if result not in ('success', 'Success', 'SUCCESS') and str(result).lower() != 'success':
        # ResultType enum may be success/error
        if str(result).lower() == 'error':
            raise RuntimeError(f'callAssistant returned error: {data}')
    return data


def recent_auto_continue(previous, row, cooldown_seconds=180):
    """Skip re-inject while a previous auto-continue for the same answer is still settling."""
    if previous.get('last_auto_continue_answer_id') != row.get('last_answer_id'):
        return False
    ts = parse_ts(previous.get('last_auto_continue_at'))
    if not ts:
        return False
    age = (datetime.now(timezone.utc) - ts).total_seconds()
    return age < cooldown_seconds


def classify_transition(row, previous, initialized, inactive_minutes):
    """
    Returns:
      (event_id, event, reason, action)
      action: None | 'notify' | 'auto_continue' | 'suppress'
    """
    status = row.get('status') or 'unknown'
    is_active = status in {'created', 'running'}
    prev_active = bool(previous.get('active'))
    prev_seen = bool(previous)

    if not (initialized and prev_seen):
        return None

    event_id = event_id_for(row, status)
    if previous.get('last_handled_event') == event_id:
        return None

    # Only act on the same edge as WeCom: previous poll still active
    # (created/running), this poll has stopped. Historical waiting items
    # that were already stopped last round are ignored.
    if prev_active and status == 'finished':
        return event_id, '任务跑完了', '上一轮仍在运行，本轮状态变为 finished', 'notify'

    if prev_active and status == 'failed':
        return event_id, '任务失败了', '上一轮仍在运行，本轮状态变为 failed', 'notify'

    if prev_active and status == 'waiting':
        if row['kind'] == 'assistant' and is_iteration_limit_message(row.get('last_answer_message')):
            if already_continued(row):
                return event_id, None, '轮次上限后已经发送过“继续推进”，本次不再通知', 'suppress'
            if recent_auto_continue(previous, row):
                return None
            if AUTO_CONTINUE_ENABLED:
                return (
                    event_id,
                    None,
                    '上一轮仍在运行，本轮因 100 轮上限停止；自动回复“继续推进”，不推送企微',
                    'auto_continue',
                )
            return (
                event_id,
                '智能体达到轮次上限，需要人工确认',
                '上一轮仍在运行，本轮命中 100 轮上限；自动续跑已关闭',
                'notify',
            )

        hints = ['上一轮仍在运行，本轮状态变为 waiting']
        if int(row.get('toolcalls_total') or 0) >= TOOLCALL_SOFT_LIMIT:
            hints.append(f"toolcalls 累计 {row.get('toolcalls_total')}，疑似达到 agent 调用上限")
        if int(row.get('toolcalls_failed') or 0) > 0:
            hints.append(f"存在失败工具调用 {row.get('toolcalls_failed')} 次")
        return event_id, '任务已停止，等待人工检查', '；'.join(hints), 'notify'

    now_stale = inactive_minutes is not None and inactive_minutes >= STALE_MINUTES
    was_stale = bool(previous.get('stale'))
    if is_active and prev_active and not was_stale and now_stale:
        hints = [f"仍是 {status}，但最近 {inactive_minutes} 分钟无新活动"]
        if int(row.get('toolcalls_total') or 0) >= TOOLCALL_SOFT_LIMIT:
            hints.append(f"toolcalls 累计 {row.get('toolcalls_total')}，疑似达到 agent 调用上限")
        if int(row.get('toolcalls_failed') or 0) > 0:
            hints.append(f"存在失败工具调用 {row.get('toolcalls_failed')} 次")
        return event_id, '运行中任务长时间没有继续推进', '；'.join(hints), 'notify'

    return None


def query_rows():
    sql = """
    WITH tool_stats AS (
      SELECT flow_id,
             count(*) AS toolcalls_total,
             count(*) FILTER (WHERE status='failed') AS toolcalls_failed,
             max(updated_at) AS last_toolcall_at
      FROM toolcalls
      GROUP BY flow_id
    ), chain_stats AS (
      SELECT flow_id, max(updated_at) AS last_chain_at
      FROM msgchains
      GROUP BY flow_id
    )
    SELECT replace(encode(convert_to(row_to_json(x)::text, 'UTF8'), 'base64'), chr(10), '')
    FROM (
      SELECT 'flow' AS kind, f.id, f.id AS flow_id, f.title AS flow_title,
             NULL::bigint AS assistant_id, NULL::text AS assistant_title,
             f.status::text AS status, f.model_provider_name, f.model_provider_type::text,
             f.created_at, f.updated_at,
             COALESCE(ts.toolcalls_total, 0) AS toolcalls_total,
             COALESCE(ts.toolcalls_failed, 0) AS toolcalls_failed,
             ts.last_toolcall_at, cs.last_chain_at,
             NULL::bigint AS last_answer_id, NULL::text AS last_answer_message,
             NULL::timestamptz AS last_answer_at,
             NULL::bigint AS last_input_id, NULL::text AS last_input_message,
             NULL::timestamptz AS last_input_at
      FROM flows f
      LEFT JOIN tool_stats ts ON ts.flow_id=f.id
      LEFT JOIN chain_stats cs ON cs.flow_id=f.id
      WHERE f.deleted_at IS NULL

      UNION ALL

      SELECT 'assistant' AS kind, a.id, a.flow_id, f.title AS flow_title,
             a.id AS assistant_id, a.title AS assistant_title,
             a.status::text AS status, a.model_provider_name, a.model_provider_type::text,
             a.created_at, a.updated_at,
             COALESCE(ts.toolcalls_total, 0) AS toolcalls_total,
             COALESCE(ts.toolcalls_failed, 0) AS toolcalls_failed,
             ts.last_toolcall_at, cs.last_chain_at,
             answer.id AS last_answer_id, answer.message AS last_answer_message,
             answer.created_at AS last_answer_at,
             input.id AS last_input_id, input.message AS last_input_message,
             input.created_at AS last_input_at
      FROM assistants a
      LEFT JOIN flows f ON f.id=a.flow_id
      LEFT JOIN tool_stats ts ON ts.flow_id=a.flow_id
      LEFT JOIN chain_stats cs ON cs.flow_id=a.flow_id
      LEFT JOIN LATERAL (
        SELECT l.id, l.message, l.created_at
        FROM assistantlogs l
        WHERE l.assistant_id=a.id AND l.type='answer'
        ORDER BY l.id DESC LIMIT 1
      ) answer ON true
      LEFT JOIN LATERAL (
        SELECT l.id, l.message, l.created_at
        FROM assistantlogs l
        WHERE l.assistant_id=a.id AND l.type='input'
        ORDER BY l.id DESC LIMIT 1
      ) input ON true
      WHERE a.deleted_at IS NULL
    ) x
    ORDER BY flow_id, kind, id
    """
    rows = []
    for line in psql_json(sql).splitlines():
        if line.strip():
            rows.append(json.loads(base64.b64decode(line).decode('utf-8')))
    return rows


def update_observation(previous, row, inactive_minutes):
    status = row.get('status') or 'unknown'
    previous.update({
        'status': status,
        'active': status in {'created', 'running'},
        'updated_at': row.get('updated_at'),
        'last_toolcall_at': row.get('last_toolcall_at'),
        'last_chain_at': row.get('last_chain_at'),
        'last_answer_id': row.get('last_answer_id'),
        'last_input_id': row.get('last_input_id'),
        'stale': bool(inactive_minutes is not None and inactive_minutes >= STALE_MINUTES),
    })


def self_test():
    base = {
        'kind': 'assistant', 'id': 8, 'assistant_id': 8, 'flow_id': 40,
        'flow_title': '测试', 'assistant_title': '测试助手', 'status': 'waiting',
        'updated_at': '2026-08-16T00:05:00+00:00', 'last_answer_id': 101,
        'last_answer_message': (
            "I can’t continue this multi-turn chain because I’m too close "
            "to the AI 智能体 iteration limit (100)."
        ),
        'last_input_id': 100, 'last_input_message': '原任务',
        'toolcalls_total': 100, 'toolcalls_failed': 0,
    }
    previous = {'status': 'running', 'active': True}
    result = classify_transition(base, previous, True, 0)
    assert result and result[3] == 'auto_continue' and result[1] is None

    # Already stopped last poll: ignore even if the limit phrase is visible.
    already_waiting = {'status': 'waiting', 'active': False}
    assert classify_transition(base, already_waiting, True, 0) is None

    continued = dict(base, last_input_id=102, last_input_message='继续推进')
    result = classify_transition(continued, previous, True, 0)
    assert result and result[3] == 'suppress' and result[1] is None

    normal = dict(base, last_answer_message='任务阶段完成，等待下一步输入')
    result = classify_transition(normal, previous, True, 0)
    assert result and result[3] == 'notify' and result[1] == '任务已停止，等待人工检查'

    finished = dict(base, status='finished', last_answer_message='done')
    result = classify_transition(finished, previous, True, 0)
    assert result and result[3] == 'notify' and result[1] == '任务跑完了'

    handled = {'status': 'running', 'active': True, 'last_handled_event': event_id_for(base, 'waiting')}
    assert classify_transition(base, handled, True, 0) is None

    en = (
        "I can't continue this multi-turn chain because I'm too close "
        "to the AI agent iteration limit (100)."
    )
    assert is_iteration_limit_message(en)
    assert is_iteration_limit_message(base['last_answer_message'])
    print('self-test passed')


def main():
    if '--self-test' in sys.argv:
        self_test()
        return 0

    env = load_env(ENV_PATH)
    webhook = (
        os.getenv('PENTAGI_WECHAT_WEBHOOK_URL')
        or env.get('PENTAGI_WECHAT_WEBHOOK_URL')
        or env.get('WECHAT_WEBHOOK_URL')
    )
    state = load_state()
    initialized = bool(state.get('initialized'))
    now = datetime.now(timezone.utc)
    items = state.setdefault('items', {})
    state['initialized'] = True

    queued = []
    suppressed = 0
    auto_continued = 0
    auto_failed = 0
    rows = query_rows()

    api_token = None
    if AUTO_CONTINUE_ENABLED:
        try:
            api_token = ensure_api_token(env)
        except Exception as exc:
            print(f"api token unavailable: {exc}", file=sys.stderr)

    for row in rows:
        key = f"{row['kind']}:{row['id']}"
        previous = items.get(key, {})
        last_activity = (
            parse_ts(row.get('last_toolcall_at'))
            or parse_ts(row.get('last_chain_at'))
            or parse_ts(row.get('updated_at'))
        )
        inactive_minutes = None
        if last_activity:
            inactive_minutes = int((now - last_activity).total_seconds() // 60)

        transition = classify_transition(row, previous, initialized, inactive_minutes)
        if transition:
            event_id, event, reason, action = transition
            if action == 'suppress':
                previous['last_handled_event'] = event_id
                previous.pop('pending_notification', None)
                suppressed += 1
            elif action == 'auto_continue':
                if not api_token:
                    # Fall back to notification when we cannot inject.
                    pending = {
                        'event_id': event_id,
                        'text': build_notification(
                            row,
                            '智能体达到轮次上限，自动续跑失败',
                            f'{reason}；无法获取 API Token',
                        ),
                        'created_at': now.isoformat(),
                    }
                    previous['pending_notification'] = pending
                    auto_failed += 1
                else:
                    try:
                        call_assistant(
                            api_token,
                            int(row['flow_id']),
                            int(row['assistant_id']),
                            CONTINUE_MESSAGE,
                            USE_AGENTS_ON_CONTINUE,
                        )
                        # Do not mark last_handled_event yet; only suppress after we
                        # observe the continue input, or after cooldown settles.
                        previous.pop('pending_notification', None)
                        previous['last_auto_continue_at'] = now.isoformat()
                        previous['last_auto_continue_answer_id'] = row.get('last_answer_id')
                        auto_continued += 1
                        print(
                            f"auto-continued assistant={row['assistant_id']} "
                            f"flow={row['flow_id']} answer={row.get('last_answer_id')}"
                        )
                    except Exception as exc:
                        auto_failed += 1
                        pending = {
                            'event_id': event_id,
                            'text': build_notification(
                                row,
                                '智能体达到轮次上限，自动续跑失败',
                                f'{reason}；注入失败：{exc}',
                            ),
                            'created_at': now.isoformat(),
                        }
                        previous['pending_notification'] = pending
                        print(
                            f"auto-continue failed assistant={row['assistant_id']}: {exc}",
                            file=sys.stderr,
                        )
            elif action == 'notify':
                pending = previous.get('pending_notification')
                if not pending or pending.get('event_id') != event_id:
                    pending = {
                        'event_id': event_id,
                        'text': build_notification(row, event, reason),
                        'created_at': now.isoformat(),
                    }
                    previous['pending_notification'] = pending

        update_observation(previous, row, inactive_minutes)
        items[key] = previous

    for key, item in items.items():
        pending = item.get('pending_notification')
        if pending:
            queued.append((key, pending))

    # Persist pending events before network I/O so a failed webhook call is retried.
    save_state(state)

    sent = 0
    failed = 0
    if webhook:
        for key, pending in queued:
            try:
                send_wechat(webhook, pending['text'])
                item = items[key]
                item['last_handled_event'] = pending['event_id']
                item.pop('pending_notification', None)
                sent += 1
            except Exception as exc:
                failed += 1
                print(f"send failed for {key}: {exc}", file=sys.stderr)
    elif queued:
        print(f"webhook not configured; pending={len(queued)}", file=sys.stderr)

    save_state(state)
    print(
        f"checked={len(rows)} queued={len(queued)} sent={sent} failed={failed} "
        f"suppressed_already_continued={suppressed} "
        f"auto_continued={auto_continued} auto_failed={auto_failed}"
    )
    return 1 if failed or auto_failed else 0


if __name__ == '__main__':
    raise SystemExit(main())
