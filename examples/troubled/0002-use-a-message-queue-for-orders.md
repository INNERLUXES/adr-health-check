# 2. Use a message queue for orders

## Status

Proposed

## Context

Orders from the shop reach the warehouse system through a nightly batch file, and a late order waits up to a day.

## Decision

We will send each order to the warehouse system through a message queue as soon as it is paid.

## Consequences

The warehouse sees orders within minutes, and the team has one more system to run.
