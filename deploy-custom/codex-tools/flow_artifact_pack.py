#!/usr/bin/env python3
import argparse, csv, json, os, re, shutil, subprocess
from datetime import datetime
from pathlib import Path

ROOT = Path('/var/lib/docker/volumes/pentagi_pentagi-data/_data')
GLOBAL_OUT_ROOT = Path('/opt/pentagi/artifact-packs')  # legacy only; new output is per-flow
DELIVERABLE_DIR = 'deliverables'
PACK_DIR = 'artifact-packs'
SNAP_DIR = '.snapshots'
DB = ['docker','exec','pgvector','psql','-U','postgres','-d','pentagidb','-t','-A','-F','\t']
SAFE = re.compile(r'[^0-9A-Za-z\u4e00-\u9fff._-]+')
REPORT_EXTS = {'.md', '.pdf', '.html', '.htm', '.docx'}
DB_EXTS = {'.sql', '.csv', '.xlsx', '.xls', '.tsv', '.jsonl', '.sqlite', '.db', '.duckdb'}
ARCHIVE_EXTS = {'.zip', '.tar', '.tgz', '.rar', '.7z', '.gz', '.bz2', '.xz'}
SOURCE_EXTS = {'.php','.js','.ts','.tsx','.jsx','.py','.go','.java','.vue','.wxml','.wxss','.css','.html','.json','.yaml','.yml','.env','.sh','.sql'}


def safe_name(s, fallback):
    s = (s or '').strip() or fallback
    s = SAFE.sub('_', s).strip('._-')
    return s[:96] or fallback


def psql_one(sql):
    try:
        out = subprocess.check_output(DB + ['-c', sql], text=True).strip()
        return out.splitlines()[0] if out else ''
    except Exception:
        return ''


def flow_title(flow_id):
    return psql_one(f"SELECT title FROM flows WHERE id={int(flow_id)}")


def flow_status(flow_id):
    return psql_one(f"SELECT status::text FROM flows WHERE id={int(flow_id)}")


def hardlink_or_copy(src, dst, force_copy=False):
    dst.parent.mkdir(parents=True, exist_ok=True)
    if not force_copy:
        try:
            os.link(src, dst)
            return 'hardlink'
        except Exception:
            pass
    shutil.copy2(src, dst)
    return 'copy'


def suffixes_lower(path):
    return ''.join(path.suffixes).lower(), path.suffix.lower()


def is_report(path):
    if path.name == '.gitkeep':
        return False
    name = path.name.lower()
    suf_all, suf = suffixes_lower(path)
    in_reports = '/reports/' in str(path) and suf in REPORT_EXTS
    by_name = any(k in name for k in ['report','报告','summary','摘要','findings','结论','交付']) and suf in REPORT_EXTS.union({'.txt'})
    return in_reports or by_name


def report_kind(path):
    n = path.name.lower()
    parent = str(path.parent).lower()
    if any(k in n for k in ['最终','final','完整','complete','交付']):
        return '最终报告'
    if any(k in n for k in ['summary','摘要','概览']):
        return '摘要报告'
    if any(k in n for k in ['interim','阶段','临时','findings']):
        return '阶段报告'
    if any(k in n for k in ['web','网站']):
        return 'Web报告'
    if '/reports/' in parent:
        return '任务报告'
    return '报告'


def classify(path):
    name = path.name.lower()
    suf_all, suf = suffixes_lower(path)
    parts = [p.lower() for p in path.parts]
    if is_report(path):
        return '01_报告'
    if suf in DB_EXTS or suf_all.endswith('.sql.gz'):
        return '02_数据库与表格'
    if ('数据库' in path.name or 'database' in name) and suf not in SOURCE_EXTS:
        return '02_数据库与表格'
    if suf in ARCHIVE_EXTS or suf_all.endswith(('.tar.gz','.sql.gz')):
        return '03_压缩包'
    if any(x in parts for x in ['source','gitrepos']) or suf in SOURCE_EXTS:
        return '04_源码'
    if '/uploads/' in str(path):
        return '05_上传文件'
    if '/resources/' in str(path):
        return '06_资源文件'
    return '99_其他'


def report_target_name(path, seq):
    mt = datetime.fromtimestamp(path.stat().st_mtime).strftime('%Y%m%d_%H%M%S')
    kind = report_kind(path)
    stem = safe_name(path.stem, '未命名报告')
    return f'{seq:02d}_{kind}_{mt}_{stem}{path.suffix}'


def table_manifest_name(path):
    stem = safe_name(path.stem, 'table')
    # For .sql.gz keep meaningful full suffix in the visible name.
    if ''.join(path.suffixes).lower().endswith('.sql.gz'):
        return stem + '.sql.gz'
    return stem + path.suffix


def flow_output_root(flow_id):
    return ROOT / f'flow-{int(flow_id)}-data' / DELIVERABLE_DIR / PACK_DIR


def snapshot_file(flow_id):
    return ROOT / f'flow-{int(flow_id)}-data' / DELIVERABLE_DIR / SNAP_DIR / f'flow-{int(flow_id)}.json'


def file_fingerprint(st):
    return {'size': st.st_size, 'mtime_ns': st.st_mtime_ns}


def load_snapshot(flow_id):
    path = snapshot_file(flow_id)
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text(encoding='utf-8'))
        return data.get('files', {})
    except Exception:
        return {}


def save_snapshot(flow_id, files):
    snapshot_file(flow_id).parent.mkdir(parents=True, exist_ok=True)
    data = {
        'flow_id': int(flow_id),
        'generated_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'files': files,
    }
    tmp = snapshot_file(flow_id).with_suffix('.json.tmp')
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
    tmp.replace(snapshot_file(flow_id))


def mtime_text(st):
    return datetime.fromtimestamp(st.st_mtime).strftime('%Y-%m-%d %H:%M:%S')


def unique_path(path):
    if not path.exists():
        return path
    base = path.name
    stem = path.stem
    suffix = ''.join(path.suffixes) or path.suffix
    if suffix and stem.endswith(suffix):
        stem = stem[:-len(suffix)]
    for i in range(2, 10000):
        candidate = path.with_name(f'{stem}_{i}{suffix}')
        if not candidate.exists():
            return candidate
    raise RuntimeError(f'cannot create unique path for {path}')


def pack(flow_id, copy=False, archive=False, reset=False, incremental=False, write_snapshot=True):
    src_root = ROOT / f'flow-{flow_id}-data'
    if not src_root.exists():
        raise SystemExit(f'flow directory not found: {src_root}')
    title = flow_title(flow_id)
    status = flow_status(flow_id)
    stamp = datetime.now().strftime('%Y%m%d_%H%M%S_%f')
    base_name = f'flow-{flow_id}_{safe_name(title, "未命名任务流")}_{stamp}'
    out = flow_output_root(flow_id) / base_name
    if reset and out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True, exist_ok=True)

    rows=[]
    report_rows=[]
    table_rows=[]
    change_rows=[]
    report_seq=0
    table_seq=0
    seen_files=set()
    old_snapshot = load_snapshot(flow_id) if incremental else {}
    new_snapshot = {}
    for base in ['reports','data','source','uploads','resources','work']:
        b = src_root / base
        if not b.exists():
            continue
        for f in sorted(b.rglob('*')):
            if not f.is_file():
                continue
            if f.name == '.gitkeep':
                continue
            if DELIVERABLE_DIR in f.relative_to(src_root).parts:
                continue
            try:
                st = f.stat()
                ident = (st.st_dev, st.st_ino)
            except Exception:
                ident = (str(f.resolve()), 0)
            if ident in seen_files:
                continue
            seen_files.add(ident)
            rel = f.relative_to(src_root)
            rel_str = str(rel)
            fp = file_fingerprint(st)
            new_snapshot[rel_str] = fp
            if incremental:
                old_fp = old_snapshot.get(rel_str)
                if old_fp == fp:
                    continue
                change_rows.append(['新增' if old_fp is None else '修改', rel_str, st.st_size, mtime_text(st), '', ''])
            cat = classify(f)
            if cat == '01_报告':
                report_seq += 1
                target = out / cat / report_target_name(f, report_seq)
                report_rows.append([report_seq, report_kind(f), datetime.fromtimestamp(st.st_mtime).strftime('%Y-%m-%d %H:%M:%S'), f.name, str(rel), str(target.relative_to(out)), st.st_size])
            elif cat == '02_数据库与表格':
                table_seq += 1
                db_bucket = '数据库表'
                target = out / cat / db_bucket / f'{table_seq:04d}_{table_manifest_name(f)}'
                table_rows.append([table_seq, f.name, str(rel), str(target.relative_to(out)), st.st_size])
            else:
                target = out / cat / rel
            target = unique_path(target)
            method = hardlink_or_copy(f, target, force_copy=copy)
            rows.append([cat, str(rel), str(target.relative_to(out)), st.st_size, mtime_text(st), method])

    if incremental:
        for rel_str in sorted(set(old_snapshot) - set(new_snapshot)):
            old_fp = old_snapshot.get(rel_str, {})
            change_rows.append(['删除', rel_str, old_fp.get('size', ''), '', '', '源目录中已不存在'])
    elif not change_rows:
        change_rows.append(['全量', '.', '', '', '', '本次为全量整理包；已刷新后续增量校验基线'])

    with (out / '00_目录索引.csv').open('w', newline='', encoding='utf-8-sig') as fp:
        w=csv.writer(fp)
        w.writerow(['分类','原始相对路径','整理后路径','字节数','修改时间','方式'])
        w.writerows(rows)
    with (out / '00_报告清单.csv').open('w', newline='', encoding='utf-8-sig') as fp:
        w=csv.writer(fp)
        w.writerow(['序号','报告类型','修改时间','原文件名','原始相对路径','整理后路径','字节数'])
        w.writerows(report_rows)
    with (out / '00_数据库表清单.csv').open('w', newline='', encoding='utf-8-sig') as fp:
        w=csv.writer(fp)
        w.writerow(['序号','表/文件名','原始相对路径','整理后路径','字节数'])
        w.writerows(table_rows)
    with (out / '00_变更清单.csv').open('w', newline='', encoding='utf-8-sig') as fp:
        w=csv.writer(fp)
        w.writerow(['变更类型','原始相对路径','字节数','修改时间','整理后路径','说明'])
        if incremental:
            target_by_rel = {r[1]: r[2] for r in rows}
            for row in change_rows:
                if row[0] in ('新增','修改'):
                    row[4] = target_by_rel.get(row[1], '')
        w.writerows(change_rows)

    readme = out / 'README.md'
    readme.write_text(f'''# PentAGI 任务流交付包\n\n- 任务流：#{flow_id} {title}\n- 状态：{status}\n- 生成时间：{stamp}\n- 原始目录：`{src_root}`\n- 本任务流交付目录：`{src_root / DELIVERABLE_DIR}`\n- 文件数：{len(rows)}\n- 报告数：{len(report_rows)}\n- 数据表/数据文件数：{len(table_rows)}\n- 打包模式：{'增量包（只包含新增/修改文件）' if incremental else '全量整理包'}\n- 变更记录：`00_变更清单.csv`\n\n## 怎么看\n\n1. 先打开 `00_报告清单.csv`，看有哪些报告、哪份是最终报告/阶段报告/摘要报告。\n2. 再打开 `00_数据库表清单.csv`，查数据库导出的表格文件，不要直接在文件管理器里翻几百个表。\n3. 如果这是增量包，先打开 `00_变更清单.csv`，只处理“新增/修改/删除”的部分。\n4. 大文件、源码、原始压缩包分别在 `03_压缩包`、`04_源码`。\n\n## 目录说明\n\n- `01_报告`：报告文件，命名格式为 `序号_报告类型_时间_原名`\n- `02_数据库与表格`：SQL、CSV、XLSX、JSONL、SQLite/DuckDB 等数据\n- `03_压缩包`：zip/tar/gz/rar/7z 等原始压缩包\n- `04_源码`：源码、Git 导出、小程序反编译等\n- `05_上传文件`：你上传给任务流的文件\n- `06_资源文件`：资源库挂载进来的文件\n- `99_其他`：未能自动归类的文件\n\n原始目录没有被移动或删除；本交付包是整理视图，并严格保存在本任务流自己的 deliverables 目录内。\n''', encoding='utf-8')

    if write_snapshot:
        save_snapshot(flow_id, new_snapshot)

    archive_path = ''
    if archive:
        archive_path = shutil.make_archive(str(out), 'gztar', out)
    return out, len(rows), len(report_rows), len(table_rows), archive_path


def list_flows():
    for d in sorted(ROOT.glob('flow-*-data'), key=lambda p: int(re.search(r'flow-(\d+)-data', p.name).group(1))):
        fid = int(re.search(r'flow-(\d+)-data', d.name).group(1))
        yield fid


def main():
    ap = argparse.ArgumentParser(description='Pack PentAGI flow artifacts into an organized bundle')
    ap.add_argument('flow_id', nargs='?', type=int)
    ap.add_argument('--all', action='store_true', help='organize all existing flow directories without archiving by default')
    ap.add_argument('--copy', action='store_true', help='copy files instead of hardlinking')
    ap.add_argument('--archive', action='store_true', help='create tar.gz archive after organizing')
    ap.add_argument('--incremental', action='store_true', help='only include files changed since the previous snapshot')
    ap.add_argument('--no-snapshot', action='store_true', help='do not refresh the saved change-detection snapshot')
    args = ap.parse_args()
    targets = list(list_flows()) if args.all else [args.flow_id]
    if not targets or targets == [None]:
        raise SystemExit('provide flow_id or --all')
    for fid in targets:
        out, files, reports, tables, archive = pack(fid, copy=args.copy, archive=args.archive, incremental=args.incremental, write_snapshot=not args.no_snapshot)
        print(f'flow={fid} out={out} files={files} reports={reports} tables={tables}')
        if archive:
            print(f'archive={archive}')

if __name__ == '__main__':
    main()
