import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { CodeExecutionService } from './code-execution.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { User } from '../auth/user.decorator';

@Controller('code')
export class CodeExecutionController {
  constructor(private readonly codeExecutionService: CodeExecutionService) {}

  @Post('run')
  @UseGuards(JwtAuthGuard)
  async run(@Body() body: { language: string; code: string; input?: string }) {
    return this.codeExecutionService.runCode(
      body.language,
      body.code,
      body.input || '',
    );
  }

  @Post('submit')
  @UseGuards(JwtAuthGuard)
  async submit(
    @Body()
    body: {
      unitId: string;
      language: string;
      code: string;
      examId?: string;
      testCases?: any[];
    },
    @User() user: any,
  ) {
    return this.codeExecutionService.submitCode(
      body.unitId,
      body.language,
      body.code,
      body.examId,
      body.testCases,
      user,
    );
  }

  @Post('public-run')
  async publicRun(
    @Body() body: { language: string; code: string; input?: string },
    @Req() req: any,
  ) {
    return this.codeExecutionService.publicRunCode(
      body.language,
      body.code,
      body.input || '',
      req,
    );
  }

  @Post('public-submit')
  async publicSubmit(
    @Body()
    body: {
      questionSlug: string;
      language: string;
      code: string;
    },
    @Req() req: any,
  ) {
    return this.codeExecutionService.publicSubmitCode(
      body.questionSlug,
      body.language,
      body.code,
      req,
    );
  }
}

@Controller('playground/questions')
export class PublicCodingQuestionController {
  constructor(private readonly codeExecutionService: CodeExecutionService) {}

  @Post()
  @UseGuards(OptionalJwtAuthGuard)
  async create(@Body() body: any, @Req() req: any, @User() user?: any) {
    return this.codeExecutionService.createPublicQuestion(body, user, req);
  }

  @Get(':slug')
  async get(@Param('slug') slug: string) {
    return this.codeExecutionService.getPublicQuestion(slug);
  }
}
