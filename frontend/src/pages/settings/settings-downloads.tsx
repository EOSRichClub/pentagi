import { FolderOpen, FolderX, HardDriveDownload } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    clearDirectoryHandle,
    type DownloadMode,
    getDownloadPrefs,
    pickDownloadDirectory,
    setDownloadMode,
} from '@/lib/local-download';

/**
 * Web UI for choosing how / where downloads are saved on the user's machine.
 * Full absolute paths cannot be forced by the browser; the user must grant a
 * directory via the File System Access API (Chrome / Edge / recent Chromium).
 */
export default function SettingsDownloads() {
    const [prefs, setPrefs] = useState(() => getDownloadPrefs());
    const [busy, setBusy] = useState(false);

    const refresh = useCallback(() => {
        setPrefs(getDownloadPrefs());
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const handleModeChange = (value: string) => {
        const mode = value as DownloadMode;

        setDownloadMode(mode);
        refresh();
        toast.success('Download preference saved');
    };

    const handlePickFolder = async () => {
        if (!prefs.supportsDirectoryPicker) {
            toast.error(
                'This browser does not support choosing a fixed download folder. Use Chrome or Edge, or pick “Ask each time / Browser default”.',
            );

            return;
        }

        setBusy(true);

        try {
            const handle = await pickDownloadDirectory();

            if (handle) {
                toast.success(`Downloads will be saved under “${handle.name}”`);
            } else {
                toast.message('No folder selected');
            }
        } finally {
            setBusy(false);
            refresh();
        }
    };

    const handleClearFolder = async () => {
        setBusy(true);

        try {
            await clearDirectoryHandle();
            toast.success('Fixed download folder cleared');
        } finally {
            setBusy(false);
            refresh();
        }
    };

    return (
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight">Downloads</h1>
                <p className="text-muted-foreground mt-1 text-sm">
                    Control where files from Flows / Resources are saved on this computer. Because of browser
                    security, the page cannot write to an arbitrary path string — you choose a folder once, and
                    we reuse that permission.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <HardDriveDownload className="size-4" />
                        Download behaviour
                    </CardTitle>
                    <CardDescription>
                        Applies to flow files, resource library downloads, and exported reports.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                        <Label htmlFor="download-mode">Mode</Label>
                        <Select
                            onValueChange={handleModeChange}
                            value={prefs.mode}
                        >
                            <SelectTrigger
                                className="w-full"
                                id="download-mode"
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="browser-default">
                                    Browser default (system Downloads folder)
                                </SelectItem>
                                <SelectItem value="ask-each-time">Ask for location every time</SelectItem>
                                <SelectItem
                                    disabled={!prefs.supportsDirectoryPicker}
                                    value="fixed-folder"
                                >
                                    Always save to a chosen folder
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="bg-muted/40 flex flex-col gap-3 rounded-lg border p-4">
                        <div className="text-sm">
                            <span className="text-muted-foreground">Chosen folder: </span>
                            <span className="font-medium">{prefs.dirName ?? 'None'}</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button
                                disabled={busy || !prefs.supportsDirectoryPicker}
                                onClick={handlePickFolder}
                                type="button"
                            >
                                <FolderOpen className="mr-2 size-4" />
                                Choose local folder…
                            </Button>
                            <Button
                                disabled={busy || !prefs.dirName}
                                onClick={handleClearFolder}
                                type="button"
                                variant="outline"
                            >
                                <FolderX className="mr-2 size-4" />
                                Clear
                            </Button>
                        </div>
                        {!prefs.supportsDirectoryPicker && (
                            <p className="text-muted-foreground text-xs">
                                File System Access API is not available in this browser. “Ask each time” still
                                works in Chromium via the save dialog; otherwise files go to the default
                                Downloads folder.
                            </p>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
