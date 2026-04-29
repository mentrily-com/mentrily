<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

Supabase migration verification suites are also available:

- `src/services/supabase/supabase-rpc-verification.spec.ts` (9 RPC edge-case checks)
- `src/services/supabase/supabase-rls-matrix.spec.ts` (11-scenario role access matrix)

These integration suites are environment-gated and are skipped unless required variables are set:

```bash
DATABASE_URL=postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true
SUPABASE_DIRECT_URL=postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres?sslmode=require
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_ANON_KEY=...
SUPABASE_TEST_JWT_SUPER_ADMIN=...
SUPABASE_TEST_JWT_ADMIN=...
SUPABASE_TEST_JWT_TEACHER=...
SUPABASE_TEST_JWT_STUDENT=...
```

Use `DATABASE_URL` for application runtime traffic. On networks without IPv6, Supabase direct hosts such as `db.<project-ref>.supabase.co:5432` can fail with `Network is unreachable`; use the Supabase pooler connection string from Project Settings > Database instead. Keep `SUPABASE_DIRECT_URL` for migrations and one-off direct database scripts.

Generate all four RLS test JWTs automatically (writes to `.env`):

```bash
npm run supabase:rls:tokens
```

To deploy project schema/RPC/RLS to Supabase directly:

```bash
SUPABASE_DIRECT_URL=postgresql://postgres:<password>@<project-ref>.supabase.co:5432/postgres
npm run supabase:deploy
```

Notes:

- The deploy script applies SQL files from `supabase/migrations` in order and tracks applied files in `public._schema_migrations`.
- `SUPABASE_DIRECT_URL` can be replaced with `TARGET_DIRECT_URL` if you already use that variable name.
- For RLS matrix tests, set all role JWT env vars:
  - `SUPABASE_TEST_JWT_SUPER_ADMIN`
  - `SUPABASE_TEST_JWT_ADMIN`
  - `SUPABASE_TEST_JWT_TEACHER`
  - `SUPABASE_TEST_JWT_STUDENT`

## Clerk Invitation Setup

The admin invite endpoint `POST /admin/users/invite` uses Clerk invitations and the `PendingInvite` table.

1. In Clerk Dashboard, enable **Email invitations**.
2. Set invitation redirect URL to your app dashboard (for example: `https://{org-domain}/dashboard`).
3. Customize Clerk invitation email branding (name/logo/colors).
4. Configure backend environment variables:

```bash
CLERK_SECRET_KEY=...
CLERK_WEBHOOK_SECRET=...
FRONTEND_URL=https://your-app-domain
DEFAULT_ORG_ID=<uuid-from-prisma-seed-log>
```

5. Apply migrations before starting the app:

```bash
npm run migrate:deploy
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
