# 4. Cache prices in memory

## Status

Approved

## Context

Every product page asks the pricing service for its price, and the pricing service answers in 400 ms at busy hours.

## Decision

We will keep the prices of the shop in the memory of each web server for 60 seconds.

## Consequences

TBD
