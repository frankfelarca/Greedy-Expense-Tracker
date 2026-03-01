Analyze the file or component specified: $ARGUMENTS

Read the file and check for:

1. **Unnecessary re-renders** — missing React.memo, useMemo, or useCallback where props/values are recreated each render
2. **Heavy imports** — large libraries imported but only partially used; candidates for lazy loading or tree shaking
3. **Inline allocations** — objects, arrays, or functions created inside render that could be hoisted or memoized
4. **Framer Motion** — animations that trigger on every render instead of being conditional
5. **Redux selectors** — selecting too much state causing unnecessary component updates
6. **Bundle impact** — large dependencies that could be code-split

For each finding, provide the specific line(s) and a concrete code fix.
