# Heart of Daggers Vault API

## Overview

The Heart of Daggers vault (https://heartofdaggers.com/vault/) uses WordPress AJAX to filter and search homebrew content. All requests are sent as `multipart/form-data` POST requests to `/wp-admin/admin-ajax.php`.

## Configuration

From the page source:

```html
<div id="hb-hub-config"
    data-ajax="https://heartofdaggers.com/wp-admin/admin-ajax.php"
    data-nonce="14a49b0e77"
    data-per-page="20"></div>
```

- **Endpoint**: `https://heartofdaggers.com/wp-admin/admin-ajax.php`
- **Nonce**: `14a49b0e77` (changes per session/user - must be extracted from page)
- **Per Page**: 20 items

## Request Format

### Method
`POST` with `Content-Type: multipart/form-data`

### Common Fields (Always Sent)

All requests include these base fields:

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `action` | string | WordPress AJAX action name | `hb_hub_query` |
| `nonce` | string | Security token (extracted from page) | `14a49b0e77` |
| `q` | string | Search query text | `goblin` or `` (empty) |
| `cat` | string | Category filter | `adversaries`, `environments`, `all`, etc. |
| `sort` | string | Sort order | `recent`, `upvoted`, `a-z`, `relevance` |
| `page` | string | Page number (1-indexed) | `1` |
| `per_page` | string | Results per page | `20` |
| `author` | string | Filter by author username | `` (usually empty) |
| `campaign_frame` | string | Campaign frame filter | `` (usually empty) |

### Category-Specific Fields

Additional fields are appended based on the `cat` value:

#### Adversaries (`cat=adversaries`)

| Field | Type | Description | Possible Values |
|-------|------|-------------|-----------------|
| `adv_tier` | string | Tier level | ``, `1`, `2`, `3`, `4` |
| `adv_type` | string | Adversary type | ``, `Bruiser`, `Horde`, `Leader`, `Minion`, `Ranged`, `Skulk`, `Solo`, `Standard`, `Support`, `Social` |
| `adv_dmgtype` | string | Damage type | ``, `Physical`, `Magical` |
| `adv_diff_min` | string | Minimum difficulty | `` or numeric |
| `adv_diff_max` | string | Maximum difficulty | `` or numeric |
| `adv_hp_min` | string | Minimum HP | `` or numeric |
| `adv_hp_max` | string | Maximum HP | `` or numeric |
| `adv_mt` | string | Movement type | `` or specific movement |
| `adv_feature` | string | Feature search | `` or text |

#### Environments (`cat=environments`)

| Field | Type | Description | Possible Values |
|-------|------|-------------|-----------------|
| `env_tier` | string | Tier level | ``, `1`, `2`, `3`, `4` |
| `env_type` | string | Environment type | ``, `Exploration`, `Social`, `Traversal`, `Event` |
| `env_diff_min` | string | Minimum difficulty | `` or numeric |
| `env_diff_max` | string | Maximum difficulty | `` or numeric |
| `env_impulse` | string | Impulse filter | `` or text |
| `env_pad` | string | PAD filter | `` or text |
| `env_feat` | string | Feature search | `` or text |

#### Weapons (`cat=weapons`)

| Field | Type | Description |
|-------|------|-------------|
| `weapon_trait` | string | Trait filter |
| `weapon_range` | string | Range filter |
| `weapon_burden` | string | Burden filter |
| `weapon_damage_type` | string | Damage type |
| `weapon_feature` | string | Feature search |

#### Armor (`cat=armor`)

| Field | Type | Description |
|-------|------|-------------|
| `armor_tier` | string | Tier level |
| `armor_feature` | string | Feature search |
| `armor_mod` | string | Modifier filter |

#### Consumables (`cat=consumables`)

| Field | Type | Description |
|-------|------|-------------|
| `consumable_rarity` | string | Rarity level |
| `consumable_usage` | string | Usage type |

#### Items (`cat=items`)

| Field | Type | Description |
|-------|------|-------------|
| `item_type` | string | Item type |
| `item_restrict` | string | Restriction filter |

#### Classes (`cat=classes`)

| Field | Type | Description |
|-------|------|-------------|
| `class_source` | string | Source filter |
| `class_domain` | string | Domain filter |
| `class_hpmin` | string | Minimum HP |
| `class_evasionmin` | string | Minimum evasion |
| `class_feature` | string | Feature search |

#### Subclasses (`cat=subclasses`)

| Field | Type | Description |
|-------|------|-------------|
| `sub_parent` | string | Parent class |
| `sub_parent_core` | string | Core parent class |
| `sub_trait` | string | Trait filter |
| `sub_name` | string | Name search |

#### Ancestries (`cat=ancestries`)

| Field | Type | Description |
|-------|------|-------------|
| `anc_size` | string | Size filter |
| `anc_trait` | string | Trait filter |
| `anc_example` | string | Example filter |

#### Communities (`cat=communities`)

| Field | Type | Description |
|-------|------|-------------|
| `comm_feature` | string | Feature search |

## Example Request 1: Filter Adversaries

**Request Body (FormData):**
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

## Example Request 2: Filter Adversaries with Tier 3

**Request Body (FormData):**
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
adv_tier=3
adv_type=
adv_dmgtype=
adv_diff_min=
adv_diff_max=
adv_hp_min=
adv_hp_max=
adv_mt=
adv_feature=
```

## Example Request 3: Filter Environments with Tier 2

**Request Body (FormData):**
```
action=hb_hub_query
nonce=14a49b0e77
q=
cat=environments
sort=recent
page=1
per_page=20
author=
campaign_frame=
env_tier=2
env_type=
env_diff_min=
env_diff_max=
env_impulse=
env_pad=
env_feat=
```

## Response Format

The response is JSON with this structure:

```json
{
  "success": true,
  "data": {
    "html": "<div>...rendered HTML for results...</div>",
    "found": 73,
    "page": 1,
    "max_pages": 4,
    "per_page": 20
  }
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Whether the request succeeded |
| `data.html` | string | Rendered HTML for the results list |
| `data.found` | number | Total number of results found |
| `data.page` | number | Current page number |
| `data.max_pages` | number | Total number of pages |
| `data.per_page` | number | Results per page |

### HTML Structure & Data Attributes

The `data.html` field contains a series of `<a>` elements with the class `hb-row`. Each element has extensive `data-*` attributes that contain metadata about the item:

**Common Attributes (all items):**
- `data-id` - Unique item ID (e.g., `"36556"`)
- `data-title` - Item title (e.g., `"Pidgeot ((No. 18) Normal/Flying)"`)
- `data-desc` - Short description/excerpt
- `data-cat` - Category (e.g., `"adversaries"`, `"environments"`)
- `data-date` - Publication date (e.g., `"Mar 2, 2026"`)
- `data-upvotes` - Number of upvotes (e.g., `"0"`)
- `data-link` - Full URL to item detail page
- `data-tags` - Tags (often empty)
- `data-author` - Author name

**Adversary-Specific Attributes:**
- `data-adv-difficulty` - Difficulty rating (e.g., `"15"`)
- `data-adv-type` - Adversary type (e.g., `"Standard"`, `"Skulk"`)
- `data-adv-hp` - Hit points (e.g., `"4"`)
- `data-adv-stress` - Stress value (e.g., `"5"`)

**Environment-Specific Attributes:**
- `data-env-tier` - Tier level (e.g., `"2"`)
- `data-env-type` - Environment type (e.g., `"Event"`, `"Exploration"`)
- `data-env-difficulty` - Difficulty rating (e.g., `"14"`)

**Example HTML structure:**
```html
<a href="https://heartofdaggers.com/homebrew/adversaries/pidgeot-no-18-normal-flying/"
   class="hb-row group block rounded-none bg-white/80..."
   data-id="36556"
   data-title="Pidgeot ((No. 18) Normal/Flying)"
   data-desc="When it comes to Pokémon..."
   data-cat="adversaries"
   data-date="Mar 2, 2026"
   data-upvotes="0"
   data-link="https://heartofdaggers.com/homebrew/adversaries/pidgeot-no-18-normal-flying/"
   data-tags=""
   data-author="Shield's Rest"
   data-adv-difficulty="15"
   data-adv-type="Standard"
   data-adv-hp="4"
   data-adv-stress="5">
  <!-- Card content with image, title, description, badges -->
</a>
```

## Implementation Notes

1. **Nonce Extraction**: The nonce must be extracted from the page HTML on each session. It's found in the `data-nonce` attribute of the `#hb-hub-config` element.

2. **Empty Values**: All filter fields are sent even when empty (as empty strings).

3. **Category Switching**: When changing categories, only the fields relevant to that category are sent (but all common fields are always included).

4. **Pagination**: To fetch additional pages, increment the `page` field while keeping all other filters the same.

5. **Search**: The `q` field accepts free-text search queries that are matched against item names and descriptions.

6. **Sort Options**:
   - `recent` - Most recently added
   - `upvoted` - Most upvoted
   - `a-z` - Alphabetical
   - `relevance` - Search relevance (when `q` is not empty)

## Item Detail Pages

To get full item data, you need to fetch the detail page URL (from `data-link` attribute).

### Adversary Detail Page Structure

The detail page contains structured data in HTML format:

**Stat Block Section:**
- Tier (1-4)
- Type (Standard, Skulk, etc.)
- Difficulty (numeric)
- HP (numeric)
- Stress (numeric)
- Attack mod (e.g., "+2")
- Damage thresholds (Minor, Major, Severe with HP marks)

**Standard Attack:**
- Name (e.g., "Wing Attack")
- Range (e.g., "Melee", "Close", "Far")
- Damage (e.g., "3d6+6 Flying Type Damage")
- Attack Mod (e.g., "+2")
- Damage Type (e.g., "Physical", "Magical")

**Features:**
- **Passives** - Passive abilities with fear costs and descriptions
- **Actions** - Action abilities with fear costs and descriptions
- **Reactions** - Reaction abilities

**Additional Info:**
- Motives & tactics (text description)
- Experiences (text or "—")

### Example Adversary Data

From the Pidgeot example:
- **Tier**: 3
- **Type**: Standard
- **Difficulty**: 15
- **HP**: 4
- **Stress**: 5
- **Attack Mod**: +2
- **Standard Attack**: Wing Attack (Melee, 3d6+6 Flying Type Damage, Physical)
- **Features**:
  - Hurricane (Passive, fear 2): AoE attack with confusion
  - Tailwind (Action, fear 1): Evasion buff for allies
  - Agility (Action, fear 1): Self evasion buff
- **Motives & Tactics**: Territorial Hunter Fast

## Integration Strategy

To integrate Heart of Daggers content into DaggerheartGM:

1. **Scraping Approach**:
   - Fetch the vault page to extract the current nonce
   - Make POST requests to `admin-ajax.php` with appropriate filters
   - Parse the returned HTML to extract item metadata from `data-*` attributes
   - Follow `data-link` URLs to fetch full item details
   - Cache results to minimize requests

2. **Data Extraction**:
   - **List View**: Parse `data-*` attributes from the HTML response for quick metadata
   - **Detail View**: Scrape the detail page HTML to extract full stat blocks and features
   - Transform to DaggerheartGM schema (similar to FCG integration)
   - Handle missing/optional fields gracefully

3. **Caching**:
   - Cache the nonce for the session (it may expire - extract fresh on each session)
   - Cache search results with a TTL (e.g., 1 hour)
   - Store popular items in the database as mirrors with `user_id='__MIRROR__'` (similar to FCG integration)
   - Track popularity via `clone_count` and `play_count`

4. **Rate Limiting**:
   - Implement respectful rate limiting (e.g., 1 request per second)
   - Consider bulk fetching during off-peak hours
   - Use pagination to fetch all results for a category
   - Cache aggressively to avoid repeated requests

5. **Schema Mapping**:
   - Map Heart of Daggers fields to DaggerheartGM schema
   - Tag items with `_source: 'hod'` and prefix IDs with `hod-`
   - Store original URL in item metadata for attribution
   - Handle custom fields (like Pokémon-specific mechanics) appropriately
