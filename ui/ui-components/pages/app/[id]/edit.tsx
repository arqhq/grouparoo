import Head from "next/head";
import { useState } from "react";
import { useApi } from "../../../hooks/useApi";
import { Row, Col, Form, Badge, Alert } from "react-bootstrap";
import { Typeahead } from "react-bootstrap-typeahead";
import { useRouter } from "next/router";
import PageHeader from "../../../components/pageHeader";
import StateBadge from "../../../components/badges/stateBadge";
import SourceBadge from "../../../components/badges/sourceBadge";
import DestinationBadge from "../../../components/badges/destinationBadge";
import AppTabs from "../../../components/tabs/app";
import Loader from "../../../components/loader";
import LoadingButton from "../../../components/loadingButton";
import LockedBadge from "../../../components/badges/lockedBadge";

import { Actions, Models } from "../../../utils/apiData";
import { ErrorHandler } from "../../../utils/errorHandler";
import { SuccessHandler } from "../../../utils/successHandler";
import { AppHandler } from "../../../utils/appHandler";

export default function Page(props) {
  const {
    errorHandler,
    successHandler,
    appHandler,
    types,
    environmentVariableOptions,
    optionOptions,
  }: {
    errorHandler: ErrorHandler;
    successHandler: SuccessHandler;
    appHandler: AppHandler;
    types: Actions.AppOptions["types"];
    environmentVariableOptions: Actions.AppOptions["environmentVariableOptions"];
    optionOptions: Actions.AppOptionOptions["options"];
  } = props;
  const router = useRouter();
  const { execApi } = useApi(props, errorHandler);
  const [app, setApp] = useState<Models.AppType>(props.app);
  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    error: string;
    message: string;
  }>({ success: null, error: null, message: null });
  const [ranTest, setRanTest] = useState(false);
  const { id } = router.query;

  async function edit(event) {
    event.preventDefault();
    const state = app.state === "ready" ? undefined : "ready";
    setLoading(true);
    const response: Actions.AppEdit = await execApi(
      "put",
      `/app/${id}`,
      Object.assign({}, app, { state })
    );
    if (response?.app) {
      if (response.app.state === "ready" && app.state === "draft") {
        router.push("/apps");
      } else {
        setLoading(false);
        successHandler.set({ message: "App Updated" });
        setApp(response.app);
        appHandler.set(response.app);
      }
    } else {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (window.confirm("are you sure?")) {
      setLoading(true);
      const response: Actions.AppDestroy = await execApi(
        "delete",
        `/app/${id}`
      );
      if (response?.success) {
        successHandler.set({ message: "App Deleted" });
        router.push("/apps");
      } else {
        setLoading(false);
      }
    }
  }

  async function test() {
    setTestLoading(true);
    setRanTest(false);
    setTestResult({ success: null, message: null, error: null });
    const response: Actions.AppTest = await execApi("put", `/app/${id}/test`, {
      options: app.options,
    });
    if (response?.test) {
      setRanTest(true);
      setTestResult(response.test);
    }
    setTestLoading(false);
  }

  let typeOptions = [];
  types.forEach((type) => {
    if (app.type === type.name) {
      typeOptions = type.options;
    }
  });

  const update = async (event) => {
    const _app = Object.assign({}, app);
    _app[event.target.id] = event.target.value;
    setApp(_app);
  };

  const updateOption = async (optKey, optValue) => {
    const _app = Object.assign({}, app);
    _app.options[optKey] = optValue;
    setApp(_app);
  };

  return (
    <>
      <Head>
        <title>Grouparoo: {app.name || `Draft`}</title>
      </Head>

      <AppTabs app={app} />

      <PageHeader
        icon={app.icon}
        title={app.name}
        badges={[
          <SourceBadge object={app} />,
          <DestinationBadge object={app} />,
          <LockedBadge object={app} />,
          <StateBadge state={app.state} />,
        ]}
      />

      <Row>
        <Col>
          <Form id="form" onSubmit={edit} autoComplete="off">
            <fieldset disabled={app.locked !== null}>
              <Form.Group controlId="name">
                <Form.Label>Name</Form.Label>
                <Form.Control
                  required
                  type="text"
                  placeholder="Name"
                  value={app.name}
                  disabled={loading}
                  onChange={(e) => update(e)}
                />
                <Form.Control.Feedback type="invalid">
                  Name is required
                </Form.Control.Feedback>
              </Form.Group>

              <Form.Group controlId="type">
                <Form.Label>Type</Form.Label>
                <Form.Control
                  as="select"
                  value={app.type}
                  onChange={(e) => update(e)}
                  disabled
                >
                  {types.map((type) => (
                    <option key={`type-${type.name}`}>{type.name}</option>
                  ))}
                </Form.Control>
              </Form.Group>

              {typeOptions.length > 0 ? (
                <>
                  <div className="mb-3">
                    <hr />
                    <p className="mb-3">
                      <strong>Options for a {app.type} app</strong>
                    </p>

                    {environmentVariableOptions.length > 0 && (
                      <p className="mb-0">
                        Available environment variables for apps:{" "}
                        {environmentVariableOptions.sort().map((envOpt) => (
                          <Badge key={`envOpt-${envOpt}`} variant="info">
                            {envOpt}
                          </Badge>
                        ))}
                      </p>
                    )}
                    {process.env.GROUPAROO_UI_EDITION === "config" && (
                      <p className="mb-0">
                        <a
                          target="_blank"
                          href="https://www.grouparoo.com/docs/support/secrets"
                        >
                          See the docs
                        </a>{" "}
                        for more information on using environment variables for
                        secret option values.
                      </p>
                    )}
                  </div>

                  {typeOptions.map((opt) => {
                    return (
                      <Form.Group key={`opt-${opt.key}`} controlId={opt.key}>
                        <Form.Label>
                          {opt.required ? (
                            <>
                              <Badge variant="info">required</Badge>&nbsp;
                            </>
                          ) : null}
                          <code>{opt.displayName || opt.key}</code>
                        </Form.Label>
                        {(() => {
                          if (optionOptions[opt.key]?.type === "typeahead") {
                            return (
                              <>
                                <Typeahead
                                  id="typeahead"
                                  labelKey="key"
                                  disabled={loading}
                                  onChange={(selected) => {
                                    updateOption(opt.key, selected[0]?.key);
                                  }}
                                  options={optionOptions[opt.key]?.options.map(
                                    (k, idx) => {
                                      return {
                                        key: k,
                                        descriptions:
                                          optionOptions[k]?.descriptions[idx],
                                      };
                                    }
                                  )}
                                  placeholder={
                                    opt.placeholder || `Select ${opt.key}`
                                  }
                                  renderMenuItemChildren={(opt, props, idx) => {
                                    return [
                                      <span key={`opt-${idx}-key`}>
                                        {opt.key}
                                        <br />
                                      </span>,
                                      <small
                                        key={`opt-${idx}-descriptions`}
                                        className="text-small"
                                      >
                                        <em>
                                          Descriptions:{" "}
                                          {opt.descriptions
                                            ? opt.descriptions.join(", ")
                                            : "None"}
                                        </em>
                                      </small>,
                                    ];
                                  }}
                                  defaultSelected={
                                    app.options[opt.key]
                                      ? [app.options[opt.key]]
                                      : undefined
                                  }
                                />
                                <Form.Text className="text-muted">
                                  {opt.description}
                                </Form.Text>
                              </>
                            );
                          } else if (optionOptions[opt.key]?.type === "list") {
                            return (
                              <>
                                <Form.Control
                                  as="select"
                                  required={opt.required}
                                  defaultValue={
                                    app.options[opt.key]?.toString() || ""
                                  }
                                  disabled={loading}
                                  onChange={(e) => {
                                    updateOption(e.target.id, e.target.value);
                                  }}
                                >
                                  <option value={""} disabled>
                                    Select an option
                                  </option>
                                  {optionOptions[opt.key].options.map(
                                    (o, idx) => (
                                      <option
                                        key={`opt~${opt.key}-${o}`}
                                        value={o}
                                      >
                                        {o}{" "}
                                        {optionOptions[opt.key]?.descriptions &&
                                        optionOptions[opt.key]?.descriptions[
                                          idx
                                        ]
                                          ? ` | ${
                                              optionOptions[opt.key]
                                                ?.descriptions[idx]
                                            }`
                                          : null}
                                      </option>
                                    )
                                  )}
                                </Form.Control>
                                <Form.Text className="text-muted">
                                  {opt.description}
                                </Form.Text>
                              </>
                            );
                          } else {
                            return (
                              <>
                                <Form.Control
                                  required={opt.required}
                                  type={
                                    optionOptions[opt.key]?.type === "password"
                                      ? "password"
                                      : "text"
                                  }
                                  disabled={loading}
                                  defaultValue={app.options[
                                    opt.key
                                  ]?.toString()}
                                  placeholder={opt.placeholder}
                                  onChange={(e) => {
                                    updateOption(e.target.id, e.target.value);
                                  }}
                                />
                                <Form.Text className="text-muted">
                                  {opt.description}
                                </Form.Text>
                              </>
                            );
                          }
                        })()}
                      </Form.Group>
                    );
                  })}
                </>
              ) : null}
            </fieldset>

            <Row>
              <Col md={3}>
                <LoadingButton
                  variant="outline-secondary"
                  size="sm"
                  onClick={test}
                  disabled={testLoading}
                >
                  Test Connection
                </LoadingButton>
                <br />
                <br />
              </Col>

              <Col>
                {testResult.success !== null &&
                testResult.success !== false &&
                testResult.success !== undefined &&
                !testResult.error ? (
                  <Alert variant="success">
                    <strong>Test Passed</strong> {testResult.message}
                  </Alert>
                ) : ranTest ? (
                  <Alert variant="warning">
                    <strong>Test Failed</strong> {testResult.error}
                  </Alert>
                ) : null}
                {loading ? <Loader /> : null}
              </Col>
            </Row>

            <fieldset disabled={app.locked !== null}>
              <LoadingButton variant="primary" type="submit" disabled={loading}>
                Update
              </LoadingButton>

              <br />
              <br />

              <LoadingButton
                variant="danger"
                size="sm"
                onClick={handleDelete}
                disabled={loading}
              >
                Delete
              </LoadingButton>
            </fieldset>
          </Form>
        </Col>
      </Row>
    </>
  );
}

Page.getInitialProps = async (ctx) => {
  const { id } = ctx.query;
  const { execApi } = useApi(ctx);
  const { app } = await execApi("get", `/app/${id}`);
  const { types, environmentVariableOptions } = await execApi(
    "get",
    `/appOptions`
  );
  const { options } = await execApi("get", `/app/${id}/optionOptions`);
  return { app, types, environmentVariableOptions, optionOptions: options };
};
