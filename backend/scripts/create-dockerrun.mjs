import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const image = process.argv[2];
const outputPath = process.argv[3] || 'Dockerrun.aws.json';

if (!image) {
  console.error('Usage: node scripts/create-dockerrun.mjs <image-uri> [output-path]');
  process.exit(1);
}

const dockerrun = {
  AWSEBDockerrunVersion: '1',
  Image: {
    Name: image,
    Update: 'true',
  },
  Ports: [
    {
      ContainerPort: '3000',
    },
  ],
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(dockerrun, null, 2)}\n`);
console.log(`Wrote ${outputPath}`);
