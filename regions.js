// Known Genesys Cloud regions -> login/api hostnames, plus each region's country code
// (shown in the UI, e.g. "Frankfurt (DE)").
// Reference: https://developer.genesys.cloud/platform/api/ (Base URIs per region)
const REGIONS = {
  'us-east-1': { label: 'US East (Virginia)', code: 'US', loginHost: 'login.mypurecloud.com', apiHost: 'api.mypurecloud.com' },
  'us-east-2': { label: 'US East 2 (Ohio)', code: 'US', loginHost: 'login.use2.pure.cloud', apiHost: 'api.use2.pure.cloud' },
  'us-west-2': { label: 'US West (Oregon)', code: 'US', loginHost: 'login.usw2.pure.cloud', apiHost: 'api.usw2.pure.cloud' },
  'ca-central-1': { label: 'Canada (Central)', code: 'CA', loginHost: 'login.cac1.pure.cloud', apiHost: 'api.cac1.pure.cloud' },
  'eu-west-1': { label: 'Ireland', code: 'IE', loginHost: 'login.mypurecloud.ie', apiHost: 'api.mypurecloud.ie' },
  'eu-west-2': { label: 'London', code: 'GB', loginHost: 'login.euw2.pure.cloud', apiHost: 'api.euw2.pure.cloud' },
  'eu-central-1': { label: 'Frankfurt', code: 'DE', loginHost: 'login.mypurecloud.de', apiHost: 'api.mypurecloud.de' },
  'ap-southeast-2': { label: 'Sydney', code: 'AU', loginHost: 'login.mypurecloud.com.au', apiHost: 'api.mypurecloud.com.au' },
  'ap-northeast-1': { label: 'Tokyo', code: 'JP', loginHost: 'login.mypurecloud.jp', apiHost: 'api.mypurecloud.jp' },
  'ap-northeast-2': { label: 'Seoul', code: 'KR', loginHost: 'login.apne2.mypurecloud.com', apiHost: 'api.apne2.mypurecloud.com' },
  'ap-northeast-3': { label: 'Osaka', code: 'JP', loginHost: 'login.apne3.mypurecloud.com', apiHost: 'api.apne3.mypurecloud.com' },
  'ap-south-1': { label: 'Mumbai', code: 'IN', loginHost: 'login.aps1.pure.cloud', apiHost: 'api.aps1.pure.cloud' },
  'sa-east-1': { label: 'Sao Paulo', code: 'BR', loginHost: 'login.sae1.pure.cloud', apiHost: 'api.sae1.pure.cloud' },
};

module.exports = { REGIONS };
