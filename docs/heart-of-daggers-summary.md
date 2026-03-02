# Heart of Daggers API - Key Findings Summary

## ✅ AJAX Request Captured Successfully

### Endpoint
```
POST https://heartofdaggers.com/wp-admin/admin-ajax.php
Content-Type: multipart/form-data
```

### WordPress Action
```
action=hb_hub_query
```

### Security/Nonce
The nonce must be extracted from the page HTML:
```html
<div id="hb-hub-config"
    data-ajax="https://heartofdaggers.com/wp-admin/admin-ajax.php"
    data-nonce="14a49b0e77"
    data-per-page="20"></div>
```

**Note**: The nonce value changes per session and must be scraped fresh from the vault page.

## 📋 Request 1: Filter Adversaries (All Tiers)

**Form Data Fields:**
```
action=hb_hub_query
nonce=14a49b0e77
q=
cat=adversaries
sort=recent
page=1
per_page=20
author=
campaign_frame=
adv_tier=
adv_type=
adv_dmgtype=
adv_diff_min=
adv_diff_max=
adv_hp_min=
adv_hp_max=
adv_mt=
adv_feature=
```

**Response:**
```json
{
  "success": true,
  "data": {
    "found": 73,
    "page": 1,
    "max_pages": 4,
    "per_page": 20,
    "html": "<div>...HTML with item cards...</div>"
  }
}
```

## 📋 Request 2: Filter Adversaries with Tier 3

**Form Data Fields (only changed field shown):**
```
adv_tier=3
```

All other fields remain the same as Request 1.

**Response:**
- Same structure as Request 1
- Different `found` count and `max_pages` based on filtered results
- HTML contains only Tier 3 adversaries

## 🔍 Data Extraction from HTML Response

Each item in the HTML has rich metadata in `data-*` attributes:

```html
<a href="https://heartofdaggers.com/homebrew/adversaries/pidgeot-no-18-normal-flying/"
   data-id="36556"
   data-title="Pidgeot ((No. 18) Normal/Flying)"
   data-desc="When it comes to Pokémon..."
   data-cat="adversaries"
   data-date="Mar 2, 2026"
   data-upvotes="0"
   data-link="https://heartofdaggers.com/homebrew/adversaries/pidgeot-no-18-normal-flying/"
   data-author="Shield's Rest"
   data-adv-difficulty="15"
   data-adv-type="Standard"
   data-adv-hp="4"
   data-adv-stress="5">
```

### Quick Metadata Available (No Detail Page Needed)
- ID, title, description excerpt
- Category, author, date, upvotes
- Link to detail page
- **Adversaries**: difficulty, type, HP, stress
- **Environments**: (would have env-specific attributes)

## 📄 Full Item Data (Detail Page)

To get complete item data including features, attacks, and full descriptions, fetch the detail page URL from `data-link`.

### Example: Adversary Detail Page

**URL**: `https://heartofdaggers.com/homebrew/adversaries/pidgeot-no-18-normal-flying/`

**Structured Data Available:**
- Complete stat block (tier, type, difficulty, HP, stress, attack mod, thresholds)
- Standard attack (name, range, damage, attack mod, damage type)
- Features organized by type:
  - Passives (with fear costs)
  - Actions (with fear costs)
  - Reactions
- Motives & tactics
- Experiences

## 🎯 Integration Recommendations

### Phase 1: List View Integration
1. Extract nonce from vault page
2. Make AJAX requests with filters (tier, type, etc.)
3. Parse `data-*` attributes for quick metadata
4. Display in a searchable list (similar to FCG integration)

### Phase 2: Detail View Integration
1. Fetch detail pages for selected items
2. Scrape HTML to extract full stat blocks
3. Transform to DaggerheartGM schema
4. Store as mirrors in database with `_source: 'hod'`

### Phase 3: Caching & Optimization
1. Cache nonce per session
2. Cache search results (1 hour TTL)
3. Store popular items as mirrors
4. Track popularity (clone_count, play_count)
5. Implement rate limiting (1 req/sec)

## 🔑 Critical Fields for Integration

### All Items
- `action` (always `hb_hub_query`)
- `nonce` (extract from page)
- `cat` (category: adversaries, environments, etc.)
- `sort` (recent, upvoted, a-z, relevance)
- `page` (pagination)
- `per_page` (results per page, default 20)

### Adversaries
- `adv_tier` (1, 2, 3, 4)
- `adv_type` (Standard, Skulk, Bruiser, etc.)
- `adv_dmgtype` (Physical, Magical)
- `adv_diff_min` / `adv_diff_max` (difficulty range)
- `adv_hp_min` / `adv_hp_max` (HP range)
- `adv_feature` (feature search text)

### Environments
- `env_tier` (1, 2, 3, 4)
- `env_type` (Exploration, Social, Traversal, Event)
- `env_diff_min` / `env_diff_max` (difficulty range)
- `env_feat` (feature search text)

## ✨ Next Steps

1. Create `src/hod-search.js` (similar to `src/fcg-search.js`)
2. Add nonce extraction utility
3. Implement AJAX request function with proper form data
4. Add HTML parsing for `data-*` attributes
5. Add detail page scraper for full item data
6. Create schema transformer (HoD → DaggerheartGM)
7. Add API route `GET /api/hod-search` (similar to FCG)
8. Integrate into `LibraryView` with `includeHod=1` parameter
9. Add to Feature Library filters

## 📚 Documentation

Full API documentation available in:
`/Users/andrewreutter/Repos/DaggerheartGM/docs/heart-of-daggers-api.md`
