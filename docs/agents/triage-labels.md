# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the actual label strings used in this repo's issue tracker.

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an agent      |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation            |
| `wontfix`                  | `wontfix`            | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the agent-ready triage label"), use the corresponding label string from this table.

These five labels are created in the repo's GitHub Issues. To create a missing one:

```bash
gh label create needs-triage --description "Maintainer needs to evaluate this issue" --color "d93f0b"
```

## Note for this repo

A `ready-for-agent` issue is NOT ready to merge: in Yuddit a change reaches production
through a pull request that the owner merges explicitly. "Ready for an agent" means the
work is fully specified and can be implemented without asking the owner anything; it does
not mean it is safe to deploy on its own.
