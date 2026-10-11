import { App } from 'aws-cdk-lib';
import { GpsMapStack } from '../lib/gps-map-stack';

const app = new App();
if (process.env.CDK_DEFAULT_REGION && process.env.CDK_DEFAULT_REGION !== 'ap-northeast-1') {
  throw new Error('Deploy with AWS_REGION=ap-northeast-1 and AWS_DEFAULT_REGION=ap-northeast-1');
}
new GpsMapStack(app, 'GpsMultiunitMap', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'ap-northeast-1' },
});