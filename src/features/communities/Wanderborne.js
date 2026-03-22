/**
 * Wanderborne community — feature hooks keyed by feature name.
 *
 * SRD (community): Being part of a wanderborne community means you've lived as a nomad, forgoing a permanent home and
 * experiencing a wide variety of cultures. Wanderborne put less value on the accumulation of material possessions in
 * favor of acquiring information, skills, and connections. Wanderborne are known for their unwavering loyalty.
 *
 * SRD (Nomadic Pack): Add a Nomadic Pack to your inventory. Once per session, you can **spend a Hope** to reach into
 * this pack and pull out a mundane item that's useful to your situation. Work with the GM to figure out what item you
 * take out.
 */
export default {
  'Nomadic Pack': {
    chips: [
      {
        placement: 'card',
        label: 'Spend 1 Hope to pull a mundane item from your pack',
        hopeCost: 1,
        resetsOn: 'session',
        bannerOnUse: true,
      },
    ],
  },
};
