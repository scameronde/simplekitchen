import { db } from '../init';
import type { DietaryProfile } from '../../../shared/types/recipe';
import type { DietaryProfileTable } from '../../../shared/types/database';
import type { DietaryTag } from '../../../shared/types/database';

// Get dietary profile (singleton - always ID 1)
export async function getDietaryProfile(): Promise<DietaryProfile> {
  const row = await db
    .selectFrom('dietary_profile')
    .selectAll()
    .where('id', '=', 1)
    .executeTakeFirst();

  if (!row) {
    // Should never happen (migration creates default profile)
    throw new Error('Dietary profile not found');
  }

  return {
    id: row.id,
    hardRestrictions: JSON.parse(row.hard_restrictions),
    preferences: JSON.parse(row.preferences),
    explicitInclusions: JSON.parse(row.explicit_inclusions),
    explicitExclusions: JSON.parse(row.explicit_exclusions),
    updatedAt: new Date(row.updated_at),
  };
}

// Update dietary profile
export async function updateDietaryProfile(updates: {
  hardRestrictions?: DietaryTag[];
  preferences?: DietaryTag[];
  explicitInclusions?: string[];
  explicitExclusions?: string[];
}): Promise<DietaryProfile> {
  const now = new Date().toISOString();

  const dbUpdates: Partial<DietaryProfileTable> = { updated_at: now };
  if (updates.hardRestrictions !== undefined) {
    dbUpdates.hard_restrictions = JSON.stringify(updates.hardRestrictions);
  }
  if (updates.preferences !== undefined) {
    dbUpdates.preferences = JSON.stringify(updates.preferences);
  }
  if (updates.explicitInclusions !== undefined) {
    dbUpdates.explicit_inclusions = JSON.stringify(updates.explicitInclusions);
  }
  if (updates.explicitExclusions !== undefined) {
    dbUpdates.explicit_exclusions = JSON.stringify(updates.explicitExclusions);
  }

  await db
    .updateTable('dietary_profile')
    .set(dbUpdates)
    .where('id', '=', 1)
    .execute();

  return getDietaryProfile();
}

// Reset dietary profile to defaults
export async function resetDietaryProfile(): Promise<DietaryProfile> {
  await db
    .updateTable('dietary_profile')
    .set({
      hard_restrictions: JSON.stringify(['gluten-free', 'lactose-free']),
      preferences: JSON.stringify([]),
      explicit_inclusions: JSON.stringify([]),
      explicit_exclusions: JSON.stringify([]),
      updated_at: new Date().toISOString(),
    })
    .where('id', '=', 1)
    .execute();

  return getDietaryProfile();
}
