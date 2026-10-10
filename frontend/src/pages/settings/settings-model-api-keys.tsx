import { Edit3, Eye, EyeOff, KeyRound, Plus, RefreshCw, Server, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import type { ModelCredential, ModelService } from '@/lib/model-services';

import { AppHeader, AppHeaderActions, AppHeaderContent, AppHeaderTitle } from '@/components/layouts/app/app-header';
import ConfirmationDialog from '@/components/shared/confirmation-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { loadModelServices, modelProviderLabels, modelServicesRequest } from '@/lib/model-services';

interface CredentialDraft {
    enabled: boolean;
    id?: number;
    name: string;
    remark: string;
    secret: string;
    serviceId: number;
    serviceName: string;
    showSecret: boolean;
}

type DeleteTarget =
    | { id: number; kind: 'credential'; name: string; usageCount: number }
    | { id: number; kind: 'service'; name: string };

interface ServiceDraft {
    baseUrl: string;
    id?: number;
    name: string;
}

const emptyServiceDraft: ServiceDraft = { baseUrl: '', name: '' };

function SettingsModelAPIKeys() {
    const [services, setServices] = useState<ModelService[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [serviceDraft, setServiceDraft] = useState<null | ServiceDraft>(null);
    const [credentialDraft, setCredentialDraft] = useState<CredentialDraft | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

    const load = useCallback(async () => {
        setLoading(true);

        try {
            setServices(await loadModelServices());
        } catch (error) {
            toast.error(error instanceof Error ? error.message : '加载模型服务失败');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const timeout = window.setTimeout(() => void load(), 0);

        return () => window.clearTimeout(timeout);
    }, [load]);

    const configuredCount = useMemo(
        () => services.reduce((total, service) => total + service.credentials.length, 0),
        [services],
    );

    const openCredentialDialog = (service: ModelService, credential?: ModelCredential) => {
        setCredentialDraft({
            enabled: credential?.enabled ?? true,
            id: credential?.id,
            name: credential?.name ?? '',
            remark: credential?.remark ?? '',
            secret: '',
            serviceId: service.id,
            serviceName: service.name,
            showSecret: false,
        });
    };

    const saveService = async () => {
        if (!serviceDraft) {return;}

        const name = serviceDraft.name.trim();
        const baseUrl = serviceDraft.baseUrl.trim();

        if (!name || !baseUrl) {
            toast.error('请填写服务名称和 Base URL');

            return;
        }

        setSaving(true);

        try {
            await modelServicesRequest(`/model-services/${serviceDraft.id ?? ''}`, {
                body: JSON.stringify({ baseUrl, name }),
                method: serviceDraft.id ? 'PUT' : 'POST',
            });
            toast.success(serviceDraft.id ? '模型服务已更新' : '自定义模型服务已添加');
            setServiceDraft(null);
            await load();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : '保存模型服务失败');
        } finally {
            setSaving(false);
        }
    };

    const saveCredential = async () => {
        if (!credentialDraft) {return;}

        const name = credentialDraft.name.trim();
        const secret = credentialDraft.secret.trim();

        if (!name || (!credentialDraft.id && !secret)) {
            toast.error('请填写密钥名称和 API 密钥');

            return;
        }

        setSaving(true);

        try {
            const body = credentialDraft.id
                ? {
                      enabled: credentialDraft.enabled,
                      name,
                      remark: credentialDraft.remark.trim(),
                      ...(secret ? { secret } : {}),
                  }
                : { name, remark: credentialDraft.remark.trim(), secret };
            const path = credentialDraft.id
                ? `/model-credentials/${credentialDraft.id}`
                : `/model-services/${credentialDraft.serviceId}/credentials`;
            await modelServicesRequest(path, {
                body: JSON.stringify(body),
                method: credentialDraft.id ? 'PUT' : 'POST',
            });
            toast.success(credentialDraft.id ? 'API 密钥已更新' : 'API 密钥已添加');
            setCredentialDraft(null);
            await load();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : '保存 API 密钥失败');
        } finally {
            setSaving(false);
        }
    };

    const deleteItem = async () => {
        if (!deleteTarget) {return;}

        const path =
            deleteTarget.kind === 'credential'
                ? `/model-credentials/${deleteTarget.id}`
                : `/model-services/${deleteTarget.id}`;
        await modelServicesRequest(path, { method: 'DELETE' });
        toast.success(deleteTarget.kind === 'credential' ? 'API 密钥已删除' : '模型服务已删除');
        setDeleteTarget(null);
        await load();
    };

    return (
        <>
            <AppHeader>
                <AppHeaderContent>
                    <AppHeaderTitle icon={<KeyRound className="size-4 shrink-0" />}>模型 API 密钥</AppHeaderTitle>
                </AppHeaderContent>
                <AppHeaderActions>
                    <Button
                        onClick={() => setServiceDraft({ ...emptyServiceDraft })}
                        size="sm"
                        variant="secondary"
                    >
                        <Plus />
                        <span className="hidden md:inline">添加自定义模型服务</span>
                    </Button>
                    <Button
                        disabled={loading}
                        onClick={() => void load()}
                        size="sm"
                        variant="secondary"
                    >
                        <RefreshCw className={loading ? 'animate-spin' : ''} />
                        <span className="hidden md:inline">刷新</span>
                    </Button>
                </AppHeaderActions>
            </AppHeader>

            <div className="flex flex-1 flex-col gap-5 p-4">
                <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4 text-sm leading-6">
                    <p className="font-medium">一个模型服务可以保存多把 API 密钥，并分别设置名称和备注。</p>
                    <p className="text-muted-foreground">
                        密钥会加密保存且只显示掩码。添加完成后，请在“模型提供商”中选择具体服务和密钥；正在使用的密钥不能直接删除。
                    </p>
                </div>

                {loading && services.length === 0 ? (
                    <div className="text-muted-foreground flex min-h-48 items-center justify-center gap-2 text-sm">
                        <Spinner variant="circle" /> 正在加载模型服务…
                    </div>
                ) : services.length === 0 ? (
                    <div className="text-muted-foreground flex min-h-48 items-center justify-center text-sm">
                        暂无模型服务
                    </div>
                ) : (
                    <div className="grid gap-4 xl:grid-cols-2">
                        {services.map((service) => (
                            <Card key={service.id}>
                                <CardHeader className="gap-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <CardTitle className="flex flex-wrap items-center gap-2">
                                                <Server className="size-4" />
                                                {service.name}
                                                <Badge variant={service.builtin ? 'secondary' : 'outline'}>
                                                    {service.builtin ? '内置服务' : '自定义服务'}
                                                </Badge>
                                            </CardTitle>
                                            <CardDescription className="mt-1 break-all">
                                                {modelProviderLabels[service.providerType]} ·{' '}
                                                {service.baseUrl || '使用默认地址'}
                                            </CardDescription>
                                        </div>
                                        <div className="flex shrink-0 gap-1">
                                            {!service.builtin && (
                                                <>
                                                    <Button
                                                        aria-label={`编辑 ${service.name}`}
                                                        onClick={() =>
                                                            setServiceDraft({
                                                                baseUrl: service.baseUrl,
                                                                id: service.id,
                                                                name: service.name,
                                                            })
                                                        }
                                                        size="icon-sm"
                                                        variant="ghost"
                                                    >
                                                        <Edit3 />
                                                    </Button>
                                                    <Button
                                                        aria-label={`删除 ${service.name}`}
                                                        onClick={() =>
                                                            setDeleteTarget({
                                                                id: service.id,
                                                                kind: 'service',
                                                                name: service.name,
                                                            })
                                                        }
                                                        size="icon-sm"
                                                        variant="ghost"
                                                    >
                                                        <Trash2 />
                                                    </Button>
                                                </>
                                            )}
                                            <Button
                                                onClick={() => openCredentialDialog(service)}
                                                size="sm"
                                                variant="secondary"
                                            >
                                                <Plus /> 添加密钥
                                            </Button>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="flex flex-col gap-2">
                                    {service.credentials.length === 0 ? (
                                        <div className="text-muted-foreground rounded-md border border-dashed p-4 text-center text-sm">
                                            尚未添加 API 密钥
                                        </div>
                                    ) : (
                                        service.credentials.map((credential) => (
                                            <div
                                                className="flex items-start justify-between gap-3 rounded-md border p-3"
                                                key={credential.id}
                                            >
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="font-medium">{credential.name}</span>
                                                        <code className="text-muted-foreground text-xs">
                                                            {credential.masked}
                                                        </code>
                                                        <Badge variant={credential.enabled ? 'green' : 'secondary'}>
                                                            {credential.enabled ? '启用' : '停用'}
                                                        </Badge>
                                                        {credential.source === 'environment' && (
                                                            <Badge variant="outline">环境变量导入</Badge>
                                                        )}
                                                        {credential.usageCount > 0 && (
                                                            <Badge variant="outline">
                                                                {credential.usageCount} 个提供商使用
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    {credential.remark && (
                                                        <p className="text-muted-foreground mt-1 text-sm">
                                                            {credential.remark}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="flex shrink-0 gap-1">
                                                    <Button
                                                        aria-label={`编辑 ${credential.name}`}
                                                        onClick={() => openCredentialDialog(service, credential)}
                                                        size="icon-sm"
                                                        variant="ghost"
                                                    >
                                                        <Edit3 />
                                                    </Button>
                                                    <Button
                                                        aria-label={`删除 ${credential.name}`}
                                                        disabled={credential.usageCount > 0}
                                                        onClick={() =>
                                                            setDeleteTarget({
                                                                id: credential.id,
                                                                kind: 'credential',
                                                                name: credential.name,
                                                                usageCount: credential.usageCount,
                                                            })
                                                        }
                                                        size="icon-sm"
                                                        title={
                                                            credential.usageCount > 0
                                                                ? '请先更换或删除使用此密钥的模型提供商'
                                                                : '删除密钥'
                                                        }
                                                        variant="ghost"
                                                    >
                                                        <Trash2 />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}

                <p className="text-muted-foreground text-xs">
                    当前共 {services.length} 个模型服务，{configuredCount} 把 API 密钥。
                </p>
            </div>

            <Dialog
                onOpenChange={(open) => !open && setServiceDraft(null)}
                open={serviceDraft != null}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{serviceDraft?.id ? '编辑自定义模型服务' : '添加自定义模型服务'}</DialogTitle>
                        <DialogDescription>适用于硅基流动、商汤日日新等兼容 OpenAI 接口的模型服务。</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-2">
                        <div className="grid gap-2">
                            <Label htmlFor="service-name">服务名称</Label>
                            <Input
                                id="service-name"
                                onChange={(event) =>
                                    setServiceDraft((current) => current && { ...current, name: event.target.value })
                                }
                                placeholder="例如：硅基流动主账号"
                                value={serviceDraft?.name ?? ''}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="service-url">Base URL</Label>
                            <Input
                                id="service-url"
                                onChange={(event) =>
                                    setServiceDraft((current) => current && { ...current, baseUrl: event.target.value })
                                }
                                placeholder="https://api.example.com/v1"
                                spellCheck={false}
                                value={serviceDraft?.baseUrl ?? ''}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            disabled={saving}
                            onClick={() => setServiceDraft(null)}
                            variant="outline"
                        >
                            取消
                        </Button>
                        <Button
                            disabled={saving}
                            onClick={() => void saveService()}
                        >
                            {saving && <Spinner variant="circle" />} 保存
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                onOpenChange={(open) => !open && setCredentialDraft(null)}
                open={credentialDraft != null}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{credentialDraft?.id ? '编辑 API 密钥' : '添加 API 密钥'}</DialogTitle>
                        <DialogDescription>所属模型服务：{credentialDraft?.serviceName}</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-2">
                        <div className="grid gap-2">
                            <Label htmlFor="credential-name">自定义名称</Label>
                            <Input
                                id="credential-name"
                                onChange={(event) =>
                                    setCredentialDraft((current) => current && { ...current, name: event.target.value })
                                }
                                placeholder="例如：生产主密钥、备用密钥"
                                value={credentialDraft?.name ?? ''}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="credential-secret">
                                API 密钥{credentialDraft?.id ? '（留空表示不修改）' : ''}
                            </Label>
                            <div className="flex gap-2">
                                <Input
                                    autoComplete="new-password"
                                    id="credential-secret"
                                    onChange={(event) =>
                                        setCredentialDraft(
                                            (current) => current && { ...current, secret: event.target.value },
                                        )
                                    }
                                    placeholder={credentialDraft?.id ? '留空表示保留原密钥' : '请输入 API 密钥'}
                                    spellCheck={false}
                                    type={credentialDraft?.showSecret ? 'text' : 'password'}
                                    value={credentialDraft?.secret ?? ''}
                                />
                                <Button
                                    aria-label={credentialDraft?.showSecret ? '隐藏密钥' : '显示密钥'}
                                    onClick={() =>
                                        setCredentialDraft(
                                            (current) => current && { ...current, showSecret: !current.showSecret },
                                        )
                                    }
                                    size="icon"
                                    type="button"
                                    variant="outline"
                                >
                                    {credentialDraft?.showSecret ? <EyeOff /> : <Eye />}
                                </Button>
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="credential-remark">备注</Label>
                            <Textarea
                                id="credential-remark"
                                onChange={(event) =>
                                    setCredentialDraft(
                                        (current) => current && { ...current, remark: event.target.value },
                                    )
                                }
                                placeholder="例如：主账号、2026 年采购、仅用于代码模型"
                                value={credentialDraft?.remark ?? ''}
                            />
                        </div>
                        {credentialDraft?.id && (
                            <div className="flex items-center justify-between rounded-md border p-3">
                                <div>
                                    <Label htmlFor="credential-enabled">允许模型提供商使用</Label>
                                    <p className="text-muted-foreground text-xs">
                                        停用后，绑定该密钥的任务将无法启动。
                                    </p>
                                </div>
                                <Switch
                                    checked={credentialDraft.enabled}
                                    id="credential-enabled"
                                    onCheckedChange={(enabled) =>
                                        setCredentialDraft((current) => current && { ...current, enabled })
                                    }
                                />
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button
                            disabled={saving}
                            onClick={() => setCredentialDraft(null)}
                            variant="outline"
                        >
                            取消
                        </Button>
                        <Button
                            disabled={saving}
                            onClick={() => void saveCredential()}
                        >
                            {saving && <Spinner variant="circle" />} 保存
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ConfirmationDialog
                cancelText="取消"
                confirmText="删除"
                description={
                    deleteTarget?.kind === 'credential'
                        ? '删除后无法恢复；已使用的密钥必须先解除模型提供商绑定。'
                        : '仅能删除没有密钥、也没有模型提供商绑定的自定义服务。'
                }
                handleConfirm={deleteItem}
                handleOpenChange={(open) => !open && setDeleteTarget(null)}
                isOpen={deleteTarget != null}
                itemName={deleteTarget?.name}
                itemType={deleteTarget?.kind === 'credential' ? 'API 密钥' : '模型服务'}
                title={deleteTarget?.kind === 'credential' ? '删除 API 密钥' : '删除模型服务'}
            />
        </>
    );
}

export default SettingsModelAPIKeys;
