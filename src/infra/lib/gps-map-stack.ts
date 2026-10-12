import * as path from 'node:path';
import {
  Stack, StackProps, Duration, RemovalPolicy, CfnOutput,
  aws_apigateway as apigateway, aws_cloudfront as cloudfront,
  aws_cloudfront_origins as origins, aws_dynamodb as dynamodb,
  aws_iam as iam, aws_lambda as lambda, aws_logs as logs,
  aws_s3 as s3, aws_s3_deployment as deployment,
  aws_secretsmanager as secretsmanager, aws_wafv2 as waf,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class GpsMapStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);
    const projectRoot = path.resolve(__dirname, '../../..');
    const table = new dynamodb.Table(this, 'Locations', {
      partitionKey: { name: 'deviceKey', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: RemovalPolicy.RETAIN,
    });
    const newSecret = (name: string) => new secretsmanager.Secret(this, name, {
      generateSecretString: { passwordLength: 64, excludePunctuation: true },
      removalPolicy: RemovalPolicy.RETAIN,
    });
    const beamSecret = newSecret('BeamToken');
    const hashSecret = newSecret('ImsiHashKey');
    const originSecret = newSecret('CloudFrontOriginToken');
    const ingest = new lambda.Function(this, 'Ingest', {
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      handler: 'ingest.handler',
      code: lambda.Code.fromAsset(path.join(projectRoot, 'dist/lambda')),
      timeout: Duration.seconds(15),
      memorySize: 256,
      reservedConcurrentExecutions: 5,
      logGroup: new logs.LogGroup(this, 'IngestLogs', {
        retention: logs.RetentionDays.ONE_MONTH,
        removalPolicy: RemovalPolicy.RETAIN,
      }),
      environment: {
        TABLE_NAME: table.tableName,
        INGEST_SECRET_ARN: beamSecret.secretArn,
        HASH_SECRET_ARN: hashSecret.secretArn,
        NODE_OPTIONS: '--enable-source-maps',
      },
    });
    ingest.addToRolePolicy(new iam.PolicyStatement({ actions: ['dynamodb:PutItem'], resources: [table.tableArn] }));
    beamSecret.grantRead(ingest);
    hashSecret.grantRead(ingest);

    const apiAccessLogs = new logs.LogGroup(this, 'ApiAccessLogs', {
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.RETAIN,
    });
    const api = new apigateway.RestApi(this, 'Api', {
      endpointTypes: [apigateway.EndpointType.REGIONAL],
      deployOptions: {
        stageName: 'prod', throttlingRateLimit: 10, throttlingBurstLimit: 20,
        loggingLevel: apigateway.MethodLoggingLevel.INFO, dataTraceEnabled: false,
        accessLogDestination: new apigateway.LogGroupLogDestination(apiAccessLogs),
        accessLogFormat: apigateway.AccessLogFormat.custom(JSON.stringify({
          requestId: apigateway.AccessLogField.contextRequestId(),
          extendedRequestId: apigateway.AccessLogField.contextExtendedRequestId(),
          resourcePath: apigateway.AccessLogField.contextResourcePath(),
          status: apigateway.AccessLogField.contextStatus(),
          integrationStatus: apigateway.AccessLogField.contextIntegrationStatus(),
          integrationError: apigateway.AccessLogField.contextIntegrationErrorMessage(),
        })),
      },
      cloudWatchRole: true,
    });
    const bucket = new s3.Bucket(this, 'Website', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: true,
      removalPolicy: RemovalPolicy.RETAIN,
    });
    const securityHeaders = new cloudfront.ResponseHeadersPolicy(this, 'SecurityHeaders', {
      securityHeadersBehavior: {
        contentSecurityPolicy: {
          contentSecurityPolicy: "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; font-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
          override: true,
        },
        contentTypeOptions: { override: true },
        frameOptions: { frameOption: cloudfront.HeadersFrameOption.DENY, override: true },
        referrerPolicy: { referrerPolicy: cloudfront.HeadersReferrerPolicy.NO_REFERRER, override: true },
        strictTransportSecurity: { accessControlMaxAge: Duration.days(365), override: true },
      },
    });
    const apiOrigin = new origins.HttpOrigin(`${api.restApiId}.execute-api.${this.region}.${this.urlSuffix}`, {
      originPath: '/prod',
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
      customHeaders: { 'X-Origin-Verify': originSecret.secretValue.unsafeUnwrap() },
    });
    const apiBehavior: cloudfront.BehaviorOptions = {
      origin: apiOrigin,
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
      allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
      cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
      originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
      responseHeadersPolicy: securityHeaders,
    };
    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultRootObject: 'index.html',
      priceClass: cloudfront.PriceClass.PRICE_CLASS_200,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        responseHeadersPolicy: securityHeaders,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      additionalBehaviors: { '/beam': apiBehavior, '/api/*': apiBehavior },
    });
    const siteOrigin = `https://${distribution.distributionDomainName}`;

    const firewall = new waf.CfnWebACL(this, 'OriginOnlyFirewall', {
      scope: 'REGIONAL',
      defaultAction: { block: {} },
      visibilityConfig: { cloudWatchMetricsEnabled: true, metricName: 'GpsOriginOnly', sampledRequestsEnabled: false },
      rules: [{
        name: 'OnlyCloudFront', priority: 0, action: { allow: {} },
        statement: { byteMatchStatement: {
          fieldToMatch: { singleHeader: { Name: 'x-origin-verify' } },
          positionalConstraint: 'EXACTLY',
          searchString: originSecret.secretValue.unsafeUnwrap(),
          textTransformations: [{ priority: 0, type: 'NONE' }],
        } },
        visibilityConfig: { cloudWatchMetricsEnabled: true, metricName: 'GpsCloudFrontAllowed', sampledRequestsEnabled: false },
      }],
    });
    const firewallAssociation = new waf.CfnWebACLAssociation(this, 'ApiFirewallAssociation', {
      resourceArn: `arn:${this.partition}:apigateway:${this.region}::/restapis/${api.restApiId}/stages/${api.deploymentStage.stageName}`,
      webAclArn: firewall.attrArn,
    });
    firewallAssociation.node.addDependency(api.deploymentStage);

    api.root.addResource('beam').addMethod('POST', new apigateway.LambdaIntegration(ingest));
    const scanRole = new iam.Role(this, 'ApiScanRole', { assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com') });
    scanRole.addToPolicy(new iam.PolicyStatement({ actions: ['dynamodb:Scan'], resources: [table.tableArn] }));
    const readResource = api.root.addResource('api').addResource('prefectures');
    const parameters = `#set($segmentText = $input.params().querystring.get('segment'))
#set($segmentsText = $input.params().querystring.get('segments'))
#set($segment = $util.parseJson($segmentText))
#set($segments = $util.parseJson($segmentsText))`;
    const corsHeaders = {
      'method.response.header.Access-Control-Allow-Origin': `'${siteOrigin}'`,
      'method.response.header.Cache-Control': "'no-store'",
      'method.response.header.Vary': "'Origin'",
    };
    const responseHeaders = Object.fromEntries(Object.keys(corsHeaders).map((key) => [key, true]));
    readResource.addMethod('GET', new apigateway.AwsIntegration({
      service: 'dynamodb', action: 'Scan', integrationHttpMethod: 'POST',
      options: {
        credentialsRole: scanRole,
        passthroughBehavior: apigateway.PassthroughBehavior.NEVER,
        requestTemplates: {
          'application/json': `${parameters}
{"TableName":"${table.tableName}","ProjectionExpression":"#p","ExpressionAttributeNames":{"#p":"prefecture"},"ConsistentRead":true,
"Segment":$segment,"TotalSegments":$segments
}`,
        },
        integrationResponses: [
          {
            statusCode: '200', responseParameters: corsHeaders,
            responseTemplates: { 'application/json': `${parameters}
#set($result = $input.path('$'))
#if($result.LastEvaluatedKey && !$result.LastEvaluatedKey.isEmpty())
  {"items":[],"splitRequired":true}
#else
  {"items":[#foreach($item in $result.Items){"prefecture":$item.prefecture.N}#if($foreach.hasNext),#end#end],"splitRequired":false}
#end` },
          },
          { selectionPattern: '4\\d{2}', statusCode: '502', responseParameters: corsHeaders, responseTemplates: { 'application/json': `#set($integrationError = $context.integration.error)
{"message":"Database request failed","integrationError":"$util.escapeJavaScript($integrationError).replaceAll("\\'","'")","integrationStatus":"$context.integration.status","requestId":"$context.requestId"}` } },
          { selectionPattern: '5\\d{2}', statusCode: '503', responseParameters: corsHeaders, responseTemplates: { 'application/json': '{"message":"Database temporarily unavailable"}' } },
        ],
      },
    }), {
      requestParameters: { 'method.request.querystring.segment': true, 'method.request.querystring.segments': true },
      requestValidatorOptions: { validateRequestParameters: true },
      methodResponses: ['200', '400', '502', '503'].map((statusCode) => ({ statusCode, responseParameters: responseHeaders })),
    });
    readResource.addMethod('OPTIONS', new apigateway.MockIntegration({
      requestTemplates: { 'application/json': '{"statusCode":200}' },
      integrationResponses: [{ statusCode: '200', responseParameters: {
        ...corsHeaders,
        'method.response.header.Access-Control-Allow-Methods': "'GET,OPTIONS'",
        'method.response.header.Access-Control-Allow-Headers': "'Content-Type'",
      } }],
    }), { methodResponses: [{ statusCode: '200', responseParameters: {
      ...responseHeaders,
      'method.response.header.Access-Control-Allow-Methods': true,
      'method.response.header.Access-Control-Allow-Headers': true,
    } }] });
    for (const [name, type] of [['ClientErrors', apigateway.ResponseType.DEFAULT_4XX], ['ServerErrors', apigateway.ResponseType.DEFAULT_5XX]] as const) {
      api.addGatewayResponse(name, {
        type,
        responseHeaders: { 'Access-Control-Allow-Origin': `'${siteOrigin}'`, 'Cache-Control': "'no-store'", Vary: "'Origin'" },
        templates: { 'application/json': '{"message":$context.error.messageString}' },
      });
    }
    new deployment.BucketDeployment(this, 'DeployWebsite', {
      sources: [deployment.Source.asset(path.join(projectRoot, 'dist/web'))],
      destinationBucket: bucket,
      distribution,
      distributionPaths: ['/*'],
      cacheControl: [deployment.CacheControl.maxAge(Duration.minutes(5))],
      memoryLimit: 256,
    });
    new CfnOutput(this, 'WebsiteUrl', { value: `${siteOrigin}/` });
    new CfnOutput(this, 'BeamEndpoint', { value: `${siteOrigin}/beam` });
    new CfnOutput(this, 'ReadEndpoint', { value: `${siteOrigin}/api/prefectures?segment=0&segments=1` });
    new CfnOutput(this, 'BeamTokenSecretArn', { value: beamSecret.secretArn });
    new CfnOutput(this, 'ImsiHashSecretArn', { value: hashSecret.secretArn });
    new CfnOutput(this, 'TableName', { value: table.tableName });
  }
}