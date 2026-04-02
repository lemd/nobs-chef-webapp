# Redipe

Recipe scraper and parser using OpenRouter + Claude.

## Setup

```bash
npm install
cp .env.example .env  # add your OPENROUTER_API_KEY
```

## Commands

### Scraper

```bash
npm start <url>        # scrape and parse a recipe URL
npm run dev <url>      # same, with file watching
npm run build          # compile TypeScript
```

### Web viewer

```bash
cd web
npm install
npm start              # start the web server
npm run dev            # start with file watching
```

## Output

Parsed recipes are saved as JSON in the `output/` directory and cached for subsequent runs.
