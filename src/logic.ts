import * as core from '@actions/core';
import * as semver from 'semver';
import * as cc from '@conventional-commits/parser';

import { Commit } from "./github/types";
import { NotConventionalCommitsReaction } from "./types";

const IGNORE_MESSAGE_PATTERN = /(^Merge )/;

const BREAKING_CHANGE = 'BREAKING CHANGE';
const MINOR_LIST = ['feat', 'feature'];


/**
 * Check if a note indicates a breaking change.
 */
export const noteHasBreakingChange = (note: { title: string; text: string }): boolean => {
  return note.title === BREAKING_CHANGE;
}


/**
 * Determine the bump type (major, minor, patch) from a list of commits.
 */
export const getBumpTypeFromCommits = (
  commits: Array<Commit>,
  notConventionalCommitsReaction: NotConventionalCommitsReaction = NotConventionalCommitsReaction.WARN
): semver.ReleaseType => {
  let bumpMajor = false;
  let bumpMinor = false;

  for (const commit of commits) {
    if (IGNORE_MESSAGE_PATTERN.test(commit.message)) {
      core.debug(`Ignoring commit message: '${commit.message}'`);
      continue;
    }

    try {
      const commitMessage = cc.toConventionalChangelogFormat(cc.parser(commit.message));
      const commitMessageType = commitMessage.type.toLowerCase();

      if (commitMessage.notes.some(noteHasBreakingChange)) {
        bumpMajor = true;
      } else if (MINOR_LIST.includes(commitMessageType)) {
        bumpMinor = true;
      }

    } catch (error) {
      if (notConventionalCommitsReaction === NotConventionalCommitsReaction.ERROR) {
        core.setFailed(`Commit message not in conventional-commits format: '${commit.message}'`);
        return;
      } else if (notConventionalCommitsReaction === NotConventionalCommitsReaction.WARN) {
        core.warning(`Commit message not in conventional-commits format: '${commit.message}'`);
      }
      // If IGNORE, do nothing
    }
  }

  return bumpMajor ? 'major' : bumpMinor ? 'minor' : 'patch';
};
