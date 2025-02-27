import { api } from "actionhero";
import { AuthenticatedAction } from "../classes/actions/authenticatedAction";
import { App } from "../models/App";
import { Source } from "../models/Source";
import { GrouparooPlugin, PluginConnection } from "../classes/plugin";
import { OptionHelper } from "../modules/optionHelper";
import { ConfigWriter } from "../modules/configWriter";
import { AsyncReturnType } from "type-fest";

export class SourcesList extends AuthenticatedAction {
  constructor() {
    super();
    this.name = "sources:list";
    this.description = "list all the sources";
    this.outputExample = {};
    this.permission = { topic: "source", mode: "read" };
    this.inputs = {
      limit: { required: true, default: 100, formatter: parseInt },
      offset: { required: true, default: 0, formatter: parseInt },
      state: { required: false },
      order: {
        required: false,
        default: [
          ["appId", "desc"],
          ["createdAt", "asc"],
        ],
      },
    };
  }

  async runWithinTransaction({ params }) {
    const where = {};
    if (params.state) where["state"] = params.state;

    const sources = await Source.scope(null).findAll({
      where,
      limit: params.limit,
      offset: params.offset,
      order: params.order,
    });

    const total = await Source.scope(null).count({ where });

    return {
      total,
      sources: await Promise.all(sources.map((source) => source.apiData())),
    };
  }
}

export class SourceConnectionApps extends AuthenticatedAction {
  constructor() {
    super();
    this.name = "sources:connectionApps";
    this.description =
      "enumerate the connection and app pairs for creating a new source";
    this.outputExample = {};
    this.permission = { topic: "source", mode: "read" };
    this.inputs = {};
  }

  async runWithinTransaction() {
    const apps = await App.findAll();
    const existingAppTypes = apps.map((a) => a.type);

    const connectionApps: Array<{
      app: AsyncReturnType<typeof App.prototype.apiData>;
      connection: PluginConnection;
    }> = [];

    let importConnections = [];
    api.plugins.plugins.forEach((plugin: GrouparooPlugin) => {
      if (plugin.connections) {
        plugin.connections
          .filter((c) => c.direction === "import")
          .filter((c) => existingAppTypes.includes(c.app))
          .map((c) => importConnections.push(c));
      }
    });

    for (const i in apps) {
      for (const j in importConnections) {
        if (apps[i].type === importConnections[j].app) {
          connectionApps.push({
            app: await apps[i].apiData(),
            connection: importConnections[j],
          });
        }
      }
    }

    const environmentVariableOptions =
      OptionHelper.getEnvironmentVariableOptionsForTopic("source");

    return { connectionApps, environmentVariableOptions };
  }
}

export class SourceCreate extends AuthenticatedAction {
  constructor() {
    super();
    this.name = "source:create";
    this.description = "create a source";
    this.outputExample = {};
    this.permission = { topic: "source", mode: "write" };
    this.inputs = {
      appId: { required: true },
      name: { required: false },
      type: { required: true },
      state: { required: false },
      options: { required: false },
      mapping: { required: false },
    };
  }

  async runWithinTransaction({ params }) {
    const source = await Source.create({
      appId: params.appId,
      name: params.name,
      type: params.type,
    });

    if (params.options) await source.setOptions(params.options);
    if (params.mapping) await source.setMapping(params.mapping);
    if (params.state) await source.update({ state: params.state });

    await ConfigWriter.run();

    return { source: await source.apiData() };
  }
}

export class SourceView extends AuthenticatedAction {
  constructor() {
    super();
    this.name = "source:view";
    this.description = "view a source";
    this.outputExample = {};
    this.permission = { topic: "source", mode: "read" };
    this.inputs = {
      id: { required: true },
    };
  }

  async runWithinTransaction({ params }) {
    const source = await Source.findById(params.id);
    return { source: await source.apiData() };
  }
}

export class SourceEdit extends AuthenticatedAction {
  constructor() {
    super();
    this.name = "source:edit";
    this.description = "edit a source";
    this.outputExample = {};
    this.permission = { topic: "source", mode: "write" };
    this.inputs = {
      id: { required: true },
      appId: { required: false },
      name: { required: false },
      type: { required: false },
      state: { required: false },
      options: { required: false },
      mapping: { required: false },
    };
  }

  async runWithinTransaction({ params }) {
    const source = await Source.findById(params.id);
    if (params.options) await source.setOptions(params.options);
    if (params.mapping) await source.setMapping(params.mapping);

    await source.update(params);

    await ConfigWriter.run();

    return { source: await source.apiData() };
  }
}

export class SourceBootstrapUniqueProperty extends AuthenticatedAction {
  constructor() {
    super();
    this.name = "source:bootstrapUniqueProperty";
    this.description =
      "bootstrap a new unique profile property for this source before the mapping is set";
    this.outputExample = {};
    this.permission = { topic: "source", mode: "write" };
    this.inputs = {
      id: { required: true },
      key: { required: true },
      type: { required: true },
      mappedColumn: { required: true },
    };
  }

  async runWithinTransaction({ params }) {
    const source = await Source.findById(params.id);

    const property = await source.bootstrapUniqueProperty(
      params.key,
      params.type,
      params.mappedColumn
    );

    await ConfigWriter.run();

    return {
      source: await source.apiData(),
      property: await property.apiData(),
    };
  }
}

export class sourceConnectionOptions extends AuthenticatedAction {
  constructor() {
    super();
    this.name = "source:connectionOptions";
    this.description = "return option choices from this source";
    this.outputExample = {};
    this.permission = { topic: "source", mode: "read" };
    this.inputs = {
      id: { required: true },
      options: { required: false },
    };
  }

  async runWithinTransaction({ params }) {
    const source = await Source.findById(params.id);

    const options =
      typeof params.options === "string"
        ? JSON.parse(params.options)
        : params.options;

    return { options: await source.sourceConnectionOptions(options) };
  }
}

export class SourcePreview extends AuthenticatedAction {
  constructor() {
    super();
    this.name = "source:preview";
    this.description = "preview the data from this source";
    this.outputExample = {};
    this.permission = { topic: "source", mode: "read" };
    this.inputs = {
      id: { required: true },
      options: { required: false },
    };
  }

  async runWithinTransaction({ params }) {
    const source = await Source.findById(params.id);

    const options =
      typeof params.options === "string"
        ? JSON.parse(params.options)
        : params.options;

    return { preview: await source.sourcePreview(options) };
  }
}

export class SourceDestroy extends AuthenticatedAction {
  constructor() {
    super();
    this.name = "source:destroy";
    this.description = "destroy a source";
    this.outputExample = {};
    this.permission = { topic: "source", mode: "write" };
    this.inputs = {
      id: { required: true },
    };
  }

  async runWithinTransaction({ params }) {
    const source = await Source.findById(params.id);
    await source.destroy();
    await ConfigWriter.run();
    return { success: true };
  }
}
