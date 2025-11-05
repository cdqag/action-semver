import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import * as core from '@actions/core';
import * as semver from 'semver';
import { context } from '@actions/github';
import { GitHubClient } from '../github';
import { main } from '../main';
import { getBumpTypeFromCommits, suffixWithPreRelease } from '../logic';
import { NotConventionalCommitsReaction } from '../types';
import { Commit } from '../github/types';

// Mock dependencies
jest.mock('@actions/core');
jest.mock('@actions/github');
jest.mock('../github');
jest.mock('../logic');

const mockCore = core as jest.Mocked<typeof core>;
const mockContext = context as jest.Mocked<typeof context>;
const mockGitHubClient = GitHubClient as jest.MockedClass<typeof GitHubClient>;
const mockGetBumpTypeFromCommits = getBumpTypeFromCommits as jest.MockedFunction<typeof getBumpTypeFromCommits>;
const mockSuffixWithPreRelease = suffixWithPreRelease as jest.MockedFunction<typeof suffixWithPreRelease>;

describe('main', () => {
  let mockGitHubClientInstance: jest.Mocked<GitHubClient>;
  
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Setup mock GitHubClient instance
    mockGitHubClientInstance = {
      getLatestReleaseTag: jest.fn(),
      getListOfCommitsBetween: jest.fn(),
      getDefaultBranchName: jest.fn(),
    } as any;
    
    mockGitHubClient.mockImplementation(() => mockGitHubClientInstance);
    
    // Setup default mock implementations
    mockCore.info = jest.fn();
    mockCore.debug = jest.fn();
    mockCore.setOutput = jest.fn();
    mockCore.setFailed = jest.fn();
    
    // Setup context mock
    mockContext.sha = 'abc1234567890def';
    
    // Setup default return value for getDefaultBranchName
    mockGitHubClientInstance.getDefaultBranchName.mockResolvedValue('main');

    // Setup default return value for suffixWithPreRelease
    mockSuffixWithPreRelease.mockImplementation((version, glue) => `${version}${glue}abc1234`);
  });

  describe('when latest release tag exists and is valid', () => {
    it('should use the latest release tag as current version', async () => {
      const latestTag = 'v1.2.3';
      const commits: Commit[] = [
        { sha: 'abc123', message: 'feat: add new feature' }
      ];
      
      mockGitHubClientInstance.getLatestReleaseTag.mockResolvedValue(latestTag);
      mockGitHubClientInstance.getListOfCommitsBetween.mockResolvedValue(commits);
      mockGitHubClientInstance.getDefaultBranchName.mockResolvedValue('main');
      mockGetBumpTypeFromCommits.mockReturnValue('minor');
      
      await main('owner/repo', 'token', 'refs/heads/main', 'warn', '1.0.0', '-');
      
      expect(mockCore.info).toHaveBeenCalledWith('Latest release tag: v1.2.3');
      expect(mockCore.info).toHaveBeenCalledWith('Current version: 1.2.3');
      expect(mockCore.setOutput).toHaveBeenCalledWith('current-version', '1.2.3');
      expect(mockCore.setOutput).toHaveBeenCalledWith('new-version', '1.3.0');
      expect(mockCore.setOutput).toHaveBeenCalledWith('new-major-version', '1');
    });

    it('should fail when latest release tag is not valid semver', async () => {
      const invalidTag = 'invalid-tag';
      
      mockGitHubClientInstance.getLatestReleaseTag.mockResolvedValue(invalidTag);
      mockGitHubClientInstance.getDefaultBranchName.mockResolvedValue('main');
      
      await main('owner/repo', 'token', 'refs/heads/main', 'warn', '1.0.0', '-');
      
      expect(mockCore.setFailed).toHaveBeenCalledWith(
        'Latest release tag (invalid-tag) is not a valid semver version. Please ensure your latest release tag follows semver format.'
      );
    });
  });

  describe('when no latest release tag exists', () => {
    it('should use initial release version when valid', async () => {
      const commits: Commit[] = [
        { sha: 'def456', message: 'fix: bug fix' }
      ];
      
      mockGitHubClientInstance.getLatestReleaseTag.mockResolvedValue(null);
      mockGitHubClientInstance.getDefaultBranchName.mockResolvedValue('main');
      
      await main('owner/repo', 'token', 'refs/heads/main', 'error', '2.0.0', '-');
      
      expect(mockCore.info).toHaveBeenCalledWith('Latest release tag: ');
      expect(mockCore.info).toHaveBeenCalledWith('New version: 2.0.0');
      expect(mockCore.setOutput).toHaveBeenCalledWith('current-version', '');
      expect(mockCore.setOutput).toHaveBeenCalledWith('new-version', '2.0.0');
    });

    it('should fail when initial release version is not valid semver', async () => {
      mockGitHubClientInstance.getLatestReleaseTag.mockResolvedValue(null);
      mockGitHubClientInstance.getDefaultBranchName.mockResolvedValue('main');
      
      await main('owner/repo', 'token', 'refs/heads/main', 'warn', 'invalid-version', '-');
      
      expect(mockCore.setFailed).toHaveBeenCalledWith(
        'No valid latest release tag found and the provided initial version (invalid-version) is not a valid semver version.'
      );
    });
  });

  describe('commit handling', () => {
    beforeEach(() => {
      mockGitHubClientInstance.getLatestReleaseTag.mockResolvedValue('v1.0.0');
    });

    it('should handle no new commits', async () => {
      mockGitHubClientInstance.getListOfCommitsBetween.mockResolvedValue([]);
      mockGitHubClientInstance.getDefaultBranchName.mockResolvedValue('main');
      
      await main('owner/repo', 'token', 'refs/heads/main', 'warn', '1.0.0', '-');
      
      expect(mockCore.info).toHaveBeenCalledWith('No new commits found since the latest release.');
      expect(mockCore.info).toHaveBeenCalledWith('No conventional commits found. Bumping patch version.');
      expect(mockCore.info).toHaveBeenCalledWith('Bump type: patch');
      expect(mockCore.setOutput).toHaveBeenCalledWith('new-version', '1.0.1');
    });

    it('should handle commits and determine bump type', async () => {
      const commits: Commit[] = [
        { sha: 'abc123', message: 'feat: new feature' },
        { sha: 'def456', message: 'fix: bug fix' }
      ];
      
      mockGitHubClientInstance.getListOfCommitsBetween.mockResolvedValue(commits);
      mockGitHubClientInstance.getDefaultBranchName.mockResolvedValue('main');
      mockGetBumpTypeFromCommits.mockReturnValue('minor');
      
      await main('owner/repo', 'token', 'refs/heads/develop', 'ignore', '1.0.0', '-');
      
      expect(mockCore.info).toHaveBeenCalledWith('Found 2 commits since the latest release.');
      expect(mockGetBumpTypeFromCommits).toHaveBeenCalledWith(commits, NotConventionalCommitsReaction.IGNORE);
      expect(mockCore.info).toHaveBeenCalledWith('Bump type: minor');
      expect(mockSuffixWithPreRelease).toHaveBeenCalledWith('1.1.0', '-');
      expect(mockCore.setOutput).toHaveBeenCalledWith('new-version', '1.1.0-abc1234');
    });

    it('should handle major version bump', async () => {
      const commits: Commit[] = [
        { sha: 'abc123', message: 'feat!: breaking change' }
      ];
      
      mockGitHubClientInstance.getListOfCommitsBetween.mockResolvedValue(commits);
      mockGitHubClientInstance.getDefaultBranchName.mockResolvedValue('main');
      mockGetBumpTypeFromCommits.mockReturnValue('major');
      
      await main('owner/repo', 'token', 'refs/heads/main', 'error', '1.0.0', '-');
      
      expect(mockCore.info).toHaveBeenCalledWith('Bump type: major');
      expect(mockCore.setOutput).toHaveBeenCalledWith('new-version', '2.0.0');
      expect(mockCore.setOutput).toHaveBeenCalledWith('new-major-version', '2');
    });

    it('should fail when unable to get commits', async () => {
      const error = new Error('API Error');
      mockGitHubClientInstance.getListOfCommitsBetween.mockRejectedValue(error);
      mockGitHubClientInstance.getDefaultBranchName.mockResolvedValue('main');
      
      await main('owner/repo', 'token', 'refs/heads/main', 'warn', '1.0.0', '-');
      
      expect(mockCore.setFailed).toHaveBeenCalledWith(
        'Failed to get the list of commits between v1.0.0 and refs/heads/main. Please ensure the target branch exists.'
      );
    });

    it('should handle null bump type by defaulting to patch', async () => {
      const commits: Commit[] = [
        { sha: 'abc123', message: 'docs: update readme' }
      ];
      
      mockGitHubClientInstance.getListOfCommitsBetween.mockResolvedValue(commits);
      mockGitHubClientInstance.getDefaultBranchName.mockResolvedValue('main');
      mockGetBumpTypeFromCommits.mockReturnValue(null as any);
      
      await main('owner/repo', 'token', 'refs/heads/main', 'warn', '1.0.0', '-');
      
      expect(mockCore.info).toHaveBeenCalledWith('No conventional commits found. Bumping patch version.');
      expect(mockCore.info).toHaveBeenCalledWith('Bump type: patch');
      expect(mockCore.setOutput).toHaveBeenCalledWith('new-version', '1.0.1');
    });
  });

  describe('version calculation', () => {
    beforeEach(() => {
      mockGitHubClientInstance.getLatestReleaseTag.mockResolvedValue('v2.5.10');
      mockGitHubClientInstance.getListOfCommitsBetween.mockResolvedValue([]);
      mockGitHubClientInstance.getDefaultBranchName.mockResolvedValue('main');
    });

    it('should calculate patch version correctly', async () => {
      await main('owner/repo', 'token', 'refs/heads/main', 'warn', '1.0.0', '-');
      
      expect(mockCore.setOutput).toHaveBeenCalledWith('new-version', '2.5.11');
      expect(mockCore.setOutput).toHaveBeenCalledWith('new-major-version', '2');
    });
  });

  describe('output setting', () => {
    beforeEach(() => {
      mockGitHubClientInstance.getLatestReleaseTag.mockResolvedValue('v3.1.4');
      mockGitHubClientInstance.getListOfCommitsBetween.mockResolvedValue([]);
      mockGitHubClientInstance.getDefaultBranchName.mockResolvedValue('main');
    });

    it('should set all required outputs', async () => {
      await main('owner/repo', 'token', 'refs/heads/main', 'warn', '1.0.0', '-');
      
      expect(mockCore.setOutput).toHaveBeenCalledWith('latest-release-tag', 'v3.1.4');
      expect(mockCore.setOutput).toHaveBeenCalledWith('current-version', '3.1.4');
      expect(mockCore.setOutput).toHaveBeenCalledWith('new-version', '3.1.5');
      expect(mockCore.setOutput).toHaveBeenCalledWith('new-major-version', '3');
    });

    it('should handle empty latest release tag', async () => {
      mockGitHubClientInstance.getLatestReleaseTag.mockResolvedValue(null);
      mockGitHubClientInstance.getDefaultBranchName.mockResolvedValue('main');
      
      await main('owner/repo', 'token', 'refs/heads/main', 'warn', '1.0.0', '-');
      
      expect(mockCore.setOutput).toHaveBeenCalledWith('latest-release-tag', '');
    });
  });

  describe('GitHub client initialization', () => {
    it('should initialize GitHub client with correct parameters', async () => {
      mockGitHubClientInstance.getLatestReleaseTag.mockResolvedValue('v1.0.0');
      mockGitHubClientInstance.getListOfCommitsBetween.mockResolvedValue([]);
      mockGitHubClientInstance.getDefaultBranchName.mockResolvedValue('main');
      
      await main('myorg/myrepo', 'gh_token_123', 'refs/heads/main', 'warn', '1.0.0', '-');
      
      expect(mockGitHubClient).toHaveBeenCalledWith('gh_token_123', 'myorg/myrepo');
    });
  });

  describe('logging and debugging', () => {
    beforeEach(() => {
      mockGitHubClientInstance.getLatestReleaseTag.mockResolvedValue('v1.0.0');
      mockGitHubClientInstance.getDefaultBranchName.mockResolvedValue('main');
    });

    it('should log debug information for commit retrieval', async () => {
      const commits: Commit[] = [{ sha: 'abc', message: 'test' }];
      mockGitHubClientInstance.getListOfCommitsBetween.mockResolvedValue(commits);
      mockGetBumpTypeFromCommits.mockReturnValue('patch');
      mockSuffixWithPreRelease.mockReturnValue('1.0.1-abc1234');
      
      await main('owner/repo', 'token', 'refs/heads/feature-branch', 'warn', '1.0.0', '-');
      
      expect(mockCore.debug).toHaveBeenCalledWith('Getting list of commits between v1.0.0 and refs/heads/feature-branch.');
    });
  });

  describe('pre-release functionality', () => {
    beforeEach(() => {
      mockGitHubClientInstance.getLatestReleaseTag.mockResolvedValue('v1.0.0');
      mockGitHubClientInstance.getListOfCommitsBetween.mockResolvedValue([]);
      mockSuffixWithPreRelease.mockImplementation((version, glue) => `${version}-abc1234`);
    });

    it('should suffix version with pre-release identifier when target branch is not default', async () => {
      mockGitHubClientInstance.getDefaultBranchName.mockResolvedValue('main');
      
      await main('owner/repo', 'token', 'refs/heads/feature-branch', 'warn', '1.0.0', '-');

      expect(mockCore.info).toHaveBeenCalledWith('Target ref (refs/heads/feature-branch) is not the default branch ref (refs/heads/main). Suffixing version with pre-release identifier.');
      expect(mockSuffixWithPreRelease).toHaveBeenCalledWith('1.0.1', '-');
      expect(mockCore.setOutput).toHaveBeenCalledWith('new-version', '1.0.1-abc1234');
    });

    it('should not suffix version when target branch is the default branch', async () => {
      mockGitHubClientInstance.getDefaultBranchName.mockResolvedValue('main');
      
      await main('owner/repo', 'token', 'refs/heads/main', 'warn', '1.0.0', '-');
      
      expect(mockSuffixWithPreRelease).not.toHaveBeenCalled();
      expect(mockCore.setOutput).toHaveBeenCalledWith('new-version', '1.0.1');
    });

    it('should handle different pre-release glue characters', async () => {
      mockGitHubClientInstance.getDefaultBranchName.mockResolvedValue('master');
      mockSuffixWithPreRelease.mockReturnValue('1.0.1.abc1234');
      
      await main('owner/repo', 'token', 'refs/heads/develop', 'warn', '1.0.0', '.');
      
      expect(mockSuffixWithPreRelease).toHaveBeenCalledWith('1.0.1', '.');
      expect(mockCore.setOutput).toHaveBeenCalledWith('new-version', '1.0.1.abc1234');
    });

    it('should handle pre-release for initial version when no latest release exists', async () => {
      mockGitHubClientInstance.getLatestReleaseTag.mockResolvedValue(null);
      mockGitHubClientInstance.getDefaultBranchName.mockResolvedValue('main');
      mockSuffixWithPreRelease.mockReturnValue('2.0.0-abc1234');
      
      await main('owner/repo', 'token', 'refs/heads/feature-branch', 'warn', '2.0.0', '-');
      
      expect(mockSuffixWithPreRelease).toHaveBeenCalledWith('2.0.0', '-');
      expect(mockCore.setOutput).toHaveBeenCalledWith('new-version', '2.0.0-abc1234');
    });
  });
});
