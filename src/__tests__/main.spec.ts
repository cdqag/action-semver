import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import * as core from '@actions/core';
import * as semver from 'semver';
import { GitHubClient } from '../github';
import { main } from '../main';
import { getBumpTypeFromCommits } from '../logic';
import { NotConventionalCommitsReaction } from '../types';
import { Commit } from '../github/types';

// Mock dependencies
jest.mock('@actions/core');
jest.mock('../github');
jest.mock('../logic');

const mockCore = core as jest.Mocked<typeof core>;
const mockGitHubClient = GitHubClient as jest.MockedClass<typeof GitHubClient>;
const mockGetBumpTypeFromCommits = getBumpTypeFromCommits as jest.MockedFunction<typeof getBumpTypeFromCommits>;

describe('main', () => {
  let mockGitHubClientInstance: jest.Mocked<GitHubClient>;
  
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Setup mock GitHubClient instance
    mockGitHubClientInstance = {
      getLatestReleaseTag: jest.fn(),
      getListOfCommitsBetween: jest.fn(),
    } as any;
    
    mockGitHubClient.mockImplementation(() => mockGitHubClientInstance);
    
    // Setup default mock implementations
    mockCore.info = jest.fn();
    mockCore.debug = jest.fn();
    mockCore.setOutput = jest.fn();
    mockCore.setFailed = jest.fn();
  });

  describe('when latest release tag exists and is valid', () => {
    it('should use the latest release tag as current version', async () => {
      const latestTag = 'v1.2.3';
      const commits: Commit[] = [
        { sha: 'abc123', message: 'feat: add new feature' }
      ];
      
      mockGitHubClientInstance.getLatestReleaseTag.mockResolvedValue(latestTag);
      mockGitHubClientInstance.getListOfCommitsBetween.mockResolvedValue(commits);
      mockGetBumpTypeFromCommits.mockReturnValue('minor');
      
      await main('owner/repo', 'token', 'main', 'warn', '1.0.0');
      
      expect(mockCore.info).toHaveBeenCalledWith('Latest release tag: v1.2.3');
      expect(mockCore.info).toHaveBeenCalledWith('Current version: 1.2.3');
      expect(mockCore.setOutput).toHaveBeenCalledWith('current-version', '1.2.3');
      expect(mockCore.setOutput).toHaveBeenCalledWith('new-version', '1.3.0');
      expect(mockCore.setOutput).toHaveBeenCalledWith('new-major-version', '1');
    });

    it('should fail when latest release tag is not valid semver', async () => {
      const invalidTag = 'invalid-tag';
      
      mockGitHubClientInstance.getLatestReleaseTag.mockResolvedValue(invalidTag);
      
      await main('owner/repo', 'token', 'main', 'warn', '1.0.0');
      
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
      mockGitHubClientInstance.getListOfCommitsBetween.mockResolvedValue(commits);
      mockGetBumpTypeFromCommits.mockReturnValue('patch');
      
      await main('owner/repo', 'token', 'main', 'error', '2.0.0');
      
      expect(mockCore.info).toHaveBeenCalledWith('Latest release tag: ');
      expect(mockCore.info).toHaveBeenCalledWith('New version: 2.0.0');
      expect(mockCore.setOutput).toHaveBeenCalledWith('current-version', '');
      expect(mockCore.setOutput).toHaveBeenCalledWith('new-version', '2.0.0');
    });

    it('should fail when initial release version is not valid semver', async () => {
      mockGitHubClientInstance.getLatestReleaseTag.mockResolvedValue(null);
      
      await main('owner/repo', 'token', 'main', 'warn', 'invalid-version');
      
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
      
      await main('owner/repo', 'token', 'main', 'warn', '1.0.0');
      
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
      mockGetBumpTypeFromCommits.mockReturnValue('minor');
      
      await main('owner/repo', 'token', 'develop', 'ignore', '1.0.0');
      
      expect(mockCore.info).toHaveBeenCalledWith('Found 2 commits since the latest release.');
      expect(mockGetBumpTypeFromCommits).toHaveBeenCalledWith(commits, NotConventionalCommitsReaction.IGNORE);
      expect(mockCore.info).toHaveBeenCalledWith('Bump type: minor');
      expect(mockCore.setOutput).toHaveBeenCalledWith('new-version', '1.1.0');
    });

    it('should handle major version bump', async () => {
      const commits: Commit[] = [
        { sha: 'abc123', message: 'feat!: breaking change' }
      ];
      
      mockGitHubClientInstance.getListOfCommitsBetween.mockResolvedValue(commits);
      mockGetBumpTypeFromCommits.mockReturnValue('major');
      
      await main('owner/repo', 'token', 'main', 'error', '1.0.0');
      
      expect(mockCore.info).toHaveBeenCalledWith('Bump type: major');
      expect(mockCore.setOutput).toHaveBeenCalledWith('new-version', '2.0.0');
      expect(mockCore.setOutput).toHaveBeenCalledWith('new-major-version', '2');
    });

    it('should fail when unable to get commits', async () => {
      const error = new Error('API Error');
      mockGitHubClientInstance.getListOfCommitsBetween.mockRejectedValue(error);
      
      await main('owner/repo', 'token', 'main', 'warn', '1.0.0');
      
      expect(mockCore.setFailed).toHaveBeenCalledWith(
        'Failed to get the list of commits between v1.0.0 and main. Please ensure the target branch exists.'
      );
    });

    it('should handle null bump type by defaulting to patch', async () => {
      const commits: Commit[] = [
        { sha: 'abc123', message: 'docs: update readme' }
      ];
      
      mockGitHubClientInstance.getListOfCommitsBetween.mockResolvedValue(commits);
      mockGetBumpTypeFromCommits.mockReturnValue(null as any);
      
      await main('owner/repo', 'token', 'main', 'warn', '1.0.0');
      
      expect(mockCore.info).toHaveBeenCalledWith('No conventional commits found. Bumping patch version.');
      expect(mockCore.info).toHaveBeenCalledWith('Bump type: patch');
      expect(mockCore.setOutput).toHaveBeenCalledWith('new-version', '1.0.1');
    });
  });

  describe('version calculation', () => {
    beforeEach(() => {
      mockGitHubClientInstance.getLatestReleaseTag.mockResolvedValue('v2.5.10');
      mockGitHubClientInstance.getListOfCommitsBetween.mockResolvedValue([]);
    });

    it('should calculate patch version correctly', async () => {
      await main('owner/repo', 'token', 'main', 'warn', '1.0.0');
      
      expect(mockCore.setOutput).toHaveBeenCalledWith('new-version', '2.5.11');
      expect(mockCore.setOutput).toHaveBeenCalledWith('new-major-version', '2');
    });
  });

  describe('output setting', () => {
    beforeEach(() => {
      mockGitHubClientInstance.getLatestReleaseTag.mockResolvedValue('v3.1.4');
      mockGitHubClientInstance.getListOfCommitsBetween.mockResolvedValue([]);
    });

    it('should set all required outputs', async () => {
      await main('owner/repo', 'token', 'main', 'warn', '1.0.0');
      
      expect(mockCore.setOutput).toHaveBeenCalledWith('latest-release-tag', 'v3.1.4');
      expect(mockCore.setOutput).toHaveBeenCalledWith('current-version', '3.1.4');
      expect(mockCore.setOutput).toHaveBeenCalledWith('new-version', '3.1.5');
      expect(mockCore.setOutput).toHaveBeenCalledWith('new-major-version', '3');
    });

    it('should handle empty latest release tag', async () => {
      mockGitHubClientInstance.getLatestReleaseTag.mockResolvedValue(null);
      
      await main('owner/repo', 'token', 'main', 'warn', '1.0.0');
      
      expect(mockCore.setOutput).toHaveBeenCalledWith('latest-release-tag', '');
    });
  });

  describe('GitHub client initialization', () => {
    it('should initialize GitHub client with correct parameters', async () => {
      mockGitHubClientInstance.getLatestReleaseTag.mockResolvedValue('v1.0.0');
      mockGitHubClientInstance.getListOfCommitsBetween.mockResolvedValue([]);
      
      await main('myorg/myrepo', 'gh_token_123', 'main', 'warn', '1.0.0');
      
      expect(mockGitHubClient).toHaveBeenCalledWith('gh_token_123', 'myorg/myrepo');
    });
  });

  describe('logging and debugging', () => {
    beforeEach(() => {
      mockGitHubClientInstance.getLatestReleaseTag.mockResolvedValue('v1.0.0');
    });

    it('should log debug information for commit retrieval', async () => {
      const commits: Commit[] = [{ sha: 'abc', message: 'test' }];
      mockGitHubClientInstance.getListOfCommitsBetween.mockResolvedValue(commits);
      mockGetBumpTypeFromCommits.mockReturnValue('patch');
      
      await main('owner/repo', 'token', 'feature-branch', 'warn', '1.0.0');
      
      expect(mockCore.debug).toHaveBeenCalledWith('Getting list of commits between v1.0.0 and feature-branch.');
    });
  });
});
