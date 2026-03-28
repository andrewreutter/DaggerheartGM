/**
 * V2 adversary features — one module per SRD feature name (passive + action + reaction stubs).
 * Maintain descriptors in individual `*.js` files here; this barrel exports the merged registry.
 * Registry keys are `descriptor.name` except `Overwhelm::reaction` (name collision with passive).
 */

import { AcidBath } from './AcidBath.js';
import { AcidicForm } from './AcidicForm.js';
import { AdrenalineBurst } from './AdrenalineBurst.js';
import { AllConsumingRage } from './AllConsumingRage.js';
import { AllMustFall } from './AllMustFall.js';
import { AngerUnrelenting } from './AngerUnrelenting.js';
import { AnotherForThePile } from './AnotherForThePile.js';
import { ApocalypticThrashing } from './ApocalypticThrashing.js';
import { ArcaneArtillery } from './ArcaneArtillery.js';
import { ArcaneForm } from './ArcaneForm.js';
import { ArcaneSteel } from './ArcaneSteel.js';
import { ArmorShreddingShards } from './ArmorShreddingShards.js';
import { AshenCloud } from './AshenCloud.js';
import { AshenVengeancePhaseChange } from './AshenVengeancePhaseChange.js';
import { AshesToAshes } from './AshesToAshes.js';
import { AuraOfDoom } from './AuraOfDoom.js';
import { Avalanche } from './Avalanche.js';
import { AvalancheRoar } from './AvalancheRoar.js';
import { AvalancheTail } from './AvalancheTail.js';
import { Backstab } from './Backstab.js';
import { BatteringRam } from './BatteringRam.js';
import { BattleLust } from './BattleLust.js';
import { BattleTeleport } from './BattleTeleport.js';
import { BeamOfDecay } from './BeamOfDecay.js';
import { BendEars } from './BendEars.js';
import { Bite } from './Bite.js';
import { BladeOfTheForest } from './BladeOfTheForest.js';
import { BlendIn } from './BlendIn.js';
import { BlizzardBreath } from './BlizzardBreath.js';
import { BlockingShield } from './BlockingShield.js';
import { BloodAndSouls } from './BloodAndSouls.js';
import { BloodInTheWater } from './BloodInTheWater.js';
import { Bloodsucker } from './Bloodsucker.js';
import { BloodyReprisal } from './BloodyReprisal.js';
import { BoilingBlast } from './BoilingBlast.js';
import { BoneBreaker } from './BoneBreaker.js';
import { BoxIn } from './BoxIn.js';
import { BramblePatch } from './BramblePatch.js';
import { Burning } from './Burning.js';
import { CaptiveAudience } from './CaptiveAudience.js';
import { CasusBelli } from './CasusBelli.js';
import { CavalryCharge } from './CavalryCharge.js';
import { ChaoticFlux } from './ChaoticFlux.js';
import { ChaoticForm } from './ChaoticForm.js';
import { ChargingBull } from './ChargingBull.js';
import { Chevalier } from './Chevalier.js';
import { CircleOfDefilement } from './CircleOfDefilement.js';
import { ClearTheDecks } from './ClearTheDecks.js';
import { Climber } from './Climber.js';
import { Cloaked } from './Cloaked.js';
import { ConcentrateFire } from './ConcentrateFire.js';
import { Conflagration } from './Conflagration.js';
import { ConsumeKindling } from './ConsumeKindling.js';
import { Cornered } from './Cornered.js';
import { CoupDeGrace } from './CoupDeGrace.js';
import { CrackedScales } from './CrackedScales.js';
import { CreepingFire } from './CreepingFire.js';
import { CrownOfSerpents } from './CrownOfSerpents.js';
import { Crownsguard } from './Crownsguard.js';
import { Crush } from './Crush.js';
import { CrushingBlows } from './CrushingBlows.js';
import { Curse } from './Curse.js';
import { CutToTheBone } from './CutToTheBone.js';
import { DanceOfDeath } from './DanceOfDeath.js';
import { DeadlyCompanion } from './DeadlyCompanion.js';
import { DeadlyDive } from './DeadlyDive.js';
import { DeadlyDrop } from './DeadlyDrop.js';
import { DeadlyFlight } from './DeadlyFlight.js';
import { DeadlyShot } from './DeadlyShot.js';
import { DeathQuake } from './DeathQuake.js';
import { Deathlock } from './Deathlock.js';
import { DepthsOfDespair } from './DepthsOfDespair.js';
import { DesperateRampage } from './DesperateRampage.js';
import { Destructible } from './Destructible.js';
import { Detain } from './Detain.js';
import { Detonation } from './Detonation.js';
import { DevastatingRetort } from './DevastatingRetort.js';
import { DigTwoGraves } from './DigTwoGraves.js';
import { DisgorgeRealityFlotsam } from './DisgorgeRealityFlotsam.js';
import { DisorientingPresence } from './DisorientingPresence.js';
import { DiveBomb } from './DiveBomb.js';
import { DivineFlight } from './DivineFlight.js';
import { DivineVolley } from './DivineVolley.js';
import { Doombringer } from './Doombringer.js';
import { DoubleOrNothing } from './DoubleOrNothing.js';
import { DoubleStrike } from './DoubleStrike.js';
import { DrainAndMultiply } from './DrainAndMultiply.js';
import { DrainingBite } from './DrainingBite.js';
import { Dreadhowl } from './Dreadhowl.js';
import { DrowningEmbrace } from './DrowningEmbrace.js';
import { EarthEruption } from './EarthEruption.js';
import { EnchantingSong } from './EnchantingSong.js';
import { Encumber } from './Encumber.js';
import { EndlessLegions } from './EndlessLegions.js';
import { EnervatingBlast } from './EnervatingBlast.js';
import { Envelop } from './Envelop.js';
import { EruptingRagePhaseChange } from './EruptingRagePhaseChange.js';
import { Eruption } from './Eruption.js';
import { EscapePlan } from './EscapePlan.js';
import { EveryoneHasAPrice } from './EveryoneHasAPrice.js';
import { ExecuteThem } from './ExecuteThem.js';
import { Exile } from './Exile.js';
import { Explosion } from './Explosion.js';
import { FallBack } from './FallBack.js';
import { FallenHounds } from './FallenHounds.js';
import { FalteringArmor } from './FalteringArmor.js';
import { FearIsFuel } from './FearIsFuel.js';
import { FearsomePresence } from './FearsomePresence.js';
import { FeedOnFollowers } from './FeedOnFollowers.js';
import { FirespitePlateArmor } from './FirespitePlateArmor.js';
import { FlailingLimbs } from './FlailingLimbs.js';
import { Flight } from './Flight.js';
import { FlyOnTheWall } from './FlyOnTheWall.js';
import { Flying } from './Flying.js';
import { FocusedVolley } from './FocusedVolley.js';
import { ForTheRealm } from './ForTheRealm.js';
import { ForestControl } from './ForestControl.js';
import { FromAbove } from './FromAbove.js';
import { FrozenScales } from './FrozenScales.js';
import { Fumigation } from './Fumigation.js';
import { GatheringSecrets } from './GatheringSecrets.js';
import { Ghost } from './Ghost.js';
import { GoadingStrike } from './GoadingStrike.js';
import { GodRays } from './GodRays.js';
import { Gore } from './Gore.js';
import { GrabAndDrag } from './GrabAndDrag.js';
import { GrappleAndDrown } from './GrappleAndDrown.js';
import { GraveBlade } from './GraveBlade.js';
import { GrindletoothVenom } from './GrindletoothVenom.js';
import { GroundSlam } from './GroundSlam.js';
import { GroupAttack } from './GroupAttack.js';
import { GrowSaplings } from './GrowSaplings.js';
import { Guardian } from './Guardian.js';
import { GuardsSeizeThem } from './GuardsSeizeThem.js';
import { HailOfBoulders } from './HailOfBoulders.js';
import { HallucinatoryBreath } from './HallucinatoryBreath.js';
import { HeavilyArmored } from './HeavilyArmored.js';
import { Hellfire } from './Hellfire.js';
import { HighTide } from './HighTide.js';
import { HobblingShot } from './HobblingShot.js';
import { HobblingStrike } from './HobblingStrike.js';
import { HoldFast } from './HoldFast.js';
import { HoldThemDown } from './HoldThemDown.js';
import { Horde1d41 } from './Horde1d41.js';
import { Horde1d42 } from './Horde1d42.js';
import { Horde1d63 } from './Horde1d63.js';
import { Horde2d41 } from './Horde2d41.js';
import { Horde2d65 } from './Horde2d65.js';
import { Horrifying } from './Horrifying.js';
import { IHaveNeverKnownDefeatPhaseChange } from './IHaveNeverKnownDefeatPhaseChange.js';
import { Ignite } from './Ignite.js';
import { ImmovableObject } from './ImmovableObject.js';
import { InYourFace } from './InYourFace.js';
import { InevitableDeath } from './InevitableDeath.js';
import { InjuredWings } from './InjuredWings.js';
import { IveGotEm } from './IveGotEm.js';
import { Judgment } from './Judgment.js';
import { JustATree } from './JustATree.js';
import { KineticSlam } from './KineticSlam.js';
import { LavaSplash } from './LavaSplash.js';
import { Levitation } from './Levitation.js';
import { Lifesuck } from './Lifesuck.js';
import { LockUp } from './LockUp.js';
import { LookIntoMyEyes } from './LookIntoMyEyes.js';
import { LurchingLunge } from './LurchingLunge.js';
import { MagicBurst } from './MagicBurst.js';
import { MagicalReflection } from './MagicalReflection.js';
import { MagicalWeakness } from './MagicalWeakness.js';
import { MaintainDistance } from './MaintainDistance.js';
import { ManaBolt } from './ManaBolt.js';
import { ManyHeadedMenace } from './ManyHeadedMenace.js';
import { ManyTentacles } from './ManyTentacles.js';
import { MarkTarget } from './MarkTarget.js';
import { MindDance } from './MindDance.js';
import { Minion12 } from './Minion12.js';
import { Minion13 } from './Minion13.js';
import { Minion3 } from './Minion3.js';
import { Minion4 } from './Minion4.js';
import { Minion5 } from './Minion5.js';
import { Minion6 } from './Minion6.js';
import { Minion7 } from './Minion7.js';
import { Minion9 } from './Minion9.js';
import { Mistform } from './Mistform.js';
import { Mockery } from './Mockery.js';
import { Momentum } from './Momentum.js';
import { MoneyIsTime } from './MoneyIsTime.js';
import { MoneyTalks } from './MoneyTalks.js';
import { MoreWhereThatCameFrom } from './MoreWhereThatCameFrom.js';
import { MoveAsAUnit } from './MoveAsAUnit.js';
import { MyLandMyRules } from './MyLandMyRules.js';
import { MyTurn } from './MyTurn.js';
import { NeverMisses } from './NeverMisses.js';
import { NightmareTableau } from './NightmareTableau.js';
import { NoHope } from './NoHope.js';
import { NoQuarter } from './NoQuarter.js';
import { NotTodayMyDears } from './NotTodayMyDears.js';
import { NumbersMustGoUp } from './NumbersMustGoUp.js';
import { ObsidianScales } from './ObsidianScales.js';
import { OminousKnowledge } from './OminousKnowledge.js';
import { OnMySignal } from './OnMySignal.js';
import { OnlyBones } from './OnlyBones.js';
import { OpenTheGatesOfDeath } from './OpenTheGatesOfDeath.js';
import { Opportunist } from './Opportunist.js';
import { OurMastersWill } from './OurMastersWill.js';
import { OutOfNowhere } from './OutOfNowhere.js';
import { Overcharge } from './Overcharge.js';
import { Overload } from './Overload.js';
import { Overwhelm } from './Overwhelm.js';
import { OverwhelmReaction } from './OverwhelmReaction.js';
import { OverwhelmingForce } from './OverwhelmingForce.js';
import { PackTactics } from './PackTactics.js';
import { ParalyzingShock } from './ParalyzingShock.js';
import { PeerlessAccuracy } from './PeerlessAccuracy.js';
import { PerfectStrike } from './PerfectStrike.js';
import { PetrifyingGaze } from './PetrifyingGaze.js';
import { PickOffTheStraggler } from './PickOffTheStraggler.js';
import { PickYourTarget } from './PickYourTarget.js';
import { PinningStrike } from './PinningStrike.js';
import { PreferentialTreatment } from './PreferentialTreatment.js';
import { PronounceFate } from './PronounceFate.js';
import { PunishTheGuilty } from './PunishTheGuilty.js';
import { QuickHands } from './QuickHands.js';
import { RallyGuards } from './RallyGuards.js';
import { RampUp } from './RampUp.js';
import { Rampage } from './Rampage.js';
import { RampagingFury } from './RampagingFury.js';
import { RandomizedTactics } from './RandomizedTactics.js';
import { RealityQuake } from './RealityQuake.js';
import { Reaper } from './Reaper.js';
import { RefreshWardingSphere } from './RefreshWardingSphere.js';
import { Regeneration } from './Regeneration.js';
import { Reinforce } from './Reinforce.js';
import { Reinforcements } from './Reinforcements.js';
import { Relentless2 } from './Relentless2.js';
import { Relentless3 } from './Relentless3.js';
import { Relentless4 } from './Relentless4.js';
import { RelentlessX } from './RelentlessX.js';
import { RemakeReality } from './RemakeReality.js';
import { RendAndCrush } from './RendAndCrush.js';
import { RendAsunder } from './RendAsunder.js';
import { RendingBite } from './RendingBite.js';
import { Retaliation } from './Retaliation.js';
import { RipAndTear } from './RipAndTear.js';
import { Rivalry } from './Rivalry.js';
import { Rockslide } from './Rockslide.js';
import { RockyAmbush } from './RockyAmbush.js';
import { Scapegoat } from './Scapegoat.js';
import { ScorchedEarth } from './ScorchedEarth.js';
import { Screech } from './Screech.js';
import { SearingGlance } from './SearingGlance.js';
import { SeedBarrage } from './SeedBarrage.js';
import { SeizeYourMoment } from './SeizeYourMoment.js';
import { ShacklesOfGuilt } from './ShacklesOfGuilt.js';
import { ShadowEmbrace } from './ShadowEmbrace.js';
import { ShadowShackles } from './ShadowShackles.js';
import { ShatteringMight } from './ShatteringMight.js';
import { ShatteringStrike } from './ShatteringStrike.js';
import { ShieldWall } from './ShieldWall.js';
import { ShroudOfTheFallen } from './ShroudOfTheFallen.js';
import { SickeningFlux } from './SickeningFlux.js';
import { SiphonMagic } from './SiphonMagic.js';
import { SkilledOpportunist } from './SkilledOpportunist.js';
import { Slippery } from './Slippery.js';
import { Slow } from './Slow.js';
import { SlowFiring } from './SlowFiring.js';
import { SpinningSerpent } from './SpinningSerpent.js';
import { SpitAcid } from './SpitAcid.js';
import { Spitter } from './Spitter.js';
import { Split } from './Split.js';
import { Stonestrider } from './Stonestrider.js';
import { StrikeAsOne } from './StrikeAsOne.js';
import { SummonTormentors } from './SummonTormentors.js';
import { SummoningRitual } from './SummoningRitual.js';
import { SunsearArrows } from './SunsearArrows.js';
import { SuppressingBlast } from './SuppressingBlast.js';
import { SuppressingFire } from './SuppressingFire.js';
import { Swashbuckler } from './Swashbuckler.js';
import { Tactician } from './Tactician.js';
import { TakeOffAction } from './TakeOffAction.js';
import { TakeRoot } from './TakeRoot.js';
import { Terrifying } from './Terrifying.js';
import { TerrifyingChorus } from './TerrifyingChorus.js';
import { TheBestMuscleMoneyCanBuy } from './TheBestMuscleMoneyCanBuy.js';
import { TheHuntIsOn } from './TheHuntIsOn.js';
import { TheRootOfVillainy } from './TheRootOfVillainy.js';
import { TheRunaround } from './TheRunaround.js';
import { TheSubtleBlade } from './TheSubtleBlade.js';
import { ThornyArmor } from './ThornyArmor.js';
import { ThornyCage } from './ThornyCage.js';
import { TooManyToHandle } from './TooManyToHandle.js';
import { TormentedScreams } from './TormentedScreams.js';
import { TormentingLash } from './TormentingLash.js';
import { Trample } from './Trample.js';
import { TwoAsOne } from './TwoAsOne.js';
import { UncannyReflexes } from './UncannyReflexes.js';
import { UnendingBattle } from './UnendingBattle.js';
import { UnparalleledSkill } from './UnparalleledSkill.js';
import { UnprotectedMind } from './UnprotectedMind.js';
import { UnrealForm } from './UnrealForm.js';
import { UnseenStrike } from './UnseenStrike.js';
import { Unyielding } from './Unyielding.js';
import { VassalsLoyalty } from './VassalsLoyalty.js';
import { VengefulFate } from './VengefulFate.js';
import { VenomousStinger } from './VenomousStinger.js';
import { VoiceOfTheForest } from './VoiceOfTheForest.js';
import { VolcanicBreath } from './VolcanicBreath.js';
import { WallsClosingIn } from './WallsClosingIn.js';
import { WardingSphere } from './WardingSphere.js';
import { Wards } from './Wards.js';
import { WarpedFortitude } from './WarpedFortitude.js';
import { WaterJet } from './WaterJet.js';
import { WeAreAllOne } from './WeAreAllOne.js';
import { WeAreOne } from './WeAreOne.js';
import { WeakStructure } from './WeakStructure.js';
import { WhatsYoursIsMine } from './WhatsYoursIsMine.js';
import { Whirlwind } from './Whirlwind.js';
import { WillShatteringTouch } from './WillShatteringTouch.js';
import { WontSeeItComing } from './WontSeeItComing.js';
import { WontStayDead } from './WontStayDead.js';
import { YouPaleInComparison } from './YouPaleInComparison.js';
import { YourFriendsWillFailYou } from './YourFriendsWillFailYou.js';
import { YourLifeIsMine } from './YourLifeIsMine.js';
import { YourStruggleIsPointless } from './YourStruggleIsPointless.js';

export {
  AcidBath,
  AcidicForm,
  AdrenalineBurst,
  AllConsumingRage,
  AllMustFall,
  AngerUnrelenting,
  AnotherForThePile,
  ApocalypticThrashing,
  ArcaneArtillery,
  ArcaneForm,
  ArcaneSteel,
  ArmorShreddingShards,
  AshenCloud,
  AshenVengeancePhaseChange,
  AshesToAshes,
  AuraOfDoom,
  Avalanche,
  AvalancheRoar,
  AvalancheTail,
  Backstab,
  BatteringRam,
  BattleLust,
  BattleTeleport,
  BeamOfDecay,
  BendEars,
  Bite,
  BladeOfTheForest,
  BlendIn,
  BlizzardBreath,
  BlockingShield,
  BloodAndSouls,
  BloodInTheWater,
  Bloodsucker,
  BloodyReprisal,
  BoilingBlast,
  BoneBreaker,
  BoxIn,
  BramblePatch,
  Burning,
  CaptiveAudience,
  CasusBelli,
  CavalryCharge,
  ChaoticFlux,
  ChaoticForm,
  ChargingBull,
  Chevalier,
  CircleOfDefilement,
  ClearTheDecks,
  Climber,
  Cloaked,
  ConcentrateFire,
  Conflagration,
  ConsumeKindling,
  Cornered,
  CoupDeGrace,
  CrackedScales,
  CreepingFire,
  CrownOfSerpents,
  Crownsguard,
  Crush,
  CrushingBlows,
  Curse,
  CutToTheBone,
  DanceOfDeath,
  DeadlyCompanion,
  DeadlyDive,
  DeadlyDrop,
  DeadlyFlight,
  DeadlyShot,
  DeathQuake,
  Deathlock,
  DepthsOfDespair,
  DesperateRampage,
  Destructible,
  Detain,
  Detonation,
  DevastatingRetort,
  DigTwoGraves,
  DisgorgeRealityFlotsam,
  DisorientingPresence,
  DiveBomb,
  DivineFlight,
  DivineVolley,
  Doombringer,
  DoubleOrNothing,
  DoubleStrike,
  DrainAndMultiply,
  DrainingBite,
  Dreadhowl,
  DrowningEmbrace,
  EarthEruption,
  EnchantingSong,
  Encumber,
  EndlessLegions,
  EnervatingBlast,
  Envelop,
  EruptingRagePhaseChange,
  Eruption,
  EscapePlan,
  EveryoneHasAPrice,
  ExecuteThem,
  Exile,
  Explosion,
  FallBack,
  FallenHounds,
  FalteringArmor,
  FearIsFuel,
  FearsomePresence,
  FeedOnFollowers,
  FirespitePlateArmor,
  FlailingLimbs,
  Flight,
  FlyOnTheWall,
  Flying,
  FocusedVolley,
  ForTheRealm,
  ForestControl,
  FromAbove,
  FrozenScales,
  Fumigation,
  GatheringSecrets,
  Ghost,
  GoadingStrike,
  GodRays,
  Gore,
  GrabAndDrag,
  GrappleAndDrown,
  GraveBlade,
  GrindletoothVenom,
  GroundSlam,
  GroupAttack,
  GrowSaplings,
  Guardian,
  GuardsSeizeThem,
  HailOfBoulders,
  HallucinatoryBreath,
  HeavilyArmored,
  Hellfire,
  HighTide,
  HobblingShot,
  HobblingStrike,
  HoldFast,
  HoldThemDown,
  Horde1d41,
  Horde1d42,
  Horde1d63,
  Horde2d41,
  Horde2d65,
  Horrifying,
  IHaveNeverKnownDefeatPhaseChange,
  Ignite,
  ImmovableObject,
  InYourFace,
  InevitableDeath,
  InjuredWings,
  IveGotEm,
  Judgment,
  JustATree,
  KineticSlam,
  LavaSplash,
  Levitation,
  Lifesuck,
  LockUp,
  LookIntoMyEyes,
  LurchingLunge,
  MagicBurst,
  MagicalReflection,
  MagicalWeakness,
  MaintainDistance,
  ManaBolt,
  ManyHeadedMenace,
  ManyTentacles,
  MarkTarget,
  MindDance,
  Minion12,
  Minion13,
  Minion3,
  Minion4,
  Minion5,
  Minion6,
  Minion7,
  Minion9,
  Mistform,
  Mockery,
  Momentum,
  MoneyIsTime,
  MoneyTalks,
  MoreWhereThatCameFrom,
  MoveAsAUnit,
  MyLandMyRules,
  MyTurn,
  NeverMisses,
  NightmareTableau,
  NoHope,
  NoQuarter,
  NotTodayMyDears,
  NumbersMustGoUp,
  ObsidianScales,
  OminousKnowledge,
  OnMySignal,
  OnlyBones,
  OpenTheGatesOfDeath,
  Opportunist,
  OurMastersWill,
  OutOfNowhere,
  Overcharge,
  Overload,
  Overwhelm,
  OverwhelmReaction,
  OverwhelmingForce,
  PackTactics,
  ParalyzingShock,
  PeerlessAccuracy,
  PerfectStrike,
  PetrifyingGaze,
  PickOffTheStraggler,
  PickYourTarget,
  PinningStrike,
  PreferentialTreatment,
  PronounceFate,
  PunishTheGuilty,
  QuickHands,
  RallyGuards,
  RampUp,
  Rampage,
  RampagingFury,
  RandomizedTactics,
  RealityQuake,
  Reaper,
  RefreshWardingSphere,
  Regeneration,
  Reinforce,
  Reinforcements,
  Relentless2,
  Relentless3,
  Relentless4,
  RelentlessX,
  RemakeReality,
  RendAndCrush,
  RendAsunder,
  RendingBite,
  Retaliation,
  RipAndTear,
  Rivalry,
  Rockslide,
  RockyAmbush,
  Scapegoat,
  ScorchedEarth,
  Screech,
  SearingGlance,
  SeedBarrage,
  SeizeYourMoment,
  ShacklesOfGuilt,
  ShadowEmbrace,
  ShadowShackles,
  ShatteringMight,
  ShatteringStrike,
  ShieldWall,
  ShroudOfTheFallen,
  SickeningFlux,
  SiphonMagic,
  SkilledOpportunist,
  Slippery,
  Slow,
  SlowFiring,
  SpinningSerpent,
  SpitAcid,
  Spitter,
  Split,
  Stonestrider,
  StrikeAsOne,
  SummonTormentors,
  SummoningRitual,
  SunsearArrows,
  SuppressingBlast,
  SuppressingFire,
  Swashbuckler,
  Tactician,
  TakeOffAction,
  TakeRoot,
  Terrifying,
  TerrifyingChorus,
  TheBestMuscleMoneyCanBuy,
  TheHuntIsOn,
  TheRootOfVillainy,
  TheRunaround,
  TheSubtleBlade,
  ThornyArmor,
  ThornyCage,
  TooManyToHandle,
  TormentedScreams,
  TormentingLash,
  Trample,
  TwoAsOne,
  UncannyReflexes,
  UnendingBattle,
  UnparalleledSkill,
  UnprotectedMind,
  UnrealForm,
  UnseenStrike,
  Unyielding,
  VassalsLoyalty,
  VengefulFate,
  VenomousStinger,
  VoiceOfTheForest,
  VolcanicBreath,
  WallsClosingIn,
  WardingSphere,
  Wards,
  WarpedFortitude,
  WaterJet,
  WeAreAllOne,
  WeAreOne,
  WeakStructure,
  WhatsYoursIsMine,
  Whirlwind,
  WillShatteringTouch,
  WontSeeItComing,
  WontStayDead,
  YouPaleInComparison,
  YourFriendsWillFailYou,
  YourLifeIsMine,
  YourStruggleIsPointless,
};

export default {
  [AcidBath.name]: AcidBath,
  [AcidicForm.name]: AcidicForm,
  [AdrenalineBurst.name]: AdrenalineBurst,
  [AllConsumingRage.name]: AllConsumingRage,
  [AllMustFall.name]: AllMustFall,
  [AngerUnrelenting.name]: AngerUnrelenting,
  [AnotherForThePile.name]: AnotherForThePile,
  [ApocalypticThrashing.name]: ApocalypticThrashing,
  [ArcaneArtillery.name]: ArcaneArtillery,
  [ArcaneForm.name]: ArcaneForm,
  [ArcaneSteel.name]: ArcaneSteel,
  [ArmorShreddingShards.name]: ArmorShreddingShards,
  [AshenCloud.name]: AshenCloud,
  [AshenVengeancePhaseChange.name]: AshenVengeancePhaseChange,
  [AshesToAshes.name]: AshesToAshes,
  [AuraOfDoom.name]: AuraOfDoom,
  [Avalanche.name]: Avalanche,
  [AvalancheRoar.name]: AvalancheRoar,
  [AvalancheTail.name]: AvalancheTail,
  [Backstab.name]: Backstab,
  [BatteringRam.name]: BatteringRam,
  [BattleLust.name]: BattleLust,
  [BattleTeleport.name]: BattleTeleport,
  [BeamOfDecay.name]: BeamOfDecay,
  [BendEars.name]: BendEars,
  [Bite.name]: Bite,
  [BladeOfTheForest.name]: BladeOfTheForest,
  [BlendIn.name]: BlendIn,
  [BlizzardBreath.name]: BlizzardBreath,
  [BlockingShield.name]: BlockingShield,
  [BloodAndSouls.name]: BloodAndSouls,
  [BloodInTheWater.name]: BloodInTheWater,
  [Bloodsucker.name]: Bloodsucker,
  [BloodyReprisal.name]: BloodyReprisal,
  [BoilingBlast.name]: BoilingBlast,
  [BoneBreaker.name]: BoneBreaker,
  [BoxIn.name]: BoxIn,
  [BramblePatch.name]: BramblePatch,
  [Burning.name]: Burning,
  [CaptiveAudience.name]: CaptiveAudience,
  [CasusBelli.name]: CasusBelli,
  [CavalryCharge.name]: CavalryCharge,
  [ChaoticFlux.name]: ChaoticFlux,
  [ChaoticForm.name]: ChaoticForm,
  [ChargingBull.name]: ChargingBull,
  [Chevalier.name]: Chevalier,
  [CircleOfDefilement.name]: CircleOfDefilement,
  [ClearTheDecks.name]: ClearTheDecks,
  [Climber.name]: Climber,
  [Cloaked.name]: Cloaked,
  [ConcentrateFire.name]: ConcentrateFire,
  [Conflagration.name]: Conflagration,
  [ConsumeKindling.name]: ConsumeKindling,
  [Cornered.name]: Cornered,
  [CoupDeGrace.name]: CoupDeGrace,
  [CrackedScales.name]: CrackedScales,
  [CreepingFire.name]: CreepingFire,
  [CrownOfSerpents.name]: CrownOfSerpents,
  [Crownsguard.name]: Crownsguard,
  [Crush.name]: Crush,
  [CrushingBlows.name]: CrushingBlows,
  [Curse.name]: Curse,
  [CutToTheBone.name]: CutToTheBone,
  [DanceOfDeath.name]: DanceOfDeath,
  [DeadlyCompanion.name]: DeadlyCompanion,
  [DeadlyDive.name]: DeadlyDive,
  [DeadlyDrop.name]: DeadlyDrop,
  [DeadlyFlight.name]: DeadlyFlight,
  [DeadlyShot.name]: DeadlyShot,
  [DeathQuake.name]: DeathQuake,
  [Deathlock.name]: Deathlock,
  [DepthsOfDespair.name]: DepthsOfDespair,
  [DesperateRampage.name]: DesperateRampage,
  [Destructible.name]: Destructible,
  [Detain.name]: Detain,
  [Detonation.name]: Detonation,
  [DevastatingRetort.name]: DevastatingRetort,
  [DigTwoGraves.name]: DigTwoGraves,
  [DisgorgeRealityFlotsam.name]: DisgorgeRealityFlotsam,
  [DisorientingPresence.name]: DisorientingPresence,
  [DiveBomb.name]: DiveBomb,
  [DivineFlight.name]: DivineFlight,
  [DivineVolley.name]: DivineVolley,
  [Doombringer.name]: Doombringer,
  [DoubleOrNothing.name]: DoubleOrNothing,
  [DoubleStrike.name]: DoubleStrike,
  [DrainAndMultiply.name]: DrainAndMultiply,
  [DrainingBite.name]: DrainingBite,
  [Dreadhowl.name]: Dreadhowl,
  [DrowningEmbrace.name]: DrowningEmbrace,
  [EarthEruption.name]: EarthEruption,
  [EnchantingSong.name]: EnchantingSong,
  [Encumber.name]: Encumber,
  [EndlessLegions.name]: EndlessLegions,
  [EnervatingBlast.name]: EnervatingBlast,
  [Envelop.name]: Envelop,
  [EruptingRagePhaseChange.name]: EruptingRagePhaseChange,
  [Eruption.name]: Eruption,
  [EscapePlan.name]: EscapePlan,
  [EveryoneHasAPrice.name]: EveryoneHasAPrice,
  [ExecuteThem.name]: ExecuteThem,
  [Exile.name]: Exile,
  [Explosion.name]: Explosion,
  [FallBack.name]: FallBack,
  [FallenHounds.name]: FallenHounds,
  [FalteringArmor.name]: FalteringArmor,
  [FearIsFuel.name]: FearIsFuel,
  [FearsomePresence.name]: FearsomePresence,
  [FeedOnFollowers.name]: FeedOnFollowers,
  [FirespitePlateArmor.name]: FirespitePlateArmor,
  [FlailingLimbs.name]: FlailingLimbs,
  [Flight.name]: Flight,
  [FlyOnTheWall.name]: FlyOnTheWall,
  [Flying.name]: Flying,
  [FocusedVolley.name]: FocusedVolley,
  [ForTheRealm.name]: ForTheRealm,
  [ForestControl.name]: ForestControl,
  [FromAbove.name]: FromAbove,
  [FrozenScales.name]: FrozenScales,
  [Fumigation.name]: Fumigation,
  [GatheringSecrets.name]: GatheringSecrets,
  [Ghost.name]: Ghost,
  [GoadingStrike.name]: GoadingStrike,
  [GodRays.name]: GodRays,
  [Gore.name]: Gore,
  [GrabAndDrag.name]: GrabAndDrag,
  [GrappleAndDrown.name]: GrappleAndDrown,
  [GraveBlade.name]: GraveBlade,
  [GrindletoothVenom.name]: GrindletoothVenom,
  [GroundSlam.name]: GroundSlam,
  [GroupAttack.name]: GroupAttack,
  [GrowSaplings.name]: GrowSaplings,
  [Guardian.name]: Guardian,
  [GuardsSeizeThem.name]: GuardsSeizeThem,
  [HailOfBoulders.name]: HailOfBoulders,
  [HallucinatoryBreath.name]: HallucinatoryBreath,
  [HeavilyArmored.name]: HeavilyArmored,
  [Hellfire.name]: Hellfire,
  [HighTide.name]: HighTide,
  [HobblingShot.name]: HobblingShot,
  [HobblingStrike.name]: HobblingStrike,
  [HoldFast.name]: HoldFast,
  [HoldThemDown.name]: HoldThemDown,
  [Horde1d41.name]: Horde1d41,
  [Horde1d42.name]: Horde1d42,
  [Horde1d63.name]: Horde1d63,
  [Horde2d41.name]: Horde2d41,
  [Horde2d65.name]: Horde2d65,
  [Horrifying.name]: Horrifying,
  [IHaveNeverKnownDefeatPhaseChange.name]: IHaveNeverKnownDefeatPhaseChange,
  [Ignite.name]: Ignite,
  [ImmovableObject.name]: ImmovableObject,
  [InYourFace.name]: InYourFace,
  [InevitableDeath.name]: InevitableDeath,
  [InjuredWings.name]: InjuredWings,
  [IveGotEm.name]: IveGotEm,
  [Judgment.name]: Judgment,
  [JustATree.name]: JustATree,
  [KineticSlam.name]: KineticSlam,
  [LavaSplash.name]: LavaSplash,
  [Levitation.name]: Levitation,
  [Lifesuck.name]: Lifesuck,
  [LockUp.name]: LockUp,
  [LookIntoMyEyes.name]: LookIntoMyEyes,
  [LurchingLunge.name]: LurchingLunge,
  [MagicBurst.name]: MagicBurst,
  [MagicalReflection.name]: MagicalReflection,
  [MagicalWeakness.name]: MagicalWeakness,
  [MaintainDistance.name]: MaintainDistance,
  [ManaBolt.name]: ManaBolt,
  [ManyHeadedMenace.name]: ManyHeadedMenace,
  [ManyTentacles.name]: ManyTentacles,
  [MarkTarget.name]: MarkTarget,
  [MindDance.name]: MindDance,
  [Minion12.name]: Minion12,
  [Minion13.name]: Minion13,
  [Minion3.name]: Minion3,
  [Minion4.name]: Minion4,
  [Minion5.name]: Minion5,
  [Minion6.name]: Minion6,
  [Minion7.name]: Minion7,
  [Minion9.name]: Minion9,
  [Mistform.name]: Mistform,
  [Mockery.name]: Mockery,
  [Momentum.name]: Momentum,
  [MoneyIsTime.name]: MoneyIsTime,
  [MoneyTalks.name]: MoneyTalks,
  [MoreWhereThatCameFrom.name]: MoreWhereThatCameFrom,
  [MoveAsAUnit.name]: MoveAsAUnit,
  [MyLandMyRules.name]: MyLandMyRules,
  [MyTurn.name]: MyTurn,
  [NeverMisses.name]: NeverMisses,
  [NightmareTableau.name]: NightmareTableau,
  [NoHope.name]: NoHope,
  [NoQuarter.name]: NoQuarter,
  [NotTodayMyDears.name]: NotTodayMyDears,
  [NumbersMustGoUp.name]: NumbersMustGoUp,
  [ObsidianScales.name]: ObsidianScales,
  [OminousKnowledge.name]: OminousKnowledge,
  [OnMySignal.name]: OnMySignal,
  [OnlyBones.name]: OnlyBones,
  [OpenTheGatesOfDeath.name]: OpenTheGatesOfDeath,
  [Opportunist.name]: Opportunist,
  [OurMastersWill.name]: OurMastersWill,
  [OutOfNowhere.name]: OutOfNowhere,
  [Overcharge.name]: Overcharge,
  [Overload.name]: Overload,
  [Overwhelm.name]: Overwhelm,
  'Overwhelm::reaction': OverwhelmReaction,
  [OverwhelmingForce.name]: OverwhelmingForce,
  [PackTactics.name]: PackTactics,
  [ParalyzingShock.name]: ParalyzingShock,
  [PeerlessAccuracy.name]: PeerlessAccuracy,
  [PerfectStrike.name]: PerfectStrike,
  [PetrifyingGaze.name]: PetrifyingGaze,
  [PickOffTheStraggler.name]: PickOffTheStraggler,
  [PickYourTarget.name]: PickYourTarget,
  [PinningStrike.name]: PinningStrike,
  [PreferentialTreatment.name]: PreferentialTreatment,
  [PronounceFate.name]: PronounceFate,
  [PunishTheGuilty.name]: PunishTheGuilty,
  [QuickHands.name]: QuickHands,
  [RallyGuards.name]: RallyGuards,
  [RampUp.name]: RampUp,
  [Rampage.name]: Rampage,
  [RampagingFury.name]: RampagingFury,
  [RandomizedTactics.name]: RandomizedTactics,
  [RealityQuake.name]: RealityQuake,
  [Reaper.name]: Reaper,
  [RefreshWardingSphere.name]: RefreshWardingSphere,
  [Regeneration.name]: Regeneration,
  [Reinforce.name]: Reinforce,
  [Reinforcements.name]: Reinforcements,
  [Relentless2.name]: Relentless2,
  [Relentless3.name]: Relentless3,
  [Relentless4.name]: Relentless4,
  [RelentlessX.name]: RelentlessX,
  [RemakeReality.name]: RemakeReality,
  [RendAndCrush.name]: RendAndCrush,
  [RendAsunder.name]: RendAsunder,
  [RendingBite.name]: RendingBite,
  [Retaliation.name]: Retaliation,
  [RipAndTear.name]: RipAndTear,
  [Rivalry.name]: Rivalry,
  [Rockslide.name]: Rockslide,
  [RockyAmbush.name]: RockyAmbush,
  [Scapegoat.name]: Scapegoat,
  [ScorchedEarth.name]: ScorchedEarth,
  [Screech.name]: Screech,
  [SearingGlance.name]: SearingGlance,
  [SeedBarrage.name]: SeedBarrage,
  [SeizeYourMoment.name]: SeizeYourMoment,
  [ShacklesOfGuilt.name]: ShacklesOfGuilt,
  [ShadowEmbrace.name]: ShadowEmbrace,
  [ShadowShackles.name]: ShadowShackles,
  [ShatteringMight.name]: ShatteringMight,
  [ShatteringStrike.name]: ShatteringStrike,
  [ShieldWall.name]: ShieldWall,
  [ShroudOfTheFallen.name]: ShroudOfTheFallen,
  [SickeningFlux.name]: SickeningFlux,
  [SiphonMagic.name]: SiphonMagic,
  [SkilledOpportunist.name]: SkilledOpportunist,
  [Slippery.name]: Slippery,
  [Slow.name]: Slow,
  [SlowFiring.name]: SlowFiring,
  [SpinningSerpent.name]: SpinningSerpent,
  [SpitAcid.name]: SpitAcid,
  [Spitter.name]: Spitter,
  [Split.name]: Split,
  [Stonestrider.name]: Stonestrider,
  [StrikeAsOne.name]: StrikeAsOne,
  [SummonTormentors.name]: SummonTormentors,
  [SummoningRitual.name]: SummoningRitual,
  [SunsearArrows.name]: SunsearArrows,
  [SuppressingBlast.name]: SuppressingBlast,
  [SuppressingFire.name]: SuppressingFire,
  [Swashbuckler.name]: Swashbuckler,
  [Tactician.name]: Tactician,
  [TakeOffAction.name]: TakeOffAction,
  [TakeRoot.name]: TakeRoot,
  [Terrifying.name]: Terrifying,
  [TerrifyingChorus.name]: TerrifyingChorus,
  [TheBestMuscleMoneyCanBuy.name]: TheBestMuscleMoneyCanBuy,
  [TheHuntIsOn.name]: TheHuntIsOn,
  [TheRootOfVillainy.name]: TheRootOfVillainy,
  [TheRunaround.name]: TheRunaround,
  [TheSubtleBlade.name]: TheSubtleBlade,
  [ThornyArmor.name]: ThornyArmor,
  [ThornyCage.name]: ThornyCage,
  [TooManyToHandle.name]: TooManyToHandle,
  [TormentedScreams.name]: TormentedScreams,
  [TormentingLash.name]: TormentingLash,
  [Trample.name]: Trample,
  [TwoAsOne.name]: TwoAsOne,
  [UncannyReflexes.name]: UncannyReflexes,
  [UnendingBattle.name]: UnendingBattle,
  [UnparalleledSkill.name]: UnparalleledSkill,
  [UnprotectedMind.name]: UnprotectedMind,
  [UnrealForm.name]: UnrealForm,
  [UnseenStrike.name]: UnseenStrike,
  [Unyielding.name]: Unyielding,
  [VassalsLoyalty.name]: VassalsLoyalty,
  [VengefulFate.name]: VengefulFate,
  [VenomousStinger.name]: VenomousStinger,
  [VoiceOfTheForest.name]: VoiceOfTheForest,
  [VolcanicBreath.name]: VolcanicBreath,
  [WallsClosingIn.name]: WallsClosingIn,
  [WardingSphere.name]: WardingSphere,
  [Wards.name]: Wards,
  [WarpedFortitude.name]: WarpedFortitude,
  [WaterJet.name]: WaterJet,
  [WeAreAllOne.name]: WeAreAllOne,
  [WeAreOne.name]: WeAreOne,
  [WeakStructure.name]: WeakStructure,
  [WhatsYoursIsMine.name]: WhatsYoursIsMine,
  [Whirlwind.name]: Whirlwind,
  [WillShatteringTouch.name]: WillShatteringTouch,
  [WontSeeItComing.name]: WontSeeItComing,
  [WontStayDead.name]: WontStayDead,
  [YouPaleInComparison.name]: YouPaleInComparison,
  [YourFriendsWillFailYou.name]: YourFriendsWillFailYou,
  [YourLifeIsMine.name]: YourLifeIsMine,
  [YourStruggleIsPointless.name]: YourStruggleIsPointless,
};
