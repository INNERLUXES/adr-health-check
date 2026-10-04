# 5. Use feature flags

## Status

Accepted

## Context

New features of the shop are released with the code, so a feature that goes wrong needs a new release to turn off.

## Decision

We will put every new feature of the shop behind a feature flag that can be turned off without a release.

## Consequences

A feature is turned off in seconds. Old flags are removed in the release after the feature is turned on for everyone.
