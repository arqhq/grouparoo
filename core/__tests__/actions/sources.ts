import { helper } from "@grouparoo/spec-helper";
import { specHelper } from "actionhero";
import { Option, Source, App } from "../../src";

describe("actions/sources", () => {
  helper.grouparooTestServer({ truncate: true, enableTestPlugin: true });
  let app: App;
  let id: string;
  let propertyId: string;

  beforeAll(async () => {
    await specHelper.runAction("team:initialize", {
      firstName: "Mario",
      lastName: "Mario",
      password: "P@ssw0rd!",
      email: "mario@example.com",
    });

    app = await helper.factories.app();
    await app.update({ name: "test app" });
  });

  describe("administrator signed in", () => {
    let connection;
    let csrfToken;

    beforeAll(async () => {
      connection = await specHelper.buildConnection();
      connection.params = { email: "mario@example.com", password: "P@ssw0rd!" };
      const sessionResponse = await specHelper.runAction(
        "session:create",
        connection
      );
      csrfToken = sessionResponse.csrfToken;
    });

    test("an administrator can create a new source from an app", async () => {
      connection.params = {
        csrfToken,
        name: "test source",
        type: "test-plugin-import",
        appId: app.id,
        options: { table: "users" },
      };
      const { error, source } = await specHelper.runAction(
        "source:create",
        connection
      );
      expect(error).toBeUndefined();
      expect(source.id).toBeTruthy();
      expect(source.app.id).toBe(app.id);
      expect(source.app.name).toBe("test app");
      expect(source.state).toBe("draft");

      id = source.id;
    });

    test("an administrator can list all the sources", async () => {
      connection.params = {
        csrfToken,
      };
      const { error, sources, total } = await specHelper.runAction(
        "sources:list",
        connection
      );
      expect(error).toBeUndefined();
      expect(sources.length).toBe(1);
      expect(sources[0].app.name).toBe("test app");
      expect(total).toBe(1);
    });

    test("a source can be bootstrapped with a property", async () => {
      connection.params = {
        csrfToken,
        id,
        key: "userId",
        type: "integer",
        mappedColumn: "id",
      };
      const { property, error } = await specHelper.runAction(
        "source:bootstrapUniqueProperty",
        connection
      );
      expect(error).toBeUndefined();
      expect(property.id).toBeTruthy();
      propertyId = property.id;
    });

    test("an administrator can list the connection + app pairs available for a new connection", async () => {
      connection.params = {
        csrfToken,
        id,
      };
      const { error, connectionApps } = await specHelper.runAction(
        "sources:connectionApps",
        connection
      );
      expect(error).toBeUndefined();
      expect(connectionApps[0].app.id).toBe(app.id);
      expect(connectionApps[0].connection.app).toBe("test-plugin-app");
    });

    describe("options from environment variables", () => {
      beforeAll(() => {
        process.env.GROUPAROO_OPTION__SOURCE__TEST_OPTION = "abc123";
      });

      test("options for a new source will include the names of options included in environment variables", async () => {
        connection.params = { csrfToken };
        const { environmentVariableOptions } = await specHelper.runAction(
          "sources:connectionApps",
          connection
        );
        expect(environmentVariableOptions).toEqual(["TEST_OPTION"]);
      });

      afterAll(() => {
        process.env.GROUPAROO_OPTION__APP__TEST_OPTION = undefined;
      });
    });

    test("an administrator can enumerate the source connection options", async () => {
      connection.params = {
        csrfToken,
        id,
      };
      const { error, options } = await specHelper.runAction(
        "source:connectionOptions",
        connection
      );
      expect(error).toBeUndefined();
      expect(options).toEqual({ table: { options: ["users"], type: "list" } });
    });

    test("a source with no options will see an empty preview", async () => {
      const options = await Option.findAll({ where: { ownerId: id } });
      for (const option of options) await option.destroy();

      connection.params = {
        csrfToken,
        id,
      };
      const { error, preview } = await specHelper.runAction(
        "source:preview",
        connection
      );
      expect(error).toBeUndefined();
      expect(preview).toEqual([]);
    });

    test("a source can provide options to a preview", async () => {
      connection.params = {
        csrfToken,
        id,
        options: { table: "users" },
      };
      const { error, preview } = await specHelper.runAction(
        "source:preview",
        connection
      );
      expect(error).toBeUndefined();
      expect(preview).toEqual([
        { id: 1, fname: "mario", lname: "mario" },
        { id: 2, fname: "luigi", lname: "mario" },
      ]);
    });

    test("a source can have options set", async () => {
      connection.params = {
        csrfToken,
        id,
        options: { table: "users" },
      };
      const { error, source } = await specHelper.runAction(
        "source:edit",
        connection
      );
      expect(error).toBeUndefined();
      expect(source.options).toEqual({ table: "users" });
    });

    test("a source with options set will return a preview", async () => {
      connection.params = {
        csrfToken,
        id,
      };
      const { error, preview } = await specHelper.runAction(
        "source:preview",
        connection
      );
      expect(error).toBeUndefined();
      expect(preview).toEqual([
        { id: 1, fname: "mario", lname: "mario" },
        { id: 2, fname: "luigi", lname: "mario" },
      ]);
    });

    test("a source can have mapping set", async () => {
      connection.params = {
        csrfToken,
        id,
        mapping: { id: "userId" },
      };
      const { error, source } = await specHelper.runAction(
        "source:edit",
        connection
      );
      expect(error).toBeUndefined();
      expect(source.mapping).toEqual({ id: "userId" });
    });

    test("a source can be made active", async () => {
      connection.params = {
        csrfToken,
        id,
        state: "ready",
      };
      const { error, source } = await specHelper.runAction(
        "source:edit",
        connection
      );
      expect(error).toBeUndefined();
      expect(source.state).toBe("ready");
    });

    test("an administrator can view a source", async () => {
      connection.params = {
        csrfToken,
        id,
      };
      const { error, source } = await specHelper.runAction(
        "source:view",
        connection
      );

      expect(error).toBeUndefined();
      expect(source.id).toBeTruthy();
      expect(source.app.name).toBe("test app");
    });

    test("an administrator can destroy a source", async () => {
      connection.params = {
        csrfToken,
        id,
        mapping: {},
      };
      const editResponse = await specHelper.runAction(
        "source:edit",
        connection
      );
      expect(editResponse.error).toBeUndefined();

      connection.params = {
        csrfToken,
        id: propertyId,
      };
      const deleteRuleResponse = await specHelper.runAction(
        "property:destroy",
        connection
      );
      expect(deleteRuleResponse.error).toBeUndefined();

      connection.params = {
        csrfToken,
        id,
      };
      const destroyResponse = await specHelper.runAction(
        "source:destroy",
        connection
      );
      expect(destroyResponse.error).toBeUndefined();
      expect(destroyResponse.success).toBe(true);

      const count = await Source.count();
      expect(count).toBe(0);
    });
  });
});
