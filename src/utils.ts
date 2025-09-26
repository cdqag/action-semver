import * as core from '@actions/core';

/**
 * Require a non-empty string input.
 * @param name 
 * @returns 
 */
export const requireNonEmptyStringInput = (name: string): string => {
  const value = core.getInput(name).trim();
  if (value === '') {
    throw new Error(`Input '${name}' cannot be an empty string`);
  }
  return value;
}
