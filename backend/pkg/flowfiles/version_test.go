package flowfiles

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestIsVersionedBackupName(t *testing.T) {
	t.Parallel()
	assert.True(t, IsVersionedBackupName("vlink_workbench.v1_prev_20260803_151320.html"))
	assert.True(t, IsVersionedBackupName("report.v12_prev_20260101_000000.md"))
	assert.False(t, IsVersionedBackupName("vlink_workbench.html"))
	assert.False(t, IsVersionedBackupName("vlink_workbench.v1.html"))
	assert.False(t, IsVersionedBackupName("notes.txt"))
}

func TestNextBackupVersion(t *testing.T) {
	dir := t.TempDir()
	require.NoError(t, os.WriteFile(filepath.Join(dir, "doc.html"), []byte("a"), 0644))
	require.NoError(t, os.WriteFile(filepath.Join(dir, "doc.v1_prev_20260101_010101.html"), []byte("old"), 0644))
	require.NoError(t, os.WriteFile(filepath.Join(dir, "doc.v3_prev_20260102_010101.html"), []byte("older"), 0644))
	require.NoError(t, os.WriteFile(filepath.Join(dir, "other.v2_prev_20260101_010101.html"), []byte("x"), 0644))

	n, err := NextBackupVersion(dir, "doc.html")
	require.NoError(t, err)
	assert.Equal(t, 4, n)

	n, err = NextBackupVersion(dir, "fresh.html")
	require.NoError(t, err)
	assert.Equal(t, 1, n)
}

func TestCommitStagedWithVersionBackup(t *testing.T) {
	dir := t.TempDir()
	mainPath := filepath.Join(dir, "workbench.html")
	require.NoError(t, os.WriteFile(mainPath, []byte("version-one"), 0644))

	staged := filepath.Join(dir, ".staged.html")
	require.NoError(t, os.WriteFile(staged, []byte("version-two"), 0644))

	backup, result, err := CommitStagedWithVersionBackup(mainPath, staged)
	require.NoError(t, err)
	assert.Equal(t, CommitUpdated, result)
	assert.NotEmpty(t, backup)
	assert.True(t, IsVersionedBackupName(filepath.Base(backup)))

	mainData, err := os.ReadFile(mainPath)
	require.NoError(t, err)
	assert.Equal(t, "version-two", string(mainData))

	backupData, err := os.ReadFile(backup)
	require.NoError(t, err)
	assert.Equal(t, "version-one", string(backupData))

	// Same content → unchanged, no new backup
	staged2 := filepath.Join(dir, ".staged2.html")
	require.NoError(t, os.WriteFile(staged2, []byte("version-two"), 0644))
	backup2, result2, err := CommitStagedWithVersionBackup(mainPath, staged2)
	require.NoError(t, err)
	assert.Equal(t, CommitUnchanged, result2)
	assert.Empty(t, backup2)

	// Create when main missing
	main2 := filepath.Join(dir, "new.html")
	staged3 := filepath.Join(dir, ".staged3.html")
	require.NoError(t, os.WriteFile(staged3, []byte("brand-new"), 0644))
	backup3, result3, err := CommitStagedWithVersionBackup(main2, staged3)
	require.NoError(t, err)
	assert.Equal(t, CommitCreated, result3)
	assert.Empty(t, backup3)
	data, err := os.ReadFile(main2)
	require.NoError(t, err)
	assert.Equal(t, "brand-new", string(data))
}

func TestVersionedBackupPathUTC(t *testing.T) {
	ts := time.Date(2026, 8, 3, 7, 13, 20, 0, time.UTC)
	p := VersionedBackupPath("/data/work/vlink_workbench.html", 2, ts)
	assert.Equal(t, "/data/work/vlink_workbench.v2_prev_20260803_071320.html", p)
}
