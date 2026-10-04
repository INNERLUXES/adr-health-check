# 7. Move search to a separate service

## Status

Accepted

## Context

Search runs inside the shop and slows it down while the index is rebuilt. The machines of
[ADR 3](0003-deploy-on-virtual-machines.md) have no room for a larger index.

## Decision

We will run search as a service of its own with its own index, described in [the index record](0010-search-index.md).
The rollout plan is TODO. The operations handbook of the company is in [the handbook](../../handbook/README.md).
