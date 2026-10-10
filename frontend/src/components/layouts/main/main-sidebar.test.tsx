import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sidebarFlowsMock = vi.hoisted(() => ({
    current: { deleteFlow: vi.fn(), flows: [], renameFlow: vi.fn() } as {
        deleteFlow: ReturnType<typeof vi.fn>;
        flows: Array<{ createdAt: string; id: string; title: string }>;
        renameFlow: ReturnType<typeof vi.fn>;
    },
}));

vi.mock('@/providers/user-provider', () => ({
    useUser: () => ({
        authInfo: { user: { mail: 'me@example.com', name: 'Test User', type: 'local' } },
        logout: vi.fn(),
    }),
}));
vi.mock('@/hooks/use-theme', () => ({ useTheme: () => ({ setTheme: vi.fn(), theme: 'system' }) }));
vi.mock('@/providers/favorites-provider', () => ({
    useFavorites: () => ({ addFavoriteFlow: vi.fn(), favoriteFlowIds: [], removeFavoriteFlow: vi.fn() }),
}));
vi.mock('@/providers/sidebar-flows-provider', () => ({ useSidebarFlows: () => sidebarFlowsMock.current }));
vi.mock('@/features/resources/use-resources-upload', () => ({
    useResourcesUpload: () => ({ fileInputKey: 'k', fileInputProps: {}, openFilePicker: vi.fn() }),
}));

import { SidebarProvider } from '@/components/ui/sidebar';

import { MainSidebar } from './main-sidebar';

function FromProbe() {
    const location = useLocation();

    return <span data-testid="from">{(location.state as null | { from?: string })?.from ?? 'none'}</span>;
}

function renderSidebar() {
    return render(
        <MemoryRouter initialEntries={['/dashboard']}>
            <SidebarProvider>
                <MainSidebar />
            </SidebarProvider>
            <Routes>
                <Route
                    element={<div>dashboard</div>}
                    path="/dashboard"
                />
                <Route
                    element={<div>all flows</div>}
                    path="/flows"
                />
                <Route
                    element={<FromProbe />}
                    path="/settings"
                />
                <Route
                    element={<FromProbe />}
                    path="/settings/account"
                />
            </Routes>
        </MemoryRouter>,
    );
}

describe('MainSidebar settings entry points', () => {
    beforeEach(() => {
        sidebarFlowsMock.current = { deleteFlow: vi.fn(), flows: [], renameFlow: vi.fn() };
    });

    it('the Settings link carries the current path as the return origin', async () => {
        const user = userEvent.setup();
        renderSidebar();

        await user.click(screen.getByRole('link', { name: 'Settings' }));

        expect(screen.getByTestId('from')).toHaveTextContent('/dashboard');
    });

    it('the Profile menu item carries the current path as the return origin', async () => {
        const user = userEvent.setup();
        renderSidebar();

        await user.click(screen.getByRole('button', { name: /Test User/ }));
        await user.click(screen.getByRole('menuitem', { name: 'Profile' }));

        expect(screen.getByTestId('from')).toHaveTextContent('/dashboard');
    });
});

describe('MainSidebar recent flow actions', () => {
    const recentFlow = { createdAt: '2026-08-29T00:00:00Z', id: '42', title: '原任务名称' };

    beforeEach(() => {
        sidebarFlowsMock.current = {
            deleteFlow: vi.fn().mockResolvedValue(true),
            flows: [recentFlow],
            renameFlow: vi.fn().mockResolvedValue(true),
        };
    });

    it('links to the complete flow list and shows the total count', async () => {
        const user = userEvent.setup();
        renderSidebar();

        const allFlowsLink = screen.getByRole('link', { name: /所有任务流\s*1/ });
        expect(screen.getByRole('link', { name: '查看全部' })).toHaveAttribute('href', '/flows');

        await user.click(allFlowsLink);

        expect(screen.getByText('all flows')).toBeInTheDocument();
    });

    it('renames a recent flow from its action menu', async () => {
        const user = userEvent.setup();
        renderSidebar();

        await user.click(screen.getByRole('button', { name: '任务流操作' }));
        await user.click(screen.getByRole('menuitem', { name: '重命名' }));

        const input = screen.getByRole('textbox', { name: '任务流名称' });
        await user.clear(input);
        await user.type(input, '新的任务名称');
        await user.click(screen.getByRole('button', { name: '保存' }));

        await waitFor(() => {
            expect(sidebarFlowsMock.current.renameFlow).toHaveBeenCalledWith(recentFlow, '新的任务名称');
        });
    });

    it('deletes a recent flow only after confirmation', async () => {
        const user = userEvent.setup();
        renderSidebar();

        await user.click(screen.getByRole('button', { name: '任务流操作' }));
        await user.click(screen.getByRole('menuitem', { name: '删除' }));

        expect(sidebarFlowsMock.current.deleteFlow).not.toHaveBeenCalled();
        await user.click(screen.getByRole('button', { name: '删除' }));

        await waitFor(() => {
            expect(sidebarFlowsMock.current.deleteFlow).toHaveBeenCalledWith(recentFlow);
        });
    });
});
