import { readFileSync, writeFileSync } from 'node:fs';

const inputPath = process.argv[2] || '.env';
const outputPath = process.argv[3] || '/tmp/backend-eb-options.json';

const skipKeys = new Set(
  (process.env.EB_ENV_SKIP_KEYS || '')
    .split(',')
    .map((key) => key.trim())
    .filter(Boolean),
);

const optionSettings = [];

function add(namespace, optionName, value) {
  optionSettings.push({
    Namespace: namespace,
    OptionName: optionName,
    Value: String(value),
  });
}

function parseEnv(content) {
  const values = new Map();

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key && !skipKeys.has(key)) {
      values.set(key, value);
    }
  }

  return values;
}

const envValues = parseEnv(readFileSync(inputPath, 'utf8'));

add('aws:elasticbeanstalk:environment', 'ServiceRole', process.env.EB_SERVICE_ROLE || 'aws-elasticbeanstalk-service-role');
add('aws:elasticbeanstalk:environment', 'EnvironmentType', process.env.EB_ENVIRONMENT_TYPE || 'SingleInstance');
add('aws:autoscaling:launchconfiguration', 'IamInstanceProfile', process.env.EB_INSTANCE_PROFILE || 'aws-elasticbeanstalk-ec2-role');
add('aws:autoscaling:asg', 'MinSize', process.env.EB_MIN_SIZE || '1');
add('aws:autoscaling:asg', 'MaxSize', process.env.EB_MAX_SIZE || '1');
add('aws:elasticbeanstalk:environment:process:default', 'HealthCheckPath', process.env.EB_HEALTH_CHECK_PATH || '/api/health');
add('aws:elasticbeanstalk:application:environment', 'NODE_ENV', 'production');

envValues.set('PORT', process.env.EB_CONTAINER_PORT || '3000');

for (const [key, value] of envValues) {
  add('aws:elasticbeanstalk:application:environment', key, value);
}

writeFileSync(outputPath, `${JSON.stringify(optionSettings, null, 2)}\n`);
console.log(`Wrote ${optionSettings.length} Elastic Beanstalk option settings to ${outputPath}`);
