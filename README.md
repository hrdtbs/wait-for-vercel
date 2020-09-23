# Wait for Vercel

```yml
name: E2E tests
on:
  pull_request:
    branches:
     - master
jobs:
  run_tests:
    name: Run E2E tests on deployment success
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [12.x]

    steps:
      - name: Waiting for Vercel
        uses: hrdtbs/wait-for-vercel@master
        id: vercel
        with:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      - uses: actions/checkout@v2
      - name: Use Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v1
        with:
          node-version: ${{ matrix.node-version }}

      - name: Install dependencies
        run: yarn --frozen-lockfile

      - uses: microsoft/playwright-github-action@v1
      - run: yarn e2e
        env:
          BASE_URL: ${{ steps.vercel.outputs.target_url }}
      - uses: actions/upload-artifact@v1
        with:
          name: download-screenshots
          path: screenshots

```
