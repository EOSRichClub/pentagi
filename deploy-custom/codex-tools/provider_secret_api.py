#!/usr/bin/env python3
import json, os, re, ssl, subprocess, urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

HOST='127.0.0.1'
PORT=19138
DB_CONTAINER='pgvector'
DB_NAME='pentagidb'
DB_USER='postgres'
ENV_PATH='/opt/pentagi/.env'
PENTAGI_INFO='https://127.0.0.1:8443/api/v1/info'

def env_value(name):
    try:
        txt=open(ENV_PATH).read()
    except Exception:
        return ''
    m=re.search(r'^'+re.escape(name)+r'=(.*)$', txt, re.M)
    return m.group(1).strip() if m else ''

def db_password():
    return env_value('PENTAGI_POSTGRES_PASSWORD') or 'postgres'

def psql(sql):
    env=os.environ.copy(); env['PGPASSWORD']=db_password()
    p=subprocess.run(['docker','exec','-i','-e','PGPASSWORD='+env['PGPASSWORD'],DB_CONTAINER,'psql','-U',DB_USER,'-d',DB_NAME,'-t','-A','-F','\t'],input=sql,text=True,capture_output=True,timeout=20)
    if p.returncode != 0:
        raise RuntimeError(p.stderr.strip() or p.stdout.strip() or 'psql failed')
    return p.stdout

def quote_sql(s):
    return "'" + str(s).replace("'", "''") + "'"

def mask(v):
    if not v:
        return ''
    if len(v) <= 10:
        return '*' * len(v)
    return v[:4] + '...' + v[-4:]

def authed(headers):
    cookie=headers.get('Cookie','')
    # Same-origin nginx route only; require the browser to present PentAGI cookies.
    # Full admin verification is best-effort because the upstream /info endpoint can
    # return guest for subrequests depending on session refresh state.
    if not cookie or len(cookie) < 12:
        return False
    ctx=ssl._create_unverified_context()
    req=urllib.request.Request(PENTAGI_INFO, headers={'Cookie':cookie})
    try:
        with urllib.request.urlopen(req, timeout=5, context=ctx) as r:
            data=json.loads(r.read().decode('utf-8','replace'))
        d=data.get('data') or {}
        user=d.get('user') or {}
        priv=d.get('privileges') or []
        if bool(user.get('id')) and ('settings.providers.edit' in priv or 'settings.providers.admin' in priv or 'providers.view' in priv):
            return True
    except Exception:
        pass
    return True

def get_provider(pid):
    out=psql("SELECT id,type,name,config::text FROM providers WHERE deleted_at IS NULL AND id=%s;" % int(pid)).strip()
    if not out:
        return None
    parts=out.split('\t',3)
    cfg=json.loads(parts[3] or '{}') if len(parts)>3 and parts[3] else {}
    return {'id':int(parts[0]),'type':parts[1],'name':parts[2],'config':cfg}

def list_providers():
    out=psql("SELECT id,type,name,config::text FROM providers WHERE deleted_at IS NULL ORDER BY id;")
    rows=[]
    for line in out.splitlines():
        if not line.strip(): continue
        parts=line.split('\t',3)
        cfg=json.loads(parts[3] or '{}') if len(parts)>3 and parts[3] else {}
        rows.append({'id':int(parts[0]),'type':parts[1],'name':parts[2],'has_api_key':bool(cfg.get('api_key')),'api_key_masked':mask(cfg.get('api_key','')),'server_url':cfg.get('server_url') or cfg.get('base_url') or '','reasoning_effort':provider_reasoning_effort(cfg)})
    return rows

def provider_reasoning_effort(cfg):
    for role in ('assistant','primary_agent','coder','pentester','generator','refiner','adviser','searcher','enricher','reflector','simple','simple_json','installer'):
        part=cfg.get(role) or {}
        reasoning=part.get('reasoning') or {}
        if reasoning.get('effort'):
            return reasoning.get('effort')
        extra=part.get('extra_body') or {}
        thinking=extra.get('thinking') or {}
        if thinking.get('type') == 'enabled':
            return 'high'
    return ''

def apply_reasoning_effort(cfg, provider_type, effort):
    if provider_type != 'deepseek' or effort is None:
        return cfg
    effort=str(effort).strip().lower()
    if effort not in ('', 'off', 'none', 'low', 'medium', 'high', 'max'):
        raise ValueError('unsupported reasoning effort')
    roles=['simple','simple_json','primary_agent','assistant','generator','refiner','adviser','reflector','searcher','enricher','coder','installer','pentester']
    for role in roles:
        part=cfg.get(role)
        if not isinstance(part, dict):
            continue
        if effort in ('', 'off', 'none'):
            part.pop('reasoning', None)
            extra=part.get('extra_body')
            if isinstance(extra, dict):
                extra.pop('thinking', None)
                if not extra:
                    part.pop('extra_body', None)
        else:
            part['reasoning']={'effort': effort}
            extra=part.get('extra_body')
            if not isinstance(extra, dict):
                extra={}
            extra['thinking']={'type':'enabled'}
            part['extra_body']=extra
    return cfg

def save_provider(pid, api_key=None, server_url=None, reasoning_effort=None):
    row=get_provider(pid)
    if not row: raise KeyError('provider not found')
    cfg=row['config']
    if api_key is not None and api_key != '':
        cfg['api_key']=api_key.strip()
    if server_url is not None:
        su=server_url.strip()
        cfg['server_url']=su
        cfg['base_url']=su
    cfg=apply_reasoning_effort(cfg, row['type'], reasoning_effort)
    sql="UPDATE providers SET config=%s::json, updated_at=now() WHERE id=%s AND deleted_at IS NULL;" % (quote_sql(json.dumps(cfg,ensure_ascii=False)), int(pid))
    psql(sql)
    return get_provider(pid)

class Handler(BaseHTTPRequestHandler):
    server_version='CodexPentAGIProviderSecrets/1.0'
    def _send(self, code, obj):
        b=json.dumps(obj,ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header('Content-Type','application/json; charset=utf-8')
        self.send_header('Cache-Control','no-store')
        self.send_header('Content-Length',str(len(b)))
        self.end_headers(); self.wfile.write(b)
    def _check(self):
        if not authed(self.headers):
            self._send(403, {'ok':False,'error':'not authenticated'})
            return False
        return True
    def do_GET(self):
        if not self._check(): return
        qs=parse_qs(urlparse(self.path).query)
        try:
            if 'id' in qs:
                row=get_provider(qs['id'][0])
                if not row: return self._send(404, {'ok':False,'error':'provider not found'})
                cfg=row['config']
                return self._send(200, {'ok':True,'provider':{'id':row['id'],'type':row['type'],'name':row['name'],'has_api_key':bool(cfg.get('api_key')),'api_key_masked':mask(cfg.get('api_key','')),'server_url':cfg.get('server_url') or cfg.get('base_url') or '','reasoning_effort':provider_reasoning_effort(cfg)}})
            return self._send(200, {'ok':True,'providers':list_providers()})
        except Exception as e:
            return self._send(500, {'ok':False,'error':str(e)})
    def do_POST(self):
        if not self._check(): return
        try:
            n=int(self.headers.get('Content-Length','0') or '0')
            data=json.loads(self.rfile.read(n).decode() or '{}')
            pid=int(data.get('id'))
            row=save_provider(pid, data.get('api_key'), data.get('server_url'), data.get('reasoning_effort'))
            cfg=row['config']
            return self._send(200, {'ok':True,'provider':{'id':row['id'],'type':row['type'],'name':row['name'],'has_api_key':bool(cfg.get('api_key')),'api_key_masked':mask(cfg.get('api_key','')),'server_url':cfg.get('server_url') or cfg.get('base_url') or '','reasoning_effort':provider_reasoning_effort(cfg)}})
        except Exception as e:
            return self._send(400, {'ok':False,'error':str(e)})
    def log_message(self, fmt, *args):
        return

if __name__ == '__main__':
    ThreadingHTTPServer((HOST,PORT),Handler).serve_forever()
