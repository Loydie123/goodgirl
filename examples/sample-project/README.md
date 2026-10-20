# Sample QA Project with GoodGirl

This is a working sample QA project demonstrating GoodGirl CLI test execution against a local test fixture application.

## Structure

```
sample-project/
├── goodgirl.config.ts    # GoodGirl project configuration
├── tests/
│   ├── e2e/              # End-to-end browser tests
│   │   └── app.spec.ts
│   └── api/              # API contract tests
│       └── api.spec.ts
├── package.json
└── README.md
```

## Running Tests

From root workspace:
```bash
# Run all sample tests
pnpm qa test all --config examples/sample-project/goodgirl.config.ts

# Run E2E tests
pnpm qa test e2e --config examples/sample-project/goodgirl.config.ts

# Run API tests
pnpm qa test api --config examples/sample-project/goodgirl.config.ts
```

Or from within `examples/sample-project/`:
```bash
goodgirl test all
```
