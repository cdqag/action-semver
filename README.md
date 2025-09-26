# Action SemVer

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![GitHub Release](https://img.shields.io/github/release/cdqag/action-semver.svg)](https://github.com/cdqag/action-semver/releases)

A GitHub Action for automatic semantic versioning based on [Semantic Versioning (SemVer)](https://semver.org/) and [Conventional Commits](https://www.conventionalcommits.org/).

This action analyzes your commit history since the last release and automatically determines the next version number based on the types of changes made. It supports both regular releases on the default branch and pre-releases on feature branches.

## Features

- 🔍 **Automatic Version Detection**: Analyzes commits using Conventional Commits format
- 📈 **SemVer Compliance**: Follows semantic versioning principles (MAJOR.MINOR.PATCH)
- 🌿 **Pre-release Support**: Generates pre-release versions for non-default branches
- ⚙️ **Configurable Behavior**: Customizable handling of non-conventional commits
- 🏷️ **Release Tag Management**: Works with existing GitHub release tags
- 🛡️ **Error Handling**: Comprehensive validation and error reporting

## Version Bump Rules

The action determines version bumps based on conventional commit types:

- **MAJOR** (x.0.0): Breaking changes (`BREAKING CHANGE:` in commit body/footer)
- **MINOR** (x.y.0): New features (`feat:`, `feature:`)
- **PATCH** (x.y.z): Bug fixes and other changes (`fix:`, `docs:`, `style:`, etc.)

## Usage

### Basic Usage

```yaml
name: Version Check
on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  version:
    runs-on: ubuntu-latest
    steps:
      - name: Determine Version
        id: semver
        uses: cdqag/action-semver@v1

      - name: Print Versions
        run: |
          echo "Current version: ${{ steps.semver.outputs.current-version }}"
          echo "New version: ${{ steps.semver.outputs.new-version }}"
          echo "Latest release tag: ${{ steps.semver.outputs.latest-release-tag }}"
```

### Advanced Usage with Custom Configuration

```yaml
      - name: Determine Version
        id: semver
        uses: cdqag/action-semver@v1
        with:
          github-token: ${{ secrets.CUSTOM_TOKEN }}
          target-branch: ${{ github.ref_name }}
          not-conventional-commits-reaction: error
          init-release-version: v1.0.0
          pre-release-version-glue: '+dev' // Python PEP 440 style
```

## Inputs

| Input | Description | Default | Required |
|-------|-------------|---------|----------|
| `repository` | The repository to analyze in the format 'owner/repo'. If not provided, defaults to the current repository. | `${{ github.repository }}` | ❌ |
| `github-token` | GitHub Token for API access | `${{ github.token }}` | ❌ |
| `target-branch` | Branch to analyze for commits | `${{ github.ref_name }}` | ❌ |
| `not-conventional-commits-reaction` | How to handle non-conventional commits (`error`, `warn`, `silent`) | `warn` | ❌ |
| `init-release-version` | Initial version when no releases exist | `v0.1.0` | ❌ |
| `pre-release-version-glue` | Separator for pre-release identifiers | `-` | ❌ |

## Outputs

| Output | Description | Example |
|--------|-------------|---------|
| `latest-release-tag` | Latest release tag found in repository | `v1.2.3` |
| `current-version` | Current version in x.y.z format | `1.2.3` |
| `new-version` | New version in x.y.z format | `1.2.4` |
| `new-major-version` | New major version number | `1` |

## Conventional Commit Examples

### Patch Release (1.0.0 → 1.0.1)

```text
fix: resolve authentication issue
docs: update installation guide
style: format code according to eslint rules
```

### Minor Release (1.0.0 → 1.1.0)

```text
feat: add user profile management
feature: implement dark mode support
```

### Major Release (1.0.0 → 2.0.0)

```text
feat: redesign API structure

BREAKING CHANGE: The API endpoints have been restructured.
Users need to update their integration code.
```

## Pre-release Versions

When working on non-default branches, the action automatically appends pre-release identifiers:

- Default branch: `1.2.3`
- Feature branch: `1.2.3-feature-branch-name`

## Error Handling

The action validates several conditions and will fail with descriptive messages if:

- The latest release tag is not valid SemVer format
- The initial release version is not valid SemVer
- The target branch doesn't exist
- API calls to GitHub fail

Configure the `not-conventional-commits-reaction` input to control how non-conventional commits are handled:

- `error`: Fail the action (recommended for strict workflows)
- `warn`: Log warnings but continue (default)
- `silent`: Ignore non-conventional commits

## Requirements

- The repository must have `fetch-depth: 0` in the checkout step to access full commit history
- Commits should follow [Conventional Commits](https://www.conventionalcommits.org/) format for automatic version detection
- GitHub token with appropriate repository permissions

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## Support

If you encounter any problems or have questions, please [open an issue](https://github.com/cdqag/action-semver/issues) on GitHub.
