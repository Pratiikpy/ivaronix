// SkillRegistryV2 event handlers.
import { BigInt } from '@graphprotocol/graph-ts';
import {
  SkillPublished as SkillPublishedEvent,
  SkillOwnershipTransferred as SkillOwnershipTransferredEvent,
} from '../generated/SkillRegistryV2/SkillRegistryV2';
import { Skill, GlobalStats } from '../generated/schema';

export function handleSkillPublished(event: SkillPublishedEvent): void {
  const skillId = event.params.skillId.toHex();
  let skill = Skill.load(skillId);
  if (skill == null) {
    skill = new Skill(skillId);
    skill.publishedAt = event.block.timestamp;
    skill.priceWei = BigInt.zero();
    skill.creatorBps = 0;
    skill.treasuryBps = 0;
    skill.isPriced = false;
    skill.priceUpdatedAt = BigInt.zero();
    skill.totalPaidWei = BigInt.zero();
    skill.totalReceipts = 0;

    // Increment uniqueSkills on global
    let global = GlobalStats.load('global');
    if (global == null) {
      global = new GlobalStats('global');
      global.totalReceipts = 0;
      global.totalPayments = BigInt.zero();
      global.totalCreatorPaid = BigInt.zero();
      global.totalTreasuryPaid = BigInt.zero();
      global.uniqueCreators = 0;
      global.uniqueSkills = 0;
    }
    global.uniqueSkills = global.uniqueSkills + 1;
    global.save();
  }
  skill.owner = event.params.creator;
  skill.manifestRoot = event.params.manifestRoot;
  skill.save();
}

export function handleSkillOwnershipTransferred(event: SkillOwnershipTransferredEvent): void {
  const skillId = event.params.skillId.toHex();
  const skill = Skill.load(skillId);
  if (skill != null) {
    skill.owner = event.params.newOwner;
    skill.save();
  }
}
