/**
 * One-off migration: move the original single-community data into a tenant.
 *
 * Creates the Hill Park Avenue society and stamps societyId onto every
 * existing user/food/complaint/announcement/message that doesn't have one,
 * then drops the old global unique index on User.phone (it's now unique per
 * society instead).
 *
 * Safe to re-run: every step skips records that already have a societyId.
 *
 * Run from the backend directory with your production MONGO_URI available:
 *   node scripts/migrateToMultiTenant.js            # dry run, changes nothing
 *   node scripts/migrateToMultiTenant.js --commit   # actually writes
 */

require('dotenv').config();
const mongoose = require('mongoose');

const Society = require('../src/models/Society');
const User = require('../src/models/User');
const Food = require('../src/models/Food');
const Complaint = require('../src/models/Complaint');
const Announcement = require('../src/models/Announcement');
const Message = require('../src/models/Message');

const COMMIT = process.argv.includes('--commit');

const SOCIETY = {
  name: 'Hill Park Avenue',
  city: 'Thiruvananthapuram',
  state: 'Kerala',
  blocks: ['Lands Down Park', 'Hill Top Garden', 'Aakkulam Avenue'],
  inviteCode: 'HPA2026',
};

const TENANT_MODELS = [
  ['users', User],
  ['food posts', Food],
  ['complaints', Complaint],
  ['announcements', Announcement],
  ['messages', Message],
];

(async () => {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI is not set. Aborting.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log(`Connected to ${mongoose.connection.host}/${mongoose.connection.name}`);
  console.log(COMMIT ? '\n=== COMMIT MODE — changes will be written ===\n'
                     : '\n=== DRY RUN — no changes will be written (pass --commit to apply) ===\n');

  // 1. The society itself
  let society = await Society.findOne({ inviteCode: SOCIETY.inviteCode });
  if (society) {
    console.log(`Society already exists: ${society.name} (${society._id})`);
  } else if (COMMIT) {
    society = await Society.create(SOCIETY);
    console.log(`Created society: ${society.name} (${society._id}), invite code ${society.inviteCode}`);
  } else {
    console.log(`Would create society: ${SOCIETY.name} with invite code ${SOCIETY.inviteCode}`);
  }

  const societyId = society?._id;

  // 2. Backfill societyId on every tenant-scoped collection
  for (const [label, Model] of TENANT_MODELS) {
    // skipTenantScope: this is exactly the cross-tenant maintenance the
    // guard rail is designed to make explicit rather than accidental.
    const orphans = await Model.countDocuments({ societyId: { $exists: false } }).skipTenantScope();
    if (!orphans) {
      console.log(`${label}: nothing to backfill`);
      continue;
    }
    if (!COMMIT || !societyId) {
      console.log(`${label}: would backfill ${orphans}`);
      continue;
    }
    const res = await Model.updateMany(
      { societyId: { $exists: false } },
      { $set: { societyId } }
    ).skipTenantScope();
    console.log(`${label}: backfilled ${res.modifiedCount}`);
  }

  // 3. Promote the earliest member to society admin so someone can manage it
  if (societyId) {
    const admin = await User.findOne({ societyId, role: 'societyAdmin' });
    if (admin) {
      console.log(`Society admin already set: ${admin.name}`);
    } else {
      const first = await User.findOne({ societyId }).sort({ createdAt: 1 });
      if (!first) {
        console.log('No users found to promote to society admin');
      } else if (COMMIT) {
        first.role = 'societyAdmin';
        await first.save({ validateBeforeSave: false });
        await Society.findByIdAndUpdate(societyId, { createdBy: first._id });
        console.log(`Promoted ${first.name} (${first.phone}) to societyAdmin`);
      } else {
        console.log(`Would promote ${first.name} (${first.phone}) to societyAdmin`);
      }
    }
  }

  // 4. Drop the obsolete global unique index on phone
  try {
    const indexes = await User.collection.indexes();
    const stale = indexes.find(
      (i) => i.unique && i.key && i.key.phone === 1 && Object.keys(i.key).length === 1
    );
    if (!stale) {
      console.log('No stale global phone_1 unique index to drop');
    } else if (COMMIT) {
      await User.collection.dropIndex(stale.name);
      console.log(`Dropped stale index ${stale.name}`);
    } else {
      console.log(`Would drop stale index ${stale.name}`);
    }
  } catch (err) {
    console.warn('Index check failed (continuing):', err.message);
  }

  if (COMMIT) {
    // Build the new compound {societyId, phone} unique index
    await User.syncIndexes();
    console.log('Synced User indexes');
  }

  console.log('\nDone.');
  await mongoose.disconnect();
  process.exit(0);
})().catch(async (err) => {
  console.error('\nMigration failed:', err);
  await mongoose.disconnect();
  process.exit(1);
});
