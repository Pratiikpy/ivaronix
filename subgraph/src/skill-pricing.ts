// SkillPricing event handlers.
import { BigInt } from '@graphprotocol/graph-ts';
import {
  PriceUpdated as PriceUpdatedEvent,
  PriceUnset as PriceUnsetEvent,
} from '../generated/SkillPricing/SkillPricing';
import { Skill } from '../generated/schema';

export function handlePriceUpdated(event: PriceUpdatedEvent): void {
  const skillId = event.params.skillId.toHex();
  const skill = Skill.load(skillId);
  if (skill != null) {
    skill.priceWei = event.params.priceWei;
    skill.creatorBps = event.params.creatorBps;
    skill.treasuryBps = event.params.treasuryBps;
    skill.isPriced = true;
    skill.priceUpdatedAt = event.block.timestamp;
    skill.save();
  }
}

export function handlePriceUnset(event: PriceUnsetEvent): void {
  const skillId = event.params.skillId.toHex();
  const skill = Skill.load(skillId);
  if (skill != null) {
    skill.priceWei = BigInt.zero();
    skill.creatorBps = 0;
    skill.treasuryBps = 0;
    skill.isPriced = false;
    skill.priceUpdatedAt = event.block.timestamp;
    skill.save();
  }
}
