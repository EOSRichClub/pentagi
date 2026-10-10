import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ModelService } from '@/lib/model-services';

import { ProviderType } from '@/graphql/types';

const ALL_TYPES = [
    'anthropic',
    'bedrock',
    'custom',
    'deepseek',
    'gemini',
    'glm',
    'kimi',
    'minimax',
    'ollama',
    'openai',
    'qwen',
];

const emptyProvider = { agents: {} };

const makeData = (userDefined: unknown[]) => ({
    settingsProviders: {
        default: { anthropic: emptyProvider, openai: emptyProvider },
        enabled: Object.fromEntries(ALL_TYPES.map((type) => [type, type !== 'minimax' && type !== 'custom'])),
        models: {},
        userDefined,
    },
});

const queryResult = vi.hoisted(() => ({
    current: { data: undefined, error: undefined, loading: false, refetch: () => {} } as Record<string, unknown>,
}));

vi.mock('@apollo/client/react', () => ({
    useMutation: () => [vi.fn(), {}],
    useQuery: () => queryResult.current,
}));

vi.mock('react-router-dom', async (importOriginal) => ({
    ...(await importOriginal<typeof import('react-router-dom')>()),
    useNavigate: () => vi.fn(),
}));

vi.mock('@/hooks/use-table-state', () => ({
    useTableState: () => ({ filter: '', pageIndex: 0, setFilter: vi.fn(), setPage: vi.fn() }),
}));

// AppHeader pulls in SidebarTrigger (needs a SidebarProvider context); stub the family so the
// list's load-state branches render without that scaffolding. SettingsProvidersHeader builds its
// own trigger from a plain Button, so this does not touch the create-menu tests.
vi.mock('@/components/layouts/app/app-header', () => {
    const Pass = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;

    return {
        AppHeader: Pass,
        AppHeaderAction: Pass,
        AppHeaderActions: Pass,
        AppHeaderContent: Pass,
        AppHeaderTitle: Pass,
    };
});

import SettingsProviders, { SettingsProvidersHeader } from './settings-providers';

const selectableServices: ModelService[] = [
    {
        baseUrl: 'https://api.anthropic.test',
        builtin: true,
        credentials: [
            {
                enabled: true,
                id: 1,
                masked: 'sk-••••••001',
                name: 'Anthropic 主密钥',
                remark: '',
                serviceId: 11,
                source: 'user',
                usageCount: 0,
            },
        ],
        id: 11,
        name: 'Anthropic 主服务',
        providerType: ProviderType.Anthropic,
    },
    {
        baseUrl: 'https://api.openai.test/v1',
        builtin: true,
        credentials: [
            {
                enabled: true,
                id: 2,
                masked: 'sk-••••••002',
                name: 'OpenAI 主密钥',
                remark: '',
                serviceId: 12,
                source: 'user',
                usageCount: 0,
            },
        ],
        id: 12,
        name: 'OpenAI 主服务',
        providerType: ProviderType.Openai,
    },
];

describe('SettingsProvidersHeader create menu', () => {
    beforeEach(() => {
        queryResult.current = { data: makeData([]), error: undefined, loading: false, refetch: () => {} };
    });

    it('offers only model services that have an enabled API key', async () => {
        const user = userEvent.setup();
        render(<SettingsProvidersHeader services={selectableServices} />);

        await user.click(screen.getByRole('button', { name: '添加模型提供商' }));

        expect(screen.queryByRole('menuitem', { name: /MiniMax/ })).not.toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: /Anthropic 主服务/ })).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: /OpenAI 主服务/ })).toBeInTheDocument();
    });

    it('links to API key settings when no model service has an enabled key', async () => {
        const user = userEvent.setup();
        render(<SettingsProvidersHeader />);

        await user.click(screen.getByRole('button', { name: '添加模型提供商' }));

        expect(screen.getByRole('menuitem', { name: '请先添加模型 API 密钥' })).toBeInTheDocument();
        expect(screen.queryByRole('menuitem', { name: /OpenAI/ })).not.toBeInTheDocument();
    });
});

describe('SettingsProviders list load states', () => {
    const seeded = [
        {
            agents: {},
            createdAt: '2026-01-15T00:00:00Z',
            id: '1',
            name: 'Seeded Provider',
            type: ProviderType.Custom,
            updatedAt: '2026-01-15T00:00:00Z',
        },
    ];

    // cache-and-network flips loading true with cached rows still present; the table must survive
    // it rather than flip to the full-page spinner.
    it('keeps the populated table on a background refetch instead of flashing the loader', () => {
        queryResult.current = { data: makeData(seeded), error: undefined, loading: true, refetch: () => {} };

        render(
            <MemoryRouter>
                <SettingsProviders />
            </MemoryRouter>,
        );

        expect(screen.getByText('Seeded Provider')).toBeInTheDocument();
        expect(screen.queryByText('Loading providers...')).not.toBeInTheDocument();
    });
});
