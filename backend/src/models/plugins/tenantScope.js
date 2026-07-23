/**
 * Multi-tenancy guard rail.
 *
 * Adds an indexed `societyId` to a schema and makes tenant scoping the
 * default rather than something each controller has to remember. Queries
 * must opt IN to a tenant via `.byTenant(societyId)` (or by passing
 * societyId in the filter); a query that specifies neither is refused
 * outright instead of silently reading across every society.
 *
 * The failure mode we're designing against is a single forgotten
 * `societyId:` in one controller quietly leaking one community's data to
 * another, which is both a privacy breach and near-invisible in testing
 * while only one society exists.
 */

// Queries that read or mutate existing documents and therefore must be
// constrained to one tenant.
const GUARDED_OPS = [
  'count',
  'countDocuments',
  'deleteMany',
  'deleteOne',
  'find',
  'findOne',
  'findOneAndDelete',
  'findOneAndRemove',
  'findOneAndUpdate',
  'replaceOne',
  'update',
  'updateMany',
  'updateOne',
];

module.exports = function tenantScope(schema, options = {}) {
  const { required = true } = options;

  schema.add({
    societyId: {
      type: require('mongoose').Schema.Types.ObjectId,
      ref: 'Society',
      required,
      index: true,
    },
  });

  // Explicit, readable way for a controller to scope a query.
  schema.query.byTenant = function (societyId) {
    if (!societyId) throw new Error('byTenant() requires a societyId');
    return this.where({ societyId });
  };

  // Deliberate escape hatch for migrations, admin tooling and cross-tenant
  // maintenance. Naming it loudly makes its use easy to audit.
  schema.query.skipTenantScope = function () {
    this.setOptions({ _skipTenantScope: true });
    return this;
  };

  GUARDED_OPS.forEach((op) => {
    schema.pre(op, function () {
      if (this.getOptions()?._skipTenantScope) return;

      const filter = this.getFilter() || {};
      const hasTenant =
        filter.societyId !== undefined ||
        (Array.isArray(filter.$and) && filter.$and.some((c) => c && c.societyId !== undefined));

      if (!hasTenant) {
        throw new Error(
          `[tenantScope] ${this.model.modelName}.${op}() ran without a societyId filter. ` +
          'Scope it with .byTenant(req.societyId), or call .skipTenantScope() if a ' +
          'cross-tenant read is genuinely intended.'
        );
      }
    });
  });
};
