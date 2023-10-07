import { WhereClause, WhereClauseCondition } from "./WhereClause"

import { Alias } from "./Alias"
import { ApplyValueTransformers } from "../util/ApplyValueTransformers"
import { AuroraMysqlDriver } from "../driver/aurora-mysql/AuroraMysqlDriver"
import { Brackets } from "./Brackets"
import { BroadcasterResult } from "../subscriber/BroadcasterResult"
import { Buffer } from 'buffer';
import { ColumnMetadata } from "../metadata/ColumnMetadata"
import { DataSource } from "../data-source/DataSource"
import { DeleteResult } from "./result/DeleteResult"
import { DriverUtils } from "../driver/DriverUtils"
import { EntityMetadata } from "../metadata/EntityMetadata"
import { EntityNotFoundError } from "../error/EntityNotFoundError"
import { EntityPropertyNotFoundError } from "../error/EntityPropertyNotFoundError"
import { EntityTarget } from "../common/EntityTarget"
import { FindManyOptions } from "../find-options/FindManyOptions"
import { FindOperator } from "../find-options/FindOperator"
import { FindOptionsOrder } from "../find-options/FindOptionsOrder"
import { FindOptionsRelations } from "../find-options/FindOptionsRelations"
import { FindOptionsSelect } from "../find-options/FindOptionsSelect"
import { FindOptionsUtils } from "../find-options/FindOptionsUtils"
import { FindOptionsWhere } from "../find-options/FindOptionsWhere"
import { In } from "../find-options/operator/In"
import { InsertOrUpdateOptions } from "./InsertOrUpdateOptions"
import { InsertResult } from "./result/InsertResult"
import { InsertValuesMissingError } from "../error/InsertValuesMissingError"
import { InstanceChecker } from "../util/InstanceChecker"
import { JoinAttribute } from "./JoinAttribute"
import { LimitOnUpdateNotSupportedError } from "../error/LimitOnUpdateNotSupportedError"
import { LockNotSupportedOnGivenDriverError } from "../error/LockNotSupportedOnGivenDriverError"
import { MissingDeleteDateColumnError } from "../error/MissingDeleteDateColumnError"
import { MysqlDriver } from "../driver/mysql/MysqlDriver"
import { NoVersionOrUpdateDateColumnError } from "../error/NoVersionOrUpdateDateColumnError"
import { NotBrackets } from "./NotBrackets"
import { ObjectLiteral } from "../common/ObjectLiteral"
import { ObjectUtils } from "../util/ObjectUtils"
import { OffsetWithoutLimitNotSupportedError } from "../error/OffsetWithoutLimitNotSupportedError"
import { OptimisticLockCanNotBeUsedError } from "../error/OptimisticLockCanNotBeUsedError"
import { OptimisticLockVersionMismatchError } from "../error/OptimisticLockVersionMismatchError"
import { OracleDriver } from "../driver/oracle/OracleDriver"
import { OrderByCondition } from "../find-options/OrderByCondition"
import { OrmUtils } from "../util/OrmUtils"
import { PessimisticLockTransactionRequiredError } from "../error/PessimisticLockTransactionRequiredError"
import { QueryBuilderCteOptions } from "./QueryBuilderCte"
import { QueryDeepPartialEntity } from "./QueryPartialEntity"
import { QueryExpressionMap } from "./QueryExpressionMap"
import { QueryResultCacheOptions } from "../cache/QueryResultCacheOptions"
import { QueryRunner } from "../query-runner/QueryRunner"
import { RelationIdLoader as QueryStrategyRelationIdLoader } from "./RelationIdLoader"
import { RawSqlResultsToEntityTransformer } from "./transformer/RawSqlResultsToEntityTransformer"
import { ReadStream } from "../platform/PlatformTools"
import { RelationCountAttribute } from "./relation-count/RelationCountAttribute"
import { RelationCountLoader } from "./relation-count/RelationCountLoader"
import { RelationCountMetadataToAttributeTransformer } from "./relation-count/RelationCountMetadataToAttributeTransformer"
import { RelationIdAttribute } from "./relation-id/RelationIdAttribute"
import { RelationIdLoader } from "./relation-id/RelationIdLoader"
import { RelationIdMetadataToAttributeTransformer } from "./relation-id/RelationIdMetadataToAttributeTransformer"
import { RelationMetadata } from "../metadata/RelationMetadata"
import { RelationRemover } from "./RelationRemover"
import { RelationUpdater } from "./RelationUpdater"
import { ReturningResultsEntityUpdator } from "./ReturningResultsEntityUpdator"
import { ReturningStatementNotSupportedError } from "../error/ReturningStatementNotSupportedError"
import { ReturningType } from "../driver/Driver"
import { SelectQuery } from "./SelectQuery"
import { SelectQueryBuilderOption } from "./SelectQueryBuilderOption"
import { SqlServerDriver } from "../driver/sqlserver/SqlServerDriver"
import { TypeORMError } from "../error"
import { UpdateResult } from "./result/UpdateResult"
import { UpdateValuesMissingError } from "../error/UpdateValuesMissingError"
import { WhereExpressionBuilder } from "./WhereExpressionBuilder"
import { escapeRegExp } from "../util/escapeRegExp"
import { v4 as uuidv4 } from "uuid"

// todo: completely cover query builder with tests
// todo: entityOrProperty can be target name. implement proper behaviour if it is.
// todo: check in persistment if id exist on object and throw exception (can be in partial selection?)
// todo: fix problem with long aliases eg getMaxIdentifierLength
// todo: fix replacing in .select("COUNT(post.id) AS cnt") statement
// todo: implement joinAlways in relations and relationId
// todo: finish partial selection
// todo: sugar methods like: .addCount and .selectCount, selectCountAndMap, selectSum, selectSumAndMap, ...
// todo: implement @Select decorator
// todo: add select and map functions

// todo: implement relation/entity loading and setting them into properties within a separate query
// .loadAndMap("post.categories", "post.categories", qb => ...)
// .loadAndMap("post.categories", Category, qb => ...)

/**
 * Allows to build complex sql queries in a fashion way and execute those queries.
 */
export abstract class QueryBuilder<Entity extends ObjectLiteral> {
    readonly "@instanceof" = Symbol.for("QueryBuilder")

    // -------------------------------------------------------------------------
    // Public Properties
    // -------------------------------------------------------------------------

    /**
     * Connection on which QueryBuilder was created.
     */
    readonly connection: DataSource

    /**
     * Contains all properties of the QueryBuilder that needs to be build a final query.
     */
    readonly expressionMap: QueryExpressionMap

    // -------------------------------------------------------------------------
    // Protected Properties
    // -------------------------------------------------------------------------

    /**
     * Query runner used to execute query builder query.
     */
    protected queryRunner?: QueryRunner

    /**
     * If QueryBuilder was created in a subquery mode then its parent QueryBuilder (who created subquery) will be stored here.
     */
    protected parentQueryBuilder: QueryBuilder<any>

    /**
     * Memo to help keep place of current parameter index for `createParameter`
     */
    private parameterIndex = 0

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /**
     * QueryBuilder can be initialized from given Connection and QueryRunner objects or from given other QueryBuilder.
     */
    constructor(queryBuilder: QueryBuilder<any>)

    /**
     * QueryBuilder can be initialized from given Connection and QueryRunner objects or from given other QueryBuilder.
     */
    constructor(connection: DataSource, queryRunner?: QueryRunner)

    /**
     * QueryBuilder can be initialized from given Connection and QueryRunner objects or from given other QueryBuilder.
     */
    constructor(
        connectionOrQueryBuilder: DataSource | QueryBuilder<any>,
        queryRunner?: QueryRunner,
    ) {
        if (InstanceChecker.isDataSource(connectionOrQueryBuilder)) {
            this.connection = connectionOrQueryBuilder
            this.queryRunner = queryRunner
            this.expressionMap = new QueryExpressionMap(this.connection)
        } else {
            this.connection = connectionOrQueryBuilder.connection
            this.queryRunner = connectionOrQueryBuilder.queryRunner
            this.expressionMap = connectionOrQueryBuilder.expressionMap.clone()
        }
    }

    // -------------------------------------------------------------------------
    // Abstract Methods
    // -------------------------------------------------------------------------

    /**
     * Gets generated SQL query without parameters being replaced.
     */
    abstract getQuery(): string

    // -------------------------------------------------------------------------
    // Accessors
    // -------------------------------------------------------------------------

    /**
     * Gets the main alias string used in this query builder.
     */
    get alias(): string {
        if (!this.expressionMap.mainAlias)
            throw new TypeORMError(`Main alias is not set`) // todo: better exception

        return this.expressionMap.mainAlias.name
    }

    // -------------------------------------------------------------------------
    // Public Methods
    // -------------------------------------------------------------------------

    /**
     * Creates SELECT query.
     * Replaces all previous selections if they exist.
     */
    select(): SelectQueryBuilder<Entity>

    /**
     * Creates SELECT query and selects given data.
     * Replaces all previous selections if they exist.
     */
    select(
        selection: string,
        selectionAliasName?: string,
    ): SelectQueryBuilder<Entity>

    /**
     * Creates SELECT query and selects given data.
     * Replaces all previous selections if they exist.
     */
    select(selection: string[]): SelectQueryBuilder<Entity>

    /**
     * Creates SELECT query and selects given data.
     * Replaces all previous selections if they exist.
     */
    select(
        selection?: string | string[],
        selectionAliasName?: string,
    ): SelectQueryBuilder<Entity> {
        this.expressionMap.queryType = "select"
        if (Array.isArray(selection)) {
            this.expressionMap.selects = selection.map((selection) => ({
                selection: selection,
            }))
        } else if (selection) {
            this.expressionMap.selects = [
                { selection: selection, aliasName: selectionAliasName },
            ]
        }

        // loading it dynamically because of circular issue
        const SelectQueryBuilderCls =
            SelectQueryBuilder
        if (InstanceChecker.isSelectQueryBuilder(this)) return this as any

        return new SelectQueryBuilderCls(this)
    }

    /**
     * Creates INSERT query.
     */
    insert(): InsertQueryBuilder<Entity> {
        this.expressionMap.queryType = "insert"

        // loading it dynamically because of circular issue
        const InsertQueryBuilderCls =
            InsertQueryBuilder
        if (InstanceChecker.isInsertQueryBuilder(this)) return this as any

        return new InsertQueryBuilderCls(this)
    }

    /**
     * Creates UPDATE query and applies given update values.
     */
    update(): UpdateQueryBuilder<Entity>

    /**
     * Creates UPDATE query and applies given update values.
     */
    update(
        updateSet: QueryDeepPartialEntity<Entity>,
    ): UpdateQueryBuilder<Entity>

    /**
     * Creates UPDATE query for the given entity and applies given update values.
     */
    update<Entity extends ObjectLiteral>(
        entity: EntityTarget<Entity>,
        updateSet?: QueryDeepPartialEntity<Entity>,
    ): UpdateQueryBuilder<Entity>

    /**
     * Creates UPDATE query for the given table name and applies given update values.
     */
    update(
        tableName: string,
        updateSet?: QueryDeepPartialEntity<Entity>,
    ): UpdateQueryBuilder<Entity>

    /**
     * Creates UPDATE query and applies given update values.
     */
    update(
        entityOrTableNameUpdateSet?: EntityTarget<any> | ObjectLiteral,
        maybeUpdateSet?: ObjectLiteral,
    ): UpdateQueryBuilder<any> {
        const updateSet = maybeUpdateSet
            ? maybeUpdateSet
            : (entityOrTableNameUpdateSet as ObjectLiteral | undefined)
        entityOrTableNameUpdateSet = InstanceChecker.isEntitySchema(
            entityOrTableNameUpdateSet,
        )
            ? entityOrTableNameUpdateSet.options.name
            : entityOrTableNameUpdateSet

        if (
            typeof entityOrTableNameUpdateSet === "function" ||
            typeof entityOrTableNameUpdateSet === "string"
        ) {
            const mainAlias = this.createFromAlias(entityOrTableNameUpdateSet)
            this.expressionMap.setMainAlias(mainAlias)
        }

        this.expressionMap.queryType = "update"
        this.expressionMap.valuesSet = updateSet

        // loading it dynamically because of circular issue
        const UpdateQueryBuilderCls =
            UpdateQueryBuilder
        if (InstanceChecker.isUpdateQueryBuilder(this)) return this as any

        return new UpdateQueryBuilderCls(this)
    }

    /**
     * Creates DELETE query.
     */
    delete(): DeleteQueryBuilder<Entity> {
        this.expressionMap.queryType = "delete"

        // loading it dynamically because of circular issue
        const DeleteQueryBuilderCls =
            DeleteQueryBuilder
        if (InstanceChecker.isDeleteQueryBuilder(this)) return this as any

        return new DeleteQueryBuilderCls(this)
    }

    softDelete(): SoftDeleteQueryBuilder<any> {
        this.expressionMap.queryType = "soft-delete"

        // loading it dynamically because of circular issue
        const SoftDeleteQueryBuilderCls =
            SoftDeleteQueryBuilder
        if (InstanceChecker.isSoftDeleteQueryBuilder(this)) return this as any

        return new SoftDeleteQueryBuilderCls(this)
    }

    restore(): SoftDeleteQueryBuilder<any> {
        this.expressionMap.queryType = "restore"

        // loading it dynamically because of circular issue
        const SoftDeleteQueryBuilderCls =
            SoftDeleteQueryBuilder
        if (InstanceChecker.isSoftDeleteQueryBuilder(this)) return this as any

        return new SoftDeleteQueryBuilderCls(this)
    }

    /**
     * Sets entity's relation with which this query builder gonna work.
     */
    relation(propertyPath: string): RelationQueryBuilder<Entity>

    /**
     * Sets entity's relation with which this query builder gonna work.
     */
    relation<T extends ObjectLiteral>(
        entityTarget: EntityTarget<T>,
        propertyPath: string,
    ): RelationQueryBuilder<T>

    /**
     * Sets entity's relation with which this query builder gonna work.
     */
    relation(
        entityTargetOrPropertyPath: Function | string,
        maybePropertyPath?: string,
    ): RelationQueryBuilder<Entity> {
        const entityTarget =
            arguments.length === 2 ? entityTargetOrPropertyPath : undefined
        const propertyPath =
            arguments.length === 2
                ? (maybePropertyPath as string)
                : (entityTargetOrPropertyPath as string)

        this.expressionMap.queryType = "relation"
        this.expressionMap.relationPropertyPath = propertyPath

        if (entityTarget) {
            const mainAlias = this.createFromAlias(entityTarget)
            this.expressionMap.setMainAlias(mainAlias)
        }

        // loading it dynamically because of circular issue
        const RelationQueryBuilderCls =
            RelationQueryBuilder
        if (InstanceChecker.isRelationQueryBuilder(this)) return this as any

        return new RelationQueryBuilderCls(this)
    }

    /**
     * Checks if given relation exists in the entity.
     * Returns true if relation exists, false otherwise.
     *
     * todo: move this method to manager? or create a shortcut?
     */
    hasRelation<T>(target: EntityTarget<T>, relation: string): boolean

    /**
     * Checks if given relations exist in the entity.
     * Returns true if relation exists, false otherwise.
     *
     * todo: move this method to manager? or create a shortcut?
     */
    hasRelation<T>(target: EntityTarget<T>, relation: string[]): boolean

    /**
     * Checks if given relation or relations exist in the entity.
     * Returns true if relation exists, false otherwise.
     *
     * todo: move this method to manager? or create a shortcut?
     */
    hasRelation<T>(
        target: EntityTarget<T>,
        relation: string | string[],
    ): boolean {
        const entityMetadata = this.connection.getMetadata(target)
        const relations = Array.isArray(relation) ? relation : [relation]
        return relations.every((relation) => {
            return !!entityMetadata.findRelationWithPropertyPath(relation)
        })
    }

    /**
     * Check the existence of a parameter for this query builder.
     */
    hasParameter(key: string): boolean {
        return (
            this.parentQueryBuilder?.hasParameter(key) ||
            key in this.expressionMap.parameters
        )
    }

    /**
     * Sets parameter name and its value.
     *
     * The key for this parameter may contain numbers, letters, underscores, or periods.
     */
    setParameter(key: string, value: any): this {
        if (typeof value === "function") {
            throw new TypeORMError(
                `Function parameter isn't supported in the parameters. Please check "${key}" parameter.`,
            )
        }

        if (!key.match(/^([A-Za-z0-9_.]+)$/)) {
            throw new TypeORMError(
                "QueryBuilder parameter keys may only contain numbers, letters, underscores, or periods.",
            )
        }

        if (this.parentQueryBuilder) {
            this.parentQueryBuilder.setParameter(key, value)
        }

        this.expressionMap.parameters[key] = value
        return this
    }

    /**
     * Adds all parameters from the given object.
     */
    setParameters(parameters: ObjectLiteral): this {
        for (const [key, value] of Object.entries(parameters)) {
            this.setParameter(key, value)
        }

        return this
    }

    protected createParameter(value: any): string {
        let parameterName

        do {
            parameterName = `orm_param_${this.parameterIndex++}`
        } while (this.hasParameter(parameterName))

        this.setParameter(parameterName, value)

        return `:${parameterName}`
    }

    /**
     * Adds native parameters from the given object.
     *
     * @deprecated Use `setParameters` instead
     */
    setNativeParameters(parameters: ObjectLiteral): this {
        // set parent query builder parameters as well in sub-query mode
        if (this.parentQueryBuilder) {
            this.parentQueryBuilder.setNativeParameters(parameters)
        }

        Object.keys(parameters).forEach((key) => {
            this.expressionMap.nativeParameters[key] = parameters[key]
        })
        return this
    }

    /**
     * Gets all parameters.
     */
    getParameters(): ObjectLiteral {
        const parameters: ObjectLiteral = Object.assign(
            {},
            this.expressionMap.parameters,
        )

        // add discriminator column parameter if it exist
        if (
            this.expressionMap.mainAlias &&
            this.expressionMap.mainAlias.hasMetadata
        ) {
            const metadata = this.expressionMap.mainAlias!.metadata
            if (metadata.discriminatorColumn && metadata.parentEntityMetadata) {
                const values = metadata.childEntityMetadatas
                    .filter(
                        (childMetadata) => childMetadata.discriminatorColumn,
                    )
                    .map((childMetadata) => childMetadata.discriminatorValue)
                values.push(metadata.discriminatorValue)
                parameters["discriminatorColumnValues"] = values
            }
        }

        return parameters
    }

    /**
     * Prints sql to stdout using console.log.
     */
    printSql(): this {
        // TODO rename to logSql()
        const [query, parameters] = this.getQueryAndParameters()
        this.connection.logger.logQuery(query, parameters)
        return this
    }

    /**
     * Gets generated sql that will be executed.
     * Parameters in the query are escaped for the currently used driver.
     */
    getSql(): string {
        return this.getQueryAndParameters()[0]
    }

    /**
     * Gets query to be executed with all parameters used in it.
     */
    getQueryAndParameters(): [string, any[]] {
        // this execution order is important because getQuery method generates this.expressionMap.nativeParameters values
        const query = this.getQuery()
        const parameters = this.getParameters()
        return this.connection.driver.escapeQueryWithParameters(
            query,
            parameters,
            this.expressionMap.nativeParameters,
        )
    }

    /**
     * Executes sql generated by query builder and returns raw database results.
     */
    async execute(): Promise<any> {
        const [sql, parameters] = this.getQueryAndParameters()
        const queryRunner = this.obtainQueryRunner()
        try {
            return await queryRunner.query(sql, parameters) // await is needed here because we are using finally
        } finally {
            if (queryRunner !== this.queryRunner) {
                // means we created our own query runner
                await queryRunner.release()
            }
        }
    }

    /**
     * Creates a completely new query builder.
     * Uses same query runner as current QueryBuilder.
     */
    createQueryBuilder(): this {
        return new (this.constructor as any)(this.connection, this.queryRunner)
    }

    /**
     * Clones query builder as it is.
     * Note: it uses new query runner, if you want query builder that uses exactly same query runner,
     * you can create query builder using its constructor, for example new SelectQueryBuilder(queryBuilder)
     * where queryBuilder is cloned QueryBuilder.
     */
    clone(): this {
        return new (this.constructor as any)(this)
    }

    /**
     * Includes a Query comment in the query builder.  This is helpful for debugging purposes,
     * such as finding a specific query in the database server's logs, or for categorization using
     * an APM product.
     */
    comment(comment: string): this {
        this.expressionMap.comment = comment
        return this
    }

    /**
     * Disables escaping.
     */
    disableEscaping(): this {
        this.expressionMap.disableEscaping = false
        return this
    }

    /**
     * Escapes table name, column name or alias name using current database's escaping character.
     */
    escape(name: string): string {
        if (!this.expressionMap.disableEscaping) return name
        return this.connection.driver.escape(name)
    }

    /**
     * Sets or overrides query builder's QueryRunner.
     */
    setQueryRunner(queryRunner: QueryRunner): this {
        this.queryRunner = queryRunner
        return this
    }

    /**
     * Indicates if listeners and subscribers must be called before and after query execution.
     * Enabled by default.
     */
    callListeners(enabled: boolean): this {
        this.expressionMap.callListeners = enabled
        return this
    }

    /**
     * If set to true the query will be wrapped into a transaction.
     */
    useTransaction(enabled: boolean): this {
        this.expressionMap.useTransaction = enabled
        return this
    }

    /**
     * Adds CTE to query
     */
    addCommonTableExpression(
        queryBuilder: QueryBuilder<any> | string,
        alias: string,
        options?: QueryBuilderCteOptions,
    ): this {
        this.expressionMap.commonTableExpressions.push({
            queryBuilder,
            alias,
            options: options || {},
        })
        return this
    }

    // -------------------------------------------------------------------------
    // Protected Methods
    // -------------------------------------------------------------------------

    /**
     * Gets escaped table name with schema name if SqlServer driver used with custom
     * schema name, otherwise returns escaped table name.
     */
    protected getTableName(tablePath: string): string {
        return tablePath
            .split(".")
            .map((i) => {
                // this condition need because in SQL Server driver when custom database name was specified and schema name was not, we got `dbName..tableName` string, and doesn't need to escape middle empty string
                if (i === "") return i
                return this.escape(i)
            })
            .join(".")
    }

    /**
     * Gets name of the table where insert should be performed.
     */
    protected getMainTableName(): string {
        if (!this.expressionMap.mainAlias)
            throw new TypeORMError(
                `Entity where values should be inserted is not specified. Call "qb.into(entity)" method to specify it.`,
            )

        if (this.expressionMap.mainAlias.hasMetadata)
            return this.expressionMap.mainAlias.metadata.tablePath

        return this.expressionMap.mainAlias.tablePath!
    }

    /**
     * Specifies FROM which entity's table select/update/delete will be executed.
     * Also sets a main string alias of the selection data.
     */
    protected createFromAlias(
        entityTarget:
            | EntityTarget<any>
            | ((qb: SelectQueryBuilder<any>) => SelectQueryBuilder<any>),
        aliasName?: string,
    ): Alias {
        // if table has a metadata then find it to properly escape its properties
        // const metadata = this.connection.entityMetadatas.find(metadata => metadata.tableName === tableName);
        if (this.connection.hasMetadata(entityTarget)) {
            const metadata = this.connection.getMetadata(entityTarget)

            return this.expressionMap.createAlias({
                type: "from",
                name: aliasName,
                metadata: this.connection.getMetadata(entityTarget),
                tablePath: metadata.tablePath,
            })
        } else {
            if (typeof entityTarget === "string") {
                const isSubquery =
                    entityTarget.substr(0, 1) === "(" &&
                    entityTarget.substr(-1) === ")"

                return this.expressionMap.createAlias({
                    type: "from",
                    name: aliasName,
                    tablePath: !isSubquery
                        ? (entityTarget as string)
                        : undefined,
                    subQuery: isSubquery ? entityTarget : undefined,
                })
            }

            const subQueryBuilder: SelectQueryBuilder<any> = (
                entityTarget as any
            )((this as any as SelectQueryBuilder<any>).subQuery())
            this.setParameters(subQueryBuilder.getParameters())
            const subquery = subQueryBuilder.getQuery()

            return this.expressionMap.createAlias({
                type: "from",
                name: aliasName,
                subQuery: subquery,
            })
        }
    }

    /**
     * @deprecated this way of replace property names is too slow.
     *  Instead, we'll replace property names at the end - once query is build.
     */
    protected replacePropertyNames(statement: string) {
        return statement
    }

    /**
     * Replaces all entity's propertyName to name in the given SQL string.
     */
    protected replacePropertyNamesForTheWholeQuery(statement: string) {
        const replacements: { [key: string]: { [key: string]: string } } = {}

        for (const alias of this.expressionMap.aliases) {
            if (!alias.hasMetadata) continue
            const replaceAliasNamePrefix =
                this.expressionMap.aliasNamePrefixingEnabled && alias.name
                    ? `${alias.name}.`
                    : ""

            if (!replacements[replaceAliasNamePrefix]) {
                replacements[replaceAliasNamePrefix] = {}
            }

            // Insert & overwrite the replacements from least to most relevant in our replacements object.
            // To do this we iterate and overwrite in the order of relevance.
            // Least to Most Relevant:
            // * Relation Property Path to first join column key
            // * Relation Property Path + Column Path
            // * Column Database Name
            // * Column Property Name
            // * Column Property Path

            for (const relation of alias.metadata.relations) {
                if (relation.joinColumns.length > 0)
                    replacements[replaceAliasNamePrefix][
                        relation.propertyPath
                    ] = relation.joinColumns[0].databaseName
            }

            for (const relation of alias.metadata.relations) {
                const allColumns = [
                    ...relation.joinColumns,
                    ...relation.inverseJoinColumns,
                ]
                for (const joinColumn of allColumns) {
                    const propertyKey = `${relation.propertyPath}.${
                        joinColumn.referencedColumn!.propertyPath
                    }`
                    replacements[replaceAliasNamePrefix][propertyKey] =
                        joinColumn.databaseName
                }
            }

            for (const column of alias.metadata.columns) {
                replacements[replaceAliasNamePrefix][column.databaseName] =
                    column.databaseName
            }

            for (const column of alias.metadata.columns) {
                replacements[replaceAliasNamePrefix][column.propertyName] =
                    column.databaseName
            }

            for (const column of alias.metadata.columns) {
                replacements[replaceAliasNamePrefix][column.propertyPath] =
                    column.databaseName
            }
        }

        const replacementKeys = Object.keys(replacements)
        const replaceAliasNamePrefixes = replacementKeys
            .map((key) => escapeRegExp(key))
            .join("|")

        if (replacementKeys.length > 0) {
            statement = statement.replace(
                new RegExp(
                    // Avoid a lookbehind here since it's not well supported
                    `([ =\(]|^.{0})` + // any of ' =(' or start of line
                        // followed by our prefix, e.g. 'tablename.' or ''
                        `${
                            replaceAliasNamePrefixes
                                ? "(" + replaceAliasNamePrefixes + ")"
                                : ""
                        }([^ =\(\)\,]+)` + // a possible property name: sequence of anything but ' =(),'
                        // terminated by ' =),' or end of line
                        `(?=[ =\)\,]|.{0}$)`,
                    "gm",
                ),
                (...matches) => {
                    let match: string, pre: string, p: string
                    if (replaceAliasNamePrefixes) {
                        match = matches[0]
                        pre = matches[1]
                        p = matches[3]

                        if (replacements[matches[2]][p]) {
                            return `${pre}${this.escape(
                                matches[2].substring(0, matches[2].length - 1),
                            )}.${this.escape(replacements[matches[2]][p])}`
                        }
                    } else {
                        match = matches[0]
                        pre = matches[1]
                        p = matches[2]

                        if (replacements[""][p]) {
                            return `${pre}${this.escape(replacements[""][p])}`
                        }
                    }
                    return match
                },
            )
        }

        return statement
    }

    protected createComment(): string {
        if (!this.expressionMap.comment) {
            return ""
        }

        // ANSI SQL 2003 support C style comments - comments that start with `/*` and end with `*/`
        // In some dialects query nesting is available - but not all.  Because of this, we'll need
        // to scrub "ending" characters from the SQL but otherwise we can leave everything else
        // as-is and it should be valid.

        return `/* ${this.expressionMap.comment.replace(/\*\//g, "")} */ `
    }

    /**
     * Time travel queries for CockroachDB
     */
    protected createTimeTravelQuery(): string {
        if (
            this.expressionMap.queryType === "select" &&
            this.expressionMap.timeTravel
        ) {
            return ` AS OF SYSTEM TIME ${this.expressionMap.timeTravel}`
        }

        return ""
    }

    /**
     * Creates "WHERE" expression.
     */
    protected createWhereExpression() {
        const conditionsArray = []

        const whereExpression = this.createWhereClausesExpression(
            this.expressionMap.wheres,
        )

        if (whereExpression.length > 0 && whereExpression !== "1=1") {
            conditionsArray.push(this.replacePropertyNames(whereExpression))
        }

        if (this.expressionMap.mainAlias!.hasMetadata) {
            const metadata = this.expressionMap.mainAlias!.metadata
            // Adds the global condition of "non-deleted" for the entity with delete date columns in select query.
            if (
                this.expressionMap.queryType === "select" &&
                !this.expressionMap.withDeleted &&
                metadata.deleteDateColumn
            ) {
                const column = this.expressionMap.aliasNamePrefixingEnabled
                    ? this.expressionMap.mainAlias!.name +
                      "." +
                      metadata.deleteDateColumn.propertyName
                    : metadata.deleteDateColumn.propertyName

                const condition = `${this.replacePropertyNames(column)} IS NULL`
                conditionsArray.push(condition)
            }

            if (metadata.discriminatorColumn && metadata.parentEntityMetadata) {
                const column = this.expressionMap.aliasNamePrefixingEnabled
                    ? this.expressionMap.mainAlias!.name +
                      "." +
                      metadata.discriminatorColumn.databaseName
                    : metadata.discriminatorColumn.databaseName

                const condition = `${this.replacePropertyNames(
                    column,
                )} IN (:...discriminatorColumnValues)`
                conditionsArray.push(condition)
            }
        }

        if (this.expressionMap.extraAppendedAndWhereCondition) {
            const condition = this.replacePropertyNames(
                this.expressionMap.extraAppendedAndWhereCondition,
            )
            conditionsArray.push(condition)
        }

        let condition = ""

        // time travel
        condition += this.createTimeTravelQuery()

        if (!conditionsArray.length) {
            condition += ""
        } else if (conditionsArray.length === 1) {
            condition += ` WHERE ${conditionsArray[0]}`
        } else {
            condition += ` WHERE ( ${conditionsArray.join(" ) AND ( ")} )`
        }

        return condition
    }

    /**
     * Creates "RETURNING" / "OUTPUT" expression.
     */
    protected createReturningExpression(returningType: ReturningType): string {
        const columns = this.getReturningColumns()
        const driver = this.connection.driver

        // also add columns we must auto-return to perform entity updation
        // if user gave his own returning
        if (
            typeof this.expressionMap.returning !== "string" &&
            this.expressionMap.extraReturningColumns.length > 0 &&
            driver.isReturningSqlSupported(returningType)
        ) {
            columns.push(
                ...this.expressionMap.extraReturningColumns.filter((column) => {
                    return columns.indexOf(column) === -1
                }),
            )
        }

        if (columns.length) {
            let columnsExpression = columns
                .map((column) => {
                    const name = this.escape(column.databaseName)
                    if (driver.options.type === "mssql") {
                        if (
                            this.expressionMap.queryType === "insert" ||
                            this.expressionMap.queryType === "update" ||
                            this.expressionMap.queryType === "soft-delete" ||
                            this.expressionMap.queryType === "restore"
                        ) {
                            return "INSERTED." + name
                        } else {
                            return (
                                this.escape(this.getMainTableName()) +
                                "." +
                                name
                            )
                        }
                    } else {
                        return name
                    }
                })
                .join(", ")

            if (driver.options.type === "oracle") {
                columnsExpression +=
                    " INTO " +
                    columns
                        .map((column) => {
                            return this.createParameter({
                                type: (
                                    driver as OracleDriver
                                ).columnTypeToNativeParameter(column.type),
                                dir: (driver as OracleDriver).oracle.BIND_OUT,
                            })
                        })
                        .join(", ")
            }

            if (driver.options.type === "mssql") {
                if (
                    this.expressionMap.queryType === "insert" ||
                    this.expressionMap.queryType === "update"
                ) {
                    columnsExpression += " INTO @OutputTable"
                }
            }

            return columnsExpression
        } else if (typeof this.expressionMap.returning === "string") {
            return this.expressionMap.returning
        }

        return ""
    }

    /**
     * If returning / output cause is set to array of column names,
     * then this method will return all column metadatas of those column names.
     */
    protected getReturningColumns(): ColumnMetadata[] {
        const columns: ColumnMetadata[] = []
        if (Array.isArray(this.expressionMap.returning)) {
            ;(this.expressionMap.returning as string[]).forEach(
                (columnName) => {
                    if (this.expressionMap.mainAlias!.hasMetadata) {
                        columns.push(
                            ...this.expressionMap.mainAlias!.metadata.findColumnsWithPropertyPath(
                                columnName,
                            ),
                        )
                    }
                },
            )
        }
        return columns
    }

    protected createWhereClausesExpression(clauses: WhereClause[]): string {
        return clauses
            .map((clause, index) => {
                const expression = this.createWhereConditionExpression(
                    clause.condition,
                )

                switch (clause.type) {
                    case "and":
                        return (index > 0 ? "AND " : "") + expression
                    case "or":
                        return (index > 0 ? "OR " : "") + expression
                }

                return expression
            })
            .join(" ")
            .trim()
    }

    /**
     * Computes given where argument - transforms to a where string all forms it can take.
     */
    protected createWhereConditionExpression(
        condition: WhereClauseCondition,
        alwaysWrap: boolean = false,
    ): string {
        if (typeof condition === "string") return condition

        if (Array.isArray(condition)) {
            if (condition.length === 0) {
                return "1=1"
            }

            // In the future we should probably remove this entire condition
            // but for now to prevent any breaking changes it exists.
            if (condition.length === 1 && !alwaysWrap) {
                return this.createWhereClausesExpression(condition)
            }

            return "(" + this.createWhereClausesExpression(condition) + ")"
        }

        const { driver } = this.connection

        switch (condition.operator) {
            case "lessThan":
                return `${condition.parameters[0]} < ${condition.parameters[1]}`
            case "lessThanOrEqual":
                return `${condition.parameters[0]} <= ${condition.parameters[1]}`
            case "arrayContains":
                return `${condition.parameters[0]} @> ${condition.parameters[1]}`
            case "jsonContains":
                return `${condition.parameters[0]} ::jsonb @> ${condition.parameters[1]}`
            case "arrayContainedBy":
                return `${condition.parameters[0]} <@ ${condition.parameters[1]}`
            case "arrayOverlap":
                return `${condition.parameters[0]} && ${condition.parameters[1]}`
            case "moreThan":
                return `${condition.parameters[0]} > ${condition.parameters[1]}`
            case "moreThanOrEqual":
                return `${condition.parameters[0]} >= ${condition.parameters[1]}`
            case "notEqual":
                return `${condition.parameters[0]} != ${condition.parameters[1]}`
            case "equal":
                return `${condition.parameters[0]} = ${condition.parameters[1]}`
            case "ilike":
                if (
                    driver.options.type === "postgres" ||
                    driver.options.type === "cockroachdb"
                ) {
                    return `${condition.parameters[0]} ILIKE ${condition.parameters[1]}`
                }

                return `UPPER(${condition.parameters[0]}) LIKE UPPER(${condition.parameters[1]})`
            case "like":
                return `${condition.parameters[0]} LIKE ${condition.parameters[1]}`
            case "between":
                return `${condition.parameters[0]} BETWEEN ${condition.parameters[1]} AND ${condition.parameters[2]}`
            case "in":
                if (condition.parameters.length <= 1) {
                    return "0=1"
                }
                return `${condition.parameters[0]} IN (${condition.parameters
                    .slice(1)
                    .join(", ")})`
            case "any":
                if (driver.options.type === "cockroachdb") {
                    return `${condition.parameters[0]}::STRING = ANY(${condition.parameters[1]}::STRING[])`
                }

                return `${condition.parameters[0]} = ANY(${condition.parameters[1]})`
            case "isNull":
                return `${condition.parameters[0]} IS NULL`

            case "not":
                return `NOT(${this.createWhereConditionExpression(
                    condition.condition,
                )})`
            case "brackets":
                return `${this.createWhereConditionExpression(
                    condition.condition,
                    true,
                )}`
            case "and":
                return condition.parameters.join(" AND ")
        }

        throw new TypeError(
            `Unsupported FindOperator ${FindOperator.constructor.name}`,
        )
    }

    protected createCteExpression(): string {
        if (!this.hasCommonTableExpressions()) {
            return ""
        }
        const databaseRequireRecusiveHint =
            this.connection.driver.cteCapabilities.requiresRecursiveHint

        const cteStrings = this.expressionMap.commonTableExpressions.map(
            (cte) => {
                const cteBodyExpression =
                    typeof cte.queryBuilder === "string"
                        ? cte.queryBuilder
                        : cte.queryBuilder.getQuery()
                if (typeof cte.queryBuilder !== "string") {
                    if (cte.queryBuilder.hasCommonTableExpressions()) {
                        throw new TypeORMError(
                            `Nested CTEs aren't supported (CTE: ${cte.alias})`,
                        )
                    }
                    if (
                        !this.connection.driver.cteCapabilities.writable &&
                        !InstanceChecker.isSelectQueryBuilder(cte.queryBuilder)
                    ) {
                        throw new TypeORMError(
                            `Only select queries are supported in CTEs in ${this.connection.options.type} (CTE: ${cte.alias})`,
                        )
                    }
                    this.setParameters(cte.queryBuilder.getParameters())
                }
                let cteHeader = this.escape(cte.alias)
                if (cte.options.columnNames) {
                    const escapedColumnNames = cte.options.columnNames.map(
                        (column) => this.escape(column),
                    )
                    if (
                        InstanceChecker.isSelectQueryBuilder(cte.queryBuilder)
                    ) {
                        if (
                            cte.queryBuilder.expressionMap.selects.length &&
                            cte.options.columnNames.length !==
                                cte.queryBuilder.expressionMap.selects.length
                        ) {
                            throw new TypeORMError(
                                `cte.options.columnNames length (${cte.options.columnNames.length}) doesn't match subquery select list length ${cte.queryBuilder.expressionMap.selects.length} (CTE: ${cte.alias})`,
                            )
                        }
                    }
                    cteHeader += `(${escapedColumnNames.join(", ")})`
                }
                const recursiveClause =
                    cte.options.recursive && databaseRequireRecusiveHint
                        ? "RECURSIVE"
                        : ""
                let materializeClause = ""
                if (
                    this.connection.driver.cteCapabilities.materializedHint &&
                    cte.options.materialized !== undefined
                ) {
                    materializeClause = cte.options.materialized
                        ? "MATERIALIZED"
                        : "NOT MATERIALIZED"
                }

                return [
                    recursiveClause,
                    cteHeader,
                    "AS",
                    materializeClause,
                    `(${cteBodyExpression})`,
                ]
                    .filter(Boolean)
                    .join(" ")
            },
        )

        return "WITH " + cteStrings.join(", ") + " "
    }

    /**
     * Creates "WHERE" condition for an in-ids condition.
     */
    protected getWhereInIdsCondition(
        ids: any | any[],
    ): ObjectLiteral | Brackets {
        const metadata = this.expressionMap.mainAlias!.metadata
        const normalized = (Array.isArray(ids) ? ids : [ids]).map((id) =>
            metadata.ensureEntityIdMap(id),
        )

        // using in(...ids) for single primary key entities
        if (!metadata.hasMultiplePrimaryKeys) {
            const primaryColumn = metadata.primaryColumns[0]

            // getEntityValue will try to transform `In`, it is a bug
            // todo: remove this transformer check after #2390 is fixed
            // This also fails for embedded & relation, so until that is fixed skip it.
            if (
                !primaryColumn.transformer &&
                !primaryColumn.relationMetadata &&
                !primaryColumn.embeddedMetadata
            ) {
                return {
                    [primaryColumn.propertyName]: In(
                        normalized.map((id) =>
                            primaryColumn.getEntityValue(id, false),
                        ),
                    ),
                }
            }
        }

        return new Brackets((qb) => {
            for (const data of normalized) {
                qb.orWhere(new Brackets((qb) => qb.where(data)))
            }
        })
    }

    protected getExistsCondition(subQuery: any): [string, any[]] {
        const query = subQuery
            .clone()
            .orderBy()
            .groupBy()
            .offset(undefined)
            .limit(undefined)
            .skip(undefined)
            .take(undefined)
            .select("1")
            .setOption("disable-global-order")

        return [`EXISTS (${query.getQuery()})`, query.getParameters()]
    }

    private findColumnsForPropertyPath(
        propertyPath: string,
    ): [Alias, string[], ColumnMetadata[]] {
        // Make a helper to iterate the entity & relations?
        // Use that to set the correct alias?  Or the other way around?

        // Start with the main alias with our property paths
        let alias = this.expressionMap.mainAlias
        const root: string[] = []
        const propertyPathParts = propertyPath.split(".")

        while (propertyPathParts.length > 1) {
            const part = propertyPathParts[0]

            if (!alias?.hasMetadata) {
                // If there's no metadata, we're wasting our time
                // and can't actually look any of this up.
                break
            }

            if (alias.metadata.hasEmbeddedWithPropertyPath(part)) {
                // If this is an embedded then we should combine the two as part of our lookup.
                // Instead of just breaking, we keep going with this in case there's an embedded/relation
                // inside an embedded.
                propertyPathParts.unshift(
                    `${propertyPathParts.shift()}.${propertyPathParts.shift()}`,
                )
                continue
            }

            if (alias.metadata.hasRelationWithPropertyPath(part)) {
                // If this is a relation then we should find the aliases
                // that match the relation & then continue further down
                // the property path
                const joinAttr = this.expressionMap.joinAttributes.find(
                    (joinAttr) => joinAttr.relationPropertyPath === part,
                )

                if (!joinAttr?.alias) {
                    const fullRelationPath =
                        root.length > 0 ? `${root.join(".")}.${part}` : part
                    throw new Error(
                        `Cannot find alias for relation at ${fullRelationPath}`,
                    )
                }

                alias = joinAttr.alias
                root.push(...part.split("."))
                propertyPathParts.shift()
                continue
            }

            break
        }

        if (!alias) {
            throw new Error(`Cannot find alias for property ${propertyPath}`)
        }

        // Remaining parts are combined back and used to find the actual property path
        const aliasPropertyPath = propertyPathParts.join(".")

        const columns =
            alias.metadata.findColumnsWithPropertyPath(aliasPropertyPath)

        if (!columns.length) {
            throw new EntityPropertyNotFoundError(propertyPath, alias.metadata)
        }

        return [alias, root, columns]
    }

    /**
     * Creates a property paths for a given ObjectLiteral.
     */
    protected createPropertyPath(
        metadata: EntityMetadata,
        entity: ObjectLiteral,
        prefix: string = "",
    ) {
        const paths: string[] = []

        for (const key of Object.keys(entity)) {
            const path = prefix ? `${prefix}.${key}` : key

            // There's times where we don't actually want to traverse deeper.
            // If the value is a `FindOperator`, or null, or not an object, then we don't, for example.
            if (
                entity[key] === null ||
                typeof entity[key] !== "object" ||
                InstanceChecker.isFindOperator(entity[key])
            ) {
                paths.push(path)
                continue
            }

            if (metadata.hasEmbeddedWithPropertyPath(path)) {
                const subPaths = this.createPropertyPath(
                    metadata,
                    entity[key],
                    path,
                )
                paths.push(...subPaths)
                continue
            }

            if (metadata.hasRelationWithPropertyPath(path)) {
                const relation = metadata.findRelationWithPropertyPath(path)!

                // There's also cases where we don't want to return back all of the properties.
                // These handles the situation where someone passes the model & we don't need to make
                // a HUGE `where` to uniquely look up the entity.

                // In the case of a *-to-one, there's only ever one possible entity on the other side
                // so if the join columns are all defined we can return just the relation itself
                // because it will fetch only the join columns and do the lookup.
                if (
                    relation.relationType === "one-to-one" ||
                    relation.relationType === "many-to-one"
                ) {
                    const joinColumns = relation.joinColumns
                        .map((j) => j.referencedColumn)
                        .filter((j): j is ColumnMetadata => !!j)

                    const hasAllJoinColumns =
                        joinColumns.length > 0 &&
                        joinColumns.every((column) =>
                            column.getEntityValue(entity[key], false),
                        )

                    if (hasAllJoinColumns) {
                        paths.push(path)
                        continue
                    }
                }

                if (
                    relation.relationType === "one-to-many" ||
                    relation.relationType === "many-to-many"
                ) {
                    throw new Error(
                        `Cannot query across ${relation.relationType} for property ${path}`,
                    )
                }

                // For any other case, if the `entity[key]` contains all of the primary keys we can do a
                // lookup via these.  We don't need to look up via any other values 'cause these are
                // the unique primary keys.
                // This handles the situation where someone passes the model & we don't need to make
                // a HUGE where.
                const primaryColumns =
                    relation.inverseEntityMetadata.primaryColumns
                const hasAllPrimaryKeys =
                    primaryColumns.length > 0 &&
                    primaryColumns.every((column) =>
                        column.getEntityValue(entity[key], false),
                    )

                if (hasAllPrimaryKeys) {
                    const subPaths = primaryColumns.map(
                        (column) => `${path}.${column.propertyPath}`,
                    )
                    paths.push(...subPaths)
                    continue
                }

                // If nothing else, just return every property that's being passed to us.
                const subPaths = this.createPropertyPath(
                    relation.inverseEntityMetadata,
                    entity[key],
                ).map((p) => `${path}.${p}`)
                paths.push(...subPaths)
                continue
            }

            paths.push(path)
        }

        return paths
    }

    protected *getPredicates(where: ObjectLiteral) {
        if (this.expressionMap.mainAlias!.hasMetadata) {
            const propertyPaths = this.createPropertyPath(
                this.expressionMap.mainAlias!.metadata,
                where,
            )

            for (const propertyPath of propertyPaths) {
                const [alias, aliasPropertyPath, columns] =
                    this.findColumnsForPropertyPath(propertyPath)

                for (const column of columns) {
                    let containedWhere = where

                    for (const part of aliasPropertyPath) {
                        if (!containedWhere || !(part in containedWhere)) {
                            containedWhere = {}
                            break
                        }

                        containedWhere = containedWhere[part]
                    }

                    // Use the correct alias & the property path from the column
                    const aliasPath = this.expressionMap
                        .aliasNamePrefixingEnabled
                        ? `${alias.name}.${column.propertyPath}`
                        : column.propertyPath

                    const parameterValue = column.getEntityValue(
                        containedWhere,
                        true,
                    )

                    yield [aliasPath, parameterValue]
                }
            }
        } else {
            for (const key of Object.keys(where)) {
                const parameterValue = where[key]
                const aliasPath = this.expressionMap.aliasNamePrefixingEnabled
                    ? `${this.alias}.${key}`
                    : key

                yield [aliasPath, parameterValue]
            }
        }
    }

    protected getWherePredicateCondition(
        aliasPath: string,
        parameterValue: any,
    ): WhereClauseCondition {
        if (InstanceChecker.isFindOperator(parameterValue)) {
            let parameters: any[] = []
            if (parameterValue.useParameter) {
                if (parameterValue.objectLiteralParameters) {
                    this.setParameters(parameterValue.objectLiteralParameters)
                } else if (parameterValue.multipleParameters) {
                    for (const v of parameterValue.value) {
                        parameters.push(this.createParameter(v))
                    }
                } else {
                    parameters.push(this.createParameter(parameterValue.value))
                }
            }

            if (parameterValue.type === "raw") {
                if (parameterValue.getSql) {
                    return parameterValue.getSql(aliasPath)
                } else {
                    return {
                        operator: "equal",
                        parameters: [aliasPath, parameterValue.value],
                    }
                }
            } else if (parameterValue.type === "not") {
                if (parameterValue.child) {
                    return {
                        operator: parameterValue.type,
                        condition: this.getWherePredicateCondition(
                            aliasPath,
                            parameterValue.child,
                        ),
                    }
                } else {
                    return {
                        operator: "notEqual",
                        parameters: [aliasPath, ...parameters],
                    }
                }
            } else if (parameterValue.type === "and") {
                const values: FindOperator<any>[] = parameterValue.value

                return {
                    operator: parameterValue.type,
                    parameters: values.map((operator) =>
                        this.createWhereConditionExpression(
                            this.getWherePredicateCondition(
                                aliasPath,
                                operator,
                            ),
                        ),
                    ),
                }
            } else {
                return {
                    operator: parameterValue.type,
                    parameters: [aliasPath, ...parameters],
                }
            }
            // } else if (parameterValue === null) {
            //     return {
            //         operator: "isNull",
            //         parameters: [
            //             aliasPath,
            //         ]
            //     };
        } else {
            return {
                operator: "equal",
                parameters: [aliasPath, this.createParameter(parameterValue)],
            }
        }
    }

    protected getWhereCondition(
        where:
            | string
            | ((qb: this) => string)
            | Brackets
            | NotBrackets
            | ObjectLiteral
            | ObjectLiteral[],
    ): WhereClauseCondition {
        if (typeof where === "string") {
            return where
        }

        if (InstanceChecker.isBrackets(where)) {
            const whereQueryBuilder = this.createQueryBuilder()

            whereQueryBuilder.parentQueryBuilder = this

            whereQueryBuilder.expressionMap.mainAlias =
                this.expressionMap.mainAlias
            whereQueryBuilder.expressionMap.aliasNamePrefixingEnabled =
                this.expressionMap.aliasNamePrefixingEnabled
            whereQueryBuilder.expressionMap.parameters =
                this.expressionMap.parameters
            whereQueryBuilder.expressionMap.nativeParameters =
                this.expressionMap.nativeParameters

            whereQueryBuilder.expressionMap.wheres = []

            where.whereFactory(whereQueryBuilder as any)

            return {
                operator: InstanceChecker.isNotBrackets(where)
                    ? "not"
                    : "brackets",
                condition: whereQueryBuilder.expressionMap.wheres,
            }
        }

        if (typeof where === "function") {
            return where(this)
        }

        const wheres: ObjectLiteral[] = Array.isArray(where) ? where : [where]
        const clauses: WhereClause[] = []

        for (const where of wheres) {
            const conditions: WhereClauseCondition = []

            // Filter the conditions and set up the parameter values
            for (const [aliasPath, parameterValue] of this.getPredicates(
                where,
            )) {
                conditions.push({
                    type: "and",
                    condition: this.getWherePredicateCondition(
                        aliasPath,
                        parameterValue,
                    ),
                })
            }

            clauses.push({ type: "or", condition: conditions })
        }

        if (clauses.length === 1) {
            return clauses[0].condition
        }

        return clauses
    }

    /**
     * Creates a query builder used to execute sql queries inside this query builder.
     */
    protected obtainQueryRunner() {
        return this.queryRunner || this.connection.createQueryRunner()
    }

    protected hasCommonTableExpressions(): boolean {
        return this.expressionMap.commonTableExpressions.length > 0
    }
}

/**
 * Allows to build complex sql queries in a fashion way and execute those queries.
 */
export class DeleteQueryBuilder<Entity extends ObjectLiteral>
    extends QueryBuilder<Entity>
    implements WhereExpressionBuilder
{
    readonly "@instanceof" = Symbol.for("DeleteQueryBuilder")

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(
        connectionOrQueryBuilder: DataSource | QueryBuilder<any>,
        queryRunner?: QueryRunner,
    ) {
        super(connectionOrQueryBuilder as any, queryRunner)
        this.expressionMap.aliasNamePrefixingEnabled = false
    }

    // -------------------------------------------------------------------------
    // Public Implemented Methods
    // -------------------------------------------------------------------------

    /**
     * Gets generated SQL query without parameters being replaced.
     */
    getQuery(): string {
        let sql = this.createComment()
        sql += this.createCteExpression()
        sql += this.createDeleteExpression()
        return this.replacePropertyNamesForTheWholeQuery(sql.trim())
    }

    /**
     * Executes sql generated by query builder and returns raw database results.
     */
    async execute(): Promise<DeleteResult> {
        const [sql, parameters] = this.getQueryAndParameters()
        const queryRunner = this.obtainQueryRunner()
        let transactionStartedByUs: boolean = false

        try {
            // start transaction if it was enabled
            if (
                this.expressionMap.useTransaction === true &&
                queryRunner.isTransactionActive === false
            ) {
                await queryRunner.startTransaction()
                transactionStartedByUs = true
            }

            // call before deletion methods in listeners and subscribers
            if (
                this.expressionMap.callListeners === true &&
                this.expressionMap.mainAlias!.hasMetadata
            ) {
                await queryRunner.broadcaster.broadcast(
                    "BeforeRemove",
                    this.expressionMap.mainAlias!.metadata,
                )
            }

            // execute query
            const queryResult = await queryRunner.query(sql, parameters, true)
            const deleteResult = DeleteResult.from(queryResult)

            // call after deletion methods in listeners and subscribers
            if (
                this.expressionMap.callListeners === true &&
                this.expressionMap.mainAlias!.hasMetadata
            ) {
                await queryRunner.broadcaster.broadcast(
                    "AfterRemove",
                    this.expressionMap.mainAlias!.metadata,
                )
            }

            // close transaction if we started it
            if (transactionStartedByUs) await queryRunner.commitTransaction()

            return deleteResult
        } catch (error) {
            // rollback transaction if we started it
            if (transactionStartedByUs) {
                try {
                    await queryRunner.rollbackTransaction()
                } catch (rollbackError) {}
            }
            throw error
        } finally {
            if (queryRunner !== this.queryRunner) {
                // means we created our own query runner
                await queryRunner.release()
            }
        }
    }

    // -------------------------------------------------------------------------
    // Public Methods
    // -------------------------------------------------------------------------

    /**
     * Specifies FROM which entity's table select/update/delete will be executed.
     * Also sets a main string alias of the selection data.
     */
    from<T extends ObjectLiteral>(
        entityTarget: EntityTarget<T>,
        aliasName?: string,
    ): DeleteQueryBuilder<T> {
        entityTarget = InstanceChecker.isEntitySchema(entityTarget)
            ? entityTarget.options.name
            : entityTarget
        const mainAlias = this.createFromAlias(entityTarget, aliasName)
        this.expressionMap.setMainAlias(mainAlias)
        return this as any as DeleteQueryBuilder<T>
    }

    /**
     * Sets WHERE condition in the query builder.
     * If you had previously WHERE expression defined,
     * calling this function will override previously set WHERE conditions.
     * Additionally you can add parameters used in where expression.
     */
    where(
        where:
            | Brackets
            | string
            | ((qb: this) => string)
            | ObjectLiteral
            | ObjectLiteral[],
        parameters?: ObjectLiteral,
    ): this {
        this.expressionMap.wheres = [] // don't move this block below since computeWhereParameter can add where expressions
        const condition = this.getWhereCondition(where)
        if (condition)
            this.expressionMap.wheres = [
                { type: "simple", condition: condition },
            ]
        if (parameters) this.setParameters(parameters)
        return this
    }

    /**
     * Adds new AND WHERE condition in the query builder.
     * Additionally you can add parameters used in where expression.
     */
    andWhere(
        where:
            | Brackets
            | string
            | ((qb: this) => string)
            | ObjectLiteral
            | ObjectLiteral[],
        parameters?: ObjectLiteral,
    ): this {
        this.expressionMap.wheres.push({
            type: "and",
            condition: this.getWhereCondition(where),
        })
        if (parameters) this.setParameters(parameters)
        return this
    }

    /**
     * Adds new OR WHERE condition in the query builder.
     * Additionally you can add parameters used in where expression.
     */
    orWhere(
        where:
            | Brackets
            | string
            | ((qb: this) => string)
            | ObjectLiteral
            | ObjectLiteral[],
        parameters?: ObjectLiteral,
    ): this {
        this.expressionMap.wheres.push({
            type: "or",
            condition: this.getWhereCondition(where),
        })
        if (parameters) this.setParameters(parameters)
        return this
    }

    /**
     * Sets WHERE condition in the query builder with a condition for the given ids.
     * If you had previously WHERE expression defined,
     * calling this function will override previously set WHERE conditions.
     */
    whereInIds(ids: any | any[]): this {
        return this.where(this.getWhereInIdsCondition(ids))
    }

    /**
     * Adds new AND WHERE with conditions for the given ids.
     */
    andWhereInIds(ids: any | any[]): this {
        return this.andWhere(this.getWhereInIdsCondition(ids))
    }

    /**
     * Adds new OR WHERE with conditions for the given ids.
     */
    orWhereInIds(ids: any | any[]): this {
        return this.orWhere(this.getWhereInIdsCondition(ids))
    }
    /**
     * Optional returning/output clause.
     * This will return given column values.
     */
    output(columns: string[]): this

    /**
     * Optional returning/output clause.
     * Returning is a SQL string containing returning statement.
     */
    output(output: string): this

    /**
     * Optional returning/output clause.
     */
    output(output: string | string[]): this

    /**
     * Optional returning/output clause.
     */
    output(output: string | string[]): this {
        return this.returning(output)
    }

    /**
     * Optional returning/output clause.
     * This will return given column values.
     */
    returning(columns: string[]): this

    /**
     * Optional returning/output clause.
     * Returning is a SQL string containing returning statement.
     */
    returning(returning: string): this

    /**
     * Optional returning/output clause.
     */
    returning(returning: string | string[]): this

    /**
     * Optional returning/output clause.
     */
    returning(returning: string | string[]): this {
        // not all databases support returning/output cause
        if (!this.connection.driver.isReturningSqlSupported("delete")) {
            throw new ReturningStatementNotSupportedError()
        }

        this.expressionMap.returning = returning
        return this
    }

    // -------------------------------------------------------------------------
    // Protected Methods
    // -------------------------------------------------------------------------

    /**
     * Creates DELETE express used to perform query.
     */
    protected createDeleteExpression() {
        const tableName = this.getTableName(this.getMainTableName())
        const whereExpression = this.createWhereExpression()
        const returningExpression = this.createReturningExpression("delete")

        if (returningExpression === "") {
            return `DELETE FROM ${tableName}${whereExpression}`
        }
        if (this.connection.driver.options.type === "mssql") {
            return `DELETE FROM ${tableName} OUTPUT ${returningExpression}${whereExpression}`
        }
        return `DELETE FROM ${tableName}${whereExpression} RETURNING ${returningExpression}`
    }
}

/**
 * Allows to build complex sql queries in a fashion way and execute those queries.
 */
export class InsertQueryBuilder<
    Entity extends ObjectLiteral,
> extends QueryBuilder<Entity> {
    readonly "@instanceof" = Symbol.for("InsertQueryBuilder")

    // -------------------------------------------------------------------------
    // Public Implemented Methods
    // -------------------------------------------------------------------------

    /**
     * Gets generated SQL query without parameters being replaced.
     */
    getQuery(): string {
        let sql = this.createComment()
        sql += this.createCteExpression()
        sql += this.createInsertExpression()
        return this.replacePropertyNamesForTheWholeQuery(sql.trim())
    }

    /**
     * Executes sql generated by query builder and returns raw database results.
     */
    async execute(): Promise<InsertResult> {
        // console.time(".value sets");
        const valueSets: ObjectLiteral[] = this.getValueSets()
        // console.timeEnd(".value sets");

        // If user passed empty array of entities then we don't need to do
        // anything.
        //
        // Fixes GitHub issues #3111 and #5734. If we were to let this through
        // we would run into problems downstream, like subscribers getting
        // invoked with the empty array where they expect an entity, and SQL
        // queries with an empty VALUES clause.
        if (valueSets.length === 0) return new InsertResult()

        // console.time("QueryBuilder.execute");
        // console.time(".database stuff");
        const queryRunner = this.obtainQueryRunner()
        let transactionStartedByUs: boolean = false

        try {
            // start transaction if it was enabled
            if (
                this.expressionMap.useTransaction === true &&
                queryRunner.isTransactionActive === false
            ) {
                await queryRunner.startTransaction()
                transactionStartedByUs = true
            }

            // console.timeEnd(".database stuff");

            // call before insertion methods in listeners and subscribers
            if (
                this.expressionMap.callListeners === true &&
                this.expressionMap.mainAlias!.hasMetadata
            ) {
                const broadcastResult = new BroadcasterResult()
                valueSets.forEach((valueSet) => {
                    queryRunner.broadcaster.broadcastBeforeInsertEvent(
                        broadcastResult,
                        this.expressionMap.mainAlias!.metadata,
                        valueSet,
                    )
                })
                await broadcastResult.wait()
            }

            let declareSql: string | null = null
            let selectOutputSql: string | null = null

            // if update entity mode is enabled we may need extra columns for the returning statement
            // console.time(".prepare returning statement");
            const returningResultsEntityUpdator =
                new ReturningResultsEntityUpdator(
                    queryRunner,
                    this.expressionMap,
                )

            const returningColumns: ColumnMetadata[] = []

            if (
                Array.isArray(this.expressionMap.returning) &&
                this.expressionMap.mainAlias!.hasMetadata
            ) {
                for (const columnPath of this.expressionMap.returning) {
                    returningColumns.push(
                        ...this.expressionMap.mainAlias!.metadata.findColumnsWithPropertyPath(
                            columnPath,
                        ),
                    )
                }
            }

            if (
                this.expressionMap.updateEntity === true &&
                this.expressionMap.mainAlias!.hasMetadata
            ) {
                if (
                    !(
                        valueSets.length > 1 &&
                        this.connection.driver.options.type === "oracle"
                    )
                ) {
                    this.expressionMap.extraReturningColumns =
                        this.expressionMap.mainAlias!.metadata.getInsertionReturningColumns()
                }

                returningColumns.push(
                    ...this.expressionMap.extraReturningColumns.filter(
                        (c) => !returningColumns.includes(c),
                    ),
                )
            }

            if (
                returningColumns.length > 0 &&
                this.connection.driver.options.type === "mssql"
            ) {
                declareSql = (
                    this.connection.driver as SqlServerDriver
                ).buildTableVariableDeclaration(
                    "@OutputTable",
                    returningColumns,
                )
                selectOutputSql = `SELECT * FROM @OutputTable`
            }
            // console.timeEnd(".prepare returning statement");

            // execute query
            // console.time(".getting query and parameters");
            const [insertSql, parameters] = this.getQueryAndParameters()
            // console.timeEnd(".getting query and parameters");

            // console.time(".query execution by database");
            const statements = [declareSql, insertSql, selectOutputSql]
            const sql = statements.filter((s) => s != null).join(";\n\n")

            const queryResult = await queryRunner.query(sql, parameters, true)

            const insertResult = InsertResult.from(queryResult)

            // console.timeEnd(".query execution by database");

            // load returning results and set them to the entity if entity updation is enabled
            if (
                this.expressionMap.updateEntity === true &&
                this.expressionMap.mainAlias!.hasMetadata
            ) {
                // console.time(".updating entity");
                await returningResultsEntityUpdator.insert(
                    insertResult,
                    valueSets,
                )
                // console.timeEnd(".updating entity");
            }

            // call after insertion methods in listeners and subscribers
            if (
                this.expressionMap.callListeners === true &&
                this.expressionMap.mainAlias!.hasMetadata
            ) {
                const broadcastResult = new BroadcasterResult()
                valueSets.forEach((valueSet) => {
                    queryRunner.broadcaster.broadcastAfterInsertEvent(
                        broadcastResult,
                        this.expressionMap.mainAlias!.metadata,
                        valueSet,
                    )
                })
                await broadcastResult.wait()
            }

            // close transaction if we started it
            // console.time(".commit");
            if (transactionStartedByUs) {
                await queryRunner.commitTransaction()
            }
            // console.timeEnd(".commit");

            return insertResult
        } catch (error) {
            // rollback transaction if we started it
            if (transactionStartedByUs) {
                try {
                    await queryRunner.rollbackTransaction()
                } catch (rollbackError) {}
            }
            throw error
        } finally {
            // console.time(".releasing connection");
            if (queryRunner !== this.queryRunner) {
                // means we created our own query runner
                await queryRunner.release()
            }
            // console.timeEnd(".releasing connection");
            // console.timeEnd("QueryBuilder.execute");
        }
    }

    // -------------------------------------------------------------------------
    // Public Methods
    // -------------------------------------------------------------------------

    /**
     * Specifies INTO which entity's table insertion will be executed.
     */
    into<T extends ObjectLiteral>(
        entityTarget: EntityTarget<T>,
        columns?: string[],
    ): InsertQueryBuilder<T> {
        entityTarget = InstanceChecker.isEntitySchema(entityTarget)
            ? entityTarget.options.name
            : entityTarget
        const mainAlias = this.createFromAlias(entityTarget)
        this.expressionMap.setMainAlias(mainAlias)
        this.expressionMap.insertColumns = columns || []
        return this as any as InsertQueryBuilder<T>
    }

    /**
     * Values needs to be inserted into table.
     */
    values(
        values:
            | QueryDeepPartialEntity<Entity>
            | QueryDeepPartialEntity<Entity>[],
    ): this {
        this.expressionMap.valuesSet = values
        return this
    }

    /**
     * Optional returning/output clause.
     * This will return given column values.
     */
    output(columns: string[]): this

    /**
     * Optional returning/output clause.
     * Returning is a SQL string containing returning statement.
     */
    output(output: string): this

    /**
     * Optional returning/output clause.
     */
    output(output: string | string[]): this

    /**
     * Optional returning/output clause.
     */
    output(output: string | string[]): this {
        return this.returning(output)
    }

    /**
     * Optional returning/output clause.
     * This will return given column values.
     */
    returning(columns: string[]): this

    /**
     * Optional returning/output clause.
     * Returning is a SQL string containing returning statement.
     */
    returning(returning: string): this

    /**
     * Optional returning/output clause.
     */
    returning(returning: string | string[]): this

    /**
     * Optional returning/output clause.
     */
    returning(returning: string | string[]): this {
        // not all databases support returning/output cause
        if (!this.connection.driver.isReturningSqlSupported("insert")) {
            throw new ReturningStatementNotSupportedError()
        }

        this.expressionMap.returning = returning
        return this
    }

    /**
     * Indicates if entity must be updated after insertion operations.
     * This may produce extra query or use RETURNING / OUTPUT statement (depend on database).
     * Enabled by default.
     */
    updateEntity(enabled: boolean): this {
        this.expressionMap.updateEntity = enabled
        return this
    }

    /**
     * Adds additional ON CONFLICT statement supported in postgres and cockroach.
     *
     * @deprecated Use `orIgnore` or `orUpdate`
     */
    onConflict(statement: string): this {
        this.expressionMap.onConflict = statement
        return this
    }

    /**
     * Adds additional ignore statement supported in databases.
     */
    orIgnore(statement: string | boolean = true): this {
        this.expressionMap.onIgnore = !!statement
        return this
    }

    /**
     * @deprecated
     *
     * `.orUpdate({ columns: [ "is_updated" ] }).setParameter("is_updated", value)`
     *
     * is now `.orUpdate(["is_updated"])`
     *
     * `.orUpdate({ conflict_target: ['date'], overwrite: ['title'] })`
     *
     * is now `.orUpdate(['title'], ['date'])`
     *
     */
    orUpdate(statement?: {
        columns?: string[]
        overwrite?: string[]
        conflict_target?: string | string[]
    }): this

    orUpdate(
        overwrite: string[],
        conflictTarget?: string | string[],
        orUpdateOptions?: InsertOrUpdateOptions,
    ): this

    /**
     * Adds additional update statement supported in databases.
     */
    orUpdate(
        statementOrOverwrite?:
            | {
                  columns?: string[]
                  overwrite?: string[]
                  conflict_target?: string | string[]
              }
            | string[],
        conflictTarget?: string | string[],
        orUpdateOptions?: InsertOrUpdateOptions,
    ): this {
        if (!Array.isArray(statementOrOverwrite)) {
            this.expressionMap.onUpdate = {
                conflict: statementOrOverwrite?.conflict_target,
                columns: statementOrOverwrite?.columns,
                overwrite: statementOrOverwrite?.overwrite,
                skipUpdateIfNoValuesChanged:
                    orUpdateOptions?.skipUpdateIfNoValuesChanged,
                upsertType: orUpdateOptions?.upsertType,
            }
            return this
        }

        this.expressionMap.onUpdate = {
            overwrite: statementOrOverwrite,
            conflict: conflictTarget,
            skipUpdateIfNoValuesChanged:
                orUpdateOptions?.skipUpdateIfNoValuesChanged,
            indexPredicate: orUpdateOptions?.indexPredicate,
            upsertType: orUpdateOptions?.upsertType,
        }
        return this
    }

    // -------------------------------------------------------------------------
    // Protected Methods
    // -------------------------------------------------------------------------

    /**
     * Creates INSERT express used to perform insert query.
     */
    protected createInsertExpression() {
        const tableName = this.getTableName(this.getMainTableName())
        const valuesExpression = this.createValuesExpression() // its important to get values before returning expression because oracle rely on native parameters and ordering of them is important
        const returningExpression =
            this.connection.driver.options.type === "oracle" &&
            this.getValueSets().length > 1
                ? null
                : this.createReturningExpression("insert") // oracle doesnt support returning with multi-row insert
        const columnsExpression = this.createColumnNamesExpression()
        let query = "INSERT "

        if (this.expressionMap.onUpdate?.upsertType === "primary-key") {
            query = "UPSERT "
        }

        if (
            DriverUtils.isMySQLFamily(this.connection.driver) ||
            this.connection.driver.options.type === "aurora-mysql"
        ) {
            query += `${this.expressionMap.onIgnore ? " IGNORE " : ""}`
        }

        query += `INTO ${tableName}`

        if (
            this.alias !== this.getMainTableName() &&
            DriverUtils.isPostgresFamily(this.connection.driver)
        ) {
            query += ` AS "${this.alias}"`
        }

        // add columns expression
        if (columnsExpression) {
            query += `(${columnsExpression})`
        } else {
            if (
                !valuesExpression &&
                (DriverUtils.isMySQLFamily(this.connection.driver) ||
                    this.connection.driver.options.type === "aurora-mysql")
            )
                // special syntax for mysql DEFAULT VALUES insertion
                query += "()"
        }

        // add OUTPUT expression
        if (
            returningExpression &&
            this.connection.driver.options.type === "mssql"
        ) {
            query += ` OUTPUT ${returningExpression}`
        }

        // add VALUES expression
        if (valuesExpression) {
            if (
                this.connection.driver.options.type === "oracle" &&
                this.getValueSets().length > 1
            ) {
                query += ` ${valuesExpression}`
            } else {
                query += ` VALUES ${valuesExpression}`
            }
        } else {
            if (
                DriverUtils.isMySQLFamily(this.connection.driver) ||
                this.connection.driver.options.type === "aurora-mysql"
            ) {
                // special syntax for mysql DEFAULT VALUES insertion
                query += " VALUES ()"
            } else {
                query += ` DEFAULT VALUES`
            }
        }
        if (this.expressionMap.onUpdate?.upsertType !== "primary-key") {
            if (
                this.connection.driver.supportedUpsertTypes.includes(
                    "on-conflict-do-update",
                )
            ) {
                if (this.expressionMap.onIgnore) {
                    query += " ON CONFLICT DO NOTHING "
                } else if (this.expressionMap.onConflict) {
                    query += ` ON CONFLICT ${this.expressionMap.onConflict} `
                } else if (this.expressionMap.onUpdate) {
                    const {
                        overwrite,
                        columns,
                        conflict,
                        skipUpdateIfNoValuesChanged,
                        indexPredicate,
                    } = this.expressionMap.onUpdate

                    let conflictTarget = "ON CONFLICT"

                    if (Array.isArray(conflict)) {
                        conflictTarget += ` ( ${conflict
                            .map((column) => this.escape(column))
                            .join(", ")} )`
                        if (
                            indexPredicate &&
                            !DriverUtils.isPostgresFamily(
                                this.connection.driver,
                            )
                        ) {
                            throw new TypeORMError(
                                `indexPredicate option is not supported by the current database driver`,
                            )
                        }
                        if (
                            indexPredicate &&
                            DriverUtils.isPostgresFamily(this.connection.driver)
                        ) {
                            conflictTarget += ` WHERE ( ${this.escape(
                                indexPredicate,
                            )} )`
                        }
                    } else if (conflict) {
                        conflictTarget += ` ON CONSTRAINT ${this.escape(
                            conflict,
                        )}`
                    }

                    if (Array.isArray(overwrite)) {
                        query += ` ${conflictTarget} DO UPDATE SET `
                        query += overwrite
                            ?.map(
                                (column) =>
                                    `${this.escape(
                                        column,
                                    )} = EXCLUDED.${this.escape(column)}`,
                            )
                            .join(", ")
                        query += " "
                    } else if (columns) {
                        query += ` ${conflictTarget} DO UPDATE SET `
                        query += columns
                            .map(
                                (column) =>
                                    `${this.escape(column)} = :${column}`,
                            )
                            .join(", ")
                        query += " "
                    }

                    if (
                        Array.isArray(overwrite) &&
                        skipUpdateIfNoValuesChanged &&
                        DriverUtils.isPostgresFamily(this.connection.driver)
                    ) {
                        query += ` WHERE (`
                        query += overwrite
                            .map(
                                (column) =>
                                    `${tableName}.${this.escape(
                                        column,
                                    )} IS DISTINCT FROM EXCLUDED.${this.escape(
                                        column,
                                    )}`,
                            )
                            .join(" OR ")
                        query += ") "
                    }
                }
            } else if (
                this.connection.driver.supportedUpsertTypes.includes(
                    "on-duplicate-key-update",
                )
            ) {
                if (this.expressionMap.onUpdate) {
                    const { overwrite, columns } = this.expressionMap.onUpdate

                    if (Array.isArray(overwrite)) {
                        query += " ON DUPLICATE KEY UPDATE "
                        query += overwrite
                            .map(
                                (column) =>
                                    `${this.escape(
                                        column,
                                    )} = VALUES(${this.escape(column)})`,
                            )
                            .join(", ")
                        query += " "
                    } else if (Array.isArray(columns)) {
                        query += " ON DUPLICATE KEY UPDATE "
                        query += columns
                            .map(
                                (column) =>
                                    `${this.escape(column)} = :${column}`,
                            )
                            .join(", ")
                        query += " "
                    }
                }
            } else {
                if (this.expressionMap.onUpdate) {
                    throw new TypeORMError(
                        `onUpdate is not supported by the current database driver`,
                    )
                }
            }
        }

        // add RETURNING expression
        if (
            returningExpression &&
            (DriverUtils.isPostgresFamily(this.connection.driver) ||
                this.connection.driver.options.type === "oracle" ||
                this.connection.driver.options.type === "cockroachdb" ||
                DriverUtils.isMySQLFamily(this.connection.driver))
        ) {
            query += ` RETURNING ${returningExpression}`
        }

        // Inserting a specific value for an auto-increment primary key in mssql requires enabling IDENTITY_INSERT
        // IDENTITY_INSERT can only be enabled for tables where there is an IDENTITY column and only if there is a value to be inserted (i.e. supplying DEFAULT is prohibited if IDENTITY_INSERT is enabled)
        if (
            this.connection.driver.options.type === "mssql" &&
            this.expressionMap.mainAlias!.hasMetadata &&
            this.expressionMap
                .mainAlias!.metadata.columns.filter((column) =>
                    this.expressionMap.insertColumns.length > 0
                        ? this.expressionMap.insertColumns.indexOf(
                              column.propertyPath,
                          ) !== -1
                        : column.isInsert,
                )
                .some((column) =>
                    this.isOverridingAutoIncrementBehavior(column),
                )
        ) {
            query = `SET IDENTITY_INSERT ${tableName} ON; ${query}; SET IDENTITY_INSERT ${tableName} OFF`
        }

        return query
    }

    /**
     * Gets list of columns where values must be inserted to.
     */
    protected getInsertedColumns(): ColumnMetadata[] {
        if (!this.expressionMap.mainAlias!.hasMetadata) return []

        return this.expressionMap.mainAlias!.metadata.columns.filter(
            (column) => {
                // if user specified list of columns he wants to insert to, then we filter only them
                if (this.expressionMap.insertColumns.length)
                    return (
                        this.expressionMap.insertColumns.indexOf(
                            column.propertyPath,
                        ) !== -1
                    )

                // skip columns the user doesn't want included by default
                if (!column.isInsert) {
                    return false
                }

                // if user did not specified such list then return all columns except auto-increment one
                // for Oracle we return auto-increment column as well because Oracle does not support DEFAULT VALUES expression
                if (
                    column.isGenerated &&
                    column.generationStrategy === "increment" &&
                    !(this.connection.driver.options.type === "spanner") &&
                    !(this.connection.driver.options.type === "oracle") &&
                    !DriverUtils.isSQLiteFamily(this.connection.driver) &&
                    !DriverUtils.isMySQLFamily(this.connection.driver) &&
                    !(this.connection.driver.options.type === "aurora-mysql") &&
                    !(
                        this.connection.driver.options.type === "mssql" &&
                        this.isOverridingAutoIncrementBehavior(column)
                    )
                )
                    return false

                return true
            },
        )
    }

    /**
     * Creates a columns string where values must be inserted to for INSERT INTO expression.
     */
    protected createColumnNamesExpression(): string {
        const columns = this.getInsertedColumns()
        if (columns.length > 0)
            return columns
                .map((column) => this.escape(column.databaseName))
                .join(", ")

        // in the case if there are no insert columns specified and table without metadata used
        // we get columns from the inserted value map, in the case if only one inserted map is specified
        if (
            !this.expressionMap.mainAlias!.hasMetadata &&
            !this.expressionMap.insertColumns.length
        ) {
            const valueSets = this.getValueSets()
            if (valueSets.length === 1)
                return Object.keys(valueSets[0])
                    .map((columnName) => this.escape(columnName))
                    .join(", ")
        }

        // get a table name and all column database names
        return this.expressionMap.insertColumns
            .map((columnName) => this.escape(columnName))
            .join(", ")
    }

    /**
     * Creates list of values needs to be inserted in the VALUES expression.
     */
    protected createValuesExpression(): string {
        const valueSets = this.getValueSets()
        const columns = this.getInsertedColumns()

        // if column metadatas are given then apply all necessary operations with values
        if (columns.length > 0) {
            let expression = ""
            valueSets.forEach((valueSet, valueSetIndex) => {
                columns.forEach((column, columnIndex) => {
                    if (columnIndex === 0) {
                        if (
                            this.connection.driver.options.type === "oracle" &&
                            valueSets.length > 1
                        ) {
                            expression += " SELECT "
                        } else if (
                            this.connection.driver.options.type === "sap" &&
                            valueSets.length > 1
                        ) {
                            expression += " SELECT "
                        } else {
                            expression += "("
                        }
                    }

                    // extract real value from the entity
                    let value = column.getEntityValue(valueSet)

                    // if column is relational and value is an object then get real referenced column value from this object
                    // for example column value is { question: { id: 1 } }, value will be equal to { id: 1 }
                    // and we extract "1" from this object
                    /*if (column.referencedColumn && value instanceof Object && !(typeof value === "function")) { // todo: check if we still need it since getEntityValue already has similar code
                        value = column.referencedColumn.getEntityValue(value);
                    }*/

                    if (!(typeof value === "function")) {
                        // make sure our value is normalized by a driver
                        value = this.connection.driver.preparePersistentValue(
                            value,
                            column,
                        )
                    }

                    // newly inserted entities always have a version equal to 1 (first version)
                    // also, user-specified version must be empty
                    if (column.isVersion && value === undefined) {
                        expression += "1"

                        // } else if (column.isNestedSetLeft) {
                        //     const tableName = this.connection.driver.escape(column.entityMetadata.tablePath);
                        //     const rightColumnName = this.connection.driver.escape(column.entityMetadata.nestedSetRightColumn!.databaseName);
                        //     const subQuery = `(SELECT c.max + 1 FROM (SELECT MAX(${rightColumnName}) as max from ${tableName}) c)`;
                        //     expression += subQuery;
                        //
                        // } else if (column.isNestedSetRight) {
                        //     const tableName = this.connection.driver.escape(column.entityMetadata.tablePath);
                        //     const rightColumnName = this.connection.driver.escape(column.entityMetadata.nestedSetRightColumn!.databaseName);
                        //     const subQuery = `(SELECT c.max + 2 FROM (SELECT MAX(${rightColumnName}) as max from ${tableName}) c)`;
                        //     expression += subQuery;
                    } else if (column.isDiscriminator) {
                        expression += this.createParameter(
                            this.expressionMap.mainAlias!.metadata
                                .discriminatorValue,
                        )
                        // return "1";

                        // for create and update dates we insert current date
                        // no, we don't do it because this constant is already in "default" value of the column
                        // with extended timestamp functionality, like CURRENT_TIMESTAMP(6) for example
                        // } else if (column.isCreateDate || column.isUpdateDate) {
                        //     return "CURRENT_TIMESTAMP";

                        // if column is generated uuid and database does not support its generation and custom generated value was not provided by a user - we generate a new uuid value for insertion
                    } else if (
                        column.isGenerated &&
                        column.generationStrategy === "uuid" &&
                        !this.connection.driver.isUUIDGenerationSupported() &&
                        value === undefined
                    ) {
                        value = uuidv4()
                        expression += this.createParameter(value)

                        if (
                            !(
                                valueSetIndex in
                                this.expressionMap.locallyGenerated
                            )
                        ) {
                            this.expressionMap.locallyGenerated[valueSetIndex] =
                                {}
                        }
                        column.setEntityValue(
                            this.expressionMap.locallyGenerated[valueSetIndex],
                            value,
                        )

                        // if value for this column was not provided then insert default value
                    } else if (value === undefined) {
                        if (
                            (this.connection.driver.options.type === "oracle" &&
                                valueSets.length > 1) ||
                            DriverUtils.isSQLiteFamily(
                                this.connection.driver,
                            ) ||
                            this.connection.driver.options.type === "sap" ||
                            this.connection.driver.options.type === "spanner"
                        ) {
                            // unfortunately sqlite does not support DEFAULT expression in INSERT queries
                            if (
                                column.default !== undefined &&
                                column.default !== null
                            ) {
                                // try to use default defined in the column
                                expression +=
                                    this.connection.driver.normalizeDefault(
                                        column,
                                    )
                            } else {
                                expression += "NULL" // otherwise simply use NULL and pray if column is nullable
                            }
                        } else {
                            expression += "DEFAULT"
                        }
                    } else if (
                        value === null &&
                        this.connection.driver.options.type === "spanner"
                    ) {
                        expression += "NULL"

                        // support for SQL expressions in queries
                    } else if (typeof value === "function") {
                        expression += value()

                        // just any other regular value
                    } else {
                        if (this.connection.driver.options.type === "mssql")
                            value = (
                                this.connection.driver as SqlServerDriver
                            ).parametrizeValue(column, value)

                        // we need to store array values in a special class to make sure parameter replacement will work correctly
                        // if (value instanceof Array)
                        //     value = new ArrayParameter(value);

                        const paramName = this.createParameter(value)

                        if (
                            (DriverUtils.isMySQLFamily(
                                this.connection.driver,
                            ) ||
                                this.connection.driver.options.type ===
                                    "aurora-mysql") &&
                            this.connection.driver.spatialTypes.indexOf(
                                column.type,
                            ) !== -1
                        ) {
                            const useLegacy = (
                                this.connection.driver as
                                    | MysqlDriver
                                    | AuroraMysqlDriver
                            ).options.legacySpatialSupport
                            const geomFromText = useLegacy
                                ? "GeomFromText"
                                : "ST_GeomFromText"
                            if (column.srid != null) {
                                expression += `${geomFromText}(${paramName}, ${column.srid})`
                            } else {
                                expression += `${geomFromText}(${paramName})`
                            }
                        } else if (
                            DriverUtils.isPostgresFamily(
                                this.connection.driver,
                            ) &&
                            this.connection.driver.spatialTypes.indexOf(
                                column.type,
                            ) !== -1
                        ) {
                            if (column.srid != null) {
                                expression += `ST_SetSRID(ST_GeomFromGeoJSON(${paramName}), ${column.srid})::${column.type}`
                            } else {
                                expression += `ST_GeomFromGeoJSON(${paramName})::${column.type}`
                            }
                        } else if (
                            this.connection.driver.options.type === "mssql" &&
                            this.connection.driver.spatialTypes.indexOf(
                                column.type,
                            ) !== -1
                        ) {
                            expression +=
                                column.type +
                                "::STGeomFromText(" +
                                paramName +
                                ", " +
                                (column.srid || "0") +
                                ")"
                        } else {
                            expression += paramName
                        }
                    }

                    if (columnIndex === columns.length - 1) {
                        if (valueSetIndex === valueSets.length - 1) {
                            if (
                                this.connection.driver.options.type ===
                                    "oracle" &&
                                valueSets.length > 1
                            ) {
                                expression += " FROM DUAL "
                            } else if (
                                this.connection.driver.options.type === "sap" &&
                                valueSets.length > 1
                            ) {
                                expression += " FROM dummy "
                            } else {
                                expression += ")"
                            }
                        } else {
                            if (
                                this.connection.driver.options.type ===
                                    "oracle" &&
                                valueSets.length > 1
                            ) {
                                expression += " FROM DUAL UNION ALL "
                            } else if (
                                this.connection.driver.options.type === "sap" &&
                                valueSets.length > 1
                            ) {
                                expression += " FROM dummy UNION ALL "
                            } else {
                                expression += "), "
                            }
                        }
                    } else {
                        expression += ", "
                    }
                })
            })
            if (expression === "()") return ""

            return expression
        } else {
            // for tables without metadata
            // get values needs to be inserted
            let expression = ""

            valueSets.forEach((valueSet, insertionIndex) => {
                const columns = Object.keys(valueSet)
                columns.forEach((columnName, columnIndex) => {
                    if (columnIndex === 0) {
                        expression += "("
                    }

                    const value = valueSet[columnName]

                    // support for SQL expressions in queries
                    if (typeof value === "function") {
                        expression += value()

                        // if value for this column was not provided then insert default value
                    } else if (value === undefined) {
                        if (
                            (this.connection.driver.options.type === "oracle" &&
                                valueSets.length > 1) ||
                            DriverUtils.isSQLiteFamily(
                                this.connection.driver,
                            ) ||
                            this.connection.driver.options.type === "sap" ||
                            this.connection.driver.options.type === "spanner"
                        ) {
                            expression += "NULL"
                        } else {
                            expression += "DEFAULT"
                        }
                    } else if (
                        value === null &&
                        this.connection.driver.options.type === "spanner"
                    ) {
                        // just any other regular value
                    } else {
                        expression += this.createParameter(value)
                    }

                    if (columnIndex === Object.keys(valueSet).length - 1) {
                        if (insertionIndex === valueSets.length - 1) {
                            expression += ")"
                        } else {
                            expression += "), "
                        }
                    } else {
                        expression += ", "
                    }
                })
            })
            if (expression === "()") return ""
            return expression
        }
    }

    /**
     * Gets array of values need to be inserted into the target table.
     */
    protected getValueSets(): ObjectLiteral[] {
        if (Array.isArray(this.expressionMap.valuesSet))
            return this.expressionMap.valuesSet

        if (ObjectUtils.isObject(this.expressionMap.valuesSet))
            return [this.expressionMap.valuesSet]

        throw new InsertValuesMissingError()
    }

    /**
     * Checks if column is an auto-generated primary key, but the current insertion specifies a value for it.
     *
     * @param column
     */
    protected isOverridingAutoIncrementBehavior(
        column: ColumnMetadata,
    ): boolean {
        return (
            column.isPrimary &&
            column.isGenerated &&
            column.generationStrategy === "increment" &&
            this.getValueSets().some(
                (valueSet) =>
                    column.getEntityValue(valueSet) !== undefined &&
                    column.getEntityValue(valueSet) !== null,
            )
        )
    }
}
/**
 * Allows to work with entity relations and perform specific operations with those relations.
 *
 * todo: add transactions everywhere
 */
export class RelationQueryBuilder<
    Entity extends ObjectLiteral,
> extends QueryBuilder<Entity> {
    readonly "@instanceof" = Symbol.for("RelationQueryBuilder")

    // -------------------------------------------------------------------------
    // Public Implemented Methods
    // -------------------------------------------------------------------------

    /**
     * Gets generated SQL query without parameters being replaced.
     */
    getQuery(): string {
        return ""
    }

    // -------------------------------------------------------------------------
    // Public Methods
    // -------------------------------------------------------------------------

    /**
     * Sets entity (target) which relations will be updated.
     */
    of(entity: any | any[]): this {
        this.expressionMap.of = entity
        return this
    }

    /**
     * Sets entity relation's value.
     * Value can be entity, entity id or entity id map (if entity has composite ids).
     * Works only for many-to-one and one-to-one relations.
     * For many-to-many and one-to-many relations use #add and #remove methods instead.
     */
    async set(value: any): Promise<void> {
        const relation = this.expressionMap.relationMetadata

        if (!this.expressionMap.of)
            // todo: move this check before relation query builder creation?
            throw new TypeORMError(
                `Entity whose relation needs to be set is not set. Use .of method to define whose relation you want to set.`,
            )

        if (relation.isManyToMany || relation.isOneToMany)
            throw new TypeORMError(
                `Set operation is only supported for many-to-one and one-to-one relations. ` +
                    `However given "${relation.propertyPath}" has ${relation.relationType} relation. ` +
                    `Use .add() method instead.`,
            )

        // if there are multiple join columns then user must send id map as "value" argument. check if he really did it
        if (
            relation.joinColumns &&
            relation.joinColumns.length > 1 &&
            (!ObjectUtils.isObject(value) ||
                Object.keys(value).length < relation.joinColumns.length)
        )
            throw new TypeORMError(
                `Value to be set into the relation must be a map of relation ids, for example: .set({ firstName: "...", lastName: "..." })`,
            )

        const updater = new RelationUpdater(this, this.expressionMap)
        return updater.update(value)
    }

    /**
     * Adds (binds) given value to entity relation.
     * Value can be entity, entity id or entity id map (if entity has composite ids).
     * Value also can be array of entities, array of entity ids or array of entity id maps (if entity has composite ids).
     * Works only for many-to-many and one-to-many relations.
     * For many-to-one and one-to-one use #set method instead.
     */
    async add(value: any | any[]): Promise<void> {
        if (Array.isArray(value) && value.length === 0) return

        const relation = this.expressionMap.relationMetadata

        if (!this.expressionMap.of)
            // todo: move this check before relation query builder creation?
            throw new TypeORMError(
                `Entity whose relation needs to be set is not set. Use .of method to define whose relation you want to set.`,
            )

        if (relation.isManyToOne || relation.isOneToOne)
            throw new TypeORMError(
                `Add operation is only supported for many-to-many and one-to-many relations. ` +
                    `However given "${relation.propertyPath}" has ${relation.relationType} relation. ` +
                    `Use .set() method instead.`,
            )

        // if there are multiple join columns then user must send id map as "value" argument. check if he really did it
        if (
            relation.joinColumns &&
            relation.joinColumns.length > 1 &&
            (!ObjectUtils.isObject(value) ||
                Object.keys(value).length < relation.joinColumns.length)
        )
            throw new TypeORMError(
                `Value to be set into the relation must be a map of relation ids, for example: .set({ firstName: "...", lastName: "..." })`,
            )

        const updater = new RelationUpdater(this, this.expressionMap)
        return updater.update(value)
    }

    /**
     * Removes (unbinds) given value from entity relation.
     * Value can be entity, entity id or entity id map (if entity has composite ids).
     * Value also can be array of entities, array of entity ids or array of entity id maps (if entity has composite ids).
     * Works only for many-to-many and one-to-many relations.
     * For many-to-one and one-to-one use #set method instead.
     */
    async remove(value: any | any[]): Promise<void> {
        if (Array.isArray(value) && value.length === 0) return

        const relation = this.expressionMap.relationMetadata

        if (!this.expressionMap.of)
            // todo: move this check before relation query builder creation?
            throw new TypeORMError(
                `Entity whose relation needs to be set is not set. Use .of method to define whose relation you want to set.`,
            )

        if (relation.isManyToOne || relation.isOneToOne)
            throw new TypeORMError(
                `Add operation is only supported for many-to-many and one-to-many relations. ` +
                    `However given "${relation.propertyPath}" has ${relation.relationType} relation. ` +
                    `Use .set(null) method instead.`,
            )

        const remover = new RelationRemover(this, this.expressionMap)
        return remover.remove(value)
    }

    /**
     * Adds (binds) and removes (unbinds) given values to/from entity relation.
     * Value can be entity, entity id or entity id map (if entity has composite ids).
     * Value also can be array of entities, array of entity ids or array of entity id maps (if entity has composite ids).
     * Works only for many-to-many and one-to-many relations.
     * For many-to-one and one-to-one use #set method instead.
     */
    async addAndRemove(
        added: any | any[],
        removed: any | any[],
    ): Promise<void> {
        await this.remove(removed)
        await this.add(added)
    }

    /**
     * Gets entity's relation id.
    async getId(): Promise<any> {

    }*/

    /**
     * Gets entity's relation ids.
    async getIds(): Promise<any[]> {
        return [];
    }*/

    /**
     * Loads a single entity (relational) from the relation.
     * You can also provide id of relational entity to filter by.
     */
    async loadOne<T = any>(): Promise<T | undefined> {
        return this.loadMany<T>().then((results) => results[0])
    }

    /**
     * Loads many entities (relational) from the relation.
     * You can also provide ids of relational entities to filter by.
     */
    async loadMany<T = any>(): Promise<T[]> {
        let of = this.expressionMap.of
        if (!ObjectUtils.isObject(of)) {
            const metadata = this.expressionMap.mainAlias!.metadata
            if (metadata.hasMultiplePrimaryKeys)
                throw new TypeORMError(
                    `Cannot load entity because only one primary key was specified, however entity contains multiple primary keys`,
                )

            of = metadata.primaryColumns[0].createValueMap(of)
        }

        return this.connection.relationLoader.load(
            this.expressionMap.relationMetadata,
            of,
            this.queryRunner,
        )
    }
}

/**
 * Allows to build complex sql queries in a fashion way and execute those queries.
 */
export class SelectQueryBuilder<Entity extends ObjectLiteral>
    extends QueryBuilder<Entity>
    implements WhereExpressionBuilder
{
    readonly "@instanceof" = Symbol.for("SelectQueryBuilder")

    protected findOptions: FindManyOptions = {}
    protected selects: string[] = []
    protected joins: {
        type: "inner" | "left"
        alias: string
        parentAlias: string
        relationMetadata: RelationMetadata
        select: boolean
        selection: FindOptionsSelect<any> | undefined
    }[] = []
    protected conditions: string = ""
    protected orderBys: {
        alias: string
        direction: "ASC" | "DESC"
        nulls?: "NULLS FIRST" | "NULLS LAST"
    }[] = []
    protected relationMetadatas: RelationMetadata[] = []

    // -------------------------------------------------------------------------
    // Public Implemented Methods
    // -------------------------------------------------------------------------

    /**
     * Gets generated SQL query without parameters being replaced.
     */
    getQuery(): string {
        let sql = this.createComment()
        sql += this.createCteExpression()
        sql += this.createSelectExpression()
        sql += this.createJoinExpression()
        sql += this.createWhereExpression()
        sql += this.createGroupByExpression()
        sql += this.createHavingExpression()
        sql += this.createOrderByExpression()
        sql += this.createLimitOffsetExpression()
        sql += this.createLockExpression()
        sql = sql.trim()
        if (this.expressionMap.subQuery) sql = "(" + sql + ")"
        return this.replacePropertyNamesForTheWholeQuery(sql)
    }

    // -------------------------------------------------------------------------
    // Public Methods
    // -------------------------------------------------------------------------

    setFindOptions(findOptions: FindManyOptions<Entity>) {
        this.findOptions = findOptions
        this.applyFindOptions()
        return this
    }

    /**
     * Creates a subquery - query that can be used inside other queries.
     */
    subQuery(): SelectQueryBuilder<any> {
        const qb = this.createQueryBuilder()
        qb.expressionMap.subQuery = true
        qb.parentQueryBuilder = this
        return qb
    }

    /**
     * Creates SELECT query.
     * Replaces all previous selections if they exist.
     */
    select(): this

    /**
     * Creates SELECT query.
     * Replaces all previous selections if they exist.
     */
    select(
        selection: (qb: SelectQueryBuilder<any>) => SelectQueryBuilder<any>,
        selectionAliasName?: string,
    ): this

    /**
     * Creates SELECT query and selects given data.
     * Replaces all previous selections if they exist.
     */
    select(selection: string, selectionAliasName?: string): this

    /**
     * Creates SELECT query and selects given data.
     * Replaces all previous selections if they exist.
     */
    select(selection: string[]): this

    /**
     * Creates SELECT query and selects given data.
     * Replaces all previous selections if they exist.
     */
    select(
        selection?:
            | string
            | string[]
            | ((qb: SelectQueryBuilder<any>) => SelectQueryBuilder<any>),
        selectionAliasName?: string,
    ): SelectQueryBuilder<Entity> {
        this.expressionMap.queryType = "select"
        if (Array.isArray(selection)) {
            this.expressionMap.selects = selection.map((selection) => ({
                selection: selection,
            }))
        } else if (typeof selection === "function") {
            const subQueryBuilder = selection(this.subQuery())
            this.setParameters(subQueryBuilder.getParameters())
            this.expressionMap.selects.push({
                selection: subQueryBuilder.getQuery(),
                aliasName: selectionAliasName,
            })
        } else if (selection) {
            this.expressionMap.selects = [
                { selection: selection, aliasName: selectionAliasName },
            ]
        }

        return this
    }

    /**
     * Adds new selection to the SELECT query.
     */
    addSelect(
        selection: (qb: SelectQueryBuilder<any>) => SelectQueryBuilder<any>,
        selectionAliasName?: string,
    ): this

    /**
     * Adds new selection to the SELECT query.
     */
    addSelect(selection: string, selectionAliasName?: string): this

    /**
     * Adds new selection to the SELECT query.
     */
    addSelect(selection: string[]): this

    /**
     * Adds new selection to the SELECT query.
     */
    addSelect(
        selection:
            | string
            | string[]
            | ((qb: SelectQueryBuilder<any>) => SelectQueryBuilder<any>),
        selectionAliasName?: string,
    ): this {
        if (!selection) return this

        if (Array.isArray(selection)) {
            this.expressionMap.selects = this.expressionMap.selects.concat(
                selection.map((selection) => ({ selection: selection })),
            )
        } else if (typeof selection === "function") {
            const subQueryBuilder = selection(this.subQuery())
            this.setParameters(subQueryBuilder.getParameters())
            this.expressionMap.selects.push({
                selection: subQueryBuilder.getQuery(),
                aliasName: selectionAliasName,
            })
        } else if (selection) {
            this.expressionMap.selects.push({
                selection: selection,
                aliasName: selectionAliasName,
            })
        }

        return this
    }

    /**
     * Set max execution time.
     * @param milliseconds
     */
    maxExecutionTime(milliseconds: number): this {
        this.expressionMap.maxExecutionTime = milliseconds
        return this
    }

    /**
     * Sets whether the selection is DISTINCT.
     */
    distinct(distinct: boolean = true): this {
        this.expressionMap.selectDistinct = distinct
        return this
    }

    /**
     * Sets the distinct on clause for Postgres.
     */
    distinctOn(distinctOn: string[]): this {
        this.expressionMap.selectDistinctOn = distinctOn
        return this
    }

    fromDummy(): SelectQueryBuilder<any> {
        return this.from(
            this.connection.driver.dummyTableName ??
                "(SELECT 1 AS dummy_column)",
            "dummy_table",
        )
    }

    /**
     * Specifies FROM which entity's table select/update/delete will be executed.
     * Also sets a main string alias of the selection data.
     * Removes all previously set from-s.
     */
    from<T extends ObjectLiteral>(
        entityTarget: (qb: SelectQueryBuilder<any>) => SelectQueryBuilder<any>,
        aliasName: string,
    ): SelectQueryBuilder<T>

    /**
     * Specifies FROM which entity's table select/update/delete will be executed.
     * Also sets a main string alias of the selection data.
     * Removes all previously set from-s.
     */
    from<T extends ObjectLiteral>(
        entityTarget: EntityTarget<T>,
        aliasName: string,
    ): SelectQueryBuilder<T>

    /**
     * Specifies FROM which entity's table select/update/delete will be executed.
     * Also sets a main string alias of the selection data.
     * Removes all previously set from-s.
     */
    from<T extends ObjectLiteral>(
        entityTarget:
            | EntityTarget<T>
            | ((qb: SelectQueryBuilder<any>) => SelectQueryBuilder<any>),
        aliasName: string,
    ): SelectQueryBuilder<T> {
        const mainAlias = this.createFromAlias(entityTarget, aliasName)
        this.expressionMap.setMainAlias(mainAlias)
        return this as any as SelectQueryBuilder<T>
    }

    /**
     * Specifies FROM which entity's table select/update/delete will be executed.
     * Also sets a main string alias of the selection data.
     */
    addFrom<T extends ObjectLiteral>(
        entityTarget: (qb: SelectQueryBuilder<any>) => SelectQueryBuilder<any>,
        aliasName: string,
    ): SelectQueryBuilder<T>

    /**
     * Specifies FROM which entity's table select/update/delete will be executed.
     * Also sets a main string alias of the selection data.
     */
    addFrom<T extends ObjectLiteral>(
        entityTarget: EntityTarget<T>,
        aliasName: string,
    ): SelectQueryBuilder<T>

    /**
     * Specifies FROM which entity's table select/update/delete will be executed.
     * Also sets a main string alias of the selection data.
     */
    addFrom<T extends ObjectLiteral>(
        entityTarget:
            | EntityTarget<T>
            | ((qb: SelectQueryBuilder<any>) => SelectQueryBuilder<any>),
        aliasName: string,
    ): SelectQueryBuilder<T> {
        const alias = this.createFromAlias(entityTarget, aliasName)
        if (!this.expressionMap.mainAlias)
            this.expressionMap.setMainAlias(alias)

        return this as any as SelectQueryBuilder<T>
    }

    /**
     * INNER JOINs (without selection) given subquery.
     * You also need to specify an alias of the joined data.
     * Optionally, you can add condition and parameters used in condition.
     */
    innerJoin(
        subQueryFactory: (
            qb: SelectQueryBuilder<any>,
        ) => SelectQueryBuilder<any>,
        alias: string,
        condition?: string,
        parameters?: ObjectLiteral,
    ): this

    /**
     * INNER JOINs (without selection) entity's property.
     * Given entity property should be a relation.
     * You also need to specify an alias of the joined data.
     * Optionally, you can add condition and parameters used in condition.
     */
    innerJoin(
        property: string,
        alias: string,
        condition?: string,
        parameters?: ObjectLiteral,
    ): this

    /**
     * INNER JOINs (without selection) given entity's table.
     * You also need to specify an alias of the joined data.
     * Optionally, you can add condition and parameters used in condition.
     */
    innerJoin(
        entity: Function | string,
        alias: string,
        condition?: string,
        parameters?: ObjectLiteral,
    ): this

    /**
     * INNER JOINs (without selection) given table.
     * You also need to specify an alias of the joined data.
     * Optionally, you can add condition and parameters used in condition.
     */
    innerJoin(
        tableName: string,
        alias: string,
        condition?: string,
        parameters?: ObjectLiteral,
    ): this

    /**
     * INNER JOINs (without selection).
     * You also need to specify an alias of the joined data.
     * Optionally, you can add condition and parameters used in condition.
     */
    innerJoin(
        entityOrProperty:
            | Function
            | string
            | ((qb: SelectQueryBuilder<any>) => SelectQueryBuilder<any>),
        alias: string,
        condition?: string,
        parameters?: ObjectLiteral,
    ): this {
        this.join("INNER", entityOrProperty, alias, condition, parameters)
        return this
    }

    /**
     * LEFT JOINs (without selection) given subquery.
     * You also need to specify an alias of the joined data.
     * Optionally, you can add condition and parameters used in condition.
     */
    leftJoin(
        subQueryFactory: (
            qb: SelectQueryBuilder<any>,
        ) => SelectQueryBuilder<any>,
        alias: string,
        condition?: string,
        parameters?: ObjectLiteral,
    ): this

    /**
     * LEFT JOINs (without selection) entity's property.
     * Given entity property should be a relation.
     * You also need to specify an alias of the joined data.
     * Optionally, you can add condition and parameters used in condition.
     */
    leftJoin(
        property: string,
        alias: string,
        condition?: string,
        parameters?: ObjectLiteral,
    ): this

    /**
     * LEFT JOINs (without selection) entity's table.
     * You also need to specify an alias of the joined data.
     * Optionally, you can add condition and parameters used in condition.
     */
    leftJoin(
        entity: Function | string,
        alias: string,
        condition?: string,
        parameters?: ObjectLiteral,
    ): this

    /**
     * LEFT JOINs (without selection) given table.
     * You also need to specify an alias of the joined data.
     * Optionally, you can add condition and parameters used in condition.
     */
    leftJoin(
        tableName: string,
        alias: string,
        condition?: string,
        parameters?: ObjectLiteral,
    ): this

    /**
     * LEFT JOINs (without selection).
     * You also need to specify an alias of the joined data.
     * Optionally, you can add condition and parameters used in condition.
     */
    leftJoin(
        entityOrProperty:
            | Function
            | string
            | ((qb: SelectQueryBuilder<any>) => SelectQueryBuilder<any>),
        alias: string,
        condition?: string,
        parameters?: ObjectLiteral,
    ): this {
        this.join("LEFT", entityOrProperty, alias, condition, parameters)
        return this
    }

    /**
     * INNER JOINs given subquery and adds all selection properties to SELECT..
     * You also need to specify an alias of the joined data.
     * Optionally, you can add condition and parameters used in condition.
     */
    innerJoinAndSelect(
        subQueryFactory: (
            qb: SelectQueryBuilder<any>,
        ) => SelectQueryBuilder<any>,
        alias: string,
        condition?: string,
        parameters?: ObjectLiteral,
    ): this

    /**
     * INNER JOINs entity's property and adds all selection properties to SELECT.
     * Given entity property should be a relation.
     * You also need to specify an alias of the joined data.
     * Optionally, you can add condition and parameters used in condition.
     */
    innerJoinAndSelect(
        property: string,
        alias: string,
        condition?: string,
        parameters?: ObjectLiteral,
    ): this

    /**
     * INNER JOINs entity and adds all selection properties to SELECT.
     * You also need to specify an alias of the joined data.
     * Optionally, you can add condition and parameters used in condition.
     */
    innerJoinAndSelect(
        entity: Function | string,
        alias: string,
        condition?: string,
        parameters?: ObjectLiteral,
    ): this

    /**
     * INNER JOINs table and adds all selection properties to SELECT.
     * You also need to specify an alias of the joined data.
     * Optionally, you can add condition and parameters used in condition.
     */
    innerJoinAndSelect(
        tableName: string,
        alias: string,
        condition?: string,
        parameters?: ObjectLiteral,
    ): this

    /**
     * INNER JOINs and adds all selection properties to SELECT.
     * You also need to specify an alias of the joined data.
     * Optionally, you can add condition and parameters used in condition.
     */
    innerJoinAndSelect(
        entityOrProperty:
            | Function
            | string
            | ((qb: SelectQueryBuilder<any>) => SelectQueryBuilder<any>),
        alias: string,
        condition?: string,
        parameters?: ObjectLiteral,
    ): this {
        this.addSelect(alias)
        this.innerJoin(entityOrProperty, alias, condition, parameters)
        return this
    }

    /**
     * LEFT JOINs given subquery and adds all selection properties to SELECT..
     * You also need to specify an alias of the joined data.
     * Optionally, you can add condition and parameters used in condition.
     */
    leftJoinAndSelect(
        subQueryFactory: (
            qb: SelectQueryBuilder<any>,
        ) => SelectQueryBuilder<any>,
        alias: string,
        condition?: string,
        parameters?: ObjectLiteral,
    ): this

    /**
     * LEFT JOINs entity's property and adds all selection properties to SELECT.
     * Given entity property should be a relation.
     * You also need to specify an alias of the joined data.
     * Optionally, you can add condition and parameters used in condition.
     */
    leftJoinAndSelect(
        property: string,
        alias: string,
        condition?: string,
        parameters?: ObjectLiteral,
    ): this

    /**
     * LEFT JOINs entity and adds all selection properties to SELECT.
     * You also need to specify an alias of the joined data.
     * Optionally, you can add condition and parameters used in condition.
     */
    leftJoinAndSelect(
        entity: Function | string,
        alias: string,
        condition?: string,
        parameters?: ObjectLiteral,
    ): this

    /**
     * LEFT JOINs table and adds all selection properties to SELECT.
     * You also need to specify an alias of the joined data.
     * Optionally, you can add condition and parameters used in condition.
     */
    leftJoinAndSelect(
        tableName: string,
        alias: string,
        condition?: string,
        parameters?: ObjectLiteral,
    ): this

    /**
     * LEFT JOINs and adds all selection properties to SELECT.
     * You also need to specify an alias of the joined data.
     * Optionally, you can add condition and parameters used in condition.
     */
    leftJoinAndSelect(
        entityOrProperty:
            | Function
            | string
            | ((qb: SelectQueryBuilder<any>) => SelectQueryBuilder<any>),
        alias: string,
        condition?: string,
        parameters?: ObjectLiteral,
    ): this {
        this.addSelect(alias)
        this.leftJoin(entityOrProperty, alias, condition, parameters)
        return this
    }

    /**
     * INNER JOINs given subquery, SELECTs the data returned by a join and MAPs all that data to some entity's property.
     * This is extremely useful when you want to select some data and map it to some virtual property.
     * It will assume that there are multiple rows of selecting data, and mapped result will be an array.
     * Given entity property should be a relation.
     * You also need to specify an alias of the joined data.
     * Optionally, you can add condition and parameters used in condition.
     */
    innerJoinAndMapMany(
        mapToProperty: string,
        subQueryFactory: (
            qb: SelectQueryBuilder<any>,
        ) => SelectQueryBuilder<any>,
        alias: string,
        condition?: string,
        parameters?: ObjectLiteral,
    ): this

    /**
     * INNER JOINs entity's property, SELECTs the data returned by a join and MAPs all that data to some entity's property.
     * This is extremely useful when you want to select some data and map it to some virtual property.
     * It will assume that there are multiple rows of selecting data, and mapped result will be an array.
     * Given entity property should be a relation.
     * You also need to specify an alias of the joined data.
     * Optionally, you can add condition and parameters used in condition.
     */
    innerJoinAndMapMany(
        mapToProperty: string,
        property: string,
        alias: string,
        condition?: string,
        parameters?: ObjectLiteral,
    ): this

    /**
     * INNER JOINs entity's table, SELECTs the data returned by a join and MAPs all that data to some entity's property.
     * This is extremely useful when you want to select some data and map it to some virtual property.
     * It will assume that there are multiple rows of selecting data, and mapped result will be an array.
     * You also need to specify an alias of the joined data.
     * Optionally, you can add condition and parameters used in condition.
     */
    innerJoinAndMapMany(
        mapToProperty: string,
        entity: Function | string,
        alias: string,
        condition?: string,
        parameters?: ObjectLiteral,
    ): this

    /**
     * INNER JOINs table, SELECTs the data returned by a join and MAPs all that data to some entity's property.
     * This is extremely useful when you want to select some data and map it to some virtual property.
     * It will assume that there are multiple rows of selecting data, and mapped result will be an array.
     * You also need to specify an alias of the joined data.
     * Optionally, you can add condition and parameters used in condition.
     */
    innerJoinAndMapMany(
        mapToProperty: string,
        tableName: string,
        alias: string,
        condition?: string,
        parameters?: ObjectLiteral,
    ): this

    /**
     * INNER JOINs, SELECTs the data returned by a join and MAPs all that data to some entity's property.
     * This is extremely useful when you want to select some data and map it to some virtual property.
     * It will assume that there are multiple rows of selecting data, and mapped result will be an array.
     * You also need to specify an alias of the joined data.
     * Optionally, you can add condition and parameters used in condition.
     */
    innerJoinAndMapMany(
        mapToProperty: string,
        entityOrProperty:
            | Function
            | string
            | ((qb: SelectQueryBuilder<any>) => SelectQueryBuilder<any>),
        alias: string,
        condition?: string,
        parameters?: ObjectLiteral,
    ): this {
        this.addSelect(alias)
        this.join(
            "INNER",
            entityOrProperty,
            alias,
            condition,
            parameters,
            mapToProperty,
            true,
        )
        return this
    }

    /**
     * INNER JOINs given subquery, SELECTs the data returned by a join and MAPs all that data to some entity's property.
     * This is extremely useful when you want to select some data and map it to some virtual property.
     * It will assume that there is a single row of selecting data, and mapped result will be a single selected value.
     * Given entity property should be a relation.
     * You also need to specify an alias of the joined data.
     * Optionally, you can add condition and parameters used in condition.
     */
    innerJoinAndMapOne(
        mapToProperty: string,
        subQueryFactory: (
            qb: SelectQueryBuilder<any>,
        ) => SelectQueryBuilder<any>,
        alias: string,
        condition?: string,
        parameters?: ObjectLiteral,
        mapAsEntity?: Function | string,
    ): this

    /**
     * INNER JOINs entity's property, SELECTs the data returned by a join and MAPs all that data to some entity's property.
     * This is extremely useful when you want to select some data and map it to some virtual property.
     * It will assume that there is a single row of selecting data, and mapped result will be a single selected value.
     * Given entity property should be a relation.
     * You also need to specify an alias of the joined data.
     * Optionally, you can add condition and parameters used in condition.
     */
    innerJoinAndMapOne(
        mapToProperty: string,
        property: string,
        alias: string,
        condition?: string,
        parameters?: ObjectLiteral,
    ): this

    /**
     * INNER JOINs entity's table, SELECTs the data returned by a join and MAPs all that data to some entity's property.
     * This is extremely useful when you want to select some data and map it to some virtual property.
     * It will assume that there is a single row of selecting data, and mapped result will be a single selected value.
     * You also need to specify an alias of the joined data.
     * Optionally, you can add condition and parameters used in condition.
     */
    innerJoinAndMapOne(
        mapToProperty: string,
        entity: Function | string,
        alias: string,
        condition?: string,
        parameters?: ObjectLiteral,
    ): this

    /**
     * INNER JOINs table, SELECTs the data returned by a join and MAPs all that data to some entity's property.
     * This is extremely useful when you want to select some data and map it to some virtual property.
     * It will assume that there is a single row of selecting data, and mapped result will be a single selected value.
     * You also need to specify an alias of the joined data.
     * Optionally, you can add condition and parameters used in condition.
     */
    innerJoinAndMapOne(
        mapToProperty: string,
        tableName: string,
        alias: string,
        condition?: string,
        parameters?: ObjectLiteral,
    ): this

    /**
     * INNER JOINs, SELECTs the data returned by a join and MAPs all that data to some entity's property.
     * This is extremely useful when you want to select some data and map it to some virtual property.
     * It will assume that there is a single row of selecting data, and mapped result will be a single selected value.
     * You also need to specify an alias of the joined data.
     * Optionally, you can add condition and parameters used in condition.
     */
    innerJoinAndMapOne(
        mapToProperty: string,
        entityOrProperty:
            | Function
            | string
            | ((qb: SelectQueryBuilder<any>) => SelectQueryBuilder<any>),
        alias: string,
        condition?: string,
        parameters?: ObjectLiteral,
        mapAsEntity?: Function | string,
    ): this {
        this.addSelect(alias)
        this.join(
            "INNER",
            entityOrProperty,
            alias,
            condition,
            parameters,
            mapToProperty,
            false,
            mapAsEntity,
        )
        return this
    }

    /**
     * LEFT JOINs given subquery, SELECTs the data returned by a join and MAPs all that data to some entity's property.
     * This is extremely useful when you want to select some data and map it to some virtual property.
     * It will assume that there are multiple rows of selecting data, and mapped result will be an array.
     * Given entity property should be a relation.
     * You also need to specify an alias of the joined data.
     * Optionally, you can add condition and parameters used in condition.
     */
    leftJoinAndMapMany(
        mapToProperty: string,
        subQueryFactory: (
            qb: SelectQueryBuilder<any>,
        ) => SelectQueryBuilder<any>,
        alias: string,
        condition?: string,
        parameters?: ObjectLiteral,
    ): this

    /**
     * LEFT JOINs entity's property, SELECTs the data returned by a join and MAPs all that data to some entity's property.
     * This is extremely useful when you want to select some data and map it to some virtual property.
     * It will assume that there are multiple rows of selecting data, and mapped result will be an array.
     * Given entity property should be a relation.
     * You also need to specify an alias of the joined data.
     * Optionally, you can add condition and parameters used in condition.
     */
    leftJoinAndMapMany(
        mapToProperty: string,
        property: string,
        alias: string,
        condition?: string,
        parameters?: ObjectLiteral,
    ): this

    /**
     * LEFT JOINs entity's table, SELECTs the data returned by a join and MAPs all that data to some entity's property.
     * This is extremely useful when you want to select some data and map it to some virtual property.
     * It will assume that there are multiple rows of selecting data, and mapped result will be an array.
     * You also need to specify an alias of the joined data.
     * Optionally, you can add condition and parameters used in condition.
     */
    leftJoinAndMapMany(
        mapToProperty: string,
        entity: Function | string,
        alias: string,
        condition?: string,
        parameters?: ObjectLiteral,
    ): this

    /**
     * LEFT JOINs table, SELECTs the data returned by a join and MAPs all that data to some entity's property.
     * This is extremely useful when you want to select some data and map it to some virtual property.
     * It will assume that there are multiple rows of selecting data, and mapped result will be an array.
     * You also need to specify an alias of the joined data.
     * Optionally, you can add condition and parameters used in condition.
     */
    leftJoinAndMapMany(
        mapToProperty: string,
        tableName: string,
        alias: string,
        condition?: string,
        parameters?: ObjectLiteral,
    ): this

    /**
     * LEFT JOINs, SELECTs the data returned by a join and MAPs all that data to some entity's property.
     * This is extremely useful when you want to select some data and map it to some virtual property.
     * It will assume that there are multiple rows of selecting data, and mapped result will be an array.
     * You also need to specify an alias of the joined data.
     * Optionally, you can add condition and parameters used in condition.
     */
    leftJoinAndMapMany(
        mapToProperty: string,
        entityOrProperty:
            | Function
            | string
            | ((qb: SelectQueryBuilder<any>) => SelectQueryBuilder<any>),
        alias: string,
        condition?: string,
        parameters?: ObjectLiteral,
    ): this {
        this.addSelect(alias)
        this.join(
            "LEFT",
            entityOrProperty,
            alias,
            condition,
            parameters,
            mapToProperty,
            true,
        )
        return this
    }

    /**
     * LEFT JOINs given subquery, SELECTs the data returned by a join and MAPs all that data to some entity's property.
     * This is extremely useful when you want to select some data and map it to some virtual property.
     * It will assume that there is a single row of selecting data, and mapped result will be a single selected value.
     * Given entity property should be a relation.
     * You also need to specify an alias of the joined data.
     * Optionally, you can add condition and parameters used in condition.
     */
    leftJoinAndMapOne(
        mapToProperty: string,
        subQueryFactory: (
            qb: SelectQueryBuilder<any>,
        ) => SelectQueryBuilder<any>,
        alias: string,
        condition?: string,
        parameters?: ObjectLiteral,
        mapAsEntity?: Function | string,
    ): this

    /**
     * LEFT JOINs entity's property, SELECTs the data returned by a join and MAPs all that data to some entity's property.
     * This is extremely useful when you want to select some data and map it to some virtual property.
     * It will assume that there is a single row of selecting data, and mapped result will be a single selected value.
     * Given entity property should be a relation.
     * You also need to specify an alias of the joined data.
     * Optionally, you can add condition and parameters used in condition.
     */
    leftJoinAndMapOne(
        mapToProperty: string,
        property: string,
        alias: string,
        condition?: string,
        parameters?: ObjectLiteral,
    ): this

    /**
     * LEFT JOINs entity's table, SELECTs the data returned by a join and MAPs all that data to some entity's property.
     * This is extremely useful when you want to select some data and map it to some virtual property.
     * It will assume that there is a single row of selecting data, and mapped result will be a single selected value.
     * You also need to specify an alias of the joined data.
     * Optionally, you can add condition and parameters used in condition.
     */
    leftJoinAndMapOne(
        mapToProperty: string,
        entity: Function | string,
        alias: string,
        condition?: string,
        parameters?: ObjectLiteral,
    ): this

    /**
     * LEFT JOINs table, SELECTs the data returned by a join and MAPs all that data to some entity's property.
     * This is extremely useful when you want to select some data and map it to some virtual property.
     * It will assume that there is a single row of selecting data, and mapped result will be a single selected value.
     * You also need to specify an alias of the joined data.
     * Optionally, you can add condition and parameters used in condition.
     */
    leftJoinAndMapOne(
        mapToProperty: string,
        tableName: string,
        alias: string,
        condition?: string,
        parameters?: ObjectLiteral,
    ): this

    /**
     * LEFT JOINs, SELECTs the data returned by a join and MAPs all that data to some entity's property.
     * This is extremely useful when you want to select some data and map it to some virtual property.
     * It will assume that there is a single row of selecting data, and mapped result will be a single selected value.
     * You also need to specify an alias of the joined data.
     * Optionally, you can add condition and parameters used in condition.
     */
    leftJoinAndMapOne(
        mapToProperty: string,
        entityOrProperty:
            | Function
            | string
            | ((qb: SelectQueryBuilder<any>) => SelectQueryBuilder<any>),
        alias: string,
        condition?: string,
        parameters?: ObjectLiteral,
        mapAsEntity?: Function | string,
    ): this {
        this.addSelect(alias)
        this.join(
            "LEFT",
            entityOrProperty,
            alias,
            condition,
            parameters,
            mapToProperty,
            false,
            mapAsEntity,
        )
        return this
    }

    /**
     */
    // selectAndMap(mapToProperty: string, property: string, aliasName: string, qbFactory: ((qb: SelectQueryBuilder<any>) => SelectQueryBuilder<any>)): this;

    /**
     */
    // selectAndMap(mapToProperty: string, entity: Function|string, aliasName: string, qbFactory: ((qb: SelectQueryBuilder<any>) => SelectQueryBuilder<any>)): this;

    /**
     */
    // selectAndMap(mapToProperty: string, tableName: string, aliasName: string, qbFactory: ((qb: SelectQueryBuilder<any>) => SelectQueryBuilder<any>)): this;

    /**
     */
    // selectAndMap(mapToProperty: string, entityOrProperty: Function|string, aliasName: string, qbFactory: ((qb: SelectQueryBuilder<any>) => SelectQueryBuilder<any>)): this {
    //     const select = new SelectAttribute(this.expressionMap);
    //     select.mapToProperty = mapToProperty;
    //     select.entityOrProperty = entityOrProperty;
    //     select.aliasName = aliasName;
    //     select.qbFactory = qbFactory;
    //     return this;
    // }

    /**
     * LEFT JOINs relation id and maps it into some entity's property.
     * Optionally, you can add condition and parameters used in condition.
     */
    loadRelationIdAndMap(
        mapToProperty: string,
        relationName: string,
        options?: { disableMixedMap?: boolean },
    ): this

    /**
     * LEFT JOINs relation id and maps it into some entity's property.
     * Optionally, you can add condition and parameters used in condition.
     */
    loadRelationIdAndMap(
        mapToProperty: string,
        relationName: string,
        alias: string,
        queryBuilderFactory: (
            qb: SelectQueryBuilder<any>,
        ) => SelectQueryBuilder<any>,
    ): this

    /**
     * LEFT JOINs relation id and maps it into some entity's property.
     * Optionally, you can add condition and parameters used in condition.
     */
    loadRelationIdAndMap(
        mapToProperty: string,
        relationName: string,
        aliasNameOrOptions?: string | { disableMixedMap?: boolean },
        queryBuilderFactory?: (
            qb: SelectQueryBuilder<any>,
        ) => SelectQueryBuilder<any>,
    ): this {
        const relationIdAttribute = new RelationIdAttribute(this.expressionMap)
        relationIdAttribute.mapToProperty = mapToProperty
        relationIdAttribute.relationName = relationName
        if (typeof aliasNameOrOptions === "string")
            relationIdAttribute.alias = aliasNameOrOptions
        if (
            typeof aliasNameOrOptions === "object" &&
            (aliasNameOrOptions as any).disableMixedMap
        )
            relationIdAttribute.disableMixedMap = true

        relationIdAttribute.queryBuilderFactory = queryBuilderFactory
        this.expressionMap.relationIdAttributes.push(relationIdAttribute)

        if (relationIdAttribute.relation.junctionEntityMetadata) {
            this.expressionMap.createAlias({
                type: "other",
                name: relationIdAttribute.junctionAlias,
                metadata: relationIdAttribute.relation.junctionEntityMetadata,
            })
        }
        return this
    }

    /**
     * Counts number of entities of entity's relation and maps the value into some entity's property.
     * Optionally, you can add condition and parameters used in condition.
     */
    loadRelationCountAndMap(
        mapToProperty: string,
        relationName: string,
        aliasName?: string,
        queryBuilderFactory?: (
            qb: SelectQueryBuilder<any>,
        ) => SelectQueryBuilder<any>,
    ): this {
        const relationCountAttribute = new RelationCountAttribute(
            this.expressionMap,
        )
        relationCountAttribute.mapToProperty = mapToProperty
        relationCountAttribute.relationName = relationName
        relationCountAttribute.alias = aliasName
        relationCountAttribute.queryBuilderFactory = queryBuilderFactory
        this.expressionMap.relationCountAttributes.push(relationCountAttribute)

        this.expressionMap.createAlias({
            type: "other",
            name: relationCountAttribute.junctionAlias,
        })
        if (relationCountAttribute.relation.junctionEntityMetadata) {
            this.expressionMap.createAlias({
                type: "other",
                name: relationCountAttribute.junctionAlias,
                metadata:
                    relationCountAttribute.relation.junctionEntityMetadata,
            })
        }
        return this
    }

    /**
     * Loads all relation ids for all relations of the selected entity.
     * All relation ids will be mapped to relation property themself.
     * If array of strings is given then loads only relation ids of the given properties.
     */
    loadAllRelationIds(options?: {
        relations?: string[]
        disableMixedMap?: boolean
    }): this {
        // todo: add skip relations
        this.expressionMap.mainAlias!.metadata.relations.forEach((relation) => {
            if (
                options !== undefined &&
                options.relations !== undefined &&
                options.relations.indexOf(relation.propertyPath) === -1
            )
                return

            this.loadRelationIdAndMap(
                this.expressionMap.mainAlias!.name +
                    "." +
                    relation.propertyPath,
                this.expressionMap.mainAlias!.name +
                    "." +
                    relation.propertyPath,
                options,
            )
        })
        return this
    }

    /**
     * Sets WHERE condition in the query builder.
     * If you had previously WHERE expression defined,
     * calling this function will override previously set WHERE conditions.
     * Additionally you can add parameters used in where expression.
     */
    where(
        where:
            | Brackets
            | string
            | ((qb: this) => string)
            | ObjectLiteral
            | ObjectLiteral[],
        parameters?: ObjectLiteral,
    ): this {
        this.expressionMap.wheres = [] // don't move this block below since computeWhereParameter can add where expressions
        const condition = this.getWhereCondition(where)
        if (condition) {
            this.expressionMap.wheres = [
                { type: "simple", condition: condition },
            ]
        }
        if (parameters) this.setParameters(parameters)
        return this
    }

    /**
     * Adds new AND WHERE condition in the query builder.
     * Additionally you can add parameters used in where expression.
     */
    andWhere(
        where:
            | string
            | Brackets
            | ((qb: this) => string)
            | ObjectLiteral
            | ObjectLiteral[],
        parameters?: ObjectLiteral,
    ): this {
        this.expressionMap.wheres.push({
            type: "and",
            condition: this.getWhereCondition(where),
        })
        if (parameters) this.setParameters(parameters)
        return this
    }

    /**
     * Adds new OR WHERE condition in the query builder.
     * Additionally you can add parameters used in where expression.
     */
    orWhere(
        where:
            | Brackets
            | string
            | ((qb: this) => string)
            | ObjectLiteral
            | ObjectLiteral[],
        parameters?: ObjectLiteral,
    ): this {
        this.expressionMap.wheres.push({
            type: "or",
            condition: this.getWhereCondition(where),
        })
        if (parameters) this.setParameters(parameters)
        return this
    }

    /**
     * Sets a new where EXISTS clause
     */
    whereExists(subQuery: SelectQueryBuilder<any>): this {
        return this.where(...this.getExistsCondition(subQuery))
    }

    /**
     * Adds a new AND where EXISTS clause
     */
    andWhereExists(subQuery: SelectQueryBuilder<any>): this {
        return this.andWhere(...this.getExistsCondition(subQuery))
    }

    /**
     * Adds a new OR where EXISTS clause
     */
    orWhereExists(subQuery: SelectQueryBuilder<any>): this {
        return this.orWhere(...this.getExistsCondition(subQuery))
    }

    /**
     * Adds new AND WHERE with conditions for the given ids.
     *
     * Ids are mixed.
     * It means if you have single primary key you can pass a simple id values, for example [1, 2, 3].
     * If you have multiple primary keys you need to pass object with property names and values specified,
     * for example [{ firstId: 1, secondId: 2 }, { firstId: 2, secondId: 3 }, ...]
     */
    whereInIds(ids: any | any[]): this {
        return this.where(this.getWhereInIdsCondition(ids))
    }

    /**
     * Adds new AND WHERE with conditions for the given ids.
     *
     * Ids are mixed.
     * It means if you have single primary key you can pass a simple id values, for example [1, 2, 3].
     * If you have multiple primary keys you need to pass object with property names and values specified,
     * for example [{ firstId: 1, secondId: 2 }, { firstId: 2, secondId: 3 }, ...]
     */
    andWhereInIds(ids: any | any[]): this {
        return this.andWhere(this.getWhereInIdsCondition(ids))
    }

    /**
     * Adds new OR WHERE with conditions for the given ids.
     *
     * Ids are mixed.
     * It means if you have single primary key you can pass a simple id values, for example [1, 2, 3].
     * If you have multiple primary keys you need to pass object with property names and values specified,
     * for example [{ firstId: 1, secondId: 2 }, { firstId: 2, secondId: 3 }, ...]
     */
    orWhereInIds(ids: any | any[]): this {
        return this.orWhere(this.getWhereInIdsCondition(ids))
    }

    /**
     * Sets HAVING condition in the query builder.
     * If you had previously HAVING expression defined,
     * calling this function will override previously set HAVING conditions.
     * Additionally you can add parameters used in where expression.
     */
    having(having: string, parameters?: ObjectLiteral): this {
        this.expressionMap.havings.push({ type: "simple", condition: having })
        if (parameters) this.setParameters(parameters)
        return this
    }

    /**
     * Adds new AND HAVING condition in the query builder.
     * Additionally you can add parameters used in where expression.
     */
    andHaving(having: string, parameters?: ObjectLiteral): this {
        this.expressionMap.havings.push({ type: "and", condition: having })
        if (parameters) this.setParameters(parameters)
        return this
    }

    /**
     * Adds new OR HAVING condition in the query builder.
     * Additionally you can add parameters used in where expression.
     */
    orHaving(having: string, parameters?: ObjectLiteral): this {
        this.expressionMap.havings.push({ type: "or", condition: having })
        if (parameters) this.setParameters(parameters)
        return this
    }

    /**
     * Sets GROUP BY condition in the query builder.
     * If you had previously GROUP BY expression defined,
     * calling this function will override previously set GROUP BY conditions.
     */
    groupBy(): this

    /**
     * Sets GROUP BY condition in the query builder.
     * If you had previously GROUP BY expression defined,
     * calling this function will override previously set GROUP BY conditions.
     */
    groupBy(groupBy: string): this

    /**
     * Sets GROUP BY condition in the query builder.
     * If you had previously GROUP BY expression defined,
     * calling this function will override previously set GROUP BY conditions.
     */
    groupBy(groupBy?: string): this {
        if (groupBy) {
            this.expressionMap.groupBys = [groupBy]
        } else {
            this.expressionMap.groupBys = []
        }
        return this
    }

    /**
     * Adds GROUP BY condition in the query builder.
     */
    addGroupBy(groupBy: string): this {
        this.expressionMap.groupBys.push(groupBy)
        return this
    }

    /**
     * Enables time travelling for the current query (only supported by cockroach currently)
     */
    timeTravelQuery(timeTravelFn?: string | boolean): this {
        if (this.connection.driver.options.type === "cockroachdb") {
            if (timeTravelFn === undefined) {
                this.expressionMap.timeTravel = "follower_read_timestamp()"
            } else {
                this.expressionMap.timeTravel = timeTravelFn
            }
        }

        return this
    }

    /**
     * Sets ORDER BY condition in the query builder.
     * If you had previously ORDER BY expression defined,
     * calling this function will override previously set ORDER BY conditions.
     *
     * Calling order by without order set will remove all previously set order bys.
     */
    orderBy(): this

    /**
     * Sets ORDER BY condition in the query builder.
     * If you had previously ORDER BY expression defined,
     * calling this function will override previously set ORDER BY conditions.
     */
    orderBy(
        sort: string,
        order?: "ASC" | "DESC",
        nulls?: "NULLS FIRST" | "NULLS LAST",
    ): this

    /**
     * Sets ORDER BY condition in the query builder.
     * If you had previously ORDER BY expression defined,
     * calling this function will override previously set ORDER BY conditions.
     */
    orderBy(order: OrderByCondition): this

    /**
     * Sets ORDER BY condition in the query builder.
     * If you had previously ORDER BY expression defined,
     * calling this function will override previously set ORDER BY conditions.
     */
    orderBy(
        sort?: string | OrderByCondition,
        order: "ASC" | "DESC" = "ASC",
        nulls?: "NULLS FIRST" | "NULLS LAST",
    ): this {
        if (order !== undefined && order !== "ASC" && order !== "DESC")
            throw new TypeORMError(
                `SelectQueryBuilder.addOrderBy "order" can accept only "ASC" and "DESC" values.`,
            )
        if (
            nulls !== undefined &&
            nulls !== "NULLS FIRST" &&
            nulls !== "NULLS LAST"
        )
            throw new TypeORMError(
                `SelectQueryBuilder.addOrderBy "nulls" can accept only "NULLS FIRST" and "NULLS LAST" values.`,
            )

        if (sort) {
            if (typeof sort === "object") {
                this.expressionMap.orderBys = sort as OrderByCondition
            } else {
                if (nulls) {
                    this.expressionMap.orderBys = {
                        [sort as string]: { order, nulls },
                    }
                } else {
                    this.expressionMap.orderBys = { [sort as string]: order }
                }
            }
        } else {
            this.expressionMap.orderBys = {}
        }
        return this
    }

    /**
     * Adds ORDER BY condition in the query builder.
     */
    addOrderBy(
        sort: string,
        order: "ASC" | "DESC" = "ASC",
        nulls?: "NULLS FIRST" | "NULLS LAST",
    ): this {
        if (order !== undefined && order !== "ASC" && order !== "DESC")
            throw new TypeORMError(
                `SelectQueryBuilder.addOrderBy "order" can accept only "ASC" and "DESC" values.`,
            )
        if (
            nulls !== undefined &&
            nulls !== "NULLS FIRST" &&
            nulls !== "NULLS LAST"
        )
            throw new TypeORMError(
                `SelectQueryBuilder.addOrderBy "nulls" can accept only "NULLS FIRST" and "NULLS LAST" values.`,
            )

        if (nulls) {
            this.expressionMap.orderBys[sort] = { order, nulls }
        } else {
            this.expressionMap.orderBys[sort] = order
        }
        return this
    }

    /**
     * Set's LIMIT - maximum number of rows to be selected.
     * NOTE that it may not work as you expect if you are using joins.
     * If you want to implement pagination, and you are having join in your query,
     * then use instead take method instead.
     */
    limit(limit?: number): this {
        this.expressionMap.limit = this.normalizeNumber(limit)
        if (
            this.expressionMap.limit !== undefined &&
            isNaN(this.expressionMap.limit)
        )
            throw new TypeORMError(
                `Provided "limit" value is not a number. Please provide a numeric value.`,
            )

        return this
    }

    /**
     * Set's OFFSET - selection offset.
     * NOTE that it may not work as you expect if you are using joins.
     * If you want to implement pagination, and you are having join in your query,
     * then use instead skip method instead.
     */
    offset(offset?: number): this {
        this.expressionMap.offset = this.normalizeNumber(offset)
        if (
            this.expressionMap.offset !== undefined &&
            isNaN(this.expressionMap.offset)
        )
            throw new TypeORMError(
                `Provided "offset" value is not a number. Please provide a numeric value.`,
            )

        return this
    }

    /**
     * Sets maximal number of entities to take.
     */
    take(take?: number): this {
        this.expressionMap.take = this.normalizeNumber(take)
        if (
            this.expressionMap.take !== undefined &&
            isNaN(this.expressionMap.take)
        )
            throw new TypeORMError(
                `Provided "take" value is not a number. Please provide a numeric value.`,
            )

        return this
    }

    /**
     * Sets number of entities to skip.
     */
    skip(skip?: number): this {
        this.expressionMap.skip = this.normalizeNumber(skip)
        if (
            this.expressionMap.skip !== undefined &&
            isNaN(this.expressionMap.skip)
        )
            throw new TypeORMError(
                `Provided "skip" value is not a number. Please provide a numeric value.`,
            )

        return this
    }

    /**
     * Set certain index to be used by the query.
     *
     * @param index Name of index to be used.
     */
    useIndex(index: string): this {
        this.expressionMap.useIndex = index

        return this
    }

    /**
     * Sets locking mode.
     */
    setLock(lockMode: "optimistic", lockVersion: number | Date): this

    /**
     * Sets locking mode.
     */
    setLock(
        lockMode:
            | "pessimistic_read"
            | "pessimistic_write"
            | "dirty_read"
            /*
                "pessimistic_partial_write" and "pessimistic_write_or_fail" are deprecated and
                will be removed in a future version.

                Use setOnLocked instead.
             */
            | "pessimistic_partial_write"
            | "pessimistic_write_or_fail"
            | "for_no_key_update"
            | "for_key_share",
        lockVersion?: undefined,
        lockTables?: string[],
    ): this

    /**
     * Sets locking mode.
     */
    setLock(
        lockMode:
            | "optimistic"
            | "pessimistic_read"
            | "pessimistic_write"
            | "dirty_read"
            /*
                "pessimistic_partial_write" and "pessimistic_write_or_fail" are deprecated and
                will be removed in a future version.

                Use setOnLocked instead.
             */
            | "pessimistic_partial_write"
            | "pessimistic_write_or_fail"
            | "for_no_key_update"
            | "for_key_share",
        lockVersion?: number | Date,
        lockTables?: string[],
    ): this {
        this.expressionMap.lockMode = lockMode
        this.expressionMap.lockVersion = lockVersion
        this.expressionMap.lockTables = lockTables
        return this
    }

    /**
     * Sets lock handling by adding NO WAIT or SKIP LOCKED.
     */
    setOnLocked(onLocked: "nowait" | "skip_locked"): this {
        this.expressionMap.onLocked = onLocked
        return this
    }

    /**
     * Disables the global condition of "non-deleted" for the entity with delete date columns.
     */
    withDeleted(): this {
        this.expressionMap.withDeleted = true
        return this
    }

    /**
     * Gets first raw result returned by execution of generated query builder sql.
     */
    async getRawOne<T = any>(): Promise<T | undefined> {
        return (await this.getRawMany())[0]
    }

    /**
     * Gets all raw results returned by execution of generated query builder sql.
     */
    async getRawMany<T = any>(): Promise<T[]> {
        if (this.expressionMap.lockMode === "optimistic")
            throw new OptimisticLockCanNotBeUsedError()

        this.expressionMap.queryEntity = false
        const queryRunner = this.obtainQueryRunner()
        let transactionStartedByUs: boolean = false
        try {
            // start transaction if it was enabled
            if (
                this.expressionMap.useTransaction === true &&
                queryRunner.isTransactionActive === false
            ) {
                await queryRunner.startTransaction()
                transactionStartedByUs = true
            }

            const results = await this.loadRawResults(queryRunner)

            // close transaction if we started it
            if (transactionStartedByUs) {
                await queryRunner.commitTransaction()
            }

            return results
        } catch (error) {
            // rollback transaction if we started it
            if (transactionStartedByUs) {
                try {
                    await queryRunner.rollbackTransaction()
                } catch (rollbackError) {}
            }
            throw error
        } finally {
            if (queryRunner !== this.queryRunner) {
                // means we created our own query runner
                await queryRunner.release()
            }
        }
    }

    /**
     * Executes sql generated by query builder and returns object with raw results and entities created from them.
     */
    async getRawAndEntities<T = any>(): Promise<{
        entities: Entity[]
        raw: T[]
    }> {
        const queryRunner = this.obtainQueryRunner()
        let transactionStartedByUs: boolean = false
        try {
            // start transaction if it was enabled
            if (
                this.expressionMap.useTransaction === true &&
                queryRunner.isTransactionActive === false
            ) {
                await queryRunner.startTransaction()
                transactionStartedByUs = true
            }

            this.expressionMap.queryEntity = true
            const results = await this.executeEntitiesAndRawResults(queryRunner)

            // close transaction if we started it
            if (transactionStartedByUs) {
                await queryRunner.commitTransaction()
            }

            return results
        } catch (error) {
            // rollback transaction if we started it
            if (transactionStartedByUs) {
                try {
                    await queryRunner.rollbackTransaction()
                } catch (rollbackError) {}
            }
            throw error
        } finally {
            if (queryRunner !== this.queryRunner)
                // means we created our own query runner
                await queryRunner.release()
        }
    }

    /**
     * Gets single entity returned by execution of generated query builder sql.
     */
    async getOne(): Promise<Entity | null> {
        const results = await this.getRawAndEntities()
        const result = results.entities[0] as any

        if (
            result &&
            this.expressionMap.lockMode === "optimistic" &&
            this.expressionMap.lockVersion
        ) {
            const metadata = this.expressionMap.mainAlias!.metadata

            if (this.expressionMap.lockVersion instanceof Date) {
                const actualVersion =
                    metadata.updateDateColumn!.getEntityValue(result) // what if columns arent set?
                if (
                    actualVersion.getTime() !==
                    this.expressionMap.lockVersion.getTime()
                )
                    throw new OptimisticLockVersionMismatchError(
                        metadata.name,
                        this.expressionMap.lockVersion,
                        actualVersion,
                    )
            } else {
                const actualVersion =
                    metadata.versionColumn!.getEntityValue(result) // what if columns arent set?
                if (actualVersion !== this.expressionMap.lockVersion)
                    throw new OptimisticLockVersionMismatchError(
                        metadata.name,
                        this.expressionMap.lockVersion,
                        actualVersion,
                    )
            }
        }

        if (result === undefined) {
            return null
        }
        return result
    }

    /**
     * Gets the first entity returned by execution of generated query builder sql or rejects the returned promise on error.
     */
    async getOneOrFail(): Promise<Entity> {
        const entity = await this.getOne()

        if (!entity) {
            throw new EntityNotFoundError(
                this.expressionMap.mainAlias!.target,
                this.expressionMap.parameters,
            )
        }

        return entity
    }

    /**
     * Gets entities returned by execution of generated query builder sql.
     */
    async getMany(): Promise<Entity[]> {
        if (this.expressionMap.lockMode === "optimistic")
            throw new OptimisticLockCanNotBeUsedError()

        const results = await this.getRawAndEntities()
        return results.entities
    }

    /**
     * Gets count - number of entities selected by sql generated by this query builder.
     * Count excludes all limitations set by offset, limit, skip, and take.
     */
    async getCount(): Promise<number> {
        if (this.expressionMap.lockMode === "optimistic")
            throw new OptimisticLockCanNotBeUsedError()

        const queryRunner = this.obtainQueryRunner()
        let transactionStartedByUs: boolean = false
        try {
            // start transaction if it was enabled
            if (
                this.expressionMap.useTransaction === true &&
                queryRunner.isTransactionActive === false
            ) {
                await queryRunner.startTransaction()
                transactionStartedByUs = true
            }

            this.expressionMap.queryEntity = false
            const results = await this.executeCountQuery(queryRunner)

            // close transaction if we started it
            if (transactionStartedByUs) {
                await queryRunner.commitTransaction()
            }

            return results
        } catch (error) {
            // rollback transaction if we started it
            if (transactionStartedByUs) {
                try {
                    await queryRunner.rollbackTransaction()
                } catch (rollbackError) {}
            }
            throw error
        } finally {
            if (queryRunner !== this.queryRunner)
                // means we created our own query runner
                await queryRunner.release()
        }
    }

    /**
     * Gets exists
     * Returns whether any rows exists matching current query.
     */
    async getExists(): Promise<boolean> {
        if (this.expressionMap.lockMode === "optimistic")
            throw new OptimisticLockCanNotBeUsedError()

        const queryRunner = this.obtainQueryRunner()
        let transactionStartedByUs: boolean = false
        try {
            // start transaction if it was enabled
            if (
                this.expressionMap.useTransaction === true &&
                queryRunner.isTransactionActive === false
            ) {
                await queryRunner.startTransaction()
                transactionStartedByUs = true
            }

            this.expressionMap.queryEntity = false
            const results = await this.executeExistsQuery(queryRunner)

            // close transaction if we started it
            if (transactionStartedByUs) {
                await queryRunner.commitTransaction()
            }

            return results
        } catch (error) {
            // rollback transaction if we started it
            if (transactionStartedByUs) {
                try {
                    await queryRunner.rollbackTransaction()
                } catch (rollbackError) {}
            }
            throw error
        } finally {
            if (queryRunner !== this.queryRunner)
                // means we created our own query runner
                await queryRunner.release()
        }
    }

    /**
     * Executes built SQL query and returns entities and overall entities count (without limitation).
     * This method is useful to build pagination.
     */
    async getManyAndCount(): Promise<[Entity[], number]> {
        if (this.expressionMap.lockMode === "optimistic")
            throw new OptimisticLockCanNotBeUsedError()

        const queryRunner = this.obtainQueryRunner()
        let transactionStartedByUs: boolean = false
        try {
            // start transaction if it was enabled
            if (
                this.expressionMap.useTransaction === true &&
                queryRunner.isTransactionActive === false
            ) {
                await queryRunner.startTransaction()
                transactionStartedByUs = true
            }

            this.expressionMap.queryEntity = true
            const entitiesAndRaw = await this.executeEntitiesAndRawResults(
                queryRunner,
            )
            this.expressionMap.queryEntity = false
            const cacheId = this.expressionMap.cacheId
            // Creates a new cacheId for the count query, or it will retreive the above query results
            // and count will return 0.
            this.expressionMap.cacheId = cacheId ? `${cacheId}-count` : cacheId
            const count = await this.executeCountQuery(queryRunner)
            const results: [Entity[], number] = [entitiesAndRaw.entities, count]

            // close transaction if we started it
            if (transactionStartedByUs) {
                await queryRunner.commitTransaction()
            }

            return results
        } catch (error) {
            // rollback transaction if we started it
            if (transactionStartedByUs) {
                try {
                    await queryRunner.rollbackTransaction()
                } catch (rollbackError) {}
            }
            throw error
        } finally {
            if (queryRunner !== this.queryRunner)
                // means we created our own query runner
                await queryRunner.release()
        }
    }

    /**
     * Executes built SQL query and returns raw data stream.
     */
    async stream(): Promise<ReadStream> {
        this.expressionMap.queryEntity = false
        const [sql, parameters] = this.getQueryAndParameters()
        const queryRunner = this.obtainQueryRunner()
        let transactionStartedByUs: boolean = false
        try {
            // start transaction if it was enabled
            if (
                this.expressionMap.useTransaction === true &&
                queryRunner.isTransactionActive === false
            ) {
                await queryRunner.startTransaction()
                transactionStartedByUs = true
            }

            const releaseFn = () => {
                if (queryRunner !== this.queryRunner)
                    // means we created our own query runner
                    return queryRunner.release()
                return
            }
            const results = queryRunner.stream(
                sql,
                parameters,
                releaseFn,
                releaseFn,
            )

            // close transaction if we started it
            if (transactionStartedByUs) {
                await queryRunner.commitTransaction()
            }

            return results
        } catch (error) {
            // rollback transaction if we started it
            if (transactionStartedByUs) {
                try {
                    await queryRunner.rollbackTransaction()
                } catch (rollbackError) {}
            }
            throw error
        }
    }

    /**
     * Enables or disables query result caching.
     */
    cache(enabled: boolean): this

    /**
     * Enables query result caching and sets in milliseconds in which cache will expire.
     * If not set then global caching time will be used.
     */
    cache(milliseconds: number): this

    /**
     * Enables query result caching and sets cache id and milliseconds in which cache will expire.
     */
    cache(id: any, milliseconds?: number): this

    /**
     * Enables or disables query result caching.
     */
    cache(
        enabledOrMillisecondsOrId: boolean | number | string,
        maybeMilliseconds?: number,
    ): this {
        if (typeof enabledOrMillisecondsOrId === "boolean") {
            this.expressionMap.cache = enabledOrMillisecondsOrId
        } else if (typeof enabledOrMillisecondsOrId === "number") {
            this.expressionMap.cache = true
            this.expressionMap.cacheDuration = enabledOrMillisecondsOrId
        } else if (
            typeof enabledOrMillisecondsOrId === "string" ||
            typeof enabledOrMillisecondsOrId === "number"
        ) {
            this.expressionMap.cache = true
            this.expressionMap.cacheId = enabledOrMillisecondsOrId
        }

        if (maybeMilliseconds) {
            this.expressionMap.cacheDuration = maybeMilliseconds
        }

        return this
    }

    /**
     * Sets extra options that can be used to configure how query builder works.
     */
    setOption(option: SelectQueryBuilderOption): this {
        this.expressionMap.options.push(option)
        return this
    }

    // -------------------------------------------------------------------------
    // Protected Methods
    // -------------------------------------------------------------------------

    protected join(
        direction: "INNER" | "LEFT",
        entityOrProperty:
            | Function
            | string
            | ((qb: SelectQueryBuilder<any>) => SelectQueryBuilder<any>),
        aliasName: string,
        condition?: string,
        parameters?: ObjectLiteral,
        mapToProperty?: string,
        isMappingMany?: boolean,
        mapAsEntity?: Function | string,
    ): void {
        if (parameters) {
            this.setParameters(parameters)
        }

        const joinAttribute = new JoinAttribute(
            this.connection,
            this.expressionMap,
        )
        joinAttribute.direction = direction
        joinAttribute.mapAsEntity = mapAsEntity
        joinAttribute.mapToProperty = mapToProperty
        joinAttribute.isMappingMany = isMappingMany
        joinAttribute.entityOrProperty = entityOrProperty // relationName
        joinAttribute.condition = condition // joinInverseSideCondition
        // joinAttribute.junctionAlias = joinAttribute.relation.isOwning ? parentAlias + "_" + destinationTableAlias : destinationTableAlias + "_" + parentAlias;
        this.expressionMap.joinAttributes.push(joinAttribute)

        const joinAttributeMetadata = joinAttribute.metadata
        if (joinAttributeMetadata) {
            if (
                joinAttributeMetadata.deleteDateColumn &&
                !this.expressionMap.withDeleted
            ) {
                const conditionDeleteColumn = `${aliasName}.${joinAttributeMetadata.deleteDateColumn.propertyName} IS NULL`
                joinAttribute.condition = joinAttribute.condition
                    ? ` ${joinAttribute.condition} AND ${conditionDeleteColumn}`
                    : `${conditionDeleteColumn}`
            }
            // todo: find and set metadata right there?
            joinAttribute.alias = this.expressionMap.createAlias({
                type: "join",
                name: aliasName,
                metadata: joinAttributeMetadata,
            })
            if (
                joinAttribute.relation &&
                joinAttribute.relation.junctionEntityMetadata
            ) {
                this.expressionMap.createAlias({
                    type: "join",
                    name: joinAttribute.junctionAlias,
                    metadata: joinAttribute.relation.junctionEntityMetadata,
                })
            }
        } else {
            let subQuery: string = ""
            if (typeof entityOrProperty === "function") {
                const subQueryBuilder: SelectQueryBuilder<any> = (
                    entityOrProperty as any
                )((this as any as SelectQueryBuilder<any>).subQuery())
                this.setParameters(subQueryBuilder.getParameters())
                subQuery = subQueryBuilder.getQuery()
            } else {
                subQuery = entityOrProperty
            }
            const isSubQuery =
                typeof entityOrProperty === "function" ||
                (entityOrProperty.substr(0, 1) === "(" &&
                    entityOrProperty.substr(-1) === ")")
            joinAttribute.alias = this.expressionMap.createAlias({
                type: "join",
                name: aliasName,
                tablePath:
                    isSubQuery === false
                        ? (entityOrProperty as string)
                        : undefined,
                subQuery: isSubQuery === true ? subQuery : undefined,
            })
        }
    }

    /**
     * Creates "SELECT FROM" part of SQL query.
     */
    protected createSelectExpression() {
        if (!this.expressionMap.mainAlias)
            throw new TypeORMError(
                "Cannot build query because main alias is not set (call qb#from method)",
            )

        // todo throw exception if selects or from is missing

        const allSelects: SelectQuery[] = []
        const excludedSelects: SelectQuery[] = []

        if (this.expressionMap.mainAlias.hasMetadata) {
            const metadata = this.expressionMap.mainAlias.metadata
            allSelects.push(
                ...this.buildEscapedEntityColumnSelects(
                    this.expressionMap.mainAlias.name,
                    metadata,
                ),
            )
            excludedSelects.push(
                ...this.findEntityColumnSelects(
                    this.expressionMap.mainAlias.name,
                    metadata,
                ),
            )
        }

        // add selects from joins
        this.expressionMap.joinAttributes.forEach((join) => {
            if (join.metadata) {
                allSelects.push(
                    ...this.buildEscapedEntityColumnSelects(
                        join.alias.name!,
                        join.metadata,
                    ),
                )
                excludedSelects.push(
                    ...this.findEntityColumnSelects(
                        join.alias.name!,
                        join.metadata,
                    ),
                )
            } else {
                const hasMainAlias = this.expressionMap.selects.some(
                    (select) => select.selection === join.alias.name,
                )
                if (hasMainAlias) {
                    allSelects.push({
                        selection: this.escape(join.alias.name!) + ".*",
                    })
                    const excludedSelect = this.expressionMap.selects.find(
                        (select) => select.selection === join.alias.name,
                    )
                    excludedSelects.push(excludedSelect!)
                }
            }
        })

        // add all other selects
        this.expressionMap.selects
            .filter((select) => excludedSelects.indexOf(select) === -1)
            .forEach((select) =>
                allSelects.push({
                    selection: this.replacePropertyNames(select.selection),
                    aliasName: select.aliasName,
                }),
            )

        // if still selection is empty, then simply set it to all (*)
        if (allSelects.length === 0) allSelects.push({ selection: "*" })

        // Use certain index
        let useIndex: string = ""
        if (this.expressionMap.useIndex) {
            if (DriverUtils.isMySQLFamily(this.connection.driver)) {
                useIndex = ` USE INDEX (${this.expressionMap.useIndex})`
            }
        }

        // create a selection query
        const froms = this.expressionMap.aliases
            .filter(
                (alias) =>
                    alias.type === "from" &&
                    (alias.tablePath || alias.subQuery),
            )
            .map((alias) => {
                if (alias.subQuery)
                    return alias.subQuery + " " + this.escape(alias.name)

                return (
                    this.getTableName(alias.tablePath!) +
                    " " +
                    this.escape(alias.name)
                )
            })

        const select = this.createSelectDistinctExpression()
        const selection = allSelects
            .map(
                (select) =>
                    select.selection +
                    (select.aliasName
                        ? " AS " + this.escape(select.aliasName)
                        : ""),
            )
            .join(", ")

        return (
            select +
            selection +
            " FROM " +
            froms.join(", ") +
            this.createTableLockExpression() +
            useIndex
        )
    }

    /**
     * Creates select | select distinct part of SQL query.
     */
    protected createSelectDistinctExpression(): string {
        const { selectDistinct, selectDistinctOn, maxExecutionTime } =
            this.expressionMap
        const { driver } = this.connection

        let select = "SELECT "

        if (maxExecutionTime > 0) {
            if (DriverUtils.isMySQLFamily(driver)) {
                select += `/*+ MAX_EXECUTION_TIME(${this.expressionMap.maxExecutionTime}) */ `
            }
        }

        if (
            DriverUtils.isPostgresFamily(driver) &&
            selectDistinctOn.length > 0
        ) {
            const selectDistinctOnMap = selectDistinctOn
                .map((on) => this.replacePropertyNames(on))
                .join(", ")

            select = `SELECT DISTINCT ON (${selectDistinctOnMap}) `
        } else if (selectDistinct) {
            select = "SELECT DISTINCT "
        }

        return select
    }

    /**
     * Creates "JOIN" part of SQL query.
     */
    protected createJoinExpression(): string {
        // examples:
        // select from owning side
        // qb.select("post")
        //     .leftJoinAndSelect("post.category", "category");
        // select from non-owning side
        // qb.select("category")
        //     .leftJoinAndSelect("category.post", "post");

        const joins = this.expressionMap.joinAttributes.map((joinAttr) => {
            const relation = joinAttr.relation
            const destinationTableName = joinAttr.tablePath
            const destinationTableAlias = joinAttr.alias.name
            let appendedCondition = joinAttr.condition
                ? " AND (" + joinAttr.condition + ")"
                : ""
            const parentAlias = joinAttr.parentAlias

            // if join was build without relation (e.g. without "post.category") then it means that we have direct
            // table to join, without junction table involved. This means we simply join direct table.
            if (!parentAlias || !relation) {
                const destinationJoin = joinAttr.alias.subQuery
                    ? joinAttr.alias.subQuery
                    : this.getTableName(destinationTableName)
                return (
                    " " +
                    joinAttr.direction +
                    " JOIN " +
                    destinationJoin +
                    " " +
                    this.escape(destinationTableAlias) +
                    this.createTableLockExpression() +
                    (joinAttr.condition
                        ? " ON " + this.replacePropertyNames(joinAttr.condition)
                        : "")
                )
            }

            // if real entity relation is involved
            if (relation.isManyToOne || relation.isOneToOneOwner) {
                // JOIN `category` `category` ON `category`.`id` = `post`.`categoryId`
                const condition = relation.joinColumns
                    .map((joinColumn) => {
                        return (
                            destinationTableAlias +
                            "." +
                            joinColumn.referencedColumn!.propertyPath +
                            "=" +
                            parentAlias +
                            "." +
                            relation.propertyPath +
                            "." +
                            joinColumn.referencedColumn!.propertyPath
                        )
                    })
                    .join(" AND ")

                return (
                    " " +
                    joinAttr.direction +
                    " JOIN " +
                    this.getTableName(destinationTableName) +
                    " " +
                    this.escape(destinationTableAlias) +
                    this.createTableLockExpression() +
                    " ON " +
                    this.replacePropertyNames(condition + appendedCondition)
                )
            } else if (relation.isOneToMany || relation.isOneToOneNotOwner) {
                // JOIN `post` `post` ON `post`.`categoryId` = `category`.`id`
                const condition = relation
                    .inverseRelation!.joinColumns.map((joinColumn) => {
                        if (
                            relation.inverseEntityMetadata.tableType ===
                                "entity-child" &&
                            relation.inverseEntityMetadata.discriminatorColumn
                        ) {
                            appendedCondition +=
                                " AND " +
                                destinationTableAlias +
                                "." +
                                relation.inverseEntityMetadata
                                    .discriminatorColumn.databaseName +
                                "='" +
                                relation.inverseEntityMetadata
                                    .discriminatorValue +
                                "'"
                        }

                        return (
                            destinationTableAlias +
                            "." +
                            relation.inverseRelation!.propertyPath +
                            "." +
                            joinColumn.referencedColumn!.propertyPath +
                            "=" +
                            parentAlias +
                            "." +
                            joinColumn.referencedColumn!.propertyPath
                        )
                    })
                    .join(" AND ")

                return (
                    " " +
                    joinAttr.direction +
                    " JOIN " +
                    this.getTableName(destinationTableName) +
                    " " +
                    this.escape(destinationTableAlias) +
                    this.createTableLockExpression() +
                    " ON " +
                    this.replacePropertyNames(condition + appendedCondition)
                )
            } else {
                // means many-to-many
                const junctionTableName =
                    relation.junctionEntityMetadata!.tablePath

                const junctionAlias = joinAttr.junctionAlias
                let junctionCondition = "",
                    destinationCondition = ""

                if (relation.isOwning) {
                    junctionCondition = relation.joinColumns
                        .map((joinColumn) => {
                            // `post_category`.`postId` = `post`.`id`
                            return (
                                junctionAlias +
                                "." +
                                joinColumn.propertyPath +
                                "=" +
                                parentAlias +
                                "." +
                                joinColumn.referencedColumn!.propertyPath
                            )
                        })
                        .join(" AND ")

                    destinationCondition = relation.inverseJoinColumns
                        .map((joinColumn) => {
                            // `category`.`id` = `post_category`.`categoryId`
                            return (
                                destinationTableAlias +
                                "." +
                                joinColumn.referencedColumn!.propertyPath +
                                "=" +
                                junctionAlias +
                                "." +
                                joinColumn.propertyPath
                            )
                        })
                        .join(" AND ")
                } else {
                    junctionCondition = relation
                        .inverseRelation!.inverseJoinColumns.map(
                            (joinColumn) => {
                                // `post_category`.`categoryId` = `category`.`id`
                                return (
                                    junctionAlias +
                                    "." +
                                    joinColumn.propertyPath +
                                    "=" +
                                    parentAlias +
                                    "." +
                                    joinColumn.referencedColumn!.propertyPath
                                )
                            },
                        )
                        .join(" AND ")

                    destinationCondition = relation
                        .inverseRelation!.joinColumns.map((joinColumn) => {
                            // `post`.`id` = `post_category`.`postId`
                            return (
                                destinationTableAlias +
                                "." +
                                joinColumn.referencedColumn!.propertyPath +
                                "=" +
                                junctionAlias +
                                "." +
                                joinColumn.propertyPath
                            )
                        })
                        .join(" AND ")
                }

                return (
                    " " +
                    joinAttr.direction +
                    " JOIN " +
                    this.getTableName(junctionTableName) +
                    " " +
                    this.escape(junctionAlias) +
                    this.createTableLockExpression() +
                    " ON " +
                    this.replacePropertyNames(junctionCondition) +
                    " " +
                    joinAttr.direction +
                    " JOIN " +
                    this.getTableName(destinationTableName) +
                    " " +
                    this.escape(destinationTableAlias) +
                    this.createTableLockExpression() +
                    " ON " +
                    this.replacePropertyNames(
                        destinationCondition + appendedCondition,
                    )
                )
            }
        })

        return joins.join(" ")
    }

    /**
     * Creates "GROUP BY" part of SQL query.
     */
    protected createGroupByExpression() {
        if (!this.expressionMap.groupBys || !this.expressionMap.groupBys.length)
            return ""
        return (
            " GROUP BY " +
            this.replacePropertyNames(this.expressionMap.groupBys.join(", "))
        )
    }

    /**
     * Creates "ORDER BY" part of SQL query.
     */
    protected createOrderByExpression() {
        const orderBys = this.expressionMap.allOrderBys
        if (Object.keys(orderBys).length === 0) return ""

        return (
            " ORDER BY " +
            Object.keys(orderBys)
                .map((columnName) => {
                    const orderValue =
                        typeof orderBys[columnName] === "string"
                            ? orderBys[columnName]
                            : (orderBys[columnName] as any).order +
                              " " +
                              (orderBys[columnName] as any).nulls
                    const selection = this.expressionMap.selects.find(
                        (s) => s.selection === columnName,
                    )
                    if (
                        selection &&
                        !selection.aliasName &&
                        columnName.indexOf(".") !== -1
                    ) {
                        const criteriaParts = columnName.split(".")
                        const aliasName = criteriaParts[0]
                        const propertyPath = criteriaParts.slice(1).join(".")
                        const alias = this.expressionMap.aliases.find(
                            (alias) => alias.name === aliasName,
                        )
                        if (alias) {
                            const column =
                                alias.metadata.findColumnWithPropertyPath(
                                    propertyPath,
                                )
                            if (column) {
                                const orderAlias = DriverUtils.buildAlias(
                                    this.connection.driver,
                                    undefined,
                                    aliasName,
                                    column.databaseName,
                                )
                                return (
                                    this.escape(orderAlias) + " " + orderValue
                                )
                            }
                        }
                    }

                    return (
                        this.replacePropertyNames(columnName) + " " + orderValue
                    )
                })
                .join(", ")
        )
    }

    /**
     * Creates "LIMIT" and "OFFSET" parts of SQL query.
     */
    protected createLimitOffsetExpression(): string {
        // in the case if nothing is joined in the query builder we don't need to make two requests to get paginated results
        // we can use regular limit / offset, that's why we add offset and limit construction here based on skip and take values
        let offset: number | undefined = this.expressionMap.offset,
            limit: number | undefined = this.expressionMap.limit
        if (
            !offset &&
            !limit &&
            this.expressionMap.joinAttributes.length === 0
        ) {
            offset = this.expressionMap.skip
            limit = this.expressionMap.take
        }

        if (this.connection.driver.options.type === "mssql") {
            // Due to a limitation in SQL Server's parser implementation it does not support using
            // OFFSET or FETCH NEXT without an ORDER BY clause being provided. In cases where the
            // user does not request one we insert a dummy ORDER BY that does nothing and should
            // have no effect on the query planner or on the order of the results returned.
            // https://dba.stackexchange.com/a/193799
            let prefix = ""
            if (
                (limit || offset) &&
                Object.keys(this.expressionMap.allOrderBys).length <= 0
            ) {
                prefix = " ORDER BY (SELECT NULL)"
            }

            if (limit && offset)
                return (
                    prefix +
                    " OFFSET " +
                    offset +
                    " ROWS FETCH NEXT " +
                    limit +
                    " ROWS ONLY"
                )
            if (limit)
                return (
                    prefix + " OFFSET 0 ROWS FETCH NEXT " + limit + " ROWS ONLY"
                )
            if (offset) return prefix + " OFFSET " + offset + " ROWS"
        } else if (
            DriverUtils.isMySQLFamily(this.connection.driver) ||
            this.connection.driver.options.type === "aurora-mysql" ||
            this.connection.driver.options.type === "sap" ||
            this.connection.driver.options.type === "spanner"
        ) {
            if (limit && offset) return " LIMIT " + limit + " OFFSET " + offset
            if (limit) return " LIMIT " + limit
            if (offset) throw new OffsetWithoutLimitNotSupportedError()
        } else if (DriverUtils.isSQLiteFamily(this.connection.driver)) {
            if (limit && offset) return " LIMIT " + limit + " OFFSET " + offset
            if (limit) return " LIMIT " + limit
            if (offset) return " LIMIT -1 OFFSET " + offset
        } else if (this.connection.driver.options.type === "oracle") {
            if (limit && offset)
                return (
                    " OFFSET " +
                    offset +
                    " ROWS FETCH NEXT " +
                    limit +
                    " ROWS ONLY"
                )
            if (limit) return " FETCH NEXT " + limit + " ROWS ONLY"
            if (offset) return " OFFSET " + offset + " ROWS"
        } else {
            if (limit && offset) return " LIMIT " + limit + " OFFSET " + offset
            if (limit) return " LIMIT " + limit
            if (offset) return " OFFSET " + offset
        }

        return ""
    }

    /**
     * Creates "LOCK" part of SELECT Query after table Clause
     * ex.
     *  SELECT 1
     *  FROM USER U WITH (NOLOCK)
     *  JOIN ORDER O WITH (NOLOCK)
     *      ON U.ID=O.OrderID
     */
    private createTableLockExpression(): string {
        if (this.connection.driver.options.type === "mssql") {
            switch (this.expressionMap.lockMode) {
                case "pessimistic_read":
                    return " WITH (HOLDLOCK, ROWLOCK)"
                case "pessimistic_write":
                    return " WITH (UPDLOCK, ROWLOCK)"
                case "dirty_read":
                    return " WITH (NOLOCK)"
            }
        }

        return ""
    }

    /**
     * Creates "LOCK" part of SQL query.
     */
    protected createLockExpression(): string {
        const driver = this.connection.driver

        let lockTablesClause = ""

        if (this.expressionMap.lockTables) {
            if (
                !(
                    DriverUtils.isPostgresFamily(driver) ||
                    driver.options.type === "cockroachdb"
                )
            ) {
                throw new TypeORMError(
                    "Lock tables not supported in selected driver",
                )
            }
            if (this.expressionMap.lockTables.length < 1) {
                throw new TypeORMError("lockTables cannot be an empty array")
            }
            lockTablesClause = " OF " + this.expressionMap.lockTables.join(", ")
        }

        let onLockExpression = ""
        if (this.expressionMap.onLocked === "nowait") {
            onLockExpression = " NOWAIT"
        } else if (this.expressionMap.onLocked === "skip_locked") {
            onLockExpression = " SKIP LOCKED"
        }
        switch (this.expressionMap.lockMode) {
            case "pessimistic_read":
                if (
                    driver.options.type === "mysql" ||
                    driver.options.type === "aurora-mysql"
                ) {
                    if (
                        DriverUtils.isReleaseVersionOrGreater(driver, "8.0.0")
                    ) {
                        return (
                            " FOR SHARE" + lockTablesClause + onLockExpression
                        )
                    } else {
                        return " LOCK IN SHARE MODE"
                    }
                } else if (driver.options.type === "mariadb") {
                    return " LOCK IN SHARE MODE"
                } else if (DriverUtils.isPostgresFamily(driver)) {
                    return " FOR SHARE" + lockTablesClause + onLockExpression
                } else if (driver.options.type === "oracle") {
                    return " FOR UPDATE"
                } else if (driver.options.type === "mssql") {
                    return ""
                } else {
                    throw new LockNotSupportedOnGivenDriverError()
                }
            case "pessimistic_write":
                if (
                    DriverUtils.isMySQLFamily(driver) ||
                    driver.options.type === "aurora-mysql" ||
                    driver.options.type === "oracle"
                ) {
                    return " FOR UPDATE" + onLockExpression
                } else if (
                    DriverUtils.isPostgresFamily(driver) ||
                    driver.options.type === "cockroachdb"
                ) {
                    return " FOR UPDATE" + lockTablesClause + onLockExpression
                } else if (driver.options.type === "mssql") {
                    return ""
                } else {
                    throw new LockNotSupportedOnGivenDriverError()
                }
            case "pessimistic_partial_write":
                if (DriverUtils.isPostgresFamily(driver)) {
                    return " FOR UPDATE" + lockTablesClause + " SKIP LOCKED"
                } else if (DriverUtils.isMySQLFamily(driver)) {
                    return " FOR UPDATE SKIP LOCKED"
                } else {
                    throw new LockNotSupportedOnGivenDriverError()
                }
            case "pessimistic_write_or_fail":
                if (
                    DriverUtils.isPostgresFamily(driver) ||
                    driver.options.type === "cockroachdb"
                ) {
                    return " FOR UPDATE" + lockTablesClause + " NOWAIT"
                } else if (DriverUtils.isMySQLFamily(driver)) {
                    return " FOR UPDATE NOWAIT"
                } else {
                    throw new LockNotSupportedOnGivenDriverError()
                }
            case "for_no_key_update":
                if (
                    DriverUtils.isPostgresFamily(driver) ||
                    driver.options.type === "cockroachdb"
                ) {
                    return (
                        " FOR NO KEY UPDATE" +
                        lockTablesClause +
                        onLockExpression
                    )
                } else {
                    throw new LockNotSupportedOnGivenDriverError()
                }
            case "for_key_share":
                if (DriverUtils.isPostgresFamily(driver)) {
                    return (
                        " FOR KEY SHARE" + lockTablesClause + onLockExpression
                    )
                } else {
                    throw new LockNotSupportedOnGivenDriverError()
                }
            default:
                return ""
        }
    }

    /**
     * Creates "HAVING" part of SQL query.
     */
    protected createHavingExpression() {
        if (!this.expressionMap.havings || !this.expressionMap.havings.length)
            return ""
        const conditions = this.expressionMap.havings
            .map((having, index) => {
                switch (having.type) {
                    case "and":
                        return (
                            (index > 0 ? "AND " : "") +
                            this.replacePropertyNames(having.condition)
                        )
                    case "or":
                        return (
                            (index > 0 ? "OR " : "") +
                            this.replacePropertyNames(having.condition)
                        )
                    default:
                        return this.replacePropertyNames(having.condition)
                }
            })
            .join(" ")

        if (!conditions.length) return ""
        return " HAVING " + conditions
    }

    protected buildEscapedEntityColumnSelects(
        aliasName: string,
        metadata: EntityMetadata,
    ): SelectQuery[] {
        const hasMainAlias = this.expressionMap.selects.some(
            (select) => select.selection === aliasName,
        )

        const columns: ColumnMetadata[] = []
        if (hasMainAlias) {
            columns.push(
                ...metadata.columns.filter(
                    (column) => column.isSelect === true,
                ),
            )
        }
        columns.push(
            ...metadata.columns.filter((column) => {
                return this.expressionMap.selects.some(
                    (select) =>
                        select.selection ===
                        aliasName + "." + column.propertyPath,
                )
            }),
        )

        // if user used partial selection and did not select some primary columns which are required to be selected
        // we select those primary columns and mark them as "virtual". Later virtual column values will be removed from final entity
        // to make entity contain exactly what user selected
        if (columns.length === 0)
            // however not in the case when nothing (even partial) was selected from this target (for example joins without selection)
            return []

        const nonSelectedPrimaryColumns = this.expressionMap.queryEntity
            ? metadata.primaryColumns.filter(
                  (primaryColumn) => columns.indexOf(primaryColumn) === -1,
              )
            : []
        const allColumns = [...columns, ...nonSelectedPrimaryColumns]
        const finalSelects: SelectQuery[] = []

        const escapedAliasName = this.escape(aliasName)
        allColumns.forEach((column) => {
            let selectionPath =
                escapedAliasName + "." + this.escape(column.databaseName)

            if (column.isVirtualProperty && column.query) {
                selectionPath = `(${column.query(escapedAliasName)})`
            }

            if (
                this.connection.driver.spatialTypes.indexOf(column.type) !== -1
            ) {
                if (
                    DriverUtils.isMySQLFamily(this.connection.driver) ||
                    this.connection.driver.options.type === "aurora-mysql"
                ) {
                    const useLegacy = (
                        this.connection.driver as
                            | MysqlDriver
                            | AuroraMysqlDriver
                    ).options.legacySpatialSupport
                    const asText = useLegacy ? "AsText" : "ST_AsText"
                    selectionPath = `${asText}(${selectionPath})`
                }

                if (DriverUtils.isPostgresFamily(this.connection.driver))
                    if (column.precision) {
                        // cast to JSON to trigger parsing in the driver
                        selectionPath = `ST_AsGeoJSON(${selectionPath}, ${column.precision})::json`
                    } else {
                        selectionPath = `ST_AsGeoJSON(${selectionPath})::json`
                    }
                if (this.connection.driver.options.type === "mssql")
                    selectionPath = `${selectionPath}.ToString()`
            }

            const selections = this.expressionMap.selects.filter(
                (select) =>
                    select.selection === aliasName + "." + column.propertyPath,
            )
            if (selections.length) {
                selections.forEach((selection) => {
                    finalSelects.push({
                        selection: selectionPath,
                        aliasName: selection.aliasName
                            ? selection.aliasName
                            : DriverUtils.buildAlias(
                                  this.connection.driver,
                                  undefined,
                                  aliasName,
                                  column.databaseName,
                              ),
                        // todo: need to keep in mind that custom selection.aliasName breaks hydrator. fix it later!
                        virtual: selection.virtual,
                    })
                })
            } else {
                finalSelects.push({
                    selection: selectionPath,
                    aliasName: DriverUtils.buildAlias(
                        this.connection.driver,
                        undefined,
                        aliasName,
                        column.databaseName,
                    ),
                    // todo: need to keep in mind that custom selection.aliasName breaks hydrator. fix it later!
                    virtual: hasMainAlias,
                })
            }
        })
        return finalSelects
    }

    protected findEntityColumnSelects(
        aliasName: string,
        metadata: EntityMetadata,
    ): SelectQuery[] {
        const mainSelect = this.expressionMap.selects.find(
            (select) => select.selection === aliasName,
        )
        if (mainSelect) return [mainSelect]

        return this.expressionMap.selects.filter((select) => {
            return metadata.columns.some(
                (column) =>
                    select.selection === aliasName + "." + column.propertyPath,
            )
        })
    }

    private computeCountExpression() {
        const mainAlias = this.expressionMap.mainAlias!.name // todo: will this work with "fromTableName"?
        const metadata = this.expressionMap.mainAlias!.metadata

        const primaryColumns = metadata.primaryColumns
        const distinctAlias = this.escape(mainAlias)

        // If we aren't doing anything that will create a join, we can use a simpler `COUNT` instead
        // so we prevent poor query patterns in the most likely cases
        if (
            this.expressionMap.joinAttributes.length === 0 &&
            this.expressionMap.relationIdAttributes.length === 0 &&
            this.expressionMap.relationCountAttributes.length === 0
        ) {
            return "COUNT(1)"
        }

        // For everything else, we'll need to do some hackery to get the correct count values.

        if (
            this.connection.driver.options.type === "cockroachdb" ||
            DriverUtils.isPostgresFamily(this.connection.driver)
        ) {
            // Postgres and CockroachDB can pass multiple parameters to the `DISTINCT` function
            // https://www.postgresql.org/docs/9.5/sql-select.html#SQL-DISTINCT
            return (
                "COUNT(DISTINCT(" +
                primaryColumns
                    .map(
                        (c) =>
                            `${distinctAlias}.${this.escape(c.databaseName)}`,
                    )
                    .join(", ") +
                "))"
            )
        }

        if (DriverUtils.isMySQLFamily(this.connection.driver)) {
            // MySQL & MariaDB can pass multiple parameters to the `DISTINCT` language construct
            // https://mariadb.com/kb/en/count-distinct/
            return (
                "COUNT(DISTINCT " +
                primaryColumns
                    .map(
                        (c) =>
                            `${distinctAlias}.${this.escape(c.databaseName)}`,
                    )
                    .join(", ") +
                ")"
            )
        }

        if (this.connection.driver.options.type === "mssql") {
            // SQL Server has gotta be different from everyone else.  They don't support
            // distinct counting multiple columns & they don't have the same operator
            // characteristic for concatenating, so we gotta use the `CONCAT` function.
            // However, If it's exactly 1 column we can omit the `CONCAT` for better performance.

            const columnsExpression = primaryColumns
                .map(
                    (primaryColumn) =>
                        `${distinctAlias}.${this.escape(
                            primaryColumn.databaseName,
                        )}`,
                )
                .join(", '|;|', ")

            if (primaryColumns.length === 1) {
                return `COUNT(DISTINCT(${columnsExpression}))`
            }

            return `COUNT(DISTINCT(CONCAT(${columnsExpression})))`
        }

        if (this.connection.driver.options.type === "spanner") {
            // spanner also has gotta be different from everyone else.
            // they do not support concatenation of different column types without casting them to string

            if (primaryColumns.length === 1) {
                return `COUNT(DISTINCT(${distinctAlias}.${this.escape(
                    primaryColumns[0].databaseName,
                )}))`
            }

            const columnsExpression = primaryColumns
                .map(
                    (primaryColumn) =>
                        `CAST(${distinctAlias}.${this.escape(
                            primaryColumn.databaseName,
                        )} AS STRING)`,
                )
                .join(", '|;|', ")
            return `COUNT(DISTINCT(CONCAT(${columnsExpression})))`
        }

        // If all else fails, fall back to a `COUNT` and `DISTINCT` across all the primary columns concatenated.
        // Per the SQL spec, this is the canonical string concatenation mechanism which is most
        // likely to work across servers implementing the SQL standard.

        // Please note, if there is only one primary column that the concatenation does not occur in this
        // query and the query is a standard `COUNT DISTINCT` in that case.

        return (
            `COUNT(DISTINCT(` +
            primaryColumns
                .map((c) => `${distinctAlias}.${this.escape(c.databaseName)}`)
                .join(" || '|;|' || ") +
            "))"
        )
    }

    protected async executeCountQuery(
        queryRunner: QueryRunner,
    ): Promise<number> {
        const countSql = this.computeCountExpression()

        const results = await this.clone()
            .orderBy()
            .groupBy()
            .offset(undefined)
            .limit(undefined)
            .skip(undefined)
            .take(undefined)
            .select(countSql, "cnt")
            .setOption("disable-global-order")
            .loadRawResults(queryRunner)

        if (!results || !results[0] || !results[0]["cnt"]) return 0

        return parseInt(results[0]["cnt"])
    }

    protected async executeExistsQuery(
        queryRunner: QueryRunner,
    ): Promise<boolean> {
        const results = await this.connection
            .createQueryBuilder()
            .fromDummy()
            .select("1", "row_exists")
            .whereExists(this)
            .limit(1)
            .loadRawResults(queryRunner)

        return results.length > 0
    }

    protected applyFindOptions() {
        // todo: convert relations: string[] to object map to simplify code
        // todo: same with selects

        if (this.expressionMap.mainAlias!.metadata) {
            if (this.findOptions.relationLoadStrategy) {
                this.expressionMap.relationLoadStrategy =
                    this.findOptions.relationLoadStrategy
            }

            if (this.findOptions.comment) {
                this.comment(this.findOptions.comment)
            }

            if (this.findOptions.withDeleted) {
                this.withDeleted()
            }

            if (this.findOptions.select) {
                const select = Array.isArray(this.findOptions.select)
                    ? OrmUtils.propertyPathsToTruthyObject(
                          this.findOptions.select as string[],
                      )
                    : this.findOptions.select

                this.buildSelect(
                    select,
                    this.expressionMap.mainAlias!.metadata,
                    this.expressionMap.mainAlias!.name,
                )
            }

            if (this.selects.length) {
                this.select(this.selects)
            }

            this.selects = []
            if (this.findOptions.relations) {
                const relations = Array.isArray(this.findOptions.relations)
                    ? OrmUtils.propertyPathsToTruthyObject(
                          this.findOptions.relations,
                      )
                    : this.findOptions.relations

                this.buildRelations(
                    relations,
                    typeof this.findOptions.select === "object"
                        ? (this.findOptions.select as FindOptionsSelect<any>)
                        : undefined,
                    this.expressionMap.mainAlias!.metadata,
                    this.expressionMap.mainAlias!.name,
                )
                if (
                    this.findOptions.loadEagerRelations !== false &&
                    this.expressionMap.relationLoadStrategy === "join"
                ) {
                    this.buildEagerRelations(
                        relations,
                        typeof this.findOptions.select === "object"
                            ? (this.findOptions
                                  .select as FindOptionsSelect<any>)
                            : undefined,
                        this.expressionMap.mainAlias!.metadata,
                        this.expressionMap.mainAlias!.name,
                    )
                }
            }
            if (this.selects.length) {
                this.addSelect(this.selects)
            }

            if (this.findOptions.where) {
                this.conditions = this.buildWhere(
                    this.findOptions.where,
                    this.expressionMap.mainAlias!.metadata,
                    this.expressionMap.mainAlias!.name,
                )

                if (this.conditions.length)
                    this.andWhere(
                        this.conditions.substr(0, 1) !== "("
                            ? "(" + this.conditions + ")"
                            : this.conditions,
                    ) // temporary and where and braces
            }

            if (this.findOptions.order) {
                this.buildOrder(
                    this.findOptions.order,
                    this.expressionMap.mainAlias!.metadata,
                    this.expressionMap.mainAlias!.name,
                )
            }

            // apply joins
            if (this.joins.length) {
                this.joins.forEach((join) => {
                    if (join.select && !join.selection) {
                        // if (join.selection) {
                        //
                        // } else {
                        if (join.type === "inner") {
                            this.innerJoinAndSelect(
                                `${join.parentAlias}.${join.relationMetadata.propertyPath}`,
                                join.alias,
                            )
                        } else {
                            this.leftJoinAndSelect(
                                `${join.parentAlias}.${join.relationMetadata.propertyPath}`,
                                join.alias,
                            )
                        }
                        // }
                    } else {
                        if (join.type === "inner") {
                            this.innerJoin(
                                `${join.parentAlias}.${join.relationMetadata.propertyPath}`,
                                join.alias,
                            )
                        } else {
                            this.leftJoin(
                                `${join.parentAlias}.${join.relationMetadata.propertyPath}`,
                                join.alias,
                            )
                        }
                    }

                    // if (join.select) {
                    //     if (this.findOptions.loadEagerRelations !== false) {
                    //         FindOptionsUtils.joinEagerRelations(
                    //             this,
                    //             join.alias,
                    //             join.relationMetadata.inverseEntityMetadata
                    //         );
                    //     }
                    // }
                })
            }

            // if (this.conditions.length) {
            //     this.where(this.conditions.join(" AND "));
            // }

            // apply offset
            if (this.findOptions.skip !== undefined) {
                // if (this.findOptions.options && this.findOptions.options.pagination === false) {
                //     this.offset(this.findOptions.skip);
                // } else {
                this.skip(this.findOptions.skip)
                // }
            }

            // apply limit
            if (this.findOptions.take !== undefined) {
                // if (this.findOptions.options && this.findOptions.options.pagination === false) {
                //     this.limit(this.findOptions.take);
                // } else {
                this.take(this.findOptions.take)
                // }
            }

            // apply caching options
            if (typeof this.findOptions.cache === "number") {
                this.cache(this.findOptions.cache)
            } else if (typeof this.findOptions.cache === "boolean") {
                this.cache(this.findOptions.cache)
            } else if (typeof this.findOptions.cache === "object") {
                this.cache(
                    this.findOptions.cache.id,
                    this.findOptions.cache.milliseconds,
                )
            }

            if (this.findOptions.join) {
                if (this.findOptions.join.leftJoin)
                    Object.keys(this.findOptions.join.leftJoin).forEach(
                        (key) => {
                            this.leftJoin(
                                this.findOptions.join!.leftJoin![key],
                                key,
                            )
                        },
                    )

                if (this.findOptions.join.innerJoin)
                    Object.keys(this.findOptions.join.innerJoin).forEach(
                        (key) => {
                            this.innerJoin(
                                this.findOptions.join!.innerJoin![key],
                                key,
                            )
                        },
                    )

                if (this.findOptions.join.leftJoinAndSelect)
                    Object.keys(
                        this.findOptions.join.leftJoinAndSelect,
                    ).forEach((key) => {
                        this.leftJoinAndSelect(
                            this.findOptions.join!.leftJoinAndSelect![key],
                            key,
                        )
                    })

                if (this.findOptions.join.innerJoinAndSelect)
                    Object.keys(
                        this.findOptions.join.innerJoinAndSelect,
                    ).forEach((key) => {
                        this.innerJoinAndSelect(
                            this.findOptions.join!.innerJoinAndSelect![key],
                            key,
                        )
                    })
            }

            if (this.findOptions.lock) {
                if (this.findOptions.lock.mode === "optimistic") {
                    this.setLock(
                        this.findOptions.lock.mode,
                        this.findOptions.lock.version,
                    )
                } else if (
                    this.findOptions.lock.mode === "pessimistic_read" ||
                    this.findOptions.lock.mode === "pessimistic_write" ||
                    this.findOptions.lock.mode === "dirty_read" ||
                    this.findOptions.lock.mode ===
                        "pessimistic_partial_write" ||
                    this.findOptions.lock.mode ===
                        "pessimistic_write_or_fail" ||
                    this.findOptions.lock.mode === "for_no_key_update" ||
                    this.findOptions.lock.mode === "for_key_share"
                ) {
                    const tableNames = this.findOptions.lock.tables
                        ? this.findOptions.lock.tables.map((table) => {
                              const tableAlias =
                                  this.expressionMap.aliases.find((alias) => {
                                      return (
                                          alias.metadata
                                              .tableNameWithoutPrefix === table
                                      )
                                  })
                              if (!tableAlias) {
                                  throw new TypeORMError(
                                      `"${table}" is not part of this query`,
                                  )
                              }
                              return this.escape(tableAlias.name)
                          })
                        : undefined
                    this.setLock(
                        this.findOptions.lock.mode,
                        undefined,
                        tableNames,
                    )

                    if (this.findOptions.lock.onLocked) {
                        this.setOnLocked(this.findOptions.lock.onLocked)
                    }
                }
            }

            if (this.findOptions.loadRelationIds === true) {
                this.loadAllRelationIds()
            } else if (typeof this.findOptions.loadRelationIds === "object") {
                this.loadAllRelationIds(this.findOptions.loadRelationIds as any)
            }

            if (this.findOptions.loadEagerRelations !== false) {
                FindOptionsUtils.joinEagerRelations(
                    this,
                    this.expressionMap.mainAlias!.name,
                    this.expressionMap.mainAlias!.metadata,
                )
            }

            if (this.findOptions.transaction === true) {
                this.expressionMap.useTransaction = true
            }

            // if (this.orderBys.length) {
            //     this.orderBys.forEach(orderBy => {
            //         this.addOrderBy(orderBy.alias, orderBy.direction, orderBy.nulls);
            //     });
            // }

            // todo
            // if (this.options.options && this.options.options.eagerRelations) {
            //     this.queryBuilder
            // }

            // todo
            // if (this.findOptions.options && this.findOptions.listeners === false) {
            //     this.callListeners(false);
            // }
        }
    }

    public concatRelationMetadata(relationMetadata: RelationMetadata) {
        this.relationMetadatas.push(relationMetadata)
    }

    /**
     * Executes sql generated by query builder and returns object with raw results and entities created from them.
     */
    protected async executeEntitiesAndRawResults(
        queryRunner: QueryRunner,
    ): Promise<{ entities: Entity[]; raw: any[] }> {
        if (!this.expressionMap.mainAlias)
            throw new TypeORMError(
                `Alias is not set. Use "from" method to set an alias.`,
            )

        if (
            (this.expressionMap.lockMode === "pessimistic_read" ||
                this.expressionMap.lockMode === "pessimistic_write" ||
                this.expressionMap.lockMode === "pessimistic_partial_write" ||
                this.expressionMap.lockMode === "pessimistic_write_or_fail" ||
                this.expressionMap.lockMode === "for_no_key_update" ||
                this.expressionMap.lockMode === "for_key_share") &&
            !queryRunner.isTransactionActive
        )
            throw new PessimisticLockTransactionRequiredError()

        if (this.expressionMap.lockMode === "optimistic") {
            const metadata = this.expressionMap.mainAlias.metadata
            if (!metadata.versionColumn && !metadata.updateDateColumn)
                throw new NoVersionOrUpdateDateColumnError(metadata.name)
        }

        const relationIdLoader = new RelationIdLoader(
            this.connection,
            queryRunner,
            this.expressionMap.relationIdAttributes,
        )
        const relationCountLoader = new RelationCountLoader(
            this.connection,
            queryRunner,
            this.expressionMap.relationCountAttributes,
        )
        const relationIdMetadataTransformer =
            new RelationIdMetadataToAttributeTransformer(this.expressionMap)
        relationIdMetadataTransformer.transform()
        const relationCountMetadataTransformer =
            new RelationCountMetadataToAttributeTransformer(this.expressionMap)
        relationCountMetadataTransformer.transform()

        let rawResults: any[] = [],
            entities: any[] = []

        // for pagination enabled (e.g. skip and take) its much more complicated - its a special process
        // where we make two queries to find the data we need
        // first query find ids in skip and take range
        // and second query loads the actual data in given ids range
        if (
            (this.expressionMap.skip || this.expressionMap.take) &&
            this.expressionMap.joinAttributes.length > 0
        ) {
            // we are skipping order by here because its not working in subqueries anyway
            // to make order by working we need to apply it on a distinct query
            const [selects, orderBys] =
                this.createOrderByCombinedWithSelectExpression("distinctAlias")
            const metadata = this.expressionMap.mainAlias.metadata
            const mainAliasName = this.expressionMap.mainAlias.name

            const querySelects = metadata.primaryColumns.map(
                (primaryColumn) => {
                    const distinctAlias = this.escape("distinctAlias")
                    const columnAlias = this.escape(
                        DriverUtils.buildAlias(
                            this.connection.driver,
                            undefined,
                            mainAliasName,
                            primaryColumn.databaseName,
                        ),
                    )
                    if (!orderBys[columnAlias])
                        // make sure we aren't overriding user-defined order in inverse direction
                        orderBys[columnAlias] = "ASC"

                    const alias = DriverUtils.buildAlias(
                        this.connection.driver,
                        undefined,
                        "ids_" + mainAliasName,
                        primaryColumn.databaseName,
                    )

                    return `${distinctAlias}.${columnAlias} AS ${this.escape(
                        alias,
                    )}`
                },
            )

            const originalQuery = this.clone()

            // preserve original timeTravel value since we set it to "false" in subquery
            const originalQueryTimeTravel =
                originalQuery.expressionMap.timeTravel

            rawResults = await new SelectQueryBuilder(
                this.connection,
                queryRunner,
            )
                .select(`DISTINCT ${querySelects.join(", ")}`)
                .addSelect(selects)
                .from(
                    `(${originalQuery
                        .orderBy()
                        .timeTravelQuery(false) // set it to "false" since time travel clause must appear at the very end and applies to the entire SELECT clause.
                        .getQuery()})`,
                    "distinctAlias",
                )
                .timeTravelQuery(originalQueryTimeTravel)
                .offset(this.expressionMap.skip)
                .limit(this.expressionMap.take)
                .orderBy(orderBys)
                .cache(
                    this.expressionMap.cache && this.expressionMap.cacheId
                        ? `${this.expressionMap.cacheId}-pagination`
                        : this.expressionMap.cache,
                    this.expressionMap.cacheDuration,
                )
                .setParameters(this.getParameters())
                .setNativeParameters(this.expressionMap.nativeParameters)
                .getRawMany()

            if (rawResults.length > 0) {
                let condition = ""
                const parameters: ObjectLiteral = {}
                if (metadata.hasMultiplePrimaryKeys) {
                    condition = rawResults
                        .map((result, index) => {
                            return metadata.primaryColumns
                                .map((primaryColumn) => {
                                    const paramKey = `orm_distinct_ids_${index}_${primaryColumn.databaseName}`
                                    const paramKeyResult =
                                        DriverUtils.buildAlias(
                                            this.connection.driver,
                                            undefined,
                                            "ids_" + mainAliasName,
                                            primaryColumn.databaseName,
                                        )
                                    parameters[paramKey] =
                                        result[paramKeyResult]
                                    return `${mainAliasName}.${primaryColumn.propertyPath}=:${paramKey}`
                                })
                                .join(" AND ")
                        })
                        .join(" OR ")
                } else {
                    const alias = DriverUtils.buildAlias(
                        this.connection.driver,
                        undefined,
                        "ids_" + mainAliasName,
                        metadata.primaryColumns[0].databaseName,
                    )

                    const ids = rawResults.map((result) => result[alias])
                    const areAllNumbers = ids.every(
                        (id: any) => typeof id === "number",
                    )
                    if (areAllNumbers) {
                        // fixes #190. if all numbers then its safe to perform query without parameter
                        condition = `${mainAliasName}.${
                            metadata.primaryColumns[0].propertyPath
                        } IN (${ids.join(", ")})`
                    } else {
                        parameters["orm_distinct_ids"] = ids
                        condition =
                            mainAliasName +
                            "." +
                            metadata.primaryColumns[0].propertyPath +
                            " IN (:...orm_distinct_ids)"
                    }
                }
                rawResults = await this.clone()
                    .mergeExpressionMap({
                        extraAppendedAndWhereCondition: condition,
                    })
                    .setParameters(parameters)
                    .loadRawResults(queryRunner)
            }
        } else {
            rawResults = await this.loadRawResults(queryRunner)
        }

        if (rawResults.length > 0) {
            // transform raw results into entities
            const rawRelationIdResults = await relationIdLoader.load(rawResults)
            const rawRelationCountResults = await relationCountLoader.load(
                rawResults,
            )
            const transformer = new RawSqlResultsToEntityTransformer(
                this.expressionMap,
                this.connection.driver,
                rawRelationIdResults,
                rawRelationCountResults,
                this.queryRunner,
            )
            entities = transformer.transform(
                rawResults,
                this.expressionMap.mainAlias!,
            )

            // broadcast all "after load" events
            if (
                this.expressionMap.callListeners === true &&
                this.expressionMap.mainAlias.hasMetadata
            ) {
                await queryRunner.broadcaster.broadcast(
                    "Load",
                    this.expressionMap.mainAlias.metadata,
                    entities,
                )
            }
        }

        if (this.expressionMap.relationLoadStrategy === "query") {
            const queryStrategyRelationIdLoader =
                new QueryStrategyRelationIdLoader(this.connection, queryRunner)

            await Promise.all(
                this.relationMetadatas.map(async (relation) => {
                    const relationTarget = relation.inverseEntityMetadata.target
                    const relationAlias =
                        relation.inverseEntityMetadata.targetName

                    const select = Array.isArray(this.findOptions.select)
                        ? OrmUtils.propertyPathsToTruthyObject(
                              this.findOptions.select as string[],
                          )
                        : this.findOptions.select
                    const relations = Array.isArray(this.findOptions.relations)
                        ? OrmUtils.propertyPathsToTruthyObject(
                              this.findOptions.relations,
                          )
                        : this.findOptions.relations

                    const queryBuilder = this.createQueryBuilder()
                        .select(relationAlias)
                        .from(relationTarget, relationAlias)
                        .setFindOptions({
                            select: select
                                ? OrmUtils.deepValue(
                                      select,
                                      relation.propertyPath,
                                  )
                                : undefined,
                            order: this.findOptions.order
                                ? OrmUtils.deepValue(
                                      this.findOptions.order,
                                      relation.propertyPath,
                                  )
                                : undefined,
                            relations: relations
                                ? OrmUtils.deepValue(
                                      relations,
                                      relation.propertyPath,
                                  )
                                : undefined,
                            withDeleted: this.findOptions.withDeleted,
                            relationLoadStrategy:
                                this.findOptions.relationLoadStrategy,
                        })
                    if (entities.length > 0) {
                        const relatedEntityGroups: any[] =
                            await queryStrategyRelationIdLoader.loadManyToManyRelationIdsAndGroup(
                                relation,
                                entities,
                                undefined,
                                queryBuilder,
                            )
                        entities.forEach((entity) => {
                            const relatedEntityGroup = relatedEntityGroups.find(
                                (group) => group.entity === entity,
                            )
                            if (relatedEntityGroup) {
                                const value =
                                    relatedEntityGroup.related === undefined
                                        ? null
                                        : relatedEntityGroup.related
                                relation.setEntityValue(entity, value)
                            }
                        })
                    }
                }),
            )
        }

        return {
            raw: rawResults,
            entities: entities,
        }
    }

    protected createOrderByCombinedWithSelectExpression(
        parentAlias: string,
    ): [string, OrderByCondition] {
        // if table has a default order then apply it
        const orderBys = this.expressionMap.allOrderBys
        const selectString = Object.keys(orderBys)
            .map((orderCriteria) => {
                if (orderCriteria.indexOf(".") !== -1) {
                    const criteriaParts = orderCriteria.split(".")
                    const aliasName = criteriaParts[0]
                    const propertyPath = criteriaParts.slice(1).join(".")
                    const alias = this.expressionMap.findAliasByName(aliasName)
                    const column =
                        alias.metadata.findColumnWithPropertyPath(propertyPath)
                    return (
                        this.escape(parentAlias) +
                        "." +
                        this.escape(
                            DriverUtils.buildAlias(
                                this.connection.driver,
                                undefined,
                                aliasName,
                                column!.databaseName,
                            ),
                        )
                    )
                } else {
                    if (
                        this.expressionMap.selects.find(
                            (select) =>
                                select.selection === orderCriteria ||
                                select.aliasName === orderCriteria,
                        )
                    )
                        return (
                            this.escape(parentAlias) +
                            "." +
                            this.escape(orderCriteria)
                        )

                    return ""
                }
            })
            .join(", ")

        const orderByObject: OrderByCondition = {}
        Object.keys(orderBys).forEach((orderCriteria) => {
            if (orderCriteria.indexOf(".") !== -1) {
                const criteriaParts = orderCriteria.split(".")
                const aliasName = criteriaParts[0]
                const propertyPath = criteriaParts.slice(1).join(".")
                const alias = this.expressionMap.findAliasByName(aliasName)
                const column =
                    alias.metadata.findColumnWithPropertyPath(propertyPath)
                orderByObject[
                    this.escape(parentAlias) +
                        "." +
                        this.escape(
                            DriverUtils.buildAlias(
                                this.connection.driver,
                                undefined,
                                aliasName,
                                column!.databaseName,
                            ),
                        )
                ] = orderBys[orderCriteria]
            } else {
                if (
                    this.expressionMap.selects.find(
                        (select) =>
                            select.selection === orderCriteria ||
                            select.aliasName === orderCriteria,
                    )
                ) {
                    orderByObject[
                        this.escape(parentAlias) +
                            "." +
                            this.escape(orderCriteria)
                    ] = orderBys[orderCriteria]
                } else {
                    orderByObject[orderCriteria] = orderBys[orderCriteria]
                }
            }
        })

        return [selectString, orderByObject]
    }

    /**
     * Loads raw results from the database.
     */
    protected async loadRawResults(queryRunner: QueryRunner) {
        const [sql, parameters] = this.getQueryAndParameters()
        const queryId = sql + " -- PARAMETERS: " + JSON.stringify(parameters)
        const cacheOptions =
            typeof this.connection.options.cache === "object"
                ? this.connection.options.cache
                : {}
        let savedQueryResultCacheOptions: QueryResultCacheOptions | undefined =
            undefined
        const isCachingEnabled =
            // Caching is enabled globally and isn't disabled locally.
            (cacheOptions.alwaysEnabled && this.expressionMap.cache) ||
            // ...or it's enabled locally explicitly.
            this.expressionMap.cache
        let cacheError = false
        if (this.connection.queryResultCache && isCachingEnabled) {
            try {
                savedQueryResultCacheOptions =
                    await this.connection.queryResultCache.getFromCache(
                        {
                            identifier: this.expressionMap.cacheId,
                            query: queryId,
                            duration:
                                this.expressionMap.cacheDuration ||
                                cacheOptions.duration ||
                                1000,
                        },
                        queryRunner,
                    )
                if (
                    savedQueryResultCacheOptions &&
                    !this.connection.queryResultCache.isExpired(
                        savedQueryResultCacheOptions,
                    )
                ) {
                    return JSON.parse(savedQueryResultCacheOptions.result)
                }
            } catch (error) {
                if (!cacheOptions.ignoreErrors) {
                    throw error
                }
                cacheError = true
            }
        }

        const results = await queryRunner.query(sql, parameters, true)

        if (
            !cacheError &&
            this.connection.queryResultCache &&
            isCachingEnabled
        ) {
            try {
                await this.connection.queryResultCache.storeInCache(
                    {
                        identifier: this.expressionMap.cacheId,
                        query: queryId,
                        time: new Date().getTime(),
                        duration:
                            this.expressionMap.cacheDuration ||
                            cacheOptions.duration ||
                            1000,
                        result: JSON.stringify(results.records),
                    },
                    savedQueryResultCacheOptions,
                    queryRunner,
                )
            } catch (error) {
                if (!cacheOptions.ignoreErrors) {
                    throw error
                }
            }
        }

        return results.records
    }

    /**
     * Merges into expression map given expression map properties.
     */
    protected mergeExpressionMap(
        expressionMap: Partial<QueryExpressionMap>,
    ): this {
        ObjectUtils.assign(this.expressionMap, expressionMap)
        return this
    }

    /**
     * Normalizes a give number - converts to int if possible.
     */
    protected normalizeNumber(num: any) {
        if (typeof num === "number" || num === undefined || num === null)
            return num

        return Number(num)
    }

    /**
     * Creates a query builder used to execute sql queries inside this query builder.
     */
    protected obtainQueryRunner() {
        return this.queryRunner || this.connection.createQueryRunner("slave")
    }

    protected buildSelect(
        select: FindOptionsSelect<any>,
        metadata: EntityMetadata,
        alias: string,
        embedPrefix?: string,
    ) {
        for (let key in select) {
            if (select[key] === undefined || select[key] === false) continue

            const propertyPath = embedPrefix ? embedPrefix + "." + key : key
            const column =
                metadata.findColumnWithPropertyPathStrict(propertyPath)
            const embed = metadata.findEmbeddedWithPropertyPath(propertyPath)
            const relation = metadata.findRelationWithPropertyPath(propertyPath)

            if (!embed && !column && !relation)
                throw new EntityPropertyNotFoundError(propertyPath, metadata)

            if (column) {
                this.selects.push(alias + "." + propertyPath)
                // this.addSelect(alias + "." + propertyPath);
            } else if (embed) {
                this.buildSelect(
                    select[key] as FindOptionsSelect<any>,
                    metadata,
                    alias,
                    propertyPath,
                )

                // } else if (relation) {
                //     const joinAlias = alias + "_" + relation.propertyName;
                //     const existJoin = this.joins.find(join => join.alias === joinAlias);
                //     if (!existJoin) {
                //         this.joins.push({
                //             type: "left",
                //             select: false,
                //             alias: joinAlias,
                //             parentAlias: alias,
                //             relationMetadata: relation
                //         });
                //     }
                //     this.buildOrder(select[key] as FindOptionsOrder<any>, relation.inverseEntityMetadata, joinAlias);
            }
        }
    }

    protected buildRelations(
        relations: FindOptionsRelations<any>,
        selection: FindOptionsSelect<any> | undefined,
        metadata: EntityMetadata,
        alias: string,
        embedPrefix?: string,
    ) {
        if (!relations) return

        Object.keys(relations).forEach((relationName) => {
            const relationValue = (relations as any)[relationName]
            const propertyPath = embedPrefix
                ? embedPrefix + "." + relationName
                : relationName
            const embed = metadata.findEmbeddedWithPropertyPath(propertyPath)
            const relation = metadata.findRelationWithPropertyPath(propertyPath)
            if (!embed && !relation)
                throw new EntityPropertyNotFoundError(propertyPath, metadata)

            if (embed) {
                this.buildRelations(
                    relationValue,
                    typeof selection === "object"
                        ? OrmUtils.deepValue(selection, embed.propertyPath)
                        : undefined,
                    metadata,
                    alias,
                    propertyPath,
                )
            } else if (relation) {
                let joinAlias = alias + "_" + propertyPath.replace(".", "_")
                joinAlias = DriverUtils.buildAlias(
                    this.connection.driver,
                    { joiner: "__" },
                    alias,
                    joinAlias,
                )
                if (
                    relationValue === true ||
                    typeof relationValue === "object"
                ) {
                    if (this.expressionMap.relationLoadStrategy === "query") {
                        this.concatRelationMetadata(relation)
                    } else {
                        // join
                        this.joins.push({
                            type: "left",
                            select: true,
                            selection:
                                selection &&
                                typeof selection[relationName] === "object"
                                    ? (selection[
                                          relationName
                                      ] as FindOptionsSelect<any>)
                                    : undefined,
                            alias: joinAlias,
                            parentAlias: alias,
                            relationMetadata: relation,
                        })

                        if (
                            selection &&
                            typeof selection[relationName] === "object"
                        ) {
                            this.buildSelect(
                                selection[
                                    relationName
                                ] as FindOptionsSelect<any>,
                                relation.inverseEntityMetadata,
                                joinAlias,
                            )
                        }
                    }
                }

                if (
                    typeof relationValue === "object" &&
                    this.expressionMap.relationLoadStrategy === "join"
                ) {
                    this.buildRelations(
                        relationValue,
                        typeof selection === "object"
                            ? OrmUtils.deepValue(
                                  selection,
                                  relation.propertyPath,
                              )
                            : undefined,
                        relation.inverseEntityMetadata,
                        joinAlias,
                        undefined,
                    )
                }
            }
        })
    }

    protected buildEagerRelations(
        relations: FindOptionsRelations<any>,
        selection: FindOptionsSelect<any> | undefined,
        metadata: EntityMetadata,
        alias: string,
        embedPrefix?: string,
    ) {
        if (!relations) return

        Object.keys(relations).forEach((relationName) => {
            const relationValue = (relations as any)[relationName]
            const propertyPath = embedPrefix
                ? embedPrefix + "." + relationName
                : relationName
            const embed = metadata.findEmbeddedWithPropertyPath(propertyPath)
            const relation = metadata.findRelationWithPropertyPath(propertyPath)
            if (!embed && !relation)
                throw new EntityPropertyNotFoundError(propertyPath, metadata)

            if (embed) {
                this.buildEagerRelations(
                    relationValue,
                    typeof selection === "object"
                        ? OrmUtils.deepValue(selection, embed.propertyPath)
                        : undefined,
                    metadata,
                    alias,
                    propertyPath,
                )
            } else if (relation) {
                let joinAlias = alias + "_" + propertyPath.replace(".", "_")
                joinAlias = DriverUtils.buildAlias(
                    this.connection.driver,
                    { joiner: "__" },
                    alias,
                    joinAlias,
                )

                if (
                    relationValue === true ||
                    typeof relationValue === "object"
                ) {
                    relation.inverseEntityMetadata.eagerRelations.forEach(
                        (eagerRelation) => {
                            let eagerRelationJoinAlias =
                                joinAlias +
                                "_" +
                                eagerRelation.propertyPath.replace(".", "_")
                            eagerRelationJoinAlias = DriverUtils.buildAlias(
                                this.connection.driver,
                                { joiner: "__" },
                                joinAlias,
                                eagerRelationJoinAlias,
                            )

                            const existJoin = this.joins.find(
                                (join) => join.alias === eagerRelationJoinAlias,
                            )
                            if (!existJoin) {
                                this.joins.push({
                                    type: "left",
                                    select: true,
                                    alias: eagerRelationJoinAlias,
                                    parentAlias: joinAlias,
                                    selection: undefined,
                                    relationMetadata: eagerRelation,
                                })
                            }

                            if (
                                selection &&
                                typeof selection[relationName] === "object"
                            ) {
                                this.buildSelect(
                                    selection[
                                        relationName
                                    ] as FindOptionsSelect<any>,
                                    relation.inverseEntityMetadata,
                                    joinAlias,
                                )
                            }
                        },
                    )
                }

                if (typeof relationValue === "object") {
                    this.buildEagerRelations(
                        relationValue,
                        typeof selection === "object"
                            ? OrmUtils.deepValue(
                                  selection,
                                  relation.propertyPath,
                              )
                            : undefined,
                        relation.inverseEntityMetadata,
                        joinAlias,
                        undefined,
                    )
                }
            }
        })
    }

    protected buildOrder(
        order: FindOptionsOrder<any>,
        metadata: EntityMetadata,
        alias: string,
        embedPrefix?: string,
    ) {
        for (let key in order) {
            if (order[key] === undefined) continue

            const propertyPath = embedPrefix ? embedPrefix + "." + key : key
            const column =
                metadata.findColumnWithPropertyPathStrict(propertyPath)
            const embed = metadata.findEmbeddedWithPropertyPath(propertyPath)
            const relation = metadata.findRelationWithPropertyPath(propertyPath)

            if (!embed && !column && !relation)
                throw new EntityPropertyNotFoundError(propertyPath, metadata)

            if (column) {
                let direction =
                    typeof order[key] === "object"
                        ? (order[key] as any).direction
                        : order[key]
                direction =
                    direction === "DESC" ||
                    direction === "desc" ||
                    direction === -1
                        ? "DESC"
                        : "ASC"
                let nulls =
                    typeof order[key] === "object"
                        ? (order[key] as any).nulls
                        : undefined
                nulls =
                    nulls?.toLowerCase() === "first"
                        ? "NULLS FIRST"
                        : nulls?.toLowerCase() === "last"
                        ? "NULLS LAST"
                        : undefined

                let aliasPath = `${alias}.${propertyPath}`
                // const selection = this.expressionMap.selects.find(
                //     (s) => s.selection === aliasPath,
                // )
                // if (selection) {
                //     // this is not building correctly now???
                //     aliasPath = this.escape(
                //         DriverUtils.buildAlias(
                //             this.connection.driver,
                //             undefined,
                //             alias,
                //             column.databaseName,
                //         ),
                //     )
                //     // selection.aliasName = aliasPath
                // } else {
                //     if (column.isVirtualProperty && column.query) {
                //         aliasPath = `(${column.query(alias)})`
                //     }
                // }

                // console.log("add sort", selection, aliasPath, direction, nulls)
                this.addOrderBy(aliasPath, direction, nulls)
                // this.orderBys.push({ alias: alias + "." + propertyPath, direction, nulls });
            } else if (embed) {
                this.buildOrder(
                    order[key] as FindOptionsOrder<any>,
                    metadata,
                    alias,
                    propertyPath,
                )
            } else if (relation) {
                let joinAlias = alias + "_" + propertyPath.replace(".", "_")
                joinAlias = DriverUtils.buildAlias(
                    this.connection.driver,
                    { joiner: "__" },
                    alias,
                    joinAlias,
                )
                // console.log("joinAlias", joinAlias, joinAlias.length, this.connection.driver.maxAliasLength)
                // todo: use expressionMap.joinAttributes, and create a new one using
                //  const joinAttribute = new JoinAttribute(this.connection, this.expressionMap);

                const existJoin = this.joins.find(
                    (join) => join.alias === joinAlias,
                )
                if (!existJoin) {
                    this.joins.push({
                        type: "left",
                        select: false,
                        alias: joinAlias,
                        parentAlias: alias,
                        selection: undefined,
                        relationMetadata: relation,
                    })
                }
                this.buildOrder(
                    order[key] as FindOptionsOrder<any>,
                    relation.inverseEntityMetadata,
                    joinAlias,
                )
            }
        }
    }

    protected buildWhere(
        where: FindOptionsWhere<any>[] | FindOptionsWhere<any>,
        metadata: EntityMetadata,
        alias: string,
        embedPrefix?: string,
    ) {
        let condition: string = ""
        // let parameterIndex = Object.keys(this.expressionMap.nativeParameters).length;
        if (Array.isArray(where) && where.length) {
            condition =
                "(" +
                where
                    .map((whereItem) => {
                        return this.buildWhere(
                            whereItem,
                            metadata,
                            alias,
                            embedPrefix,
                        )
                    })
                    .filter((condition) => !!condition)
                    .map((condition) => "(" + condition + ")")
                    .join(" OR ") +
                ")"
        } else {
            let andConditions: string[] = []
            for (let key in where) {
                if (where[key] === undefined || where[key] === null) continue

                const propertyPath = embedPrefix ? embedPrefix + "." + key : key
                const column =
                    metadata.findColumnWithPropertyPathStrict(propertyPath)
                const embed =
                    metadata.findEmbeddedWithPropertyPath(propertyPath)
                const relation =
                    metadata.findRelationWithPropertyPath(propertyPath)

                if (!embed && !column && !relation)
                    throw new EntityPropertyNotFoundError(
                        propertyPath,
                        metadata,
                    )

                if (column) {
                    let aliasPath = `${alias}.${propertyPath}`
                    if (column.isVirtualProperty && column.query) {
                        aliasPath = `(${column.query(alias)})`
                    }
                    // const parameterName = alias + "_" + propertyPath.split(".").join("_") + "_" + parameterIndex;

                    // todo: we need to handle other operators as well?
                    let parameterValue = where[key]
                    if (InstanceChecker.isEqualOperator(where[key])) {
                        parameterValue = where[key].value
                    }
                    if (column.transformer) {
                        parameterValue instanceof FindOperator
                            ? parameterValue.transformValue(column.transformer)
                            : (parameterValue =
                                  ApplyValueTransformers.transformTo(
                                      column.transformer,
                                      parameterValue,
                                  ))
                    }

                    // if (parameterValue === null) {
                    //     andConditions.push(`${aliasPath} IS NULL`);
                    //
                    // } else if (parameterValue instanceof FindOperator) {
                    //     // let parameters: any[] = [];
                    //     // if (parameterValue.useParameter) {
                    //     //     const realParameterValues: any[] = parameterValue.multipleParameters ? parameterValue.value : [parameterValue.value];
                    //     //     realParameterValues.forEach((realParameterValue, realParameterValueIndex) => {
                    //     //
                    //     //         // don't create parameters for number to prevent max number of variables issues as much as possible
                    //     //         if (typeof realParameterValue === "number") {
                    //     //             parameters.push(realParameterValue);
                    //     //
                    //     //         } else {
                    //     //             this.expressionMap.nativeParameters[parameterName + realParameterValueIndex] = realParameterValue;
                    //     //             parameterIndex++;
                    //     //             parameters.push(this.connection.driver.createParameter(parameterName + realParameterValueIndex, parameterIndex - 1));
                    //     //         }
                    //     //     });
                    //     // }
                    //     andConditions.push(
                    //         this.createWhereConditionExpression(this.getWherePredicateCondition(aliasPath, parameterValue))
                    //         // parameterValue.toSql(this.connection, aliasPath, parameters));
                    //     )
                    //
                    // } else {
                    //     this.expressionMap.nativeParameters[parameterName] = parameterValue;
                    //     parameterIndex++;
                    //     const parameter = this.connection.driver.createParameter(parameterName, parameterIndex - 1);
                    //     andConditions.push(`${aliasPath} = ${parameter}`);
                    // }

                    andConditions.push(
                        this.createWhereConditionExpression(
                            this.getWherePredicateCondition(
                                aliasPath,
                                parameterValue,
                            ),
                        ),
                        // parameterValue.toSql(this.connection, aliasPath, parameters));
                    )

                    // this.conditions.push(`${alias}.${propertyPath} = :${paramName}`);
                    // this.expressionMap.parameters[paramName] = where[key]; // todo: handle functions and other edge cases
                } else if (embed) {
                    const condition = this.buildWhere(
                        where[key],
                        metadata,
                        alias,
                        propertyPath,
                    )
                    if (condition) andConditions.push(condition)
                } else if (relation) {
                    // if all properties of where are undefined we don't need to join anything
                    // this can happen when user defines map with conditional queries inside
                    if (typeof where[key] === "object") {
                        const allAllUndefined = Object.keys(where[key]).every(
                            (k) => where[key][k] === undefined,
                        )
                        if (allAllUndefined) {
                            continue
                        }
                    }

                    if (InstanceChecker.isFindOperator(where[key])) {
                        if (
                            where[key].type === "moreThan" ||
                            where[key].type === "lessThan" ||
                            where[key].type === "moreThanOrEqual" ||
                            where[key].type === "lessThanOrEqual"
                        ) {
                            let sqlOperator = ""
                            if (where[key].type === "moreThan") {
                                sqlOperator = ">"
                            } else if (where[key].type === "lessThan") {
                                sqlOperator = "<"
                            } else if (where[key].type === "moreThanOrEqual") {
                                sqlOperator = ">="
                            } else if (where[key].type === "lessThanOrEqual") {
                                sqlOperator = "<="
                            }
                            // basically relation count functionality
                            const qb: QueryBuilder<any> = this.subQuery()
                            if (relation.isManyToManyOwner) {
                                qb.select("COUNT(*)")
                                    .from(
                                        relation.joinTableName,
                                        relation.joinTableName,
                                    )
                                    .where(
                                        relation.joinColumns
                                            .map((column) => {
                                                return `${
                                                    relation.joinTableName
                                                }.${
                                                    column.propertyName
                                                } = ${alias}.${
                                                    column.referencedColumn!
                                                        .propertyName
                                                }`
                                            })
                                            .join(" AND "),
                                    )
                            } else if (relation.isManyToManyNotOwner) {
                                qb.select("COUNT(*)")
                                    .from(
                                        relation.inverseRelation!.joinTableName,
                                        relation.inverseRelation!.joinTableName,
                                    )
                                    .where(
                                        relation
                                            .inverseRelation!.inverseJoinColumns.map(
                                                (column) => {
                                                    return `${
                                                        relation.inverseRelation!
                                                            .joinTableName
                                                    }.${
                                                        column.propertyName
                                                    } = ${alias}.${
                                                        column.referencedColumn!
                                                            .propertyName
                                                    }`
                                                },
                                            )
                                            .join(" AND "),
                                    )
                            } else if (relation.isOneToMany) {
                                qb.select("COUNT(*)")
                                    .from(
                                        relation.inverseEntityMetadata.target,
                                        relation.inverseEntityMetadata
                                            .tableName,
                                    )
                                    .where(
                                        relation
                                            .inverseRelation!.joinColumns.map(
                                                (column) => {
                                                    return `${
                                                        relation
                                                            .inverseEntityMetadata
                                                            .tableName
                                                    }.${
                                                        column.propertyName
                                                    } = ${alias}.${
                                                        column.referencedColumn!
                                                            .propertyName
                                                    }`
                                                },
                                            )
                                            .join(" AND "),
                                    )
                            } else {
                                throw new Error(
                                    `This relation isn't supported by given find operator`,
                                )
                            }
                            // this
                            //     .addSelect(qb.getSql(), relation.propertyAliasName + "_cnt")
                            //     .andWhere(this.escape(relation.propertyAliasName + "_cnt") + " " + sqlOperator + " " + parseInt(where[key].value));
                            this.andWhere(
                                qb.getSql() +
                                    " " +
                                    sqlOperator +
                                    " " +
                                    parseInt(where[key].value),
                            )
                        } else {
                            if (
                                relation.isManyToOne ||
                                (relation.isOneToOne &&
                                    relation.isOneToOneOwner)
                            ) {
                                const aliasPath = `${alias}.${propertyPath}`

                                andConditions.push(
                                    this.createWhereConditionExpression(
                                        this.getWherePredicateCondition(
                                            aliasPath,
                                            where[key],
                                        ),
                                    ),
                                )
                            } else {
                                throw new Error(
                                    `This relation isn't supported by given find operator`,
                                )
                            }
                        }
                    } else {
                        // const joinAlias = alias + "_" + relation.propertyName;
                        let joinAlias =
                            alias +
                            "_" +
                            relation.propertyPath.replace(".", "_")
                        joinAlias = DriverUtils.buildAlias(
                            this.connection.driver,
                            { joiner: "__" },
                            alias,
                            joinAlias,
                        )

                        const existJoin = this.joins.find(
                            (join) => join.alias === joinAlias,
                        )
                        if (!existJoin) {
                            this.joins.push({
                                type: "left",
                                select: false,
                                selection: undefined,
                                alias: joinAlias,
                                parentAlias: alias,
                                relationMetadata: relation,
                            })
                        }

                        const condition = this.buildWhere(
                            where[key],
                            relation.inverseEntityMetadata,
                            joinAlias,
                        )
                        if (condition) {
                            andConditions.push(condition)
                            // parameterIndex = Object.keys(this.expressionMap.nativeParameters).length;
                        }
                    }
                }
            }
            condition = andConditions.join(" AND ")
        }
        return condition
    }
}
/**
 * Allows to build complex sql queries in a fashion way and execute those queries.
 */
export class SoftDeleteQueryBuilder<Entity extends ObjectLiteral>
    extends QueryBuilder<Entity>
    implements WhereExpressionBuilder
{
    readonly "@instanceof" = Symbol.for("SoftDeleteQueryBuilder")

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(
        connectionOrQueryBuilder: DataSource | QueryBuilder<any>,
        queryRunner?: QueryRunner,
    ) {
        super(connectionOrQueryBuilder as any, queryRunner)
        this.expressionMap.aliasNamePrefixingEnabled = false
    }

    // -------------------------------------------------------------------------
    // Public Implemented Methods
    // -------------------------------------------------------------------------

    /**
     * Gets generated SQL query without parameters being replaced.
     */
    getQuery(): string {
        let sql = this.createUpdateExpression()
        sql += this.createCteExpression()
        sql += this.createOrderByExpression()
        sql += this.createLimitExpression()
        return this.replacePropertyNamesForTheWholeQuery(sql.trim())
    }

    /**
     * Executes sql generated by query builder and returns raw database results.
     */
    async execute(): Promise<UpdateResult> {
        const queryRunner = this.obtainQueryRunner()
        let transactionStartedByUs: boolean = false

        try {
            // start transaction if it was enabled
            if (
                this.expressionMap.useTransaction === true &&
                queryRunner.isTransactionActive === false
            ) {
                await queryRunner.startTransaction()
                transactionStartedByUs = true
            }

            // call before soft remove and recover methods in listeners and subscribers
            if (
                this.expressionMap.callListeners === true &&
                this.expressionMap.mainAlias!.hasMetadata
            ) {
                if (this.expressionMap.queryType === "soft-delete")
                    await queryRunner.broadcaster.broadcast(
                        "BeforeSoftRemove",
                        this.expressionMap.mainAlias!.metadata,
                    )
                else if (this.expressionMap.queryType === "restore")
                    await queryRunner.broadcaster.broadcast(
                        "BeforeRecover",
                        this.expressionMap.mainAlias!.metadata,
                    )
            }

            // if update entity mode is enabled we may need extra columns for the returning statement
            const returningResultsEntityUpdator =
                new ReturningResultsEntityUpdator(
                    queryRunner,
                    this.expressionMap,
                )
            if (
                this.expressionMap.updateEntity === true &&
                this.expressionMap.mainAlias!.hasMetadata &&
                this.expressionMap.whereEntities.length > 0
            ) {
                this.expressionMap.extraReturningColumns =
                    returningResultsEntityUpdator.getSoftDeletionReturningColumns()
            }

            // execute update query
            const [sql, parameters] = this.getQueryAndParameters()

            const queryResult = await queryRunner.query(sql, parameters, true)
            const updateResult = UpdateResult.from(queryResult)

            // if we are updating entities and entity updation is enabled we must update some of entity columns (like version, update date, etc.)
            if (
                this.expressionMap.updateEntity === true &&
                this.expressionMap.mainAlias!.hasMetadata &&
                this.expressionMap.whereEntities.length > 0
            ) {
                await returningResultsEntityUpdator.update(
                    updateResult,
                    this.expressionMap.whereEntities,
                )
            }

            // call after soft remove and recover methods in listeners and subscribers
            if (
                this.expressionMap.callListeners === true &&
                this.expressionMap.mainAlias!.hasMetadata
            ) {
                if (this.expressionMap.queryType === "soft-delete")
                    await queryRunner.broadcaster.broadcast(
                        "AfterSoftRemove",
                        this.expressionMap.mainAlias!.metadata,
                    )
                else if (this.expressionMap.queryType === "restore")
                    await queryRunner.broadcaster.broadcast(
                        "AfterRecover",
                        this.expressionMap.mainAlias!.metadata,
                    )
            }

            // close transaction if we started it
            if (transactionStartedByUs) await queryRunner.commitTransaction()

            return updateResult
        } catch (error) {
            // rollback transaction if we started it
            if (transactionStartedByUs) {
                try {
                    await queryRunner.rollbackTransaction()
                } catch (rollbackError) {}
            }
            throw error
        } finally {
            if (queryRunner !== this.queryRunner) {
                // means we created our own query runner
                await queryRunner.release()
            }
        }
    }

    // -------------------------------------------------------------------------
    // Public Methods
    // -------------------------------------------------------------------------

    /**
     * Specifies FROM which entity's table select/update/delete/soft-delete will be executed.
     * Also sets a main string alias of the selection data.
     */
    from<T extends ObjectLiteral>(
        entityTarget: EntityTarget<T>,
        aliasName?: string,
    ): SoftDeleteQueryBuilder<T> {
        entityTarget = InstanceChecker.isEntitySchema(entityTarget)
            ? entityTarget.options.name
            : entityTarget
        const mainAlias = this.createFromAlias(entityTarget, aliasName)
        this.expressionMap.setMainAlias(mainAlias)
        return this as any as SoftDeleteQueryBuilder<T>
    }

    /**
     * Sets WHERE condition in the query builder.
     * If you had previously WHERE expression defined,
     * calling this function will override previously set WHERE conditions.
     * Additionally you can add parameters used in where expression.
     */
    where(
        where:
            | string
            | ((qb: this) => string)
            | Brackets
            | ObjectLiteral
            | ObjectLiteral[],
        parameters?: ObjectLiteral,
    ): this {
        this.expressionMap.wheres = [] // don't move this block below since computeWhereParameter can add where expressions
        const condition = this.getWhereCondition(where)
        if (condition)
            this.expressionMap.wheres = [
                { type: "simple", condition: condition },
            ]
        if (parameters) this.setParameters(parameters)
        return this
    }

    /**
     * Adds new AND WHERE condition in the query builder.
     * Additionally you can add parameters used in where expression.
     */
    andWhere(
        where:
            | string
            | ((qb: this) => string)
            | Brackets
            | ObjectLiteral
            | ObjectLiteral[],
        parameters?: ObjectLiteral,
    ): this {
        this.expressionMap.wheres.push({
            type: "and",
            condition: this.getWhereCondition(where),
        })
        if (parameters) this.setParameters(parameters)
        return this
    }

    /**
     * Adds new OR WHERE condition in the query builder.
     * Additionally you can add parameters used in where expression.
     */
    orWhere(
        where:
            | string
            | ((qb: this) => string)
            | Brackets
            | ObjectLiteral
            | ObjectLiteral[],
        parameters?: ObjectLiteral,
    ): this {
        this.expressionMap.wheres.push({
            type: "or",
            condition: this.getWhereCondition(where),
        })
        if (parameters) this.setParameters(parameters)
        return this
    }

    /**
     * Adds new AND WHERE with conditions for the given ids.
     */
    whereInIds(ids: any | any[]): this {
        return this.where(this.getWhereInIdsCondition(ids))
    }

    /**
     * Adds new AND WHERE with conditions for the given ids.
     */
    andWhereInIds(ids: any | any[]): this {
        return this.andWhere(this.getWhereInIdsCondition(ids))
    }

    /**
     * Adds new OR WHERE with conditions for the given ids.
     */
    orWhereInIds(ids: any | any[]): this {
        return this.orWhere(this.getWhereInIdsCondition(ids))
    }
    /**
     * Optional returning/output clause.
     * This will return given column values.
     */
    output(columns: string[]): this

    /**
     * Optional returning/output clause.
     * Returning is a SQL string containing returning statement.
     */
    output(output: string): this

    /**
     * Optional returning/output clause.
     */
    output(output: string | string[]): this

    /**
     * Optional returning/output clause.
     */
    output(output: string | string[]): this {
        return this.returning(output)
    }

    /**
     * Optional returning/output clause.
     * This will return given column values.
     */
    returning(columns: string[]): this

    /**
     * Optional returning/output clause.
     * Returning is a SQL string containing returning statement.
     */
    returning(returning: string): this

    /**
     * Optional returning/output clause.
     */
    returning(returning: string | string[]): this

    /**
     * Optional returning/output clause.
     */
    returning(returning: string | string[]): this {
        // not all databases support returning/output cause
        if (!this.connection.driver.isReturningSqlSupported("update")) {
            throw new ReturningStatementNotSupportedError()
        }

        this.expressionMap.returning = returning
        return this
    }

    /**
     * Sets ORDER BY condition in the query builder.
     * If you had previously ORDER BY expression defined,
     * calling this function will override previously set ORDER BY conditions.
     *
     * Calling order by without order set will remove all previously set order bys.
     */
    orderBy(): this

    /**
     * Sets ORDER BY condition in the query builder.
     * If you had previously ORDER BY expression defined,
     * calling this function will override previously set ORDER BY conditions.
     */
    orderBy(
        sort: string,
        order?: "ASC" | "DESC",
        nulls?: "NULLS FIRST" | "NULLS LAST",
    ): this

    /**
     * Sets ORDER BY condition in the query builder.
     * If you had previously ORDER BY expression defined,
     * calling this function will override previously set ORDER BY conditions.
     */
    orderBy(order: OrderByCondition): this

    /**
     * Sets ORDER BY condition in the query builder.
     * If you had previously ORDER BY expression defined,
     * calling this function will override previously set ORDER BY conditions.
     */
    orderBy(
        sort?: string | OrderByCondition,
        order: "ASC" | "DESC" = "ASC",
        nulls?: "NULLS FIRST" | "NULLS LAST",
    ): this {
        if (sort) {
            if (typeof sort === "object") {
                this.expressionMap.orderBys = sort as OrderByCondition
            } else {
                if (nulls) {
                    this.expressionMap.orderBys = {
                        [sort as string]: { order, nulls },
                    }
                } else {
                    this.expressionMap.orderBys = { [sort as string]: order }
                }
            }
        } else {
            this.expressionMap.orderBys = {}
        }
        return this
    }

    /**
     * Adds ORDER BY condition in the query builder.
     */
    addOrderBy(
        sort: string,
        order: "ASC" | "DESC" = "ASC",
        nulls?: "NULLS FIRST" | "NULLS LAST",
    ): this {
        if (nulls) {
            this.expressionMap.orderBys[sort] = { order, nulls }
        } else {
            this.expressionMap.orderBys[sort] = order
        }
        return this
    }

    /**
     * Sets LIMIT - maximum number of rows to be selected.
     */
    limit(limit?: number): this {
        this.expressionMap.limit = limit
        return this
    }

    /**
     * Indicates if entity must be updated after update operation.
     * This may produce extra query or use RETURNING / OUTPUT statement (depend on database).
     * Enabled by default.
     */
    whereEntity(entity: Entity | Entity[]): this {
        if (!this.expressionMap.mainAlias!.hasMetadata)
            throw new TypeORMError(
                `.whereEntity method can only be used on queries which update real entity table.`,
            )

        this.expressionMap.wheres = []
        const entities: Entity[] = Array.isArray(entity) ? entity : [entity]
        entities.forEach((entity) => {
            const entityIdMap =
                this.expressionMap.mainAlias!.metadata.getEntityIdMap(entity)
            if (!entityIdMap)
                throw new TypeORMError(
                    `Provided entity does not have ids set, cannot perform operation.`,
                )

            this.orWhereInIds(entityIdMap)
        })

        this.expressionMap.whereEntities = entities
        return this
    }

    /**
     * Indicates if entity must be updated after update operation.
     * This may produce extra query or use RETURNING / OUTPUT statement (depend on database).
     * Enabled by default.
     */
    updateEntity(enabled: boolean): this {
        this.expressionMap.updateEntity = enabled
        return this
    }

    // -------------------------------------------------------------------------
    // Protected Methods
    // -------------------------------------------------------------------------

    /**
     * Creates UPDATE express used to perform insert query.
     */
    protected createUpdateExpression() {
        const metadata = this.expressionMap.mainAlias!.hasMetadata
            ? this.expressionMap.mainAlias!.metadata
            : undefined
        if (!metadata)
            throw new TypeORMError(
                `Cannot get entity metadata for the given alias "${this.expressionMap.mainAlias}"`,
            )
        if (!metadata.deleteDateColumn) {
            throw new MissingDeleteDateColumnError(metadata)
        }

        // prepare columns and values to be updated
        const updateColumnAndValues: string[] = []

        switch (this.expressionMap.queryType) {
            case "soft-delete":
                updateColumnAndValues.push(
                    this.escape(metadata.deleteDateColumn.databaseName) +
                        " = CURRENT_TIMESTAMP",
                )
                break
            case "restore":
                updateColumnAndValues.push(
                    this.escape(metadata.deleteDateColumn.databaseName) +
                        " = NULL",
                )
                break
            default:
                throw new TypeORMError(
                    `The queryType must be "soft-delete" or "restore"`,
                )
        }
        if (metadata.versionColumn)
            updateColumnAndValues.push(
                this.escape(metadata.versionColumn.databaseName) +
                    " = " +
                    this.escape(metadata.versionColumn.databaseName) +
                    " + 1",
            )
        if (metadata.updateDateColumn)
            updateColumnAndValues.push(
                this.escape(metadata.updateDateColumn.databaseName) +
                    " = CURRENT_TIMESTAMP",
            ) // todo: fix issue with CURRENT_TIMESTAMP(6) being used, can "DEFAULT" be used?!

        if (updateColumnAndValues.length <= 0) {
            throw new UpdateValuesMissingError()
        }

        // get a table name and all column database names
        const whereExpression = this.createWhereExpression()
        const returningExpression = this.createReturningExpression("update")

        if (returningExpression === "") {
            return `UPDATE ${this.getTableName(
                this.getMainTableName(),
            )} SET ${updateColumnAndValues.join(", ")}${whereExpression}` // todo: how do we replace aliases in where to nothing?
        }
        if (this.connection.driver.options.type === "mssql") {
            return `UPDATE ${this.getTableName(
                this.getMainTableName(),
            )} SET ${updateColumnAndValues.join(
                ", ",
            )} OUTPUT ${returningExpression}${whereExpression}`
        }
        return `UPDATE ${this.getTableName(
            this.getMainTableName(),
        )} SET ${updateColumnAndValues.join(
            ", ",
        )}${whereExpression} RETURNING ${returningExpression}`
    }

    /**
     * Creates "ORDER BY" part of SQL query.
     */
    protected createOrderByExpression() {
        const orderBys = this.expressionMap.orderBys
        if (Object.keys(orderBys).length > 0)
            return (
                " ORDER BY " +
                Object.keys(orderBys)
                    .map((columnName) => {
                        if (typeof orderBys[columnName] === "string") {
                            return (
                                this.replacePropertyNames(columnName) +
                                " " +
                                orderBys[columnName]
                            )
                        } else {
                            return (
                                this.replacePropertyNames(columnName) +
                                " " +
                                (orderBys[columnName] as any).order +
                                " " +
                                (orderBys[columnName] as any).nulls
                            )
                        }
                    })
                    .join(", ")
            )

        return ""
    }

    /**
     * Creates "LIMIT" parts of SQL query.
     */
    protected createLimitExpression(): string {
        let limit: number | undefined = this.expressionMap.limit

        if (limit) {
            if (DriverUtils.isMySQLFamily(this.connection.driver)) {
                return " LIMIT " + limit
            } else {
                throw new LimitOnUpdateNotSupportedError()
            }
        }

        return ""
    }
}
/**
 * Allows to build complex sql queries in a fashion way and execute those queries.
 */
export class UpdateQueryBuilder<Entity extends ObjectLiteral>
    extends QueryBuilder<Entity>
    implements WhereExpressionBuilder
{
    readonly "@instanceof" = Symbol.for("UpdateQueryBuilder")

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(
        connectionOrQueryBuilder: DataSource | QueryBuilder<any>,
        queryRunner?: QueryRunner,
    ) {
        super(connectionOrQueryBuilder as any, queryRunner)
        this.expressionMap.aliasNamePrefixingEnabled = false
    }

    // -------------------------------------------------------------------------
    // Public Implemented Methods
    // -------------------------------------------------------------------------

    /**
     * Gets generated SQL query without parameters being replaced.
     */
    getQuery(): string {
        let sql = this.createComment()
        sql += this.createCteExpression()
        sql += this.createUpdateExpression()
        sql += this.createOrderByExpression()
        sql += this.createLimitExpression()
        return this.replacePropertyNamesForTheWholeQuery(sql.trim())
    }

    /**
     * Executes sql generated by query builder and returns raw database results.
     */
    async execute(): Promise<UpdateResult> {
        const queryRunner = this.obtainQueryRunner()
        let transactionStartedByUs: boolean = false

        try {
            // start transaction if it was enabled
            if (
                this.expressionMap.useTransaction === true &&
                queryRunner.isTransactionActive === false
            ) {
                await queryRunner.startTransaction()
                transactionStartedByUs = true
            }

            // call before updation methods in listeners and subscribers
            if (
                this.expressionMap.callListeners === true &&
                this.expressionMap.mainAlias!.hasMetadata
            ) {
                await queryRunner.broadcaster.broadcast(
                    "BeforeUpdate",
                    this.expressionMap.mainAlias!.metadata,
                    this.expressionMap.valuesSet,
                )
            }

            let declareSql: string | null = null
            let selectOutputSql: string | null = null

            // if update entity mode is enabled we may need extra columns for the returning statement
            const returningResultsEntityUpdator =
                new ReturningResultsEntityUpdator(
                    queryRunner,
                    this.expressionMap,
                )

            const returningColumns: ColumnMetadata[] = []

            if (
                Array.isArray(this.expressionMap.returning) &&
                this.expressionMap.mainAlias!.hasMetadata
            ) {
                for (const columnPath of this.expressionMap.returning) {
                    returningColumns.push(
                        ...this.expressionMap.mainAlias!.metadata.findColumnsWithPropertyPath(
                            columnPath,
                        ),
                    )
                }
            }

            if (
                this.expressionMap.updateEntity === true &&
                this.expressionMap.mainAlias!.hasMetadata &&
                this.expressionMap.whereEntities.length > 0
            ) {
                this.expressionMap.extraReturningColumns =
                    returningResultsEntityUpdator.getUpdationReturningColumns()

                returningColumns.push(
                    ...this.expressionMap.extraReturningColumns.filter(
                        (c) => !returningColumns.includes(c),
                    ),
                )
            }

            if (
                returningColumns.length > 0 &&
                this.connection.driver.options.type === "mssql"
            ) {
                declareSql = (
                    this.connection.driver as SqlServerDriver
                ).buildTableVariableDeclaration(
                    "@OutputTable",
                    returningColumns,
                )
                selectOutputSql = `SELECT * FROM @OutputTable`
            }

            // execute update query
            const [updateSql, parameters] = this.getQueryAndParameters()

            const statements = [declareSql, updateSql, selectOutputSql]
            const queryResult = await queryRunner.query(
                statements.filter((sql) => sql != null).join(";\n\n"),
                parameters,
                true,
            )
            const updateResult = UpdateResult.from(queryResult)

            // if we are updating entities and entity updation is enabled we must update some of entity columns (like version, update date, etc.)
            if (
                this.expressionMap.updateEntity === true &&
                this.expressionMap.mainAlias!.hasMetadata &&
                this.expressionMap.whereEntities.length > 0
            ) {
                await returningResultsEntityUpdator.update(
                    updateResult,
                    this.expressionMap.whereEntities,
                )
            }

            // call after updation methods in listeners and subscribers
            if (
                this.expressionMap.callListeners === true &&
                this.expressionMap.mainAlias!.hasMetadata
            ) {
                await queryRunner.broadcaster.broadcast(
                    "AfterUpdate",
                    this.expressionMap.mainAlias!.metadata,
                    this.expressionMap.valuesSet,
                )
            }

            // close transaction if we started it
            if (transactionStartedByUs) await queryRunner.commitTransaction()

            return updateResult
        } catch (error) {
            // rollback transaction if we started it
            if (transactionStartedByUs) {
                try {
                    await queryRunner.rollbackTransaction()
                } catch (rollbackError) {}
            }
            throw error
        } finally {
            if (queryRunner !== this.queryRunner) {
                // means we created our own query runner
                await queryRunner.release()
            }
        }
    }

    // -------------------------------------------------------------------------
    // Public Methods
    // -------------------------------------------------------------------------

    /**
     * Values needs to be updated.
     */
    set(values: QueryDeepPartialEntity<Entity>): this {
        this.expressionMap.valuesSet = values
        return this
    }

    /**
     * Sets WHERE condition in the query builder.
     * If you had previously WHERE expression defined,
     * calling this function will override previously set WHERE conditions.
     * Additionally you can add parameters used in where expression.
     */
    where(
        where:
            | string
            | ((qb: this) => string)
            | Brackets
            | ObjectLiteral
            | ObjectLiteral[],
        parameters?: ObjectLiteral,
    ): this {
        this.expressionMap.wheres = [] // don't move this block below since computeWhereParameter can add where expressions
        const condition = this.getWhereCondition(where)
        if (condition)
            this.expressionMap.wheres = [
                { type: "simple", condition: condition },
            ]
        if (parameters) this.setParameters(parameters)
        return this
    }

    /**
     * Adds new AND WHERE condition in the query builder.
     * Additionally you can add parameters used in where expression.
     */
    andWhere(
        where:
            | string
            | ((qb: this) => string)
            | Brackets
            | ObjectLiteral
            | ObjectLiteral[],
        parameters?: ObjectLiteral,
    ): this {
        this.expressionMap.wheres.push({
            type: "and",
            condition: this.getWhereCondition(where),
        })
        if (parameters) this.setParameters(parameters)
        return this
    }

    /**
     * Adds new OR WHERE condition in the query builder.
     * Additionally you can add parameters used in where expression.
     */
    orWhere(
        where:
            | string
            | ((qb: this) => string)
            | Brackets
            | ObjectLiteral
            | ObjectLiteral[],
        parameters?: ObjectLiteral,
    ): this {
        this.expressionMap.wheres.push({
            type: "or",
            condition: this.getWhereCondition(where),
        })
        if (parameters) this.setParameters(parameters)
        return this
    }

    /**
     * Sets WHERE condition in the query builder with a condition for the given ids.
     * If you had previously WHERE expression defined,
     * calling this function will override previously set WHERE conditions.
     */
    whereInIds(ids: any | any[]): this {
        return this.where(this.getWhereInIdsCondition(ids))
    }

    /**
     * Adds new AND WHERE with conditions for the given ids.
     */
    andWhereInIds(ids: any | any[]): this {
        return this.andWhere(this.getWhereInIdsCondition(ids))
    }

    /**
     * Adds new OR WHERE with conditions for the given ids.
     */
    orWhereInIds(ids: any | any[]): this {
        return this.orWhere(this.getWhereInIdsCondition(ids))
    }
    /**
     * Optional returning/output clause.
     * This will return given column values.
     */
    output(columns: string[]): this

    /**
     * Optional returning/output clause.
     * Returning is a SQL string containing returning statement.
     */
    output(output: string): this

    /**
     * Optional returning/output clause.
     */
    output(output: string | string[]): this

    /**
     * Optional returning/output clause.
     */
    output(output: string | string[]): this {
        return this.returning(output)
    }

    /**
     * Optional returning/output clause.
     * This will return given column values.
     */
    returning(columns: string[]): this

    /**
     * Optional returning/output clause.
     * Returning is a SQL string containing returning statement.
     */
    returning(returning: string): this

    /**
     * Optional returning/output clause.
     */
    returning(returning: string | string[]): this

    /**
     * Optional returning/output clause.
     */
    returning(returning: string | string[]): this {
        // not all databases support returning/output cause
        if (!this.connection.driver.isReturningSqlSupported("update")) {
            throw new ReturningStatementNotSupportedError()
        }

        this.expressionMap.returning = returning
        return this
    }

    /**
     * Sets ORDER BY condition in the query builder.
     * If you had previously ORDER BY expression defined,
     * calling this function will override previously set ORDER BY conditions.
     *
     * Calling order by without order set will remove all previously set order bys.
     */
    orderBy(): this

    /**
     * Sets ORDER BY condition in the query builder.
     * If you had previously ORDER BY expression defined,
     * calling this function will override previously set ORDER BY conditions.
     */
    orderBy(
        sort: string,
        order?: "ASC" | "DESC",
        nulls?: "NULLS FIRST" | "NULLS LAST",
    ): this

    /**
     * Sets ORDER BY condition in the query builder.
     * If you had previously ORDER BY expression defined,
     * calling this function will override previously set ORDER BY conditions.
     */
    orderBy(order: OrderByCondition): this

    /**
     * Sets ORDER BY condition in the query builder.
     * If you had previously ORDER BY expression defined,
     * calling this function will override previously set ORDER BY conditions.
     */
    orderBy(
        sort?: string | OrderByCondition,
        order: "ASC" | "DESC" = "ASC",
        nulls?: "NULLS FIRST" | "NULLS LAST",
    ): this {
        if (sort) {
            if (typeof sort === "object") {
                this.expressionMap.orderBys = sort as OrderByCondition
            } else {
                if (nulls) {
                    this.expressionMap.orderBys = {
                        [sort as string]: { order, nulls },
                    }
                } else {
                    this.expressionMap.orderBys = { [sort as string]: order }
                }
            }
        } else {
            this.expressionMap.orderBys = {}
        }
        return this
    }

    /**
     * Adds ORDER BY condition in the query builder.
     */
    addOrderBy(
        sort: string,
        order: "ASC" | "DESC" = "ASC",
        nulls?: "NULLS FIRST" | "NULLS LAST",
    ): this {
        if (nulls) {
            this.expressionMap.orderBys[sort] = { order, nulls }
        } else {
            this.expressionMap.orderBys[sort] = order
        }
        return this
    }

    /**
     * Sets LIMIT - maximum number of rows to be selected.
     */
    limit(limit?: number): this {
        this.expressionMap.limit = limit
        return this
    }

    /**
     * Indicates if entity must be updated after update operation.
     * This may produce extra query or use RETURNING / OUTPUT statement (depend on database).
     * Enabled by default.
     */
    whereEntity(entity: Entity | Entity[]): this {
        if (!this.expressionMap.mainAlias!.hasMetadata)
            throw new TypeORMError(
                `.whereEntity method can only be used on queries which update real entity table.`,
            )

        this.expressionMap.wheres = []
        const entities: Entity[] = Array.isArray(entity) ? entity : [entity]
        entities.forEach((entity) => {
            const entityIdMap =
                this.expressionMap.mainAlias!.metadata.getEntityIdMap(entity)
            if (!entityIdMap)
                throw new TypeORMError(
                    `Provided entity does not have ids set, cannot perform operation.`,
                )

            this.orWhereInIds(entityIdMap)
        })

        this.expressionMap.whereEntities = entities
        return this
    }

    /**
     * Indicates if entity must be updated after update operation.
     * This may produce extra query or use RETURNING / OUTPUT statement (depend on database).
     * Enabled by default.
     */
    updateEntity(enabled: boolean): this {
        this.expressionMap.updateEntity = enabled
        return this
    }

    // -------------------------------------------------------------------------
    // Protected Methods
    // -------------------------------------------------------------------------

    /**
     * Creates UPDATE express used to perform insert query.
     */
    protected createUpdateExpression() {
        const valuesSet = this.getValueSet()
        const metadata = this.expressionMap.mainAlias!.hasMetadata
            ? this.expressionMap.mainAlias!.metadata
            : undefined

        // it doesn't make sense to update undefined properties, so just skip them
        const valuesSetNormalized: ObjectLiteral = {}
        for (let key in valuesSet) {
            if (valuesSet[key] !== undefined) {
                valuesSetNormalized[key] = valuesSet[key]
            }
        }

        // prepare columns and values to be updated
        const updateColumnAndValues: string[] = []
        const updatedColumns: ColumnMetadata[] = []
        if (metadata) {
            this.createPropertyPath(metadata, valuesSetNormalized).forEach(
                (propertyPath) => {
                    // todo: make this and other query builder to work with properly with tables without metadata
                    const columns =
                        metadata.findColumnsWithPropertyPath(propertyPath)

                    if (columns.length <= 0) {
                        throw new EntityPropertyNotFoundError(
                            propertyPath,
                            metadata,
                        )
                    }

                    columns.forEach((column) => {
                        if (
                            !column.isUpdate ||
                            updatedColumns.includes(column)
                        ) {
                            return
                        }

                        updatedColumns.push(column)

                        //
                        let value = column.getEntityValue(valuesSetNormalized)
                        if (
                            column.referencedColumn &&
                            typeof value === "object" &&
                            !(value instanceof Date) &&
                            value !== null &&
                            !Buffer.isBuffer(value)
                        ) {
                            value =
                                column.referencedColumn.getEntityValue(value)
                        } else if (!(typeof value === "function")) {
                            value =
                                this.connection.driver.preparePersistentValue(
                                    value,
                                    column,
                                )
                        }

                        // todo: duplication zone
                        if (typeof value === "function") {
                            // support for SQL expressions in update query
                            updateColumnAndValues.push(
                                this.escape(column.databaseName) +
                                    " = " +
                                    value(),
                            )
                        } else if (
                            (this.connection.driver.options.type === "sap" ||
                                this.connection.driver.options.type ===
                                    "spanner") &&
                            value === null
                        ) {
                            updateColumnAndValues.push(
                                this.escape(column.databaseName) + " = NULL",
                            )
                        } else {
                            if (
                                this.connection.driver.options.type === "mssql"
                            ) {
                                value = (
                                    this.connection.driver as SqlServerDriver
                                ).parametrizeValue(column, value)
                            }

                            const paramName = this.createParameter(value)

                            let expression = null
                            if (
                                (DriverUtils.isMySQLFamily(
                                    this.connection.driver,
                                ) ||
                                    this.connection.driver.options.type ===
                                        "aurora-mysql") &&
                                this.connection.driver.spatialTypes.indexOf(
                                    column.type,
                                ) !== -1
                            ) {
                                const useLegacy = (
                                    this.connection.driver as
                                        | MysqlDriver
                                        | AuroraMysqlDriver
                                ).options.legacySpatialSupport
                                const geomFromText = useLegacy
                                    ? "GeomFromText"
                                    : "ST_GeomFromText"
                                if (column.srid != null) {
                                    expression = `${geomFromText}(${paramName}, ${column.srid})`
                                } else {
                                    expression = `${geomFromText}(${paramName})`
                                }
                            } else if (
                                DriverUtils.isPostgresFamily(
                                    this.connection.driver,
                                ) &&
                                this.connection.driver.spatialTypes.indexOf(
                                    column.type,
                                ) !== -1
                            ) {
                                if (column.srid != null) {
                                    expression = `ST_SetSRID(ST_GeomFromGeoJSON(${paramName}), ${column.srid})::${column.type}`
                                } else {
                                    expression = `ST_GeomFromGeoJSON(${paramName})::${column.type}`
                                }
                            } else if (
                                this.connection.driver.options.type ===
                                    "mssql" &&
                                this.connection.driver.spatialTypes.indexOf(
                                    column.type,
                                ) !== -1
                            ) {
                                expression =
                                    column.type +
                                    "::STGeomFromText(" +
                                    paramName +
                                    ", " +
                                    (column.srid || "0") +
                                    ")"
                            } else {
                                expression = paramName
                            }
                            updateColumnAndValues.push(
                                this.escape(column.databaseName) +
                                    " = " +
                                    expression,
                            )
                        }
                    })
                },
            )

            // Don't allow calling update only with columns that are `update: false`
            if (
                updateColumnAndValues.length > 0 ||
                Object.keys(valuesSetNormalized).length === 0
            ) {
                if (
                    metadata.versionColumn &&
                    updatedColumns.indexOf(metadata.versionColumn) === -1
                )
                    updateColumnAndValues.push(
                        this.escape(metadata.versionColumn.databaseName) +
                            " = " +
                            this.escape(metadata.versionColumn.databaseName) +
                            " + 1",
                    )
                if (
                    metadata.updateDateColumn &&
                    updatedColumns.indexOf(metadata.updateDateColumn) === -1
                )
                    updateColumnAndValues.push(
                        this.escape(metadata.updateDateColumn.databaseName) +
                            " = CURRENT_TIMESTAMP",
                    ) // todo: fix issue with CURRENT_TIMESTAMP(6) being used, can "DEFAULT" be used?!
            }
        } else {
            Object.keys(valuesSetNormalized).map((key) => {
                let value = valuesSetNormalized[key]

                // todo: duplication zone
                if (typeof value === "function") {
                    // support for SQL expressions in update query
                    updateColumnAndValues.push(
                        this.escape(key) + " = " + value(),
                    )
                } else if (
                    (this.connection.driver.options.type === "sap" ||
                        this.connection.driver.options.type === "spanner") &&
                    value === null
                ) {
                    updateColumnAndValues.push(this.escape(key) + " = NULL")
                } else {
                    // we need to store array values in a special class to make sure parameter replacement will work correctly
                    // if (value instanceof Array)
                    //     value = new ArrayParameter(value);

                    const paramName = this.createParameter(value)
                    updateColumnAndValues.push(
                        this.escape(key) + " = " + paramName,
                    )
                }
            })
        }

        if (updateColumnAndValues.length <= 0) {
            throw new UpdateValuesMissingError()
        }

        // get a table name and all column database names
        const whereExpression = this.createWhereExpression()
        const returningExpression = this.createReturningExpression("update")

        if (returningExpression === "") {
            return `UPDATE ${this.getTableName(
                this.getMainTableName(),
            )} SET ${updateColumnAndValues.join(", ")}${whereExpression}` // todo: how do we replace aliases in where to nothing?
        }
        if (this.connection.driver.options.type === "mssql") {
            return `UPDATE ${this.getTableName(
                this.getMainTableName(),
            )} SET ${updateColumnAndValues.join(
                ", ",
            )} OUTPUT ${returningExpression}${whereExpression}`
        }
        return `UPDATE ${this.getTableName(
            this.getMainTableName(),
        )} SET ${updateColumnAndValues.join(
            ", ",
        )}${whereExpression} RETURNING ${returningExpression}`
    }

    /**
     * Creates "ORDER BY" part of SQL query.
     */
    protected createOrderByExpression() {
        const orderBys = this.expressionMap.orderBys
        if (Object.keys(orderBys).length > 0)
            return (
                " ORDER BY " +
                Object.keys(orderBys)
                    .map((columnName) => {
                        if (typeof orderBys[columnName] === "string") {
                            return (
                                this.replacePropertyNames(columnName) +
                                " " +
                                orderBys[columnName]
                            )
                        } else {
                            return (
                                this.replacePropertyNames(columnName) +
                                " " +
                                (orderBys[columnName] as any).order +
                                " " +
                                (orderBys[columnName] as any).nulls
                            )
                        }
                    })
                    .join(", ")
            )

        return ""
    }

    /**
     * Creates "LIMIT" parts of SQL query.
     */
    protected createLimitExpression(): string {
        let limit: number | undefined = this.expressionMap.limit

        if (limit) {
            if (
                DriverUtils.isMySQLFamily(this.connection.driver) ||
                this.connection.driver.options.type === "aurora-mysql"
            ) {
                return " LIMIT " + limit
            } else {
                throw new LimitOnUpdateNotSupportedError()
            }
        }

        return ""
    }

    /**
     * Gets array of values need to be inserted into the target table.
     */
    protected getValueSet(): ObjectLiteral {
        if (typeof this.expressionMap.valuesSet === "object")
            return this.expressionMap.valuesSet

        throw new UpdateValuesMissingError()
    }
}
