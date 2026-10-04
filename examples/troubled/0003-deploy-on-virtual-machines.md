# 3. Deploy on virtual machines

## Status

Superseded

## Context

The platform runs on two servers in a rented rack, and a failed disk stops the shop for hours.

## Decision

We will deploy the platform on virtual machines of a hosting provider, two per service.

## Consequences

A failed machine is replaced in minutes. The machines are patched by the team.
