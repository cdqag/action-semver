import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import * as core from '@actions/core';
import { context } from '@actions/github';
import { noteHasBreakingChange, getBumpTypeFromCommits, suffixWithPreRelease } from '../logic';
import { Commit } from '../github/types';
import { NotConventionalCommitsReaction } from "../types";

// Mock @actions/core
jest.mock('@actions/core');
const mockedCore = jest.mocked(core);

// Mock @actions/github context
jest.mock('@actions/github', () => {
  const originalModule = jest.requireActual('@actions/github') as typeof import('@actions/github');
  return {
    __esModule: true,
    ...originalModule,
    context: {
      ...originalModule.context,
      sha: 'abcdef1234567890',
    },
  };
});


describe('noteHasBreakingChange', () => {
  it('should return true for note with title BREAKING CHANGE', () => {
    const note = { title: 'BREAKING CHANGE', text: 'Some breaking change description' };
    expect(noteHasBreakingChange(note)).toBe(true);
  });

  it('should return false for note with different title', () => {
    const note = { title: 'Some other title', text: 'Some text' };
    expect(noteHasBreakingChange(note)).toBe(false);
  });
});


describe('getBumpTypeFromCommits', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('when given an empty array', () => {
    it('should return patch as default', () => {
      const commits: Commit[] = [];
      const result = getBumpTypeFromCommits(commits);
      expect(result).toBe('patch');
    });
  });

  describe('when given merge commits', () => {
    it('should ignore merge commits and return patch', () => {
      const commits: Commit[] = [
        { sha: 'abc123', message: 'Merge branch feature into main' },
        { sha: 'def456', message: 'Merge pull request #123 from user/branch' },
      ];
      
      const result = getBumpTypeFromCommits(commits);
      
      expect(result).toBe('patch');
      expect(mockedCore.debug).toHaveBeenCalledWith(
        "Ignoring commit message: 'Merge branch feature into main'"
      );
      expect(mockedCore.debug).toHaveBeenCalledWith(
        "Ignoring commit message: 'Merge pull request #123 from user/branch'"
      );
    });
  });

  describe('when given conventional commit messages', () => {
    it('should handle feat commits (minor bump)', () => {
      const commits: Commit[] = [
        { sha: 'abc123', message: 'feat: add new user authentication' },
        { sha: 'def456', message: 'fix(api): implement user profile endpoints' },
      ];
      
      const result = getBumpTypeFromCommits(commits);
      expect(result).toBe('minor');
    });

    it('should handle fix commits (patch bump)', () => {
      const commits: Commit[] = [
        { sha: 'abc123', message: 'fix: resolve memory leak in cache' },
        { sha: 'def456', message: 'fix(ui): correct button alignment issue' },
      ];
      
      const result = getBumpTypeFromCommits(commits);
      expect(result).toBe('patch');
    });

    it('should handle major changes without footer message (major bump)', () => {
      const commits: Commit[] = [
        { 
          sha: 'abc123', 
          message: 'feat!: remove deprecated API endpoints' 
        },
        { 
          sha: 'def456', 
          message: 'fix: update user model' 
        },
      ];
      
      const result = getBumpTypeFromCommits(commits);
      expect(result).toBe('major');
    });

    it('should handle breaking changes with footer message (major bump)', () => {
      const commits: Commit[] = [
        { 
          sha: 'abc123', 
          message: 'other(some-scope)!: remove deprecated API endpoints\n\nBREAKING CHANGE: Old endpoints are no longer supported' 
        },
        { 
          sha: 'def456', 
          message: 'fix: update user model' 
        },
      ];
      
      const result = getBumpTypeFromCommits(commits);
      expect(result).toBe('major');
    });

    it('should handle various conventional commit types', () => {
      const commits: Commit[] = [
        { sha: 'abc123', message: 'docs: update README with new examples' },
        { sha: 'def456', message: 'style: fix code formatting' },
        { sha: 'ghi789', message: 'refactor: reorganize utility functions' },
        { sha: 'jkl012', message: 'test: add unit tests for validation' },
        { sha: 'mno345', message: 'chore: update dependencies' },
        { sha: 'pqr678', message: 'ci: improve build pipeline' },
        { sha: 'stu901', message: 'perf: optimize database queries' },
      ];
      
      const result = getBumpTypeFromCommits(commits);
      expect(result).toBe('patch');
    });
  });

  describe('when given non-conventional commit messages', () => {
    it('should log warning for invalid commit formats', () => {
      const commits: Commit[] = [
        { sha: 'abc123', message: 'Add some new features' },
        { sha: 'def456', message: 'Bug fixes and improvements' },
        { sha: 'ghi789', message: 'WIP: work in progress' },
      ];
      
      const result = getBumpTypeFromCommits(commits);
      
      expect(result).toBe('patch');
      expect(mockedCore.warning).toHaveBeenCalledWith(
        "Commit message not in conventional-commits format: 'Add some new features'"
      );
      expect(mockedCore.warning).toHaveBeenCalledWith(
        "Commit message not in conventional-commits format: 'Bug fixes and improvements'"
      );
    });

    it('should fail for invalid commit formats', () => {
      const commits: Commit[] = [
        { sha: 'abc123', message: 'Add some new features' },
        { sha: 'def456', message: 'Bug fixes and improvements' },
        { sha: 'ghi789', message: 'WIP: work in progress' },
      ];
      
      const result = getBumpTypeFromCommits(commits, NotConventionalCommitsReaction.ERROR);
      
      expect(result).toBe(undefined);
      expect(mockedCore.setFailed).toHaveBeenCalledWith(
        "Commit message not in conventional-commits format: 'Add some new features'"
      );
      expect(mockedCore.warning).not.toHaveBeenCalledWith(
        "Commit message not in conventional-commits format: 'Bug fixes and improvements'"
      );
    });

    it('should ignore non-conventional commit formats', () => {
      const commits: Commit[] = [
        { sha: 'abc123', message: 'Add some new features' },
        { sha: 'def456', message: 'Bug fixes and improvements' },
        { sha: 'ghi789', message: 'WIP: work in progress' },
      ];
      
      const result = getBumpTypeFromCommits(commits, NotConventionalCommitsReaction.IGNORE);
      
      expect(result).toBe('patch');
      expect(mockedCore.warning).not.toHaveBeenCalledWith(
        "Commit message not in conventional-commits format: 'Add some new features'"
      );
      expect(mockedCore.setFailed).not.toHaveBeenCalledWith(
        "Commit message not in conventional-commits format: 'Add some new features'"
      );
      expect(mockedCore.warning).not.toHaveBeenCalledWith(
        "Commit message not in conventional-commits format: 'Bug fixes and improvements'"
      );
    });
  });

  describe('when given mixed commit messages', () => {
    it('should handle conventional commits and ignore merge commits', () => {
      const commits: Commit[] = [
        { sha: 'abc123', message: 'feat: add user dashboard' },
        { sha: 'def456', message: 'Merge branch "feature" into main' },
        { sha: 'ghi789', message: 'fix: resolve login issue' },
        { sha: 'jkl012', message: 'Invalid commit message format' },
      ];
      
      const result = getBumpTypeFromCommits(commits);
      
      expect(result).toBe('minor');
      expect(mockedCore.debug).toHaveBeenCalledWith(
        "Ignoring commit message: 'Merge branch \"feature\" into main'"
      );
      expect(mockedCore.warning).toHaveBeenCalledWith(
        "Commit message not in conventional-commits format: 'Invalid commit message format'"
      );
    });
  });

  describe('edge cases', () => {
    it('should handle commits with multi-line messages', () => {
      const commits: Commit[] = [
        { 
          sha: 'abc123', 
          message: 'feat: add user authentication\n\nImplement OAuth 2.0 flow with Google and GitHub providers.\nIncludes user session management and token refresh.' 
        },
      ];
      
      const result = getBumpTypeFromCommits(commits);
      expect(result).toBe('minor');
    });

    it('should handle commits with special characters', () => {
      const commits: Commit[] = [
        { sha: 'abc123', message: 'fix: resolve issue with åäö characters in names' },
        { sha: 'def456', message: 'feat: add support for émojis 🎉 in messages' },
      ];
      
      const result = getBumpTypeFromCommits(commits);
      expect(result).toBe('minor');
    });

    it('should handle empty commit messages', () => {
      const commits: Commit[] = [
        { sha: 'abc123', message: '' },
      ];
      
      const result = getBumpTypeFromCommits(commits);
      expect(result).toBe('patch');
      expect(mockedCore.warning).toHaveBeenCalledWith(
        "Commit message not in conventional-commits format: ''"
      );
    });

    it('should handle commits with only whitespace', () => {
      const commits: Commit[] = [
        { sha: 'abc123', message: '   \n\t  ' },
      ];
      
      const result = getBumpTypeFromCommits(commits);
      
      expect(result).toBe('patch');
      expect(mockedCore.warning).toHaveBeenCalledWith(
        "Commit message not in conventional-commits format: '   \n\t  '"
      );
    });
  });
});

describe('suffixWithPreRelease', () => {
  it('should suffix version with pre-release identifier', () => {
    const version = '1.2.3';
    const glue = '-rc.';
    const result = suffixWithPreRelease(version, glue);
    expect(result).toBe('1.2.3-rc.abcdef1');
  });
});
