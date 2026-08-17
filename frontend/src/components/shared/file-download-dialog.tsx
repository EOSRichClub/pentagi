import { Download, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface FileDownloadDialogProps {
    /**
     * Build a same-origin download URL from the (possibly edited) path.
     * Return null when invalid.
     */
    buildDownloadHref: (serverPath: string) => null | string;
    defaultFileName?: string;
    defaultServerPath?: string;
    description?: string;
    /** Optional path hint shown under the input. */
    pathHint?: string;
    onOpenChange: (open: boolean) => void;
    open: boolean;
    title?: string;
}

/**
 * Lightweight download dialog: confirm path → browser default download.
 * No File System Access API (avoids crashes on IP / flaky secure contexts).
 */
export function FileDownloadDialog({
    buildDownloadHref,
    defaultFileName,
    defaultServerPath = '',
    description = '确认路径后点击下载，文件会保存到浏览器默认下载位置（可在浏览器设置里改成桌面）。',
    onOpenChange,
    open,
    pathHint = '缓存路径须以 uploads/、container/ 或 resources/ 开头，例如 container/work/report.md',
    title = '下载文件',
}: FileDownloadDialogProps) {
    const [serverPath, setServerPath] = useState(defaultServerPath);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!open) {
            return;
        }

        setServerPath(defaultServerPath);
        setBusy(false);
    }, [open, defaultServerPath, defaultFileName]);

    const handleDownload = () => {
        const path = serverPath.trim();

        if (!path) {
            toast.error('请输入文件路径');

            return;
        }

        let href: null | string = null;

        try {
            href = buildDownloadHref(path);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : '无法生成下载地址');

            return;
        }

        if (!href) {
            toast.error('路径无效。请使用 uploads/、container/ 或 resources/ 开头的路径');

            return;
        }

        setBusy(true);

        try {
            // Pure browser download — uses cookies automatically for same-origin.
            const anchor = document.createElement('a');

            anchor.href = href;
            anchor.rel = 'noopener';
            // Hint filename when known; browser still honours Content-Disposition.
            if (defaultFileName) {
                anchor.download = defaultFileName;
            }

            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            toast.success('已开始下载，请查看浏览器下载栏');
            onOpenChange(false);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : '下载失败');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Dialog
            onOpenChange={(next) => {
                if (!busy) {
                    onOpenChange(next);
                }
            }}
            open={open}
        >
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Download className="size-4" />
                        {title}
                    </DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-3 py-1">
                    <div className="flex flex-col gap-2">
                        <Label htmlFor="server-path">文件路径</Label>
                        <Input
                            autoFocus
                            id="server-path"
                            onChange={(event) => setServerPath(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter' && !busy) {
                                    event.preventDefault();
                                    handleDownload();
                                }
                            }}
                            placeholder="container/work/report.md"
                            value={serverPath}
                        />
                        <p className="text-muted-foreground text-xs">{pathHint}</p>
                    </div>

                    <div className="bg-muted/40 text-muted-foreground rounded-md border p-3 text-xs leading-relaxed">
                        下载位置由浏览器决定。想保存到桌面：Chrome → 设置 → 下载内容 → 位置 → 桌面。
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        disabled={busy}
                        onClick={() => onOpenChange(false)}
                        type="button"
                        variant="outline"
                    >
                        取消
                    </Button>
                    <Button
                        disabled={busy || !serverPath.trim()}
                        onClick={handleDownload}
                        type="button"
                    >
                        {busy ? (
                            <>
                                <Loader2 className="mr-2 size-4 animate-spin" />
                                下载中…
                            </>
                        ) : (
                            <>
                                <Download className="mr-2 size-4" />
                                下载
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
