# 5. Cache prices in memory

## Status

Accepted

## Context

The first record on caching prices was never agreed. The pricing service still answers slowly at busy hours.

## Decision

We will keep the prices in a shared cache that the pricing service clears when a price changes.

## Consequences

A changed price shows on every product page within a second, and the shared cache is one more system to run.
