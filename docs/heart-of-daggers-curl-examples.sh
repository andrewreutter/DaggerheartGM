#!/bin/bash
# Heart of Daggers API - Working curl Examples
# These commands have been tested and verified to work

# NOTE: The nonce value (14a49b0e77) was valid at the time of testing
# but may expire. Extract a fresh nonce from the vault page HTML:
# curl -s "https://heartofdaggers.com/vault/" | grep 'data-nonce' | grep -o 'data-nonce="[^"]*"'

NONCE="14a49b0e77"
ENDPOINT="https://heartofdaggers.com/wp-admin/admin-ajax.php"

echo "=== Example 1: Get all Adversaries (page 1) ==="
curl -s "$ENDPOINT" \
  -X POST \
  -F "action=hb_hub_query" \
  -F "nonce=$NONCE" \
  -F "q=" \
  -F "cat=adversaries" \
  -F "sort=recent" \
  -F "page=1" \
  -F "per_page=20" \
  -F "author=" \
  -F "campaign_frame=" \
  -F "adv_tier=" \
  -F "adv_type=" \
  -F "adv_dmgtype=" \
  -F "adv_diff_min=" \
  -F "adv_diff_max=" \
  -F "adv_hp_min=" \
  -F "adv_hp_max=" \
  -F "adv_mt=" \
  -F "adv_feature=" | jq '.data | {found, page, max_pages, per_page}'

echo ""
echo "=== Example 2: Get Tier 3 Adversaries ==="
curl -s "$ENDPOINT" \
  -X POST \
  -F "action=hb_hub_query" \
  -F "nonce=$NONCE" \
  -F "q=" \
  -F "cat=adversaries" \
  -F "sort=recent" \
  -F "page=1" \
  -F "per_page=20" \
  -F "author=" \
  -F "campaign_frame=" \
  -F "adv_tier=3" \
  -F "adv_type=" \
  -F "adv_dmgtype=" \
  -F "adv_diff_min=" \
  -F "adv_diff_max=" \
  -F "adv_hp_min=" \
  -F "adv_hp_max=" \
  -F "adv_mt=" \
  -F "adv_feature=" | jq '.data | {found, page, max_pages, per_page}'

echo ""
echo "=== Example 3: Get Tier 2 Environments ==="
curl -s "$ENDPOINT" \
  -X POST \
  -F "action=hb_hub_query" \
  -F "nonce=$NONCE" \
  -F "q=" \
  -F "cat=environments" \
  -F "sort=recent" \
  -F "page=1" \
  -F "per_page=20" \
  -F "author=" \
  -F "campaign_frame=" \
  -F "env_tier=2" \
  -F "env_type=" \
  -F "env_diff_min=" \
  -F "env_diff_max=" \
  -F "env_impulse=" \
  -F "env_pad=" \
  -F "env_feat=" | jq '.data | {found, page, max_pages, per_page}'

echo ""
echo "=== Example 4: Get Standard Type Adversaries ==="
curl -s "$ENDPOINT" \
  -X POST \
  -F "action=hb_hub_query" \
  -F "nonce=$NONCE" \
  -F "q=" \
  -F "cat=adversaries" \
  -F "sort=recent" \
  -F "page=1" \
  -F "per_page=20" \
  -F "author=" \
  -F "campaign_frame=" \
  -F "adv_tier=" \
  -F "adv_type=Standard" \
  -F "adv_dmgtype=" \
  -F "adv_diff_min=" \
  -F "adv_diff_max=" \
  -F "adv_hp_min=" \
  -F "adv_hp_max=" \
  -F "adv_mt=" \
  -F "adv_feature=" | jq '.data | {found, page, max_pages, per_page}'

echo ""
echo "=== Example 5: Search for 'dragon' in Adversaries ==="
curl -s "$ENDPOINT" \
  -X POST \
  -F "action=hb_hub_query" \
  -F "nonce=$NONCE" \
  -F "q=dragon" \
  -F "cat=adversaries" \
  -F "sort=relevance" \
  -F "page=1" \
  -F "per_page=20" \
  -F "author=" \
  -F "campaign_frame=" \
  -F "adv_tier=" \
  -F "adv_type=" \
  -F "adv_dmgtype=" \
  -F "adv_diff_min=" \
  -F "adv_diff_max=" \
  -F "adv_hp_min=" \
  -F "adv_hp_max=" \
  -F "adv_mt=" \
  -F "adv_feature=" | jq '.data | {found, page, max_pages, per_page}'

echo ""
echo "=== Example 6: Extract data attributes from first result ==="
curl -s "$ENDPOINT" \
  -X POST \
  -F "action=hb_hub_query" \
  -F "nonce=$NONCE" \
  -F "q=" \
  -F "cat=adversaries" \
  -F "sort=recent" \
  -F "page=1" \
  -F "per_page=1" \
  -F "author=" \
  -F "campaign_frame=" \
  -F "adv_tier=3" \
  -F "adv_type=" \
  -F "adv_dmgtype=" \
  -F "adv_diff_min=" \
  -F "adv_diff_max=" \
  -F "adv_hp_min=" \
  -F "adv_hp_max=" \
  -F "adv_mt=" \
  -F "adv_feature=" | jq -r '.data.html' | grep -o 'data-[^=]*="[^"]*"'

echo ""
echo "=== Example 7: Get fresh nonce from vault page ==="
curl -s "https://heartofdaggers.com/vault/" | grep -o 'data-nonce="[^"]*"'

echo ""
echo "=== Example 8: Pagination - Get page 2 ==="
curl -s "$ENDPOINT" \
  -X POST \
  -F "action=hb_hub_query" \
  -F "nonce=$NONCE" \
  -F "q=" \
  -F "cat=adversaries" \
  -F "sort=recent" \
  -F "page=2" \
  -F "per_page=20" \
  -F "author=" \
  -F "campaign_frame=" \
  -F "adv_tier=" \
  -F "adv_type=" \
  -F "adv_dmgtype=" \
  -F "adv_diff_min=" \
  -F "adv_diff_max=" \
  -F "adv_hp_min=" \
  -F "adv_hp_max=" \
  -F "adv_mt=" \
  -F "adv_feature=" | jq '.data | {found, page, max_pages, per_page}'

echo ""
echo "=== Example 9: Combined filters - Tier 3 Standard Adversaries ==="
curl -s "$ENDPOINT" \
  -X POST \
  -F "action=hb_hub_query" \
  -F "nonce=$NONCE" \
  -F "q=" \
  -F "cat=adversaries" \
  -F "sort=recent" \
  -F "page=1" \
  -F "per_page=20" \
  -F "author=" \
  -F "campaign_frame=" \
  -F "adv_tier=3" \
  -F "adv_type=Standard" \
  -F "adv_dmgtype=" \
  -F "adv_diff_min=" \
  -F "adv_diff_max=" \
  -F "adv_hp_min=" \
  -F "adv_hp_max=" \
  -F "adv_mt=" \
  -F "adv_feature=" | jq '.data | {found, page, max_pages, per_page}'

echo ""
echo "=== Example 10: Sort by most upvoted ==="
curl -s "$ENDPOINT" \
  -X POST \
  -F "action=hb_hub_query" \
  -F "nonce=$NONCE" \
  -F "q=" \
  -F "cat=adversaries" \
  -F "sort=upvoted" \
  -F "page=1" \
  -F "per_page=20" \
  -F "author=" \
  -F "campaign_frame=" \
  -F "adv_tier=" \
  -F "adv_type=" \
  -F "adv_dmgtype=" \
  -F "adv_diff_min=" \
  -F "adv_diff_max=" \
  -F "adv_hp_min=" \
  -F "adv_hp_max=" \
  -F "adv_mt=" \
  -F "adv_feature=" | jq '.data | {found, page, max_pages, per_page}'
