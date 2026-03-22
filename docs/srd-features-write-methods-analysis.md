# SRD Features Write Method Analysis

This report analyzes 218 items from the Daggerheart SRD to determine if the **Write Methods** defined in the `feature-authoring-guide.md` are sufficient to implement their effects, without hallucinating new methods.

## Summary of Supported Effects

- **Resource Mutation (78)**: Handled by `markStress`, `clearHP`, `gainHope`, etc.
- **Roll Modification (12)**: Handled by `addStatic`, `addDie`, `addAdvantageDie`, `reroll`.
- **Condition Mutation (2)**: Handled by `addCondition`, `removeCondition`.
- **Narrative / Action (6)**: Handled by `actionLoop`, `broadcast`, `addNarration`.
- **Declarative (3)**: Handled by `passiveStatMods`, `virtualWeapons`.

## Summary of Missing / Unsupported Effects

These effects require write methods that are **not currently defined** in the guide.

- **Movement / Positioning (47)**: E.g., "push the target", "move to close range". (No `setRange` or `move` method defined in the guide).
- **Inventory / Loadout (6)**: E.g., "swap a domain card", "equip a weapon". (No inventory mutation methods defined).
- **GM Fear Mutation (0)**: E.g., "the GM gains a Fear". (No `gainFear` or `spendFear` method defined).
- **Other Uncategorized (64)**: Mechanics that don't neatly fit the existing write methods (e.g., "create an object", "change the environment", "summon a creature").

**Conclusion**: While the core Action Loop and state reading is robust, the **Write Methods** API needs expansion to fully support the SRD. Specifically, methods for manipulating range/positioning on the battle map, modifying the GM's Fear pool, and interacting with the character's inventory/loadout are currently missing from the guide.

## Detailed Data

### Supported: Resource Mutation (78)
Uses mark/clear methods for HP, Stress, Hope, Armor.

- **Scales** (ancestries - Drakona): Your scales act as natural protection. When you would take Severe damage, you can **mark a Stress** to mark 1 fewer Hit Points.
- **Thick Skin** (ancestries - Dwarf): When you take Minor damage, you can **mark 2 Stress** instead of marking a Hit Point.
- **Increased Fortitude** (ancestries - Dwarf): **Spend 3 Hope** to halve incoming physical damage.
- **Quick Reactions** (ancestries - Elf): **Mark a Stress** to gain advantage on a reaction roll.
- **Luckbender** (ancestries - Faerie): Once per session, after you or a willing ally within Close range makes an action roll, you can **spend 3 Hope** to reroll the Duality Dice.
- **Kick** (ancestries - Faun): When you succeed on an attack against a target within Melee range, you can **mark a Stress** to kick yourself off them, dealing an extra **2d6** damage and knocking back either yourself or the target to Very Close range.
- **Unshakable** (ancestries - Firbolg): When you would mark a Stress, roll a **d6.** On a result of 6, don't mark it.
- **Death Connection** (ancestries - Fungril): While touching a corpse that died recently, you can **mark a Stress** to extract one memory from the corpse related to a specific emotion or sensation of your choice.
- **Danger Sense** (ancestries - Goblin): Once per rest, **mark a Stress** to force an adversary to reroll an attack against you or an ally within Very Close range.
- **Luckbringer** (ancestries - Halfling): At the start of each session, everyone in your party gains a Hope.
- **Adaptability** (ancestries - Human): When you fail a roll that utilized one of your Experiences, you can **mark a Stress** to reroll.
- **Fearless** (ancestries - Infernis): When you roll with Fear, you can **mark 2 Stress** to change it into a roll with Hope instead.
- **Feline Instincts** (ancestries - Katari): When you make an Agility Roll, you can **spend 2 Hope** to reroll your Hope Die.
- **Tusks** (ancestries - Orc): When you succeed on an attack against a target within Melee range, you can **spend a Hope** to gore the target with your tusks, dealing an extra **1d6** damage.
- **Long Tongue** (ancestries - Ribbet): You can use your long tongue to grab onto things within Close range. **Mark a Stress** to use your tongue as a Finesse Close weapon that deals **d12** physical damage using your Proficiency.
- **Rally** (classes - Bard): Once per session, describe how you rally the party and give yourself and each of your allies a Rally Die. At level 1, your Rally Die is a **d6**. A PC can spend their Rally Die to roll it, adding the result to their action roll, reaction roll, damage roll, or to clear a number of Stress equal to the result. At the end of each session, clear all unspent Rally Dice. At level 5, your Rally Die increases to a **d8**.
- **Make a Scene** (classes - Bard): **Spend 3 Hope** to temporarily _Distract_ a target within Close range, giving them a -2 penalty to their Difficulty.
- **Frontline Tank** (classes - Guardian): **Spend 3 Hope** to clear 2 Armor Slots.
- **Ranger's Focus** (classes - Ranger): **Spend a Hope** and make an attack against a target. On a success, deal your attack's normal damage and temporarily make the attack's target your _Focus_. Until this feature ends or you make a different creature your _Focus_, you gain the following benefits against your _Focus:_  - You know precisely what direction they are in. - When you deal damage to them, they must mark a Stress. - When you fail an attack against them, you can end your Ranger's Focus feature to reroll your Duality Dice.
- **Hold Them Off** (classes - Ranger): **Spend 3 Hope** when you succeed on an attack with a weapon to use that same roll against two additional adversaries within range of the attack.
- **Rogue's Dodge** (classes - Rogue): **Spend 3 Hope** to gain a +2 bonus to your Evasion until the next time an attack succeeds against you. Otherwise, this bonus lasts until your next rest.
- **Life Support** (classes - Seraph): **Spend 3 Hope** to clear a Hit Point on an ally within Close range.
- **Volatile Magic** (classes - Sorcerer): **Spend 3 Hope** to reroll any number of your damage dice on an attack that deals magic damage.
- **No Mercy** (classes - Warrior): **Spend 3 Hope** to gain a +1 bonus to your attack rolls until your next rest.
- **Strange Patterns** (classes - Wizard): Choose a number between 1 and 12. When you roll that number on a Duality Die, gain a Hope or clear a Stress.  You can change this number when you take a long rest.
- **Not This Time** (classes - Wizard): **Spend 3 Hope** to force an adversary within Far range to reroll an attack or damage roll.
- **Quick** (weapons - Rapier, weapons - Improved Rapier, weapons - Bladed Whip, weapons - Advanced Rapier, weapons - Legendary Rapier, weapons - Dual-Ended Sword): When you make an attack, you can mark a Stress to target another creature within range.
- **Deadly** (weapons - Urok Broadsword): When you deal Severe damage, the target must mark an additional HP.
- **Scary** (weapons - Steelforged Halberd, weapons - Devouring Dagger): On a successful attack, the target must mark a Stress.
- **Reloading** (weapons - Blunderbuss, weapons - Black Powder Revolver, weapons - Ilmari's Rifle, weapons - Magus Revolver): After you make an attack, roll a d6. On a result of 1, you must mark a Stress to reload this weapon before you can fire it again.
- **Eruptive** (weapons - Hammer of Exota): On a successful attack against a target within Melee range, all other adversaries within Very Close range must succeed on a reaction roll (14) or take half damage.
- **Invigorating** (weapons - Scepter of Elias): On a successful attack, roll a d4. On a result of 4, clear a Stress.
- **Persuasive** (weapons - Wand of Enthrallment): Before you make a Presence Roll, you can mark a Stress to gain a +2 bonus to the result.
- **Devastating** (weapons - Hammer of Wrath): Before you make an attack roll, you can mark a Stress to use a d20 as your damage die.
- **Lucky** (weapons - Axe of Fortunis): On a failed attack, you can mark a Stress to reroll your attack.
- **Painful** (weapons - Runes of Ruination, weapons - Bloodstaff): Each time you make a successful attack, you must mark a Stress.
- **Burning** (weapons - Firestaff): When you roll a 6 on a damage die, the target must mark a Stress.
- **Concussive** (weapons - Impact Gauntlet): On a successful attack, you can spend a Hope to knock the target back to Far range.
- **Destructive** (weapons - Sledge Axe): -1 to Agility; on a successful attack, all adversaries within Very Close range must mark a Stress.
- **Bouncing** (weapons - Ricochet Axes): Mark 1 or more Stress to hit that many targets in range of the attack.
- **Reloading** (weapons - Hand Cannon): After you make an attack, roll a d6. On a 1, you must mark a Stress to reload this weapon before you can fire it again.
- **Lifestealing** (weapons - Siphoning Gauntlets): On a successful attack, roll a d6. On a result of 6, clear a Hit Point or clear a Stress.
- **Startling** (weapons - Whip, weapons - Improved Whip, weapons - Advanced Whip, weapons - Legendary Whip): Mark a Stress to crack the whip and force all adversaries within Melee range back to Close range.
- **Deflecting** (weapons - Buckler): When you are attacked, you can mark an Armor Slot to gain a bonus to your Evasion equal to your available Armor Score against the attack.
- **Charged** (weapons - Powered Gauntlet): Mark a Stress to gain a +1 bonus to your Proficiency on a primary weapon attack.
- **Sheltering** (weapons - Braveshield): When you mark an Armor Slot, it reduces damage for you and all allies within Melee range of you who took the same damage.
- **Resilient** (armor - Harrowbone Armor): Before you mark your last Armor Slot, roll a d6. On a result of 6, reduce the severity by one threshold without marking an Armor Slot.
- **Reinforced** (armor - IronTree Breastplate Armor): When you mark your last Armor Slot, increase your damage thresholds by +2 until you clear at least 1 Armor Slot.
- **Shifting** (armor - Runetan Floating Armor): When you are targeted for an attack, you can mark an Armor Slot to give the attack roll against you disadvantage.
- **Hopeful** (armor - Rosewild Armor): When you would spend a Hope, you can mark an Armor Slot instead.
- **Impenetrable** (armor - Dragonscale Armor): Once per short rest, when you would mark your last Hit Point, you can instead mark a Stress.
- **Physical** (armor - Bladefare Armor): You can't mark an Armor Slot to reduce magic damage.
- **Magic** (armor - Monett's Cloak): You can't mark an Armor Slot to reduce physical damage.
- **Painful** (armor - Runes of Fortification): Each time you mark an Armor Slot, you must mark a Stress.
- **Timeslowing** (armor - Dunamis Silkchain): Mark an Armor Slot to roll a d4 and add its result as a bonus to your Evasion against an incoming attack.
- **Burning** (armor - Emberwoven Armor): When an adversary attacks you within Melee range, they mark a Stress.
- **Fortified** (armor - Full Fortified Armor): When you mark an Armor Slot, you reduce the severity of an attack by two thresholds instead of one.
- **Elusive Prey** (beastforms - Nimble Grazer): When an attack roll against you would succeed, you can **mark a Stress** and roll a **d4.** Add the result to your Evasion against this attack.
- **Hobbling Strike** (beastforms - Pack Predator): When you succeed on an attack against a target within Melee range, you can **mark a Stress** to make the target temporarily _Vulnerable_.
- **Pack Predator** (beastforms - Pack Predator): [{"name":"Hobbling Strike","text":"When you succeed on an attack against a target within Melee range, you can **mark a Stress** to make the target temporarily _Vulnerable_."},{"name":"Pack Hunting","text":"When you succeed on an attack against the same target as an ally who acts immediately before you, add a **d8** to your damage roll."}]
- **Venomous Bite** (beastforms - Stalking Arachnid): When you succeed on an attack against a target within Melee range, the target becomes temporarily _Poisoned_. A _Poisoned_ creature takes **1d10** direct physical damage each time they act.
- **Stalking Arachnid** (beastforms - Stalking Arachnid): [{"name":"Venomous Bite","text":"When you succeed on an attack against a target within Melee range, the target becomes temporarily _Poisoned_. A _Poisoned_ creature takes **1d10** direct physical damage each time they act."},{"name":"Webslinger","text":"You can create a strong web material useful for both adventuring and battle. The web is resilient enough to support one creature. You can temporarily _Restrain_ a target within Close range by succeeding on a Finesse Roll against them."}]
- **Armored Shell** (beastforms - Armored Sentry): Your hardened exterior gives you resistance to physical damage. Additionally, **mark an Armor Slot** to retract into your shell. While in your shell, physical damage is reduced by a number equal to your Armor Score (after applying resistance), but you can't perform other actions without leaving this form.
- **Cannonball** (beastforms - Armored Sentry): **Mark a Stress** to allow an ally to throw or launch you at an adversary. To do so, the ally makes an attack roll using Agility or Strength (their choice) against a target within Close range. On a success, the adversary takes **d12+2** physical damage using the thrower's Proficiency. You can **spend a Hope** to target an additional adversary within Very Close range of the first. The second target takes half the damage dealt to the first target.
- **Armored Sentry** (beastforms - Armored Sentry): [{"name":"Armored Shell","text":"Your hardened exterior gives you resistance to physical damage. Additionally, **mark an Armor Slot** to retract into your shell. While in your shell, physical damage is reduced by a number equal to your Armor Score (after applying resistance), but you can't perform other actions without leaving this form."},{"name":"Cannonball","text":"**Mark a Stress** to allow an ally to throw or launch you at an adversary. To do so, the ally makes an attack roll using Agility or Strength (their choice) against a target within Close range. On a success, the adversary takes **d12+2** physical damage using the thrower's Proficiency. You can **spend a Hope** to target an additional adversary within Very Close range of the first. The second target takes half the damage dealt to the first target."}]
- **Rampage** (beastforms - Powerful Beast): When you roll a 1 on a damage die, you can roll a **d10** and add the result to the damage roll. Additionally, before you make an attack roll, you can **mark a Stress** to gain a +1 bonus to your Proficiency for that attack.
- **Powerful Beast** (beastforms - Powerful Beast): [{"name":"Rampage","text":"When you roll a 1 on a damage die, you can roll a **d10** and add the result to the damage roll. Additionally, before you make an attack roll, you can **mark a Stress** to gain a +1 bonus to your Proficiency for that attack."},{"name":"Thick Hide","text":"You gain a +2 bonus to your damage thresholds."}]
- **Venomous Strike** (beastforms - Striking Serpent): Make an attack against any number of targets within Very Close range. On a success, a target is temporarily _Poisoned_. A _Poisoned_ creature takes **1d10** direct physical damage each time they act.
- **Vicious Maul** (beastforms - Great Predator): When you succeed on an attack against a target, you can **spend a Hope** to make them temporarily _Vulnerable_ and gain a +1 bonus to your Proficiency for this attack.
- **Snapping Strike** (beastforms - Mighty Lizard): When you succeed on an attack against a target within Melee range, you can **spend a Hope** to clamp that opponent in your jaws, making them temporarily _Restrained_ and _Vulnerable._
- **Mighty Lizard** (beastforms - Mighty Lizard): [{"name":"Physical Defense","text":"You gain a +3 bonus to your damage thresholds."},{"name":"Snapping Strike","text":"When you succeed on an attack against a target within Melee range, you can **spend a Hope** to clamp that opponent in your jaws, making them temporarily _Restrained_ and _Vulnerable._"}]
- **Vicious Maul** (beastforms - Aquatic Predator): When you succeed on an attack against a target, you can **spend a Hope** to make them _Vulnerable_ and gain a +1 bonus to your Proficiency for this attack.
- **Hybrid Features** (beastforms - Legendary Hybrid): To transform into this creature, **mark an additional Stress.** Choose any two Beastform options from Tiers 1-2. Choose a total of four advantages and two features from those options.
- **Legendary Hybrid** (beastforms - Legendary Hybrid): [{"name":"Hybrid Features","text":"To transform into this creature, **mark an additional Stress.** Choose any two Beastform options from Tiers 1-2. Choose a total of four advantages and two features from those options."}]
- **Devastating Strikes** (beastforms - Terrible Lizard): When you deal Severe damage to a target within Melee range, you can **mark a Stress** to force them to mark an additional Hit Point.
- **Unyielding** (beastforms - Epic Aquatic Beast): When you would mark an Armor Slot, roll a **d6.** On a result of 5 or higher, reduce the severity by one threshold without marking an Armor Slot.
- **Hybrid Features** (beastforms - Mythic Hybrid): To transform into this creature, **mark 2 additional Stress.** Choose any three Beastform options from Tiers 1-3. Choose a total of five advantages and three features from those options.
- **Mythic Hybrid** (beastforms - Mythic Hybrid): [{"name":"Hybrid Features","text":"To transform into this creature, **mark 2 additional Stress.** Choose any three Beastform options from Tiers 1-3. Choose a total of five advantages and three features from those options."}]

### Supported: Roll Modification (12)
Uses addStatic, addDie, addAdvantageDie, reroll.

- **Surefooted** (ancestries - Goblin): You ignore disadvantage on Agility Rolls.
- **Internal Compass** (ancestries - Halfling): When you roll a 1 on your Hope Die, you can reroll it.
- **Dread Visage** (ancestries - Infernis): You have advantage on rolls to intimidate hostile creatures.
- **Sturdy** (ancestries - Orc): When you have 1 Hit Point remaining, attacks against you have disadvantage.
- **Natural Climber** (ancestries - Simiah): You have advantage on Agility Rolls that involve balancing and climbing.
- **Privilege** (communities - Highborne): You have advantage on rolls to consort with nobles, negotiate prices, or leverage your reputation to get what you want.
- **Steady** (communities - Ridgeborne): You have advantage on rolls to traverse dangerous cliffs and ledges, navigate harsh environments, and use your survival knowledge.
- **Low-Light Living** (communities - Underborne): When you're in an area with low light or heavy shadow, you have advantage on rolls to hide, investigate, or perceive details within that area.
- **Dueling** (weapons - Meridian Cutlass): When there are no other creatures within Close range of the target, gain advantage on your attack roll against them.
- **Sharp** (armor - Spiked Plate Armor): On a successful attack against a target within Melee range, add a d4 to the damage roll.
- **Companion** (beastforms - Household Friend): When you Help an Ally, you can roll a **d8** as your advantage die.
- **Hollow Bones** (beastforms - Winged Beast): You gain a -2 penalty to your damage thresholds.

### Supported: Condition Mutation (2)
Uses addCondition, removeCondition.

- **Retracting Claws** (ancestries - Katari): Make an **Agility Roll** to scratch a target within Melee range. On a success, they become temporarily _Vulnerable._
- **Retractable** (weapons - Retractable Saber): The blade can be hidden in the hilt to avoid detection.

### Supported: Narrative / Action (6)
Uses actionLoop, broadcast, addNarration.

- **Dedicated** (communities - Orderborne): Record three sayings or values your upbringing instilled in you. Once per rest, when you describe how you're embodying one of these principles through your current action, you can roll a **d20** as your Hope Die.
- **Wildtouch** (classes - Druid): You can perform harmless, subtle effects that involve nature—such as causing a flower to rapidly grow, summoning a slight gust of wind, or starting a campfire at will.
- **Minor Illusion** (classes - Sorcerer): Make a **Spellcast Roll (10).** On a success, you create a minor visual illusion no larger than yourself within Close range. This illusion is convincing to anyone at Close range or farther.
- **Prestidigitation** (classes - Wizard): You can perform harmless, subtle magical effects at will. For example, you can change an object's color, create a smell, light a candle, cause a tiny object to float, illuminate a room, or repair a small object.
- **Versatile** (weapons - Casting Sword): This weapon can also be used with these statistics—Knowledge, Far, d6+3.
- **Webslinger** (beastforms - Stalking Arachnid): You can create a strong web material useful for both adventuring and battle. The web is resilient enough to support one creature. You can temporarily _Restrain_ a target within Close range by succeeding on a Finesse Roll against them.

### Supported: Declarative (3)
Uses passiveStatMods, virtualWeapons.

- **Purposeful Design** (ancestries - Clank): Decide who made you and for what purpose. At character creation, choose one of your Experiences that best aligns with this purpose and gain a permanent +1 bonus to it.
- **Reach** (ancestries - Giant): Treat any weapon, ability, spell, or other feature that has a Melee range as though it has a Very Close range instead.
- **Nimble** (ancestries - Simiah): Gain a permanent +1 bonus to your Evasion at character creation.

### Missing: Movement / Positioning (47)
Requires a method to change range or move tokens.

- **Efficient** (ancestries - Clank): When you take a short rest, you can choose a long rest move instead of a short rest move.
- **Celestial Trance** (ancestries - Elf): During a rest, you can drop into a trance to choose an additional downtime move.
- **Wings** (ancestries - Faerie): You can fly. While flying, you can **mark a Stress** after an adversary makes an attack against you to gain a +2 bonus to your Evasion against that attack.
- **Caprine Leap** (ancestries - Faun): You can leap anywhere within Close range as though you were using normal movement, allowing you to vault obstacles, jump across gaps, or scale barriers with ease.
- **Charge** (ancestries - Firbolg): When you succeed on an Agility Roll to move from Far or Very Far range into Melee range with one or more targets, you can **mark a Stress** to deal **1d12** physical damage to all targets within Melee range.
- **Retract** (ancestries - Galapa): **Mark a Stress** to retract into your shell. While in your shell, you have resistance to physical damage, you have disadvantage on action rolls, and you can't move.
- **Amphibious** (ancestries - Ribbet): You can breathe and move naturally underwater.
- **Well-Read** (communities - Loreborne): You have advantage on rolls that involve the history, culture, or politics of a prominent person or place.
- **Know the Tide** (communities - Seaborne): You can sense the ebb and flow of life. When you roll with Fear, place a token on your community card. You can hold a number of tokens equal to your level. Before you make an action roll, you can spend any number of these tokens to gain a +1 bonus to the roll for each token spent. At the end of each session, clear all unspent tokens.
- **Scoundrel** (communities - Slyborne): You have advantage on rolls to negotiate with criminals, detect lies, or find a safe place to hide.
- **Nomadic Pack** (communities - Wanderborne): Add a Nomadic Pack to your inventory. Once per session, you can **spend a Hope** to reach into this pack and pull out a mundane item that's useful to your situation. Work with the GM to figure out what item you take out.
- **Lightfoot** (communities - Wildborne): Your movement is naturally silent. You have advantage on rolls to move without being heard.
- **Unstoppable** (classes - Guardian): Once per long rest, you can become _Unstoppable._ You gain an Unstoppable Die. At level 1, your Unstoppable Die is a **d4.** Place it on your character sheet in the space provided, starting with the 1 value facing up. After you make a damage roll that deals 1 or more Hit Points to a target, increase the Unstoppable Die value by one. When the die's value would exceed its maximum value or when the scene ends, remove the die and drop out of _Unstoppable_. At level 5, your Unstoppable Die increases to a **d6.**  While _Unstoppable_, you gain the following benefits:  - You reduce the severity of physical damage by one threshold (Severe to Major, Major to Minor, Minor to None). - You add the current value of the Unstoppable Die to your damage roll. - You can't be _Restrained_ or _Vulnerable_.  > _**Tip:** If your Unstoppable Die is a d4 and the 4 is currently facing up, you remove the die the next time you would increase it. However, if your Unstoppable Die has increased to a d6 and the 4 is currently facing up, you'll turn it to 5 the next time you would increase it. In this case, you'll remove the die after you would need to increase it higher than 6._
- **Cloaked** (classes - Rogue): Any time you would be _Hidden,_ you are instead _Cloaked._ In addition to the benefits of the _Hidden_ condition, while _Cloaked_ you remain unseen if you are stationary when an adversary moves to where they would normally see you. After you make an attack or end a move within line of sight of an adversary, you are no longer _Cloaked_.
- **Prayer Dice** (classes - Seraph): At the beginning of each session, roll a number of **d4s** equal to your subclass's Spellcast trait and place them on your character sheet in the space provided. These are your Prayer Dice. You can spend any number of Prayer Dice to aid yourself or an ally within Far range. You can use a spent die's value to reduce incoming damage, add to a roll's result after the roll is made, or gain Hope equal to the result. At the end of each session, clear all unspent Prayer Dice.
- **Channel Raw Power** (classes - Sorcerer): Once per long rest, you can place a domain card from your loadout into your vault and choose to either:  - Gain Hope equal to the level of the card. - Enhance a spell that deals damage, gaining a bonus to your damage roll equal to twice the level of the card.
- **Attack of Opportunity** (classes - Warrior): If an adversary within Melee range attempts to leave that range, make a reaction roll using a trait of your choice against their Difficulty. Choose one effect on a success, or two if you critically succeed:  - They can't move from where they are. - You deal damage to them equal to your primary weapon's damage. - You move with them.
- **Grappling** (weapons - Swinging Ropeblade): On a successful attack, you can spend a Hope to Restrain the target or pull them into Melee range with you.
- **Hooked** (weapons - Grappler, weapons - Improved Grappler, weapons - Advanced Grappler, weapons - Legendary Grappler): On a successful attack, you can pull the target into Melee range.
- **Quiet** (armor - Tyris Soft Armor): You gain a +2 bonus to rolls you make to move silently.
- **Agile** (beastforms - Agile Scout): Your movement is silent, and you can **spend a Hope** to move up to Far range without rolling.
- **Agile Scout** (beastforms - Agile Scout): [{"name":"Agile","text":"Your movement is silent, and you can **spend a Hope** to move up to Far range without rolling."},{"name":"Fragile","text":"When you take Major or greater damage, you drop out of Beastform."}]
- **Aquatic** (beastforms - Aquatic Scout, beastforms - Aquatic Predator): You can breathe and move naturally underwater.
- **Aquatic Scout** (beastforms - Aquatic Scout): [{"name":"Aquatic","text":"You can breathe and move naturally underwater."},{"name":"Fragile","text":"When you take Major or greater damage, you drop out of Beastform."}]
- **Carrier** (beastforms - Mighty Strider, beastforms - Great Predator, beastforms - Great Winged Beast): You can carry up to two willing allies with you when you move.
- **Trample** (beastforms - Mighty Strider): **Mark a Stress** to move up to Close range in a straight line and make an attack against all targets within Melee range of the line. Targets you succeed against take **d8+1** physical damage using your Proficiency and are temporarily _Vulnerable_.
- **Mighty Strider** (beastforms - Mighty Strider): [{"name":"Carrier","text":"You can carry up to two willing allies with you when you move."},{"name":"Trample","text":"**Mark a Stress** to move up to Close range in a straight line and make an attack against all targets within Melee range of the line. Targets you succeed against take **d8+1** physical damage using your Proficiency and are temporarily _Vulnerable_."}]
- **Warning Hiss** (beastforms - Striking Serpent): **Mark a Stress** to force any number of targets within Melee range to move back to Very Close range.
- **Striking Serpent** (beastforms - Striking Serpent): [{"name":"Venomous Strike","text":"Make an attack against any number of targets within Very Close range. On a success, a target is temporarily _Poisoned_. A _Poisoned_ creature takes **1d10** direct physical damage each time they act."},{"name":"Warning Hiss","text":"**Mark a Stress** to force any number of targets within Melee range to move back to Very Close range."}]
- **Fleet** (beastforms - Pouncing Predator): **Spend a Hope** to move up to Far range without rolling.
- **Takedown** (beastforms - Pouncing Predator): **Mark a Stress** to move into Melee range of a target and make an attack roll against them. On a success, you gain a +2 bonus to your Proficiency for this attack and the target must mark a Stress.
- **Pouncing Predator** (beastforms - Pouncing Predator): [{"name":"Fleet","text":"**Spend a Hope** to move up to Far range without rolling."},{"name":"Takedown","text":"**Mark a Stress** to move into Melee range of a target and make an attack roll against them. On a success, you gain a +2 bonus to your Proficiency for this attack and the target must mark a Stress."}]
- **Bird's-Eye View** (beastforms - Winged Beast, beastforms - Great Winged Beast): You can fly at will. Once per rest while you are airborne, you can ask the GM a question about the scene below you without needing to roll. The first time a character makes a roll to act on this information, they gain advantage on the roll.
- **Winged Beast** (beastforms - Winged Beast): [{"name":"Bird's-Eye View","text":"You can fly at will. Once per rest while you are airborne, you can ask the GM a question about the scene below you without needing to roll. The first time a character makes a roll to act on this information, they gain advantage on the roll."},{"name":"Hollow Bones","text":"You gain a -2 penalty to your damage thresholds."}]
- **Great Predator** (beastforms - Great Predator): [{"name":"Carrier","text":"You can carry up to two willing allies with you when you move."},{"name":"Vicious Maul","text":"When you succeed on an attack against a target, you can **spend a Hope** to make them temporarily _Vulnerable_ and gain a +1 bonus to your Proficiency for this attack."}]
- **Great Winged Beast** (beastforms - Great Winged Beast): [{"name":"Bird's-Eye View","text":"You can fly at will. Once per rest while you are airborne, you can ask the GM a question about the scene below you without needing to roll. The first time a character makes a roll to act on this information, they gain advantage on the roll."},{"name":"Carrier","text":"You can carry up to two willing allies with you when you move."}]
- **Aquatic Predator** (beastforms - Aquatic Predator): [{"name":"Aquatic","text":"You can breathe and move naturally underwater."},{"name":"Vicious Maul","text":"When you succeed on an attack against a target, you can **spend a Hope** to make them _Vulnerable_ and gain a +1 bonus to your Proficiency for this attack."}]
- **Carrier** (beastforms - Massive Behemoth): You can carry up to four willing allies with you when you move.
- **Demolish** (beastforms - Massive Behemoth): **Spend a Hope** to move up to Far range in a straight line and make an attack against all targets within Melee range of the line. Targets you succeed against take **d8+10** physical damage using your Proficiency and are temporarily _Vulnerable._
- **Massive Behemoth** (beastforms - Massive Behemoth): [{"name":"Carrier","text":"You can carry up to four willing allies with you when you move."},{"name":"Demolish","text":"**Spend a Hope** to move up to Far range in a straight line and make an attack against all targets within Melee range of the line. Targets you succeed against take **d8+10** physical damage using your Proficiency and are temporarily _Vulnerable._"},{"name":"Undaunted","text":"You gain a +2 bonus to all your damage thresholds."}]
- **Massive Stride** (beastforms - Terrible Lizard): You can move up to Far range without rolling. You ignore rough terain (at the GM's discretion) due to your size.
- **Terrible Lizard** (beastforms - Terrible Lizard): [{"name":"Devastating Strikes","text":"When you deal Severe damage to a target within Melee range, you can **mark a Stress** to force them to mark an additional Hit Point."},{"name":"Massive Stride","text":"You can move up to Far range without rolling. You ignore rough terain (at the GM's discretion) due to your size."}]
- **Carrier** (beastforms - Mythic Aerial Hunter): You can carry up to three willing allies with you when you move.
- **Deadly Raptor** (beastforms - Mythic Aerial Hunter): You can fly at will and move up to Far range as part of your action. When you move in a straight line into Melee range of a target from at least Close range and make an attack against that target in the same action, you can reroll all damage dice that rolled a result lower than your Proficiency.
- **Mythic Aerial Hunter** (beastforms - Mythic Aerial Hunter): [{"name":"Carrier","text":"You can carry up to three willing allies with you when you move."},{"name":"Deadly Raptor","text":"You can fly at will and move up to Far range as part of your action. When you move in a straight line into Melee range of a target from at least Close range and make an attack against that target in the same action, you can reroll all damage dice that rolled a result lower than your Proficiency."}]
- **Ocean Master** (beastforms - Epic Aquatic Beast): You can breathe and move naturally underwater. When you succeed on an attack against a target within Melee range, you can temporarily _Restrain_ them.
- **Epic Aquatic Beast** (beastforms - Epic Aquatic Beast): [{"name":"Ocean Master","text":"You can breathe and move naturally underwater. When you succeed on an attack against a target within Melee range, you can temporarily _Restrain_ them."},{"name":"Unyielding","text":"When you would mark an Armor Slot, roll a **d6.** On a result of 5 or higher, reduce the severity by one threshold without marking an Armor Slot."}]

### Missing: Inventory / Loadout (6)
Requires a method to modify equipped items or domain cards.

- **Beastform** (classes - Druid): Mark a Stress to magically transform into a creature of your tier or lower from the Beastform list. You can drop out of this form at any time. While transformed, you can't use weapons or cast spells from domain cards, but you can still use other features or abilities you have access to. Spells you cast before you transform stay active and last for their normal duration, and you can talk and communicate as normal. Additionally, you gain the Beastform's features, add their Evasion bonus to your Evasion, and use the trait specified in their statistics for your attack. While you're in a Beastform, your armor becomes part of your body and you mark Armor Slots as usual; when you drop out of a Beastform, those marked Armor Slots remain marked. If you mark your last Hit Point, you automatically drop out of this form.
- **Evolution** (classes - Druid): **Spend 3 Hope** to transform into a Beastform without marking a Stress. When you do, choose one trait to raise by +1 until you drop out of that Beastform.
- **Combat Training** (classes - Warrior): You ignore burden when equipping weapons. When you deal physical damage, you gain a bonus to your damage roll equal to your level.
- **Fragile** (beastforms - Agile Scout, beastforms - Household Friend, beastforms - Nimble Grazer, beastforms - Aquatic Scout): When you take Major or greater damage, you drop out of Beastform.
- **Household Friend** (beastforms - Household Friend): [{"name":"Companion","text":"When you Help an Ally, you can roll a **d8** as your advantage die."},{"name":"Fragile","text":"When you take Major or greater damage, you drop out of Beastform."}]
- **Nimble Grazer** (beastforms - Nimble Grazer): [{"name":"Elusive Prey","text":"When an attack roll against you would succeed, you can **mark a Stress** and roll a **d4.** Add the result to your Evasion against this attack."},{"name":"Fragile","text":"When you take Major or greater damage, you drop out of Beastform."}]

### Missing: GM Fear Mutation (0)
Requires a method to add or remove GM Fear.


### Missing: Other / Uncategorized (64)
Requires other undefined write methods.

- **Elemental Breath** (ancestries - Drakona): Choose an element for your breath (such as electricity, fire, or ice). You can use this breath against a target or group of targets within Very Close range, treating it as an Instinct weapon that deals **d8** magic damage using your Proficiency.
- **Fungril Network** (ancestries - Fungril): Make an **Instinct Roll (12)** to use your mycelial array to speak with others of your ancestry. On a success, you can communicate across any distance.
- **Shell** (ancestries - Galapa): Gain a bonus to your damage thresholds equal to your Proficiency.
- **Endurance** (ancestries - Giant): Gain an additional Hit Point slot at character creation.
- **High Stamina** (ancestries - Human): Gain an additional Stress slot at character creation.
- **Sneak Attack** (classes - Rogue): When you succeed on an attack while _Cloaked_ or while an ally is within Melee range of your target, add a number of **d6s** equal to your tier to your damage roll.  - Level 1 → Tier 1 - Levels 2-4 → Tier 2 - Levels 5-7 → Tier 3 - Levels 8-10 → Tier 4
- **Arcane Sense** (classes - Sorcerer): You can sense the presence of magical people and objects within Close range.
- **Reliable** (weapons - Broadsword, weapons - Improved Broadsword, weapons - War Scythe, weapons - Finehair Bow, weapons - Keeper's Staff, weapons - Advanced Broadsword, weapons - Legendary Broadsword, weapons - Aantari Bow, weapons - Thistlebow): +1 to attack rolls
- **Massive** (weapons - Greatsword, weapons - Improved Greatsword, weapons - Advanced Greatsword, weapons - Legendary Greatsword): -1 to Evasion; on a successful attack, roll an additional damage die and discard the lowest result.
- **Heavy** (weapons - Warhammer, weapons - Improved Warhammer, weapons - Advanced Warhammer, weapons - Legendary Warhammer, armor - Chainmail Armor, armor - Improved Chainmail Armor, armor - Advanced Chainmail Armor, armor - Legendary Chainmail Armor): -1 to Evasion
- **Cumbersome** (weapons - Halberd, weapons - Longbow, weapons - Improved Halberd, weapons - Improved Longbow, weapons - Advanced Halberd, weapons - Advanced Longbow, weapons - Legendary Halberd, weapons - Legendary Longbow): -1 to Finesse
- **Returning** (weapons - Returning Blade, weapons - Improved Returning Blade, weapons - Advanced Returning Blade, weapons - Legendary Returning Blade, weapons - Returning Axe): When this weapon is thrown within its range, it appears in your hand immediately after the attack.
- **Versatile** (weapons - Scepter): This weapon can also be used with these statistics—Presence, Melee, d8.
- **Powerful** (weapons - Greatstaff, weapons - Gilded Falchion, weapons - Greatbow, weapons - Improved Greatstaff, weapons - Elder Bow, weapons - Double Flail, weapons - Advanced Greatstaff, weapons - Mage Orb, weapons - Legendary Greatstaff, weapons - Floating Bladeshards): On a successful attack, roll an additional damage die and discard the lowest result.
- **Brutal** (weapons - Knuckle Blades, weapons - Yutari Bloodbow, weapons - Talon Blades): When you roll the maximum value on a damage die, roll an additional damage die.
- **Versatile** (weapons - Improved Scepter): This weapon can also be used with these statistics—Presence, Melee, d8+3.
- **Pompous** (weapons - Ego Blade): You must have a Presence of 0 or lower to use this weapon.
- **Sharpwing** (weapons - Flickerfly Blade): Gain a bonus to your damage rolls equal to your Agility.
- **Brave** (weapons - Bravesword): -1 to Evasion; +3 to Severe damage threshold
- **Protective** (weapons - Labrys Axe, weapons - Round Shield): +1 to Armor Score
- **Versatile** (weapons - Spiked Bow): This weapon can also be used with these statistics—Agility, Melee, d10+5.
- **Versatile** (weapons - Advanced Scepter): This weapon can also be used with these statistics—Presence, Melee, d8+4.
- **Healing** (weapons - Blessed Anlace): During downtime, automatically clear a Hit Point.
- **Otherworldly** (weapons - Ghostblade): On a successful attack, you can deal physical or magic damage.
- **Timebending** (weapons - Widogast Pendant): You choose the target of your attack after making your attack roll.
- **Self-Correcting** (weapons - Gilded Bow): When you roll a 1 on a damage die, it deals 6 damage instead.
- **Serrated** (weapons - Curved Dagger): When you roll a 1 on a damage die, it deals 8 damage instead.
- **Long** (weapons - Extended Polearm): This weapon's attack targets all adversaries in a line within range.
- **Versatile** (weapons - Legendary Scepter): This weapon can also be used with these statistics—Presence, Melee, d8+6.
- **Hot** (weapons - Sword of Light & Flame): This weapon cuts through solid material.
- **Greedy** (weapons - Midas Scythe): Spend a handful of gold to gain a +1 bonus to your Proficiency on a damage roll.
- **Timebending** (weapons - Wand of Essek): You can choose the target of your attack after making your attack roll.
- **Bonded** (weapons - Fusion Gloves): Gain a bonus to your damage rolls equal to your level.
- **Paired** (weapons - Shortsword, weapons - Small Dagger): +2 to primary weapon damage to targets within Melee range
- **Barrier** (weapons - Tower Shield): +2 to Armor Score; -1 to Evasion
- **Paired** (weapons - Improved Shortsword, weapons - Improved Small Dagger): +3 to primary weapon damage to targets within Melee range
- **Protective** (weapons - Improved Round Shield): +2 to Armor Score
- **Barrier** (weapons - Improved Tower Shield): +3 to Armor Score; -1 to Evasion
- **Double Duty** (weapons - Spiked Shield): +1 to Armor Score; +1 to primary weapon damage within Melee range
- **Parry** (weapons - Parrying Dagger): When you are attacked, roll this weapon's damage dice. If any of the attacker's damage dice rolled the same value as your dice, the matching results are discarded from the attacker's damage dice before the damage you take is totaled.
- **Paired** (weapons - Advanced Shortsword, weapons - Advanced Small Dagger): +4 to primary weapon damage to targets within Melee range
- **Protective** (weapons - Advanced Round Shield): +3 to Armor Score
- **Barrier** (weapons - Advanced Tower Shield): +4 to Armor Score; -1 to Evasion
- **Versatile** (weapons - Hand Sling): This weapon can also be used with these statistics—Finesse, Close, d8+4.
- **Paired** (weapons - Legendary Shortsword, weapons - Legendary Small Dagger): +5 to primary weapon damage to targets within Melee range
- **Protective** (weapons - Legendary Round Shield): +4 to Armor Score
- **Barrier** (weapons - Legendary Tower Shield): +5 to Armor Score; -1 to Evasion.
- **Doubled Up** (weapons - Knuckle Claws): When you make an attack with your primary weapon, you can deal damage to another target within Melee range.
- **Locked On** (weapons - Primer Shard): On a successful attack, your next attack against the same target with your primary weapon automatically succeeds.
- **Flexible** (armor - Gambeson Armor, armor - Improved Gambeson Armor, armor - Advanced Gambeson Armor, armor - Legendary Gambeson Armor): +1 to Evasion
- **Very Heavy** (armor - Full Plate Armor, armor - Improved Full Plate Armor, armor - Advanced Full Plate Armor, armor - Legendary Full Plate Armor): -2 to Evasion; -1 to Agility
- **Warded** (armor - Elundrian Chain Armor): You reduce incoming magic damage by your Armor Score before applying it to your damage thresholds.
- **Gilded** (armor - Bellamoi Fine Armor): +1 to Presence
- **Channeling** (armor - Channeling Armor): +1 to Spellcast Rolls
- **Truthseeking** (armor - Veritas Opal Armor): This armor glows when another creature within Close range tells a lie.
- **Difficult** (armor - Savior Chainmail): -1 to all character traits and Evasion
- **Pack Hunting** (beastforms - Pack Predator): When you succeed on an attack against the same target as an ally who acts immediately before you, add a **d8** to your damage roll.
- **Thick Hide** (beastforms - Powerful Beast): You gain a +2 bonus to your damage thresholds.
- **Physical Defense** (beastforms - Mighty Lizard): You gain a +3 bonus to your damage thresholds.
- **Evolved** (beastforms - Legendary Beast): Pick a Tier 1 Beastform option and become a larger, more powerful version of that creature. While you're in this form, you retain all traits and features from the original form and gain the following bonuses:  - A +6 bonus to damage rolls - A +1 bonus to the trait used by this form - A +2 bonus to Evasion
- **Legendary Beast** (beastforms - Legendary Beast): [{"name":"Evolved","text":"Pick a Tier 1 Beastform option and become a larger, more powerful version of that creature. While you're in this form, you retain all traits and features from the original form and gain the following bonuses:\n\n- A +6 bonus to damage rolls\n- A +1 bonus to the trait used by this form\n- A +2 bonus to Evasion"}]
- **Undaunted** (beastforms - Massive Behemoth): You gain a +2 bonus to all your damage thresholds.
- **Evolved** (beastforms - Mythic Beast): Pick a Tier 1 or Tier 2 Beastform option and become a larger, more powerful version of that creature. While you're in this form, you retain all traits and features from the original form and gain the following bonuses:  - A +9 bonus to damage rolls - A +2 bonus to the trait used by this form - A +3 bonus to Evasion - Your damage die increases by one size (d6 becomes d8, d8 becomes d10, etc.)
- **Mythic Beast** (beastforms - Mythic Beast): [{"name":"Evolved","text":"Pick a Tier 1 or Tier 2 Beastform option and become a larger, more powerful version of that creature. While you're in this form, you retain all traits and features from the original form and gain the following bonuses:\n\n- A +9 bonus to damage rolls\n- A +2 bonus to the trait used by this form\n- A +3 bonus to Evasion\n- Your damage die increases by one size (d6 becomes d8, d8 becomes d10, etc.)"}]

