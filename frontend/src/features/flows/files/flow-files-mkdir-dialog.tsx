import { FolderPlus, Loader2 } from 'lucide-react';
import { useCallback, useState } from 'react';
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
import { api, getApiErrorMessage } from '@/lib/axios';

import { FLOW_FILES_MKDIR_API_PATH, UPLOADS_PATH_PREFIX } from './flow-files-constants';

interface FlowFilesMkdirDialogProps {
    flowId: null | string;
    isOpen: boolean;
    onClose: () => void;
    onCreated?: (path: string) => void;
    /** Parent directory relative to flow data, e.g. uploads or uploads/客户A */
    parentPath?: string;
}

export function FlowFilesMkdirDialog({
    flowId,
    isOpen,
    onClose,
    onCreated,
    parentPath = UPLOADS_PATH_PREFIX,
}: FlowFilesMkdirDialogProps) {
    const [name, setName] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    const handleCreate = useCallback(async () => {
        if (!flowId) {
            return;
        }
        const trimmed = name.trim().replace(/[\\/]/g, '');
        if (!trimmed) {
            toast.error('请输入文件夹名称');
            return;
        }

        const path = `${parentPath.replace(/\/$/, '')}/${trimmed}`;
        setIsCreating(true);
        try {
            await api.post(FLOW_FILES_MKDIR_API_PATH(flowId), { path });
            toast.success('文件夹已创建', { description: path });
            onCreated?.(path);
            setName('');
            onClose();
        } catch (error) {
            toast.error('创建失败', { description: getApiErrorMessage(error, '无法创建文件夹') });
        } finally {
            setIsCreating(false);
        }
    }, [flowId, name, onClose, onCreated, parentPath]);

    return (
        <Dialog
            onOpenChange={(open) => {
                if (!open) {
                    onClose();
                }
            }}
            open={isOpen}
        >
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>新建文件夹</DialogTitle>
                    <DialogDescription>
                        在任务流上传目录下创建文件夹，便于分类资料。父路径：
                        <code className="ml-1">{parentPath}</code>
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                    <Label htmlFor="mkdir-name">文件夹名称</Label>
                    <Input
                        autoFocus
                        id="mkdir-name"
                        onChange={(e) => setName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                void handleCreate();
                            }
                        }}
                        placeholder="例如：客户资料"
                        value={name}
                    />
                </div>
                <DialogFooter>
                    <Button
                        onClick={onClose}
                        type="button"
                        variant="outline"
                    >
                        取消
                    </Button>
                    <Button
                        disabled={isCreating || !name.trim()}
                        onClick={() => void handleCreate()}
                        type="button"
                    >
                        {isCreating ? <Loader2 className="animate-spin" /> : <FolderPlus />}
                        创建
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
