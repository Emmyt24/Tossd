# RBAC — Role-Based Access Control

Granular permission system with hierarchical role inheritance for all admin operations.

## Role Hierarchy

```
PauseAdmin (10) → ConfigAdmin (20) → SuperAdmin (30)
```

Each role inherits all permissions of every role below it in the chain.

## Roles

| Role          | Level | Description                                                |
| ------------- | ----- | ---------------------------------------------------------- |
| `PauseAdmin`  | 10    | Can pause and unpause the contract                         |
| `ConfigAdmin` | 20    | Can update fees, wager limits, and multipliers             |
| `SuperAdmin`  | 30    | Full access — treasury, role management, HSM, audit export |

## Permissions

| Permission          | PauseAdmin | ConfigAdmin | SuperAdmin |
| ------------------- | ---------- | ----------- | ---------- |
| `contract:pause`    | ✅         | ✅          | ✅         |
| `contract:read`     | ✅         | ✅          | ✅         |
| `fee:update`        |            | ✅          | ✅         |
| `wager:update`      |            | ✅          | ✅         |
| `multiplier:update` |            | ✅          | ✅         |
| `role:read`         |            | ✅          | ✅         |
| `audit:read`        |            | ✅          | ✅         |
| `treasury:update`   |            |             | ✅         |
| `role:grant`        |            |             | ✅         |
| `role:revoke`       |            |             | ✅         |
| `hsm:manage`        |            |             | ✅         |
| `audit:export`      |            |             | ✅         |

## Usage

```ts
import { createRbac } from "./rbac";

const { registry, guard } = createRbac(walletAddress, emitter);

// Check a permission
if (registry.hasPermission(walletAddress, "fee:update")) {
  // allowed
}

// Protect an async operation
await guard.protect("fee:update", walletAddress, () => contract.setFee(400));

// Grant a role (caller must be SuperAdmin)
registry.grantRole(superAdminAddress, targetAddress, "ConfigAdmin");

// Revoke a role
registry.revokeRole(superAdminAddress, targetAddress);
```

## React Hook

```tsx
import { useRbac } from "../hooks/useRbac";

const { can, grantRole, revokeRole, currentRole, assignments } = useRbac({
  superAdminAddress: walletAddress,
  emitter,
});

// Conditional rendering
{
  can("fee:update") && <FeeForm />;
}
```

## Module Structure

```
rbac/
├── types.ts          — Role & Permission types, RoleLevel constants
├── RoleHierarchy.ts  — Inheritance chain, permission resolution
├── RoleRegistry.ts   — In-memory store, CRUD, permission checks
├── PermissionGuard.ts — Middleware wrappers for protecting operations
└── index.ts          — Public API + createRbac factory
```
