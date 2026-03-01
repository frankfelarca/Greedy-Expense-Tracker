Run the following steps in sequence. Stop immediately if any step fails.

1. `npm run lint` — all lint checks must pass. If there are fixable errors, run `npm run lint -- --fix` and retry.
2. `npm run test` — all tests must pass.
3. `npm run build` — confirm `dist/` is produced without errors.
4. `./deploy.sh` — deploy to production.

Report each step's outcome (pass/fail) and the final deploy result.
