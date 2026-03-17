/**
 * Generate mock SVG images demonstrating the Tufte theme.
 * Run: bun tufte-mocks.ts
 */
import { renderMermaidSVG } from './src/index.ts'
import { THEMES } from './src/theme.ts'
import { writeFileSync, mkdirSync } from 'fs'

mkdirSync('tufte-mocks', { recursive: true })

const tufte = THEMES['tufte']!
const tufteOpts = { ...tufte, font: 'Palatino' }

const tufteD = THEMES['tufte-dark']!
const tufteDarkOpts = { ...tufteD, font: 'Palatino' }

// 1. Flowchart
const flowchart = `graph TD
  A[Research Question] --> B{Literature Review}
  B --> C[Hypothesis]
  B --> D[Data Collection]
  C --> E[Experimental Design]
  D --> E
  E --> F{Statistical Analysis}
  F -->|Significant| G[Publication]
  F -->|Not Significant| H[Revise Hypothesis]
  H --> C`

// 2. Sequence diagram
const sequence = `sequenceDiagram
  participant R as Researcher
  participant L as Lab
  participant P as Peer Review
  R->>L: Submit experiment
  L->>L: Run trials
  L-->>R: Results
  R->>P: Submit manuscript
  P-->>R: Revisions requested
  R->>P: Revised manuscript
  P-->>R: Accepted`

// 3. Class diagram
const classDiagram = `classDiagram
  class DataSet {
    +String name
    +Int observations
    +collect()
    +clean()
    +analyze()
  }
  class Visualization {
    +String type
    +render()
    +annotate()
  }
  class StatModel {
    +String method
    +Float confidence
    +fit()
    +predict()
  }
  DataSet --> Visualization : informs
  DataSet --> StatModel : feeds
  StatModel --> Visualization : produces`

// 4. ER diagram
const erDiagram = `erDiagram
  AUTHOR ||--o{ PUBLICATION : writes
  PUBLICATION ||--|{ CITATION : receives
  PUBLICATION }o--|| JOURNAL : "published in"
  AUTHOR }o--o{ INSTITUTION : "affiliated with"`

// 5. Journey
const journey = `journey
  title Research Publication Journey
  section Discovery
    Read literature: 5: Researcher
    Identify gap: 3: Researcher
  section Experiment
    Design study: 4: Researcher, Lab
    Collect data: 3: Lab
    Analyze results: 4: Researcher
  section Publication
    Write manuscript: 2: Researcher
    Peer review: 3: Reviewer
    Revise and publish: 5: Researcher`

const diagrams = [
  { name: 'flowchart', source: flowchart },
  { name: 'sequence', source: sequence },
  { name: 'class', source: classDiagram },
  { name: 'er', source: erDiagram },
  { name: 'journey', source: journey },
]

for (const { name, source } of diagrams) {
  // Light Tufte
  const svgLight = renderMermaidSVG(source, tufteOpts)
  writeFileSync(`tufte-mocks/${name}-tufte-light.svg`, svgLight)

  // Dark Tufte
  const svgDark = renderMermaidSVG(source, tufteDarkOpts)
  writeFileSync(`tufte-mocks/${name}-tufte-dark.svg`, svgDark)

  // Zinc light (for comparison)
  const svgZinc = renderMermaidSVG(source)
  writeFileSync(`tufte-mocks/${name}-zinc-light.svg`, svgZinc)
}

console.log('Generated mock SVGs in tufte-mocks/')
console.log('Files:')
for (const { name } of diagrams) {
  console.log(`  ${name}-tufte-light.svg`)
  console.log(`  ${name}-tufte-dark.svg`)
  console.log(`  ${name}-zinc-light.svg`)
}
