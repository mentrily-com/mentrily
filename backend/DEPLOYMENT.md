# Backend AWS Deployment

The backend deploys to Elastic Beanstalk as a prebuilt Docker image:

1. GitHub Actions builds `backend/Dockerfile`.
2. The image is pushed to Amazon ECR.
3. Actions creates a `Dockerrun.aws.json` bundle that points Beanstalk at that image.
4. Beanstalk updates or creates `blockscode-backend-prod`.

This avoids running `npm install` or Docker builds on the Beanstalk EC2 instance.

## GitHub Secrets

Set these repository secrets:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `BACKEND_ENV_FILE_B64`

Create `BACKEND_ENV_FILE_B64` from the production backend env file:

```sh
base64 -w 0 backend/.env
```

The workflow skips test JWTs and Sentry project metadata by default:

- `SUPABASE_TEST_JWT_SUPER_ADMIN`
- `SUPABASE_TEST_JWT_ADMIN`
- `SUPABASE_TEST_JWT_TEACHER`
- `SUPABASE_TEST_JWT_STUDENT`
- `SENTRY_ORG`
- `SENTRY_PROJECT`

`PORT` is forced to `3000` for Elastic Beanstalk because the Dockerrun bundle maps container port 3000.

## Runtime Health

- `/api/health` is a lightweight liveness check for the load balancer.
- `/api/ready` checks database and Redis connectivity.

## Required AWS Resources

The workflow creates the ECR repository and Beanstalk application if missing. The standard Beanstalk roles must exist:

- `aws-elasticbeanstalk-service-role`
- `aws-elasticbeanstalk-ec2-role`

The EC2 role must be able to pull from ECR.

## Redis

For a single-instance Elastic Beanstalk environment, the Docker image starts an embedded Redis process when `REDIS_URL` is empty and `REDIS_HOST` is `localhost` or `127.0.0.1`.

For multi-instance production, set `REDIS_URL` to a managed Redis endpoint and remove the local Redis values.
