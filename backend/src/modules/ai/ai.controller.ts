import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpException,
  HttpStatus,
  Get,
  Query,
  Res,
} from '@nestjs/common';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PlanGuard } from '../auth/guards/plan.guard';
import { Roles } from '../auth/roles.decorator';
import { RequirePlan } from '../auth/plan.decorator';
import { Role } from '@prisma/client';
import { User } from '../auth/user.decorator';
import type { FastifyReply } from 'fastify';
import { GenerateCourseOutlineDto } from './dto/generate-course-outline.dto';
import { GenerateCourseFullDto } from './dto/generate-course-full.dto';
import { GenerateSectionDto } from './dto/generate-section.dto';
import { GenerateExamOutlineDto } from './dto/generate-exam-outline.dto';
import { GenerateExamFullDto } from './dto/generate-exam-full.dto';

@Controller('ai')
@UseGuards(JwtAuthGuard, RolesGuard, PlanGuard)
@Roles(Role.TEACHER, Role.ADMIN, Role.SUPER_ADMIN)
@RequirePlan('aiExams')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  private buildAiContext(
    user: { id?: string; orgId?: string | null } | null | undefined,
  ) {
    return {
      userId: user?.id || null,
      orgId: user?.orgId || null,
    };
  }

  @Post('generate-course-outline')
  async generateCourseOutline(
    @Body() body: GenerateCourseOutlineDto,
    @User() user: { id?: string; orgId?: string | null },
  ) {
    const {
      title,
      description,
      difficulty,
      numSections,
      questionsPerSection,
      allowedTypes,
    } = body;

    if (!title || !description) {
      throw new HttpException(
        'Title and description are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    const systemPrompt = `You are an expert curriculum designer and educator. Your task is to generate a structured outline for a course.
The course is titled "${title}".
Description: "${description}".
Difficulty Level: ${difficulty || 'Beginner'}.
Target structure: around ${numSections || '3-5'} sections (modules), each containing roughly ${questionsPerSection || '5-10'} questions (learning units).
Allowed question types: ${allowedTypes ? allowedTypes.join(', ') : 'Reading, MCQ, Coding'}.

Generate ONLY the structural outline: section titles, brief descriptions, and the list of question topics (with their types and teaching intent). Do not generate the full content of the questions yet.`;

    const userPrompt = `Please generate the course outline following the exact JSON schema provided.`;

    return this.aiService.generateObject(
      systemPrompt,
      userPrompt,
      this.aiService.getCourseOutlineSchema(),
      {
        ...this.buildAiContext(user),
        operation: 'generate-course-outline',
      },
    );
  }

  @Post('generate-course-full')
  async generateCourseFull(
    @Body() body: GenerateCourseFullDto,
    @User() user: { id?: string; orgId?: string | null },
  ) {
    const { title, description, outline } = body;

    if (!outline || !outline.sections) {
      throw new HttpException(
        'A valid course outline is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    const systemPrompt = `You are an expert software engineering instructor and content creator. You must generate the full, detailed content for a complete course based on the provided structural outline.
Course Title: "${title}"
Course Description/Topic: "${description}"

CRITICAL INSTRUCTIONS FOR HIGH-QUALITY OUTPUT:
1. CHEAT SHEET: You must generate a highly detailed, comprehensive \`courseSummary\`. This should be a "cheat sheet" or syllabus summarizing all key concepts taught in the course. It should be written in Markdown or HTML.
2. PROBLEM STATEMENTS: Every single \`problemStatement\` MUST BE FORMATTED AS BEAUTIFUL HTML. The UI already displays the question title, so DO NOT start the problem statement with a heading (like <h3>Title</h3>). Start directly with the text of the actual question or scenario. Use \`<p>\`, \`<ul>\`, \`<li>\`, \`<strong>\`, \`<em>\`, \`<u>\`, \`<s>\`, \`<code>\`, \`<pre>\`, and \`<blockquote>\` tags. Do not use plain text.
3. CODING QUESTIONS: For 'Coding' types, you MUST provide multi-language templates (e.g., 'javascript' and 'python'). Provide strictly bounded, highly robust \`testCases\` including exactly 3 to 6 test cases per question. CRITICAL: The \`input\` and \`output\` strings MUST be exact, raw programmatic values for stdin/stdout execution (e.g., "5\\n10" or "true"). They MUST NOT be descriptive sentences or random text. Configure the \`isPublic\` boolean and \`points\` allocation for each exactly.
4. READING QUESTIONS: For 'Reading' types, generate content that reads like a comprehensive, highly precise, and extremely long PDF textbook chapter that profoundly explains all the theory in exquisite detail. Use \`contentBlocks\`. You MUST heavily mix deeply detailed \`type: "text"\` blocks (using rich HTML) with actionable \`type: "code-runner"\` blocks (with a \`runnerConfig\` containing \`language\` and representative \`initialCode\`) to provide interactive, runnable examples for the vast theory explained.
5. EXAM/MCQ/MULTI-SELECT QUESTIONS: Do NOT put the answer options inside the \`problemStatement\` text; only put the question text there. For 'MultiSelect', provide tricky educational options where at least one option MUST be \`isCorrect: false\`. Do not make every option true.
6. WEB PROJECT: For 'Web' types, provide sensible starter HTML/CSS/JS.
YOUR OUTPUT MUST EXACTLY MATCH THE PROVIDED JSON SCHEMA. IF IT DOES NOT, THE SYSTEM WILL CRASH.`;

    const userPrompt = `Here is the approved course outline:\n\n${JSON.stringify(outline, null, 2)}\n\nPlease generate the full course content and the summary cheat sheet based on this outline. Ensure \`problemStatement\` is always rich HTML.`;

    return this.aiService.generateObject(
      systemPrompt,
      userPrompt,
      this.aiService.getFullCourseSchema(),
      {
        ...this.buildAiContext(user),
        operation: 'generate-course-full',
      },
    );
  }

  @Post('generate-section')
  async generateSection(
    @Body() body: GenerateSectionDto,
    @User() user: { id?: string; orgId?: string | null },
  ) {
    const { title, description, section } = body;

    if (!title || !description || !section || !section.id || !section.title) {
      throw new HttpException(
        'title, description and a valid section are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.aiService.generateSection(title, description, section, {
      ...this.buildAiContext(user),
      operation: 'generate-course-section',
    });
  }

  @Get('generate-course-full/stream')
  async generateCourseFullStream(
    @Query('title') title: string,
    @Query('description') description: string,
    @Query('outline') outlineRaw: string,
    @User() user: { id?: string; orgId?: string | null },
    @Res() reply: FastifyReply,
  ) {
    if (!title || !description || !outlineRaw) {
      throw new HttpException(
        'title, description and outline query params are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    let outline: {
      sections: Array<{
        id: string;
        title: string;
        description?: string;
        questions?: unknown[];
      }>;
    };
    try {
      outline = JSON.parse(outlineRaw) as {
        sections: Array<{
          id: string;
          title: string;
          description?: string;
          questions?: unknown[];
        }>;
      };
    } catch {
      throw new HttpException(
        'outline must be a valid JSON string',
        HttpStatus.BAD_REQUEST,
      );
    }

    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
    reply.raw.setHeader('Connection', 'keep-alive');

    const sendEvent = (event: string, data: unknown) => {
      reply.raw.write(`event: ${event}\n`);
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
      sendEvent('progress', {
        stage: 'starting',
        message: 'Starting full course generation...',
      });

      const result = await this.aiService.generateCourseFullBySections(
        title,
        description,
        outline,
        (progress) => {
          sendEvent('progress', {
            stage: 'section',
            current: progress.index,
            total: progress.total,
            message: progress.message,
          });
        },
        {
          ...this.buildAiContext(user),
          operation: 'generate-course-full-stream',
        },
      );

      sendEvent('done', { result });
      reply.raw.end();
      return;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to generate course stream';
      sendEvent('error', { message });
      reply.raw.end();
      return;
    }
  }

  @Post('generate-exam-outline')
  async generateExamOutline(
    @Body() body: GenerateExamOutlineDto,
    @User() user: { id?: string; orgId?: string | null },
  ) {
    const { title, description, numSections, sectionConfigs, courseSummary } =
      body;

    if (!title || !description) {
      throw new HttpException(
        'Title and description are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    let contextInjection = '';
    if (courseSummary) {
      contextInjection = `\nCRITICAL CONTEXT: This exam is based on an existing course. Here is the course summary:\n"""\n${courseSummary}\n"""\nYou MUST strictly generate an exam outline that aligns with concepts taught in this summary.`;
    }

    let sectionDemands = '';
    if (sectionConfigs && Array.isArray(sectionConfigs)) {
      sectionDemands = sectionConfigs
        .map((sec: any, idx: number) => {
          return `Section ${String.fromCharCode(65 + idx)}: MUST have exactly ${sec.questionsCount} questions. Allowed types: ${sec.allowedTypes.join(', ')}. Target Difficulty: ${sec.difficulty || 'Intermediate'}.`;
        })
        .join('\n');
    }

    const systemPrompt = `You are an expert examiner and assessment creator. Your task is to generate a structured outline for an exam.
The exam is titled "${title}".
Description: "${description}".
Target structure: exactly ${numSections || '1-3'} sections. 

CRITICAL SECTION DEMANDS:
${sectionDemands}
${contextInjection}

Generate ONLY the structural outline: section titles and the list of question concepts/topics (with their types, intent, and allocated marks). You must strictly adhere to the per-section lengths and allowed types requested above.`;

    const userPrompt = `Please generate the exam outline following the exact JSON schema provided.`;

    return this.aiService.generateObject(
      systemPrompt,
      userPrompt,
      this.aiService.getExamOutlineSchema(),
      {
        ...this.buildAiContext(user),
        operation: 'generate-exam-outline',
      },
    );
  }

  @Post('generate-exam-full')
  async generateExamFull(
    @Body() body: GenerateExamFullDto,
    @User() user: { id?: string; orgId?: string | null },
  ) {
    const { title, description, outline, courseSummary } = body;

    if (!outline || !outline.sections) {
      throw new HttpException(
        'A valid exam outline is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    let contextInjection = '';
    if (courseSummary) {
      contextInjection = `\nCRITICAL CONTEXT: This exam is based on a specific syllabus:\n"""\n${courseSummary}\n"""\nEnsure all generated questions strictly adhere to this context.`;
    }

    const systemPrompt = `You are an expert examiner creating the full content of an exam based on a structural outline.
Exam Title: "${title}"
Exam Description/Topic: "${description}"${contextInjection}

CRITICAL INSTRUCTIONS FOR HIGH-QUALITY OUTPUT:
1. PROBLEM STATEMENTS: Every single \`problemStatement\` MUST BE FORMATTED AS BEAUTIFUL HTML. The UI already displays the question title, so DO NOT start the problem statement with a heading (like <h3>Title</h3>). Start directly with the text of the actual question or scenario. Use \`<p>\`, \`<ul>\`, \`<li>\`, \`<strong>\`, \`<em>\`, \`<u>\`, \`<s>\`, \`<code>\`, \`<pre>\`, and \`<blockquote>\` tags. Do not use plain text.
2. CODING QUESTIONS: For 'Coding' types, provide realistic \`templates\` for 'javascript' and 'python'. Provide strictly bounded, highly robust \`testCases\` including exactly 3 to 6 test cases per question. CRITICAL: The \`input\` and \`output\` strings MUST be exact, raw programmatic values for stdin/stdout execution (e.g., "5\\n10" or "true"). They MUST NOT be descriptive sentences or random text. Config \`isPublic\` and \`points\` exactly.
3. EXAM/MCQ/MULTI-SELECT QUESTIONS: Do NOT put the answer options inside the \`problemStatement\` text; only put the question text there. For 'MultiSelect', provide tricky educational options where at least one option MUST be \`isCorrect: false\`. Do not make every option true.
4. WEB PROJECT: For 'Web' types, provide starter HTML/CSS/JS.
5. NOTEBOOK: For 'Notebook' types, provide Python starter code in \`initialCode\` and specify \`allowedLibraries\` (e.g. numpy, pandas).
YOUR OUTPUT MUST EXACTLY MATCH THE PROVIDED JSON SCHEMA. IF IT DOES NOT, THE SYSTEM WILL CRASH.`;

    const userPrompt = `Here is the approved exam outline:\n\n${JSON.stringify(outline, null, 2)}\n\nPlease generate the full exam content based on this outline. Ensure \`problemStatement\` is always rich HTML.`;

    return this.aiService.generateObject(
      systemPrompt,
      userPrompt,
      this.aiService.getFullExamSchema(),
      {
        ...this.buildAiContext(user),
        operation: 'generate-exam-full',
      },
    );
  }
}
