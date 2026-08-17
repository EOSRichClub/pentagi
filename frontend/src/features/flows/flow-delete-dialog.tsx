import { Loader2, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { Flow } from '@/providers/flows-provider';

export type FlowDeleteMode = 'record' | 'purge';

interface FlowDeleteDialogProps {
    flow: Flow | null;
    isOpen: boolean;
    isDeleting?: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: (mode: FlowDeleteMode) => Promise<void> | void;
}

export function FlowDeleteDialog({ flow, isOpen, isDeleting, onOpenChange, onConfirm }: FlowDeleteDialogProps) {
    const [mode, setMode] = useState<FlowDeleteMode>('record');

    if (!flow) {
        return null;
    }

    return (
        <Dialog
            onOpenChange={onOpenChange}
            open={isOpen}
        >
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>删除任务流 #{flow.id}</DialogTitle>
                    <DialogDescription>
                        {flow.title || '未命名任务流'} — 请选择删除范围
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3">
                    <button
                        className={cn(
                            'w-full rounded-lg border p-3 text-left transition-colors',
                            mode === 'record' ? 'border-primary bg-primary/5' : 'hover:bg-muted/40',
                        )}
                        onClick={() => setMode('record')}
                        type="button"
                    >
                        <div className="font-medium">仅删除任务记录</div>
                        <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                            列表与数据库记录消失；磁盘上的任务流文件夹（报告/数据/上传）保留，可手工找回。
                        </p>
                    </button>
                    <button
                        className={cn(
                            'w-full rounded-lg border p-3 text-left transition-colors',
                            mode === 'purge' ? 'border-red-500 bg-red-500/5' : 'hover:bg-muted/40 border-red-500/30',
                        )}
                        onClick={() => setMode('purge')}
                        type="button"
                    >
                        <div className="font-medium text-red-600">彻底删除（记录 + 全部文件）</div>
                        <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                            删除任务记录，并删除 flow-{flow.id}-data 目录及关联工作数据。不可恢复。
                        </p>
                    </button>
                </div>

                <DialogFooter>
                    <Button
                        disabled={isDeleting}
                        onClick={() => onOpenChange(false)}
                        type="button"
                        variant="outline"
                    >
                        取消
                    </Button>
                    <Button
                        disabled={isDeleting}
                        onClick={() => void onConfirm(mode)}
                        type="button"
                        variant="destructive"
                    >
                        {isDeleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
                        {mode === 'purge' ? '彻底删除' : '删除记录'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
