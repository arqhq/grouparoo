import { useEffect, useState } from "react";
import { useApi } from "../../../hooks/useApi";
import { Row, Col, Form, Badge, Alert } from "react-bootstrap";
import { Typeahead } from "react-bootstrap-typeahead";
import { useRouter } from "next/router";
import Link from "next/link";
import Head from "next/head";
import PageHeader from "../../../components/pageHeader";
import StateBadge from "../../../components/badges/stateBadge";
import LockedBadge from "../../../components/badges/lockedBadge";
import DestinationTabs from "../../../components/tabs/destination";
import LoadingButton from "../../../components/loadingButton";
import Loader from "../../../components/loader";
import { Models, Actions } from "../../../utils/apiData";
import { ErrorHandler } from "../../../utils/errorHandler";
import { SuccessHandler } from "../../../utils/successHandler";
import { DestinationHandler } from "../../../utils/destinationHandler";

export default function Page(props) {
  const {
    errorHandler,
    successHandler,
    destinationHandler,
    environmentVariableOptions,
  }: {
    errorHandler: ErrorHandler;
    successHandler: SuccessHandler;
    destinationHandler: DestinationHandler;
    environmentVariableOptions: Actions.AppOptions["environmentVariableOptions"];
  } = props;
  const router = useRouter();
  const { execApi } = useApi(props, errorHandler);
  const [destination, setDestination] = useState<Models.DestinationType>(
    props.destination
  );
  const [loading, setLoading] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [connectionOptions, setConnectionOptions] = useState({});
  const { id } = router.query;

  useEffect(() => {
    loadOptions();
    props.destinationHandler.subscribe("destination-edit", (_destination) => {
      setDestination(_destination);
    });

    return () => {
      props.destinationHandler.unsubscribe("destination-edit");
    };
  }, []);

  const onSubmit = async (event) => {
    event.preventDefault();
    delete destination["mapping"];
    delete destination["destinationGroupMemberships"];
    delete destination["groups"];

    setLoading(true);
    const response: Actions.DestinationEdit = await execApi(
      "put",
      `/destination/${id}`,
      Object.assign({}, destination, { state: "ready" })
    );
    if (response?.destination) {
      setDestination(response.destination);
      destinationHandler.set(response.destination);
      if (
        response.destination.state === "ready" &&
        destination.state === "draft"
      ) {
        router.push(
          `/destination/[id]/data`,
          `/destination/${destination.id}/data`
        );
      } else {
        setLoading(false);
        successHandler.set({ message: "Destination updated" });
      }
    } else {
      setLoading(false);
    }
  };

  async function loadOptions() {
    setLoadingOptions(true);
    const response: Actions.DestinationConnectionOptions = await execApi(
      "get",
      `/destination/${id}/connectionOptions`,
      { options: destination.options },
      null,
      null,
      false
    );
    if (response?.options) setConnectionOptions(response.options);
    setLoadingOptions(false);
  }

  async function handleDelete(force = false) {
    if (window.confirm("are you sure?")) {
      setLoading(true);
      const { success }: Actions.DestinationDestroy = await execApi(
        "delete",
        `/destination/${id}`,
        { force }
      );
      if (success) {
        router.push("/destinations");
      } else {
        setLoading(false);
      }
    }
  }

  const update = async (event) => {
    const _destination = Object.assign({}, destination);
    _destination[event.target.id] =
      event.target.type === "checkbox"
        ? event.target.checked
        : event.target.value;
    setDestination(_destination);
    if (event.target.id !== "name") setTimeout(loadOptions, 100);
  };

  const updateOption = async (optKey, optValue) => {
    const _destination = Object.assign({}, destination);
    _destination.options[optKey] = optValue;
    setDestination(_destination);
    setTimeout(loadOptions, 100);
  };

  return (
    <>
      <Head>
        <title>Grouparoo: {destination.name}</title>
      </Head>

      <DestinationTabs destination={destination} />

      <PageHeader
        icon={destination.app.icon}
        title={destination.name}
        badges={[
          <LockedBadge object={destination} />,
          <StateBadge state={destination.state} />,
        ]}
      />

      <Row>
        <Col>
          <Form id="form" onSubmit={onSubmit} autoComplete="off">
            <fieldset disabled={destination.locked !== null}>
              <Form.Group controlId="name">
                <Form.Label>Name</Form.Label>
                <Form.Control
                  required
                  type="text"
                  placeholder="Destination Name"
                  disabled={loading}
                  defaultValue={destination.name}
                  onChange={(e) => update(e)}
                />
                <Form.Control.Feedback type="invalid">
                  Name is required
                </Form.Control.Feedback>
              </Form.Group>

              {destination.syncModes.length > 0 ? (
                <Form.Group controlId="syncMode">
                  <Form.Label>Sync Mode</Form.Label>
                  <Form.Control
                    as="select"
                    required={true}
                    disabled={loading}
                    defaultValue={destination.syncMode?.toString() || ""}
                    onChange={(e) => update(e)}
                  >
                    <option value={""} disabled>
                      Select an option
                    </option>
                    {destination.syncModes.map((mode) => (
                      <option key={mode.key} value={mode.key}>
                        {mode.displayName} | {mode.description}
                      </option>
                    ))}
                  </Form.Control>
                  <Form.Text className="text-muted">
                    How should this destination sync profiles?
                  </Form.Text>
                </Form.Group>
              ) : null}

              <p>
                <strong>App</strong>:{" "}
                <Link href="/app/[id]" as={`/app/${destination.app.id}`}>
                  <a>{destination.app.name}</a>
                </Link>
                <br />
                <strong>Connection</strong>: {destination.connection.name}:{" "}
                {destination.connection.description}
              </p>

              <hr />
              <strong>Options for a {destination.type} destination</strong>
              <br />
              <br />

              {loadingOptions ? (
                <Alert variant="warning">
                  <Loader size="sm" /> Loading options from{" "}
                  {destination.app.type}
                </Alert>
              ) : null}

              {Object.keys(destination.connection.options).length === 0 ? (
                <p>No options for this type of destination</p>
              ) : null}

              {destination.connection.options.map((opt) => {
                return (
                  <Form.Group
                    key={`group-${opt.key}`}
                    controlId={`_opt~${opt.key}`}
                  >
                    <Form.Label>
                      {opt.required ? (
                        <>
                          <Badge variant="info">required</Badge>&nbsp;
                        </>
                      ) : null}
                      <code>{opt.displayName || opt.key}</code>
                    </Form.Label>
                    {(() => {
                      if (connectionOptions[opt.key]?.type === "typeahead") {
                        return (
                          <>
                            <Typeahead
                              id="typeahead"
                              labelKey="key"
                              disabled={loading || loadingOptions}
                              onChange={(selected) => {
                                updateOption(opt.key, selected[0]?.key);
                              }}
                              options={connectionOptions[opt.key]?.options.map(
                                (k, idx) => {
                                  return {
                                    key: k,
                                    descriptions:
                                      connectionOptions[k]?.descriptions[idx],
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
                                    {opt.descriptions ? (
                                      <em>
                                        Descriptions:{" "}
                                        {opt.descriptions.join(", ")}
                                      </em>
                                    ) : null}
                                  </small>,
                                ];
                              }}
                              defaultSelected={
                                destination.options[opt.key]
                                  ? [destination.options[opt.key]]
                                  : undefined
                              }
                            />
                            <Form.Text className="text-muted">
                              {opt.description}
                            </Form.Text>
                          </>
                        );
                      } else if (connectionOptions[opt.key]?.type === "list") {
                        return (
                          <>
                            <Form.Control
                              as="select"
                              required={opt.required}
                              disabled={loading || loadingOptions}
                              defaultValue={
                                destination.options[opt.key]?.toString() || ""
                              }
                              onChange={(e) =>
                                updateOption(
                                  e.target.id.replace("_opt~", ""),
                                  e.target.value
                                )
                              }
                            >
                              <option value={""} disabled>
                                Select an option
                              </option>
                              {connectionOptions[opt.key].options.map(
                                (o, idx) => (
                                  <option key={`opt~${opt.key}-${o}`} value={o}>
                                    {o}{" "}
                                    {connectionOptions[opt.key]?.descriptions &&
                                    connectionOptions[opt.key]?.descriptions[
                                      idx
                                    ]
                                      ? ` | ${
                                          connectionOptions[opt.key]
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
                      } else if (
                        connectionOptions[opt.key]?.type === "pending"
                      ) {
                        return (
                          <>
                            <Form.Control
                              size="sm"
                              disabled
                              type="text"
                              value="pending another selection"
                            ></Form.Control>
                          </>
                        );
                      } else {
                        return (
                          <>
                            <Form.Control
                              required={opt.required}
                              type={
                                connectionOptions[opt.key]?.type === "password"
                                  ? "password"
                                  : "text"
                              }
                              disabled={loading || loadingOptions}
                              defaultValue={destination.options[
                                opt.key
                              ]?.toString()}
                              placeholder={opt.placeholder}
                              onChange={(e) =>
                                updateOption(
                                  e.target.id.replace("_opt~", ""),
                                  e.target.value
                                )
                              }
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

              {environmentVariableOptions.length > 0 ? (
                <Row>
                  <Col>
                    <p>
                      Environment Variable Options for Destinations:{" "}
                      {environmentVariableOptions.sort().map((envOpt) => (
                        <Badge key={`envOpt-${envOpt}`} variant="info">
                          {envOpt}
                        </Badge>
                      ))}
                    </p>
                    <br />
                  </Col>
                </Row>
              ) : null}

              <br />

              <LoadingButton variant="primary" type="submit" disabled={loading}>
                Update
              </LoadingButton>

              <br />
              <br />

              <LoadingButton
                variant="danger"
                size="sm"
                disabled={loading}
                onClick={() => {
                  handleDelete(process.env.GROUPAROO_UI_EDITION === "config");
                }}
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
  const { execApi } = useApi(ctx);
  const { id } = ctx.query;
  const { destination } = await execApi("get", `/destination/${id}`);
  const { environmentVariableOptions } = await execApi(
    "get",
    "/destinations/connectionApps"
  );

  return {
    destination,
    environmentVariableOptions,
  };
};
