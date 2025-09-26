import * as core from '@actions/core';
import * as semver from 'semver';
import * as cc from '@conventional-commits/parser';

import { GitHubClient } from './github';
import { Commit } from "./github/types";
import { getBumpTypeFromCommits } from './logic';
import { getNotConventionalCommitsReactionEnumFromString } from './types';


/**
 * Main function
 */
export const main = async (
  fullRepoName: string,
  githubToken: string,
  targetBranch: string,
  notConventionalCommitsReaction: string,
  initReleaseVersion: string
) => {
  const notConventionalCommitsReactionEnum = getNotConventionalCommitsReactionEnumFromString(notConventionalCommitsReaction);
  const githubClient = new GitHubClient(githubToken, fullRepoName);
  
  // Get the latest release tag
  let latestReleaseTag = await githubClient.getLatestReleaseTag();
  core.info(`Latest release tag: ${latestReleaseTag ?? ''}`);
  core.setOutput('latest-release-tag', latestReleaseTag ?? '');

  // Variable to hold the versions
  let currentVersion: string = '';
  let newVersion: string = '';

  if (latestReleaseTag) {
    // Validate the latest release tag
    currentVersion = semver.valid(latestReleaseTag);
    if (!currentVersion) {
      // If the latest release tag is not valid semver, fail the action
      core.setFailed(`Latest release tag (${latestReleaseTag}) is not a valid semver version. Please ensure your latest release tag follows semver format.`);
      return;
    }

    // Define a variable to hold the determined bump type
    let bumpType: semver.ReleaseType | null = null;

    if (latestReleaseTag) {
      // Get the list of commits between the latest release tag and the target branch
      let commits: Commit[] = [];
      try {
        core.debug(`Getting list of commits between ${latestReleaseTag} and ${targetBranch}.`);
        commits = await githubClient.getListOfCommitsBetween(latestReleaseTag, targetBranch);
      } catch (error) {
        core.setFailed(`Failed to get the list of commits between ${latestReleaseTag ?? 'the beginning'} and ${targetBranch}. Please ensure the target branch exists.`);
        return;
      }


      if (commits.length === 0) {
        core.info('No new commits found since the latest release.');
      } else {
        core.info(`Found ${commits.length} commits since the latest release.`);
        bumpType = getBumpTypeFromCommits(commits, notConventionalCommitsReactionEnum);
      }
    }

    if (!bumpType) {
      core.info('No conventional commits found. Bumping patch version.');
      bumpType = 'patch';
    }
    core.info(`Bump type: ${bumpType}`);

    // Calculate the new version
    newVersion = semver.inc(currentVersion, bumpType);
    if (!newVersion) {
      core.setFailed('Failed to increment version. Please check the current version and bump type.');
      return;
    }

  } else {
    // If no latest release tag, validate the provided initial version
    newVersion = semver.valid(initReleaseVersion)

    if (!newVersion) {
      // If the provided initial version is not valid, fail the action
      core.setFailed(`No valid latest release tag found and the provided initial version (${initReleaseVersion}) is not a valid semver version.`);
      return;
    }
  }

  core.info(`Current version: ${currentVersion}`);
  core.setOutput('current-version', currentVersion);

  core.info(`New version: ${newVersion}`);
  core.setOutput('new-version', newVersion);

  // Get major version
  const newMajorVersion = semver.major(newVersion);
  core.info(`New major version: ${newMajorVersion}`);
  core.setOutput('new-major-version', newMajorVersion.toString());
}
