# Test Coverage Matrix

Test category coverage across diagram types. Use this to identify gaps when adding or auditing diagram support.

| Test type      | Flowchart | Sequence | Class | ER  | Timeline | Journey | XY Chart | Architecture |
|----------------|-----------|----------|-------|-----|----------|---------|----------|--------------|
| Parser         | yes       | yes      | yes   | yes | yes      | yes     | yes      | yes          |
| Layout         | yes       | yes      | -     | -   | yes      | yes     | yes      | yes          |
| Renderer       | yes       | -        | -     | -   | -        | -       | yes      | yes          |
| ASCII          | yes       | -        | -     | -   | yes      | yes     | yes      | yes          |
| Integration    | yes       | yes      | yes   | yes | yes      | yes     | yes      | yes          |
| Theme          | -         | -        | -     | -   | -        | yes     | -        | yes          |
| SVG Snapshot   | -         | -        | -     | -   | -        | yes     | -        | yes          |
| Config         | -         | -        | -     | -   | -        | -       | -        | yes          |
| Accessibility  | -         | -        | -     | -   | yes      | yes     | yes      | yes          |
| Property-based | yes       | -        | -     | -   | -        | -       | yes      | -            |
| Edge styles    | yes       | -        | -     | -   | -        | -       | -        | -            |
| Multiline      | yes       | -        | -     | -   | -        | -       | -        | -            |

## Remaining gaps

### Cross-cutting

- [ ] Add theme tests for timeline, xychart, sequence, class, and ER diagrams (journey and architecture have them)
- [ ] Add SVG snapshot tests for timeline, xychart, and older diagram types
- [ ] Add property-based tests for timeline, journey, and architecture diagrams
- [ ] Add accessibility (accTitle/accDescr) support to sequence, class, and ER parsers/renderers

### Flowchart / State

- [ ] Add dedicated ASCII test file (currently tested inline in ascii.test.ts)

### Sequence

- [ ] Add dedicated renderer unit tests
- [ ] Add ASCII test file
- [ ] Add theme tests

### Class

- [ ] Add layout tests
- [ ] Add dedicated renderer unit tests
- [ ] Add theme tests

### ER

- [ ] Add layout tests
- [ ] Add dedicated renderer unit tests
- [ ] Add theme tests

### Timeline

- [ ] Add theme tests
- [ ] Add SVG snapshot regression tests

### XY Chart

- [ ] Add theme tests
- [ ] Add SVG snapshot regression tests
