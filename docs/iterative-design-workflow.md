# Iterative Design Workflow

## Workflow
1. Capture requirement and use-case scope.
2. Draft concise design note with boundaries and tradeoffs.
3. Define contracts and schemas before implementation.
4. Implement in small increments.
5. Update design docs when implementation changes original design.
6. Verify with tests and CI checks before merge.

## Increment Rules
- Each increment must be independently testable.
- Each increment should reduce risk or deliver visible value.
- Avoid bundling unrelated changes in a single pull request.

## Pull Request Checklist
- Requirement or use-case ID linked.
- Design changes documented.
- Tests added or updated.
- Risk and rollback notes included.
- Observability impact noted if applicable.
