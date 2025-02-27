import { CLS } from "../modules/cls";
import { AuthenticatedAction } from "../classes/actions/authenticatedAction";
import { Group, GROUP_RULE_LIMIT } from "../models/Group";
import { PropertyOpsDictionary } from "../modules/ruleOpsDictionary";
import { TopLevelGroupRules } from "../modules/topLevelGroupRules";
import { Profile } from "../models/Profile";
import { GroupMember } from "../models/GroupMember";
import { ConfigWriter } from "../modules/configWriter";

export class GroupsList extends AuthenticatedAction {
  constructor() {
    super();
    this.name = "groups:list";
    this.description = "list all the groups";
    this.outputExample = {};
    this.permission = { topic: "group", mode: "read" };
    this.inputs = {
      limit: { required: true, default: 100, formatter: parseInt },
      offset: { required: true, default: 0, formatter: parseInt },
      state: { required: false },
      order: {
        required: false,
        default: [
          ["name", "desc"],
          ["createdAt", "desc"],
        ],
      },
    };
  }

  async runWithinTransaction({ params }) {
    const where = {};

    if (params.state) where["state"] = params.state;

    const groups = await Group.scope(null).findAll({
      where,
      limit: params.limit,
      offset: params.offset,
      order: params.order,
    });

    const total = await Group.scope(null).count({ where });

    return {
      total,
      groups: await Promise.all(groups.map((g) => g.apiData())),
    };
  }
}

export class GroupsRuleOptions extends AuthenticatedAction {
  constructor() {
    super();
    this.name = "groups:ruleOptions";
    this.description = "send the options about groups to the UI";
    this.outputExample = {};
    this.permission = { topic: "group", mode: "read" };
    this.inputs = {};
  }

  async runWithinTransaction() {
    return {
      ruleLimit: GROUP_RULE_LIMIT,
      ops: PropertyOpsDictionary,
      topLevelGroupRules: TopLevelGroupRules,
    };
  }
}

export class GroupCreate extends AuthenticatedAction {
  constructor() {
    super();
    this.name = "group:create";
    this.description = "create a group";
    this.outputExample = {};
    this.permission = { topic: "group", mode: "write" };
    this.inputs = {
      name: { required: true },
      type: { required: true },
      matchType: { required: true, default: "all" },
      rules: { required: false },
      state: { required: false },
    };
  }

  async runWithinTransaction({ params }) {
    const group = await Group.create(params);

    if (params.rules) {
      await group.setRules(params.rules);
    }

    const responseGroup = await group.apiData();
    responseGroup.rules = group.toConvenientRules(await group.getRules());
    await ConfigWriter.run();
    return { group: responseGroup };
  }
}

export class GroupEdit extends AuthenticatedAction {
  constructor() {
    super();
    this.name = "group:edit";
    this.description = "edit a group";
    this.outputExample = {};
    this.permission = { topic: "group", mode: "write" };
    this.inputs = {
      id: { required: true },
      name: { required: false },
      type: { required: false },
      matchType: { required: false },
      rules: { required: false },
    };
  }

  async runWithinTransaction({ params }) {
    const group = await Group.findById(params.id);
    await group.update(params);

    if (params.rules) await group.setRules(params.rules);

    const responseGroup = await group.apiData();
    responseGroup.rules = group.toConvenientRules(await group.getRules());
    await ConfigWriter.run();
    return { group: responseGroup };
  }
}

export class GroupRun extends AuthenticatedAction {
  constructor() {
    super();
    this.name = "group:run";
    this.description = "recalculate the members for a calculated group";
    this.outputExample = {};
    this.permission = { topic: "group", mode: "write" };
    this.inputs = {
      id: { required: true },
    };
  }

  async runWithinTransaction({ params }) {
    const group = await Group.findById(params.id);
    await group.run();
    return { success: true };
  }
}

export class GroupAddProfile extends AuthenticatedAction {
  constructor() {
    super();
    this.name = "group:addProfile";
    this.description = "add a profile to a manual group";
    this.outputExample = {};
    this.permission = { topic: "group", mode: "write" };
    this.inputs = {
      id: { required: true },
      profileId: { required: true },
    };
  }

  async runWithinTransaction({ params }) {
    const group = await Group.findById(params.id);
    if (group.type !== "manual") {
      throw new Error(
        "only manual groups can have membership manipulated by this action"
      );
    }
    const profile = await Profile.findById(params.profileId);
    await group.addProfile(profile);
    return { success: true };
  }
}

export class GroupRemoveProfile extends AuthenticatedAction {
  constructor() {
    super();
    this.name = "group:removeProfile";
    this.description = "remove a profile to a manual group";
    this.outputExample = {};
    this.permission = { topic: "group", mode: "write" };
    this.inputs = {
      id: { required: true },
      profileId: { required: true },
    };
  }

  async runWithinTransaction({ params }) {
    const group = await Group.findById(params.id);
    if (group.type !== "manual") {
      throw new Error(
        "only manual groups can have membership manipulated by this action"
      );
    }

    const profile = await Profile.findById(params.profileId);
    await group.removeProfile(profile);
    return { success: true };
  }
}

export class GroupView extends AuthenticatedAction {
  constructor() {
    super();
    this.name = "group:view";
    this.description = "view a group and members";
    this.outputExample = {};
    this.permission = { topic: "group", mode: "read" };
    this.inputs = {
      id: { required: true },
    };
  }

  async runWithinTransaction({ params }) {
    const group = await Group.findById(params.id);
    const responseGroup = await group.apiData();
    responseGroup.rules = group.toConvenientRules(await group.getRules());
    return { group: responseGroup };
  }
}

export class GroupCountComponentMembers extends AuthenticatedAction {
  constructor() {
    super();
    this.name = "group:countComponentMembers";
    this.description =
      "return the counts of profiles which exist due to a certain rule";
    this.outputExample = {};
    this.permission = { topic: "group", mode: "read" };
    this.inputs = {
      id: { required: true },
      rules: { required: false },
    };
  }

  async runWithinTransaction({ params }) {
    const group = await Group.findById(params.id);

    let rules;
    if (params.rules) {
      try {
        rules = params.rules.map((r) => JSON.parse(r));
      } catch (e) {
        rules = params.rules;
      }
    }

    const { componentCounts, funnelCounts } =
      await group.countComponentMembersFromRules(
        group.fromConvenientRules(rules)
      );

    return { componentCounts, funnelCounts };
  }
}

export class GroupCountPotentialMembers extends AuthenticatedAction {
  constructor() {
    super();
    this.name = "group:countPotentialMembers";
    this.description =
      "return the count of profiles that would match these rules";
    this.outputExample = {};
    this.permission = { topic: "group", mode: "read" };
    this.inputs = {
      id: { required: true },
      rules: { required: false },
    };
  }

  async runWithinTransaction({ params }) {
    const group = await Group.findById(params.id);

    let rules;
    if (params.rules) {
      try {
        rules = params.rules.map((r) => JSON.parse(r));
      } catch (e) {
        rules = params.rules;
      }
    }

    const count = await group.countPotentialMembers(
      group.fromConvenientRules(rules)
    );

    return { count };
  }
}

export class GroupListDestinations extends AuthenticatedAction {
  constructor() {
    super();
    this.name = "group:listDestinations";
    this.description = "list the destinations interested in this group";
    this.outputExample = {};
    this.permission = { topic: "group", mode: "read" };
    this.inputs = {
      id: { required: true },
    };
  }

  async runWithinTransaction({ params }) {
    const group = await Group.findById(params.id);

    const destinations = await group.$get("destinations");
    return {
      total: destinations.length,
      destinations: await Promise.all(destinations.map((d) => d.apiData())),
    };
  }
}

export class GroupExport extends AuthenticatedAction {
  constructor() {
    super();
    this.name = "group:export";
    this.description = "export the profiles in this group";
    this.outputExample = {};
    this.permission = { topic: "group", mode: "write" };
    this.inputs = {
      id: { required: true },
      type: { required: true },
    };
  }

  async runWithinTransaction({ params }) {
    const group = await Group.findById(params.id);

    if (params.type === "csv") {
      await CLS.enqueueTask("group:exportToCSV", { groupId: group.id });
    } else {
      throw new Error(`${params.type} is not a type of group export`);
    }

    return { success: true };
  }
}

export class GroupDestroy extends AuthenticatedAction {
  constructor() {
    super();
    this.name = "group:destroy";
    this.description = "destroy a group";
    this.outputExample = {};
    this.permission = { topic: "group", mode: "write" };
    this.inputs = {
      id: { required: true },
      force: {
        required: true,
        default: false,
        formatter: (p: string | boolean) =>
          p.toString().toLowerCase() === "true",
      },
    };
  }

  async runWithinTransaction({ params }) {
    const group = await Group.findById(params.id);
    await Group.ensureNotInUse(group);

    if (params.force === true) {
      await GroupMember.destroy({ where: { groupId: group.id } });
      await group.destroy(); // other related models are handled by hooks
    } else {
      // group:destroy will be eventually enqueued by the `destroy` system task
      await group.update({ state: "deleted" });
    }

    await ConfigWriter.run();

    return { success: true };
  }
}
