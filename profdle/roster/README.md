# Roster spreadsheet (in-house)

Regenerate from `src/data/professors.json`:

```bash
npm run roster:spreadsheet
```

Output: **`professors-roster.csv`** (open in Excel or Google Sheets).  
The JSON file is still the canonical game data; this CSV is for review and planning only.

UCSD-years semantics (`ucsdStartYear`) and how to refresh data: **[`docs/ucsd-years-data.md`](../docs/ucsd-years-data.md)**.
