import { useState, useEffect, Fragment } from "react";
import { useApi } from "../../../hooks/useApi";
import { Row, Col, Form, Table, Badge, Button } from "react-bootstrap";
import { useRouter } from "next/router";
import Link from "next/link";
import Loader from "../../../components/loader";
import PageHeader from "../../../components/pageHeader";
import StateBadge from "../../../components/badges/stateBadge";
import LockedBadge from "../../../components/badges/lockedBadge";
import ProfilePreview from "../../../components/property/profilePreview";
import { Typeahead } from "react-bootstrap-typeahead";
import DatePicker from "../../../components/datePicker";
import LoadingButton from "../../../components/loadingButton";
import Head from "next/head";
import PropertyTabs from "../../../components/tabs/property";
import { Models, Actions } from "../../../utils/apiData";
import { filtersAreEqual } from "../../../utils/filtersAreEqual";
import { makeLocal } from "../../../utils/makeLocal";
import { ErrorHandler } from "../../../utils/errorHandler";
import { SuccessHandler } from "../../../utils/successHandler";
import { PropertiesHandler } from "../../../utils/propertiesHandler";

export default function Page(props) {
  const {
    errorHandler,
    successHandler,
    sources,
    propertiesHandler,
    types,
    filterOptions,
    properties,
    hydrationError,
  }: {
    errorHandler: ErrorHandler;
    successHandler: SuccessHandler;
    sources: Models.SourceType[];
    propertiesHandler: PropertiesHandler;
    types: Actions.AppOptions["types"];
    filterOptions: Actions.ScheduleFilterOptions["options"];
    properties: Models.PropertyType[];
    hydrationError: Error;
  } = props;
  const router = useRouter();
  const { execApi } = useApi(props, errorHandler);
  const [pluginOptions, setPluginOptions] = useState<
    Actions.PropertyPluginOptions["pluginOptions"]
  >(props.pluginOptions);
  const [loading, setLoading] = useState(false);
  const [nextPage] = useState(router.query.nextPage?.toString()); // we want to store this when the page was initially loaded because we'll be updating the route for the profilePreview
  const [property, setProperty] = useState<Models.PropertyType>(props.property);
  const [localFilters, setLocalFilters] = useState<
    Actions.PropertyView["property"]["filters"]
  >(makeLocal(props.property.filters));

  const [debounceCounter, setDebounceCounter] = useState(0);
  const sleep = debounceCounter === 0 ? 0 : 1000; // we only want to make one request every ~second, so wait for more input
  let timer;

  const { id } = router.query;
  const source = sources.find((s) => s.id === property.sourceId);

  if (hydrationError) errorHandler.set({ error: hydrationError });

  useEffect(() => {
    newRuleDefaults();
  }, []);

  useEffect(() => {
    updatePluginOptions();

    return () => {
      clearTimeout(timer);
    };
  }, [JSON.stringify(property.options)]);

  async function onSubmit(event) {
    event.preventDefault();
    setLoading(true);
    const response: Actions.PropertyEdit = await execApi(
      "put",
      `/property/${id}`,
      Object.assign({}, property, { filters: localFilters, state: "ready" })
    );
    if (response?.property) {
      setProperty(response.property);
      propertiesHandler.set([response.property]);
      if (response.property.state === "ready" && property.state === "draft") {
        successHandler.set({ message: "Property Created" });
        router.push(nextPage || "/properties");
      } else {
        setLoading(false);
        successHandler.set({ message: "Property Updated" });
      }
    } else {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (
      window.confirm(
        "Are you sure?  This will also delete all profile properties with this key"
      )
    ) {
      setLoading(true);
      const { success }: Actions.PropertyDestroy = await execApi(
        "delete",
        `/property/${id}`
      );
      setLoading(false);
      if (success) {
        successHandler.set({ message: "Property Deleted" });
        router.push(nextPage || "/properties");
      }
    }
  }

  async function updatePluginOptions() {
    // setLoading(true); // Do not set loading as we don't want to block the form mid-typing on a string field
    setDebounceCounter(debounceCounter + 1);

    timer = setTimeout(async () => {
      const pluginOptionsResponse: Actions.PropertyPluginOptions =
        await execApi("get", `/property/${id}/pluginOptions`, {
          options: property.options,
        });
      // setLoading(false);
      if (
        pluginOptionsResponse &&
        JSON.stringify(pluginOptionsResponse.pluginOptions) !==
          JSON.stringify(pluginOptions)
      ) {
        setPluginOptions(pluginOptionsResponse.pluginOptions);
      }
    }, sleep);
  }

  function newRuleDefaults() {
    if (property.state === "draft" && property.key === "") {
      const _property = Object.assign({}, property);

      // make the user explicitly choose a type
      //@ts-ignore
      _property.type = "";

      setProperty(_property);
    }
  }

  const update = async (event) => {
    const _property = Object.assign({}, property);
    _property[event.target.id] =
      event.target.type === "checkbox"
        ? event.target.checked
        : event.target.value;
    setProperty(_property);
  };

  function updateOption(key, value) {
    const _property = Object.assign({}, property);
    _property.options[key] = value;
    setProperty(_property);
  }

  function addRule() {
    const ruleLimit = 10;

    const _localFilters = [...localFilters];
    if (_localFilters.length >= ruleLimit) {
      alert(`only ${ruleLimit} rules allowed`);
      return;
    }

    _localFilters.push({
      key: filterOptions[0].key,
      op: filterOptions[0].ops[0],
      match: "",
    });

    setLocalFilters(_localFilters);
  }

  function deleteRule(idx: number) {
    const _localFilters = [...localFilters];
    _localFilters.splice(idx, 1);
    setLocalFilters(_localFilters);
  }

  if (property.id === "") {
    return <Loader />;
  }

  let rowChanges = false;

  return (
    <>
      <Head>
        <title>Grouparoo: {property.key}</title>
      </Head>

      <PropertyTabs property={property} source={source} />

      <PageHeader
        icon={source.app.icon}
        title={property.key}
        badges={[
          <LockedBadge object={property} />,
          <StateBadge state={property.state} />,
        ]}
      />

      <Form id="form" onSubmit={onSubmit} autoComplete="off">
        <fieldset disabled={property.locked !== null}>
          <Row>
            <Col>
              <Form.Group controlId="key">
                <p>
                  <strong>Source</strong>:{" "}
                  <Link
                    href="/source/[id]/overview"
                    as={`/source/${source.id}/overview`}
                  >
                    <a>{source.name}</a>
                  </Link>
                </p>

                <hr />

                <Form.Label>Key</Form.Label>
                <Form.Control
                  required
                  type="text"
                  disabled={loading}
                  value={property.key}
                  onChange={(e) => update(e)}
                />
                <Form.Control.Feedback type="invalid">
                  Key is required
                </Form.Control.Feedback>
              </Form.Group>
              <Form.Group controlId="type">
                <Form.Label>Profile Property Type</Form.Label>
                <Form.Control
                  required
                  as="select"
                  value={property.type}
                  onChange={(e) => update(e)}
                  disabled={loading}
                >
                  <option value="" disabled>
                    Choose a Type
                  </option>
                  {types.map((type) => (
                    <option key={`type-${type}`}>{type}</option>
                  ))}
                </Form.Control>
              </Form.Group>
              <Form.Group controlId="unique">
                <Form.Check
                  type="checkbox"
                  label="Unique"
                  checked={property.unique}
                  onChange={(e) => update(e)}
                  disabled={loading}
                />
              </Form.Group>
              <Form.Group controlId="isArray">
                <Form.Check
                  type="checkbox"
                  label="Is Array?"
                  checked={property.isArray}
                  onChange={(e) => update(e)}
                  disabled={loading}
                />
              </Form.Group>
              <Form.Group controlId="sourceId">
                <Form.Label>Property Source</Form.Label>
                <Form.Control as="select" disabled value={source.id}>
                  <option value={source.id}>{source.name}</option>
                </Form.Control>
              </Form.Group>
              <hr />
              <p>
                <strong>Options for a {source.type} Property</strong>
              </p>
              {pluginOptions.map((opt, idx) => (
                <div key={`opt-${idx}`}>
                  <p>
                    {opt.required ? (
                      <>
                        <Badge variant="info">required</Badge>&nbsp;
                      </>
                    ) : null}
                    <code>{opt.displayName || opt.key}</code>
                  </p>

                  {/* typeahead options */}
                  {opt.type === "typeahead" ? (
                    <>
                      <Typeahead
                        id="typeahead"
                        labelKey="key"
                        disabled={loading}
                        onChange={(selected) => {
                          if (selected.length === 1 && selected[0].key) {
                            updateOption(opt.key, selected[0].key);
                          }
                        }}
                        options={opt?.options}
                        placeholder={`Select ${opt.key}`}
                        renderMenuItemChildren={(opt, props, idx) => {
                          return [
                            <span key={`opt-${idx}-key`}>
                              {opt.key}
                              <br />
                            </span>,
                            <small
                              key={`opt-${idx}-examples`}
                              className="text-small"
                            >
                              <em>
                                Examples:{" "}
                                {opt.examples
                                  ? opt.examples.slice(0, 3).join("").trim() !==
                                    ""
                                    ? opt.examples.slice(0, 3).join(", ")
                                    : "None"
                                  : null}
                              </em>
                            </small>,
                          ];
                        }}
                        defaultSelected={
                          property.options[opt?.key]
                            ? [property.options[opt?.key]]
                            : undefined
                        }
                      />
                      <Form.Text className="text-muted">
                        {opt.description}
                      </Form.Text>
                      <br />
                    </>
                  ) : null}

                  {/* list options */}
                  {opt.type === "list" ? (
                    <>
                      <Form.Text className="text-muted">
                        {opt.description}
                      </Form.Text>
                      <Table bordered striped size="sm" variant="light">
                        <thead>
                          <tr>
                            <th></th>
                            <th>Key</th>
                            {opt?.options[0]?.description ? (
                              <th>Description</th>
                            ) : null}
                            {opt?.options[0]?.examples ? (
                              <th>Examples</th>
                            ) : null}
                          </tr>
                        </thead>
                        <tbody>
                          {opt?.options?.map((col) => (
                            <tr key={`source-${col.key}`}>
                              <td>
                                <Form.Check
                                  inline
                                  type="radio"
                                  name={opt.key}
                                  disabled={loading}
                                  defaultChecked={
                                    property.options[opt.key] === col.key
                                  }
                                  onClick={() => updateOption(opt.key, col.key)}
                                />
                              </td>
                              <td>
                                <strong>{col.key}</strong>
                              </td>
                              {col.description ? (
                                <td>{col.description}</td>
                              ) : null}

                              {col.examples ? (
                                <td>{col.examples.slice(0, 3).join(", ")}</td>
                              ) : null}
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </>
                  ) : null}

                  {/* textarea options */}
                  {opt.type === "text" ? (
                    <>
                      <Form.Group controlId="key">
                        <Form.Control
                          required
                          disabled={loading}
                          type="text"
                          value={property.options[opt.key]?.toString()}
                          onChange={(e) =>
                            updateOption(opt.key, e.target.value)
                          }
                        />
                        <Form.Control.Feedback type="invalid">
                          Key is required
                        </Form.Control.Feedback>
                      </Form.Group>
                      <Form.Text className="text-muted">
                        {opt.description}
                      </Form.Text>
                    </>
                  ) : null}

                  {/* text options */}
                  {opt.type === "textarea" ? (
                    <>
                      <Form.Group controlId="key">
                        <Form.Control
                          required
                          as="textarea"
                          disabled={loading}
                          rows={5}
                          value={property.options[opt.key]?.toString()}
                          onChange={(e) =>
                            updateOption(opt.key, e.target["value"])
                          }
                          placeholder="select statement with mustache template"
                          style={{
                            fontFamily:
                              'SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                            color: "#e83e8c",
                          }}
                        />
                        <Form.Control.Feedback type="invalid">
                          Key is required
                        </Form.Control.Feedback>
                      </Form.Group>
                      <Form.Text className="text-muted">
                        {opt.description}
                      </Form.Text>
                      <p>
                        Profile Property Variables:{" "}
                        <Badge variant="light">{`{{ now }}`}</Badge>
                        &nbsp;
                        <Badge variant="light">{`{{ createdAt }}`}</Badge>&nbsp;
                        <Badge variant="light">{`{{ updatedAt }}`}</Badge>&nbsp;
                        {properties
                          .filter((rule) => rule.isArray === false)
                          .sort((a, b) => {
                            if (a.key > b.key) {
                              return 1;
                            } else {
                              return -1;
                            }
                          })
                          .map((ppr) => (
                            <Fragment key={`var-badge-${ppr.key}`}>
                              <Badge variant="light">{`{{ ${ppr.key} }}`}</Badge>
                              &nbsp;
                            </Fragment>
                          ))}
                      </p>
                      <p>
                        For dates, you can expand them to the <code>sql</code>,{" "}
                        <code>date</code>, <code>time</code>, or{" "}
                        <code>iso</code> formats, ie:{" "}
                        <Badge variant="light">{`{{ now.sql }}`}</Badge>
                      </p>
                    </>
                  ) : null}
                </div>
              ))}
              {filterOptions.length > 0 ? (
                <>
                  <hr />
                  <strong>Filters</strong>
                  <p>
                    Are there any criteria where you’d want to filter out rows
                    from being included in{" "}
                    <Badge variant="info">{property.key}</Badge>?
                  </p>

                  <Table bordered size="sm">
                    <thead>
                      <tr>
                        <td />
                        <td>
                          <strong>Key</strong>
                        </td>
                        <td>
                          <strong>Operation</strong>
                        </td>
                        <td>
                          <strong>Value</strong>
                        </td>
                        <td>&nbsp;</td>
                      </tr>
                    </thead>

                    <tbody>
                      {localFilters.map((localFilter, idx) => {
                        let rowChanged = false;
                        if (
                          !filtersAreEqual(
                            property.filters[idx],
                            localFilters[idx]
                          )
                        ) {
                          rowChanged = true;
                          rowChanges = true;
                        }

                        return (
                          <tr key={`rule-${localFilter.key}-${idx}`}>
                            <td>
                              <h5>
                                <Badge
                                  variant={rowChanged ? "warning" : "light"}
                                >
                                  {idx}
                                </Badge>
                              </h5>
                            </td>
                            <td>
                              <Form.Group
                                controlId={`${localFilter.key}-key-${idx}`}
                              >
                                <Form.Control
                                  as="select"
                                  value={localFilter.key}
                                  disabled={loading}
                                  onChange={(e: any) => {
                                    const _localFilters = [...localFilters];
                                    localFilter.key = e.target.value;
                                    _localFilters[idx] = localFilter;
                                    setLocalFilters(_localFilters);
                                  }}
                                >
                                  {filterOptions.map((filter) => (
                                    <option
                                      key={`ruleKeyOpt-${filter.key}-${idx}`}
                                    >
                                      {filter.key}
                                    </option>
                                  ))}
                                </Form.Control>
                              </Form.Group>
                            </td>

                            <td>
                              <Form.Group
                                controlId={`${localFilter.key}-op-${idx}`}
                              >
                                <Form.Control
                                  as="select"
                                  disabled={loading}
                                  value={localFilter.op}
                                  onChange={(e: any) => {
                                    const _localFilters = [...localFilters];
                                    localFilter.op = e.target.value;
                                    _localFilters[idx] = localFilter;
                                    setLocalFilters(_localFilters);
                                  }}
                                >
                                  {filterOptions.filter(
                                    (fo) => fo.key === localFilter.key
                                  ).length === 1
                                    ? filterOptions
                                        .filter(
                                          (fo) => fo.key === localFilter.key
                                        )[0]
                                        .ops.map((op) => (
                                          <option
                                            key={`op-opt-${localFilter.key}-${op}`}
                                          >
                                            {op}
                                          </option>
                                        ))
                                    : null}
                                </Form.Control>
                              </Form.Group>
                            </td>

                            <td>
                              {localFilter.key === "occurredAt" ? (
                                <DatePicker
                                  selected={
                                    localFilter.match &&
                                    localFilter.match !== "null"
                                      ? new Date(
                                          parseInt(localFilter.match.toString())
                                        )
                                      : new Date()
                                  }
                                  onChange={(d: Date) => {
                                    const _localFilter = [...localFilters];
                                    localFilter.match = d.getTime().toString();
                                    _localFilter[idx] = localFilter;
                                    setLocalFilters(_localFilter);
                                  }}
                                />
                              ) : (
                                <Form.Group
                                  controlId={`${localFilter.key}-match-${idx}`}
                                >
                                  <Form.Control
                                    required
                                    type="text"
                                    disabled={loading}
                                    value={localFilter.match.toString()}
                                    onChange={(e: any) => {
                                      const _localFilter = [...localFilters];
                                      localFilter.match = e.target.value;
                                      _localFilter[idx] = localFilter;
                                      setLocalFilters(_localFilter);
                                    }}
                                  />
                                </Form.Group>
                              )}
                            </td>

                            <td>
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => {
                                  deleteRule(idx);
                                }}
                              >
                                x
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Table>
                  {localFilters.length < property.filters.length ||
                  rowChanges ? (
                    <p>
                      <Badge variant="warning">Unsaved Rule Changes</Badge>
                    </p>
                  ) : null}
                  <Button size="sm" variant="info" onClick={addRule}>
                    Add Filter
                  </Button>
                </>
              ) : null}
              <hr />
              <LoadingButton variant="primary" type="submit" disabled={loading}>
                Update
              </LoadingButton>
              <br />
              <br />
              <LoadingButton
                variant="danger"
                size="sm"
                disabled={loading}
                onClick={() => handleDelete()}
              >
                Delete
              </LoadingButton>
            </Col>
            <Col md={3}>
              <ProfilePreview
                {...props}
                localFilters={localFilters}
                property={property}
              />
            </Col>
          </Row>
        </fieldset>
      </Form>
    </>
  );
}

Page.getInitialProps = async (ctx) => {
  const { id } = ctx.query;
  const { execApi } = useApi(ctx);

  const { properties } = await execApi("get", `/properties`, {
    state: "ready",
  });
  const { sources } = await execApi("get", "/sources");
  const { types } = await execApi("get", `/propertyOptions`);

  let property = {};
  let pluginOptions = [];
  let filterOptions = {};
  let hydrationError: Error;

  try {
    const getResponse = await execApi("get", `/property/${id}`);
    property = getResponse.property;

    const pluginOptionsResponse = await execApi(
      "get",
      `/property/${id}/pluginOptions`
    );
    pluginOptions = pluginOptionsResponse.pluginOptions;

    const filterResponse = await execApi(
      "get",
      `/property/${id}/filterOptions`
    );
    filterOptions = filterResponse.options;
  } catch (error) {
    hydrationError = error.toString();
  }

  return {
    property,
    properties,
    sources,
    pluginOptions,
    types,
    filterOptions,
    hydrationError,
  };
};
