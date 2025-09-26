import * as core from '@actions/core';
import { getOctokit } from '@actions/github';
import { Commit } from './types';


export class GitHubClient {
  private octokit: ReturnType<typeof getOctokit>;
  private repoOwner: string;
  private repoName: string;


  constructor(token: string, repoOwner: string, repoName: string);
  constructor(token: string, fullRepoName: string);
  constructor(token: string, ...repoArgs: string[]) {
    this.octokit = getOctokit(token);

    const [owner, repo] = repoArgs.length === 1 ? repoArgs[0].split('/') : repoArgs;
    this.repoOwner = owner;
    this.repoName = repo;
  }

  /**
   * Get the latest release tag name, or null if no releases exist.
   */
  async getLatestReleaseTag(): Promise<string | null> {
    try {
      
      const response = await this.octokit.rest.repos.getLatestRelease({
        owner: this.repoOwner,
        repo: this.repoName,
      });
      return response.data.tag_name;
    } catch (error) {
      if (error.status === 404) {
        return null; // No releases found
      }
      throw error; // Rethrow other errors
    }
  }

  /**
   * Get a list of commits between two git references (branches, tags, SHAs).
   */
  async getListOfCommitsBetween(rangeBegin: string, rangeEnd: string): Promise<Array<Commit>> {
    core.debug(`Getting list of commits between ${rangeBegin} and ${rangeEnd}`);
    const listOfCommits: Array<Commit> = [];

    const per_page = 100;
    let total_commits = -1;
    let page = 0;

    while(true) {
      try {
        core.debug(`Fetching commits page ${page}`);
        const response = await this.octokit.rest.repos.compareCommitsWithBasehead({
          owner: this.repoOwner,
          repo: this.repoName,
          basehead: `${rangeBegin}...${rangeEnd}`,
          page,
          per_page
        });
        core.debug(`Fetched ${response.data.commits.length} commits`);

        total_commits = response.data.total_commits;
        core.debug(`Total commits to fetch: ${total_commits}`);

        for (const commit of response.data.commits) {
          core.debug(`Found commit: ${commit.sha} with message: ${commit.commit.message}`);
          listOfCommits.push({
            sha: commit.sha,
            message: commit.commit.message
          });
        }

      } catch (error) {
        core.debug(`Error fetching commits: ${error.message}`);
        if (error.status === 404) {
          break; // No more commits found
        }
        throw error; // Rethrow other errors
      }

      if (listOfCommits.length >= total_commits) {
        break;
      }

      page++;
    }

    core.debug(`Total commits fetched: ${listOfCommits.length}`);
    return listOfCommits;
  }

  /**
   * Get the default branch name of the repository.
   */
  async getDefaultBranchName(): Promise<string> {
    const response = await this.octokit.rest.repos.get({
      owner: this.repoOwner,
      repo: this.repoName,
    });
    return response.data.default_branch;
  }

}
