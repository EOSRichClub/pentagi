package flowfiles

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// Versioned backup files keep prior content when a same-named main file is updated.
// Pattern: {stem}.v{N}_prev_{YYYYMMDD_HHMMSS}{ext}
// Example: vlink_workbench.v2_prev_20260803_151320.html
var versionedBackupNameRE = regexp.MustCompile(`(?i)^(.+)\.v(\d+)_prev_(\d{8}_\d{6})(\.[^.]+)?$`)

// IsVersionedBackupName reports whether name is a versioned previous-copy produced
// by BackupExistingRegularFile / CommitStagedWithVersionBackup.
func IsVersionedBackupName(name string) bool {
	return versionedBackupNameRE.MatchString(path.Base(name))
}

// NextBackupVersion scans dir for siblings of baseName that already use the
// versioned-backup naming scheme and returns max(N)+1 (starting at 1).
func NextBackupVersion(dir, baseName string) (int, error) {
	stem, ext := splitStemExt(baseName)
	entries, err := os.ReadDir(dir)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return 1, nil
		}
		return 0, err
	}

	maxVer := 0
	prefix := stem + ".v"
	suffixHint := "_prev_"
	for _, entry := range entries {
		name := entry.Name()
		m := versionedBackupNameRE.FindStringSubmatch(name)
		if m == nil {
			continue
		}
		// m[1]=stem, m[2]=N, m[3]=ts, m[4]=ext (optional)
		if m[1] != stem {
			continue
		}
		if ext != "" && m[4] != ext {
			// allow missing ext match only when original has no ext
			continue
		}
		if !strings.HasPrefix(name, prefix) || !strings.Contains(name, suffixHint) {
			continue
		}
		n, convErr := strconv.Atoi(m[2])
		if convErr != nil {
			continue
		}
		if n > maxVer {
			maxVer = n
		}
	}
	return maxVer + 1, nil
}

// VersionedBackupPath builds the absolute backup path next to mainPath.
func VersionedBackupPath(mainPath string, version int, ts time.Time) string {
	dir := filepath.Dir(mainPath)
	base := filepath.Base(mainPath)
	stem, ext := splitStemExt(base)
	name := fmt.Sprintf("%s.v%d_prev_%s%s", stem, version, ts.UTC().Format("20060102_150405"), ext)
	return filepath.Join(dir, name)
}

// BackupExistingRegularFile renames an existing regular file at mainPath to a
// versioned sibling. If mainPath does not exist, returns ("", false, nil).
// Directories and special files return an error (caller should use RemoveAll).
func BackupExistingRegularFile(mainPath string) (backupPath string, backedUp bool, err error) {
	info, err := os.Lstat(mainPath)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return "", false, nil
		}
		return "", false, err
	}
	if !info.Mode().IsRegular() {
		return "", false, fmt.Errorf("'%s' is not a regular file", mainPath)
	}
	// Never re-version an already versioned backup as the main file name.
	if IsVersionedBackupName(filepath.Base(mainPath)) {
		return "", false, fmt.Errorf("'%s' is already a versioned backup", filepath.Base(mainPath))
	}

	dir := filepath.Dir(mainPath)
	ver, err := NextBackupVersion(dir, filepath.Base(mainPath))
	if err != nil {
		return "", false, err
	}
	backupPath = VersionedBackupPath(mainPath, ver, time.Now().UTC())
	if err := os.Rename(mainPath, backupPath); err != nil {
		return "", false, fmt.Errorf("failed to rename to versioned backup: %w", err)
	}
	return backupPath, true, nil
}

// SameFileContent reports whether two regular files have identical SHA-256 content.
func SameFileContent(pathA, pathB string) (bool, error) {
	ha, err := fileSHA256(pathA)
	if err != nil {
		return false, err
	}
	hb, err := fileSHA256(pathB)
	if err != nil {
		return false, err
	}
	return ha == hb, nil
}

// CommitResult describes how CommitStagedWithVersionBackup resolved the write.
type CommitResult string

const (
	CommitCreated   CommitResult = "created"
	CommitUpdated   CommitResult = "updated"
	CommitUnchanged CommitResult = "unchanged"
)

// CommitStagedWithVersionBackup moves stagedPath onto mainPath.
//
// Rules for an existing regular mainPath:
//   - identical content → discard staged, leave main, result Unchanged
//   - different content → rename main to versioned backup, then move staged to main
//
// If mainPath is missing, staged is renamed to main (Created).
// If mainPath exists but is not a regular file, returns an error (caller may RemoveAll).
// Main filename is always the latest content after a successful Updated/Created.
func CommitStagedWithVersionBackup(mainPath, stagedPath string) (backupPath string, result CommitResult, err error) {
	stagedInfo, err := os.Lstat(stagedPath)
	if err != nil {
		return "", "", fmt.Errorf("staged file: %w", err)
	}
	if !stagedInfo.Mode().IsRegular() {
		return "", "", fmt.Errorf("staged path is not a regular file")
	}

	mainInfo, err := os.Lstat(mainPath)
	if err != nil {
		if !errors.Is(err, os.ErrNotExist) {
			return "", "", err
		}
		if err := os.MkdirAll(filepath.Dir(mainPath), 0755); err != nil {
			return "", "", err
		}
		if err := os.Rename(stagedPath, mainPath); err != nil {
			return "", "", err
		}
		return "", CommitCreated, nil
	}

	if !mainInfo.Mode().IsRegular() {
		return "", "", fmt.Errorf("main path exists and is not a regular file")
	}

	same, err := SameFileContent(mainPath, stagedPath)
	if err != nil {
		return "", "", err
	}
	if same {
		_ = os.Remove(stagedPath)
		return "", CommitUnchanged, nil
	}

	backupPath, backedUp, err := BackupExistingRegularFile(mainPath)
	if err != nil {
		return "", "", err
	}
	if !backedUp {
		// Race: file vanished between Lstat and backup — treat as create.
		if err := os.Rename(stagedPath, mainPath); err != nil {
			return "", "", err
		}
		return "", CommitCreated, nil
	}

	if err := os.Rename(stagedPath, mainPath); err != nil {
		// Best-effort restore of backup to main so we do not leave the cache empty.
		_ = os.Rename(backupPath, mainPath)
		return "", "", fmt.Errorf("failed to commit staged file after backup: %w", err)
	}
	return backupPath, CommitUpdated, nil
}

func splitStemExt(baseName string) (stem, ext string) {
	ext = path.Ext(baseName)
	if ext == "" {
		return baseName, ""
	}
	return strings.TrimSuffix(baseName, ext), ext
}

func fileSHA256(filePath string) (string, error) {
	f, err := os.Open(filePath)
	if err != nil {
		return "", err
	}
	defer f.Close()

	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return "", err
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}
