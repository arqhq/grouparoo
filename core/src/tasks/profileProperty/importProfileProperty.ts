import { RetryableTask } from "../../classes/tasks/retryableTask";
import { Profile } from "../../models/Profile";
import { Property } from "../../models/Property";
import { ProfileProperty } from "../../models/ProfileProperty";
import { Mapping } from "../../models/Mapping";
import { Option } from "../../models/Option";
import { PropertyOps } from "../../modules/ops/property";
import { ImportOps } from "../../modules/ops/import";

export class ImportProfileProperty extends RetryableTask {
  constructor() {
    super();
    this.name = "profileProperty:importProfileProperty";
    this.description = "Import the Profile Property for a Property";
    this.frequency = 0;
    this.queue = "profileProperties";
    this.inputs = {
      profileId: { required: true },
      propertyId: { required: true },
    };
  }

  async runWithinTransaction(params) {
    const profile = await Profile.findOne({
      where: { id: params.profileId },
    });

    // has this profile been removed since we enqueued the import task?
    if (!profile) {
      return ProfileProperty.destroy({
        where: {
          profileId: params.profileId,
          propertyId: params.propertyId,
        },
      });
    }

    const property = await Property.findOneWithCache(params.propertyId);
    if (!property) return;
    const profileProperties = await profile.getProperties();
    const source = await property.$get("source", {
      scope: null,
      include: [Option, Mapping],
    });
    const dependencies = await PropertyOps.dependencies(property);

    let ok = true;
    dependencies.forEach((dep) => {
      if (profileProperties[dep.key].state !== "ready") ok = false;
    });

    if (!ok) {
      // there's a dependency we don't have yet, sleep a little and will be retried later
      return ProfileProperty.update(
        { startedAt: ImportOps.retryStartedAt() },
        {
          where: {
            propertyId: property.id,
            profileId: profile.id,
            state: "pending",
          },
        }
      );
    }

    const propertyValues = await source.importProfileProperty(
      profile,
      property
    );

    if (propertyValues) {
      const hash = {};
      hash[property.id] = Array.isArray(propertyValues)
        ? propertyValues
        : [propertyValues];
      await profile.addOrUpdateProperties(hash);
    } else {
      // got no data back, clear value
      await ProfileProperty.update(
        {
          state: "ready",
          rawValue: null,
          stateChangedAt: new Date(),
          confirmedAt: new Date(),
        },
        {
          where: {
            propertyId: property.id,
            profileId: profile.id,
            state: "pending",
          },
        }
      );
    }
  }
}
