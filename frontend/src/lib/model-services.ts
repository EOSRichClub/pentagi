import { ProviderType } from '@/graphql/types';

export interface ModelCredential {
    enabled: boolean;
    id: number;
    masked: string;
    name: string;
    remark: string;
    serviceId: number;
    source: string;
    usageCount: number;
}

export interface ModelService {
    baseUrl: string;
    builtin: boolean;
    credentials: ModelCredential[];
    id: number;
    name: string;
    providerType: ProviderType;
}

interface APIResponse<T> {
    data: T;
    msg?: string;
    status: 'error' | 'success';
}

export const modelProviderLabels: Record<ProviderType, string> = {
    [ProviderType.Anthropic]: 'Anthropic 原生协议',
    [ProviderType.Bedrock]: 'AWS Bedrock',
    [ProviderType.Custom]: 'OpenAI 兼容协议',
    [ProviderType.Deepseek]: 'DeepSeek 原生协议',
    [ProviderType.Gemini]: 'Google Gemini 原生协议',
    [ProviderType.Glm]: '智谱 GLM 原生协议',
    [ProviderType.Kimi]: 'Kimi 原生协议',
    [ProviderType.Minimax]: 'MiniMax 原生协议',
    [ProviderType.Ollama]: 'Ollama 协议',
    [ProviderType.Openai]: 'OpenAI 原生协议',
    [ProviderType.Qwen]: '通义千问原生协议',
};

export async function modelServicesRequest<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`/api/v1${path}`, {
        cache: 'no-store',
        credentials: 'include',
        ...init,
        headers: {
            'Content-Type': 'application/json',
            ...init?.headers,
        },
    });
    const payload = (await response.json().catch(() => null)) as APIResponse<T> | null;

    if (!response.ok || !payload || payload.status !== 'success') {
        throw new Error(payload?.msg || `请求失败（HTTP ${response.status}）`);
    }

    return payload.data;
}

export const loadModelServices = () => modelServicesRequest<ModelService[]>('/model-services/');
