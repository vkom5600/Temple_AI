# Temple AI – frontend

React 19 + TypeScript + Vite. Setup and demo accounts are in the [root README](../README.md); code conventions are in [docs/STANDARDS.md](../docs/STANDARDS.md).

```bash
npm install
npm run dev         # http://localhost:5173, forwards /api to the backend
npm run typecheck   # must pass before pushing
npm run build       # production build -> dist/
```

`src/prototype/` holds the original mock-data prototype for reference. It isn't compiled; each phase ports its pages into `src/pages/`.
