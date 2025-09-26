import * as core from '@actions/core';
import { context } from '@actions/github';
import { requireNonEmptyStringInput } from './utils';
import { main } from './main';

const githubToken = requireNonEmptyStringInput('github-token');
const targetBranch = requireNonEmptyStringInput('target-branch');
const notConventionalCommitsReaction = requireNonEmptyStringInput('not-conventional-commits-reaction');
const initReleaseVersion = requireNonEmptyStringInput('init-release-version');
const preReleaseVersionGlue = requireNonEmptyStringInput('pre-release-version-glue');

main(
  context.repo.repo,
  githubToken,
  targetBranch,
  notConventionalCommitsReaction,
  initReleaseVersion,
  preReleaseVersionGlue
);
