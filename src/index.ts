import * as core from '@actions/core';
import { requireNonEmptyStringInput } from './utils';
import { main } from './main';

const repository = requireNonEmptyStringInput('repository');
const githubToken = requireNonEmptyStringInput('github-token');
const targetBranch = requireNonEmptyStringInput('target-branch');
const notConventionalCommitsReaction = requireNonEmptyStringInput('not-conventional-commits-reaction');
const initReleaseVersion = requireNonEmptyStringInput('init-release-version');
const preReleaseVersionGlue = requireNonEmptyStringInput('pre-release-version-glue');

main(
  repository,
  githubToken,
  targetBranch,
  notConventionalCommitsReaction,
  initReleaseVersion,
  preReleaseVersionGlue
);
