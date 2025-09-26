export enum NotConventionalCommitsReaction {
  ERROR = 'error',
  WARN = 'warn',
  IGNORE = 'ignore',
}

export function getNotConventionalCommitsReactionEnumFromString(value: string): NotConventionalCommitsReaction {
  switch (value.toLowerCase()) {
    case 'error':
      return NotConventionalCommitsReaction.ERROR;
    case 'warn':
      return NotConventionalCommitsReaction.WARN;
    case 'ignore':
      return NotConventionalCommitsReaction.IGNORE;
    default:
      throw new Error(`Invalid NotConventionalCommitsReaction value: ${value}`);
  }
}
