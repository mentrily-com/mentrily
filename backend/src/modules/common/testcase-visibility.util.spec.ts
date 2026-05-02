import {
  sanitizeQuestionForClient,
  sanitizeQuestionsPayloadForClient,
} from './testcase-visibility.util';

describe('testcase-visibility util', () => {
  it('removes MCQ correctness flags from question options when sensitive data is excluded', () => {
    const question = {
      id: 'Q1',
      type: 'MCQ',
      mcqOptions: [
        { id: 'A', text: 'Option A', isCorrect: true },
        { id: 'B', text: 'Option B', isCorrect: false },
      ],
      options: [
        { id: 'A', text: 'Option A', isCorrect: true },
        { id: 'B', text: 'Option B', isCorrect: false },
      ],
      mcq: {
        options: [
          { id: 'A', text: 'Option A', isCorrect: true },
          { id: 'B', text: 'Option B', isCorrect: false },
        ],
      },
      correctAnswer: 'A',
      answerKey: 'A',
    };

    const sanitized = sanitizeQuestionForClient(question, false);

    expect(sanitized.mcqOptions[0].isCorrect).toBeUndefined();
    expect(sanitized.options[0].isCorrect).toBeUndefined();
    expect(sanitized.mcq.options[0].isCorrect).toBeUndefined();
    expect(sanitized.correctAnswer).toBeUndefined();
    expect(sanitized.answerKey).toBeUndefined();
  });

  it('keeps MCQ correctness flags for privileged payloads', () => {
    const question = {
      id: 'Q2',
      type: 'MCQ',
      options: [{ id: 'A', text: 'Option A', isCorrect: true }],
    };

    const privileged = sanitizeQuestionForClient(question, true);

    expect(privileged.options[0].isCorrect).toBe(true);
  });

  it('redacts hidden coding test cases from student payloads', () => {
    const question = {
      id: 'Q3',
      type: 'Coding',
      codingConfig: {
        testCases: [
          { input: '1 2', output: '3', isPublic: true },
          { input: '999 1', output: '1000', isPublic: false },
        ],
      },
    };

    const sanitized = sanitizeQuestionForClient(question, false);

    expect(sanitized.codingConfig.testCases[0].input).toBe('1 2');
    expect(sanitized.codingConfig.testCases[0].output).toBe('3');
    expect(sanitized.codingConfig.testCases[1].input).toBeNull();
    expect(sanitized.codingConfig.testCases[1].output).toBeNull();
    expect(sanitized.codingConfig.testCases[1].expectedOutput).toBeNull();
  });

  it('redacts all coding test cases when showTestCases is disabled', () => {
    const question = {
      id: 'Q4',
      type: 'Coding',
      codingConfig: {
        showTestCases: false,
        testCases: [{ input: '1 2', output: '3', isPublic: true }],
      },
    };

    const sanitized = sanitizeQuestionForClient(question, false);

    expect(sanitized.codingConfig.testCases[0].input).toBeNull();
    expect(sanitized.codingConfig.testCases[0].output).toBeNull();
  });

  it('sanitizes object-map question payloads', () => {
    const payload = {
      Q1: {
        id: 'Q1',
        type: 'MCQ',
        options: [
          { id: 'A', text: 'Option A', isCorrect: true },
          { id: 'B', text: 'Option B', isCorrect: false },
        ],
        correctAnswer: 'A',
      },
    };

    const sanitizedPayload = sanitizeQuestionsPayloadForClient(payload, false);

    expect(sanitizedPayload.Q1.options[0].isCorrect).toBeUndefined();
    expect(sanitizedPayload.Q1.correctAnswer).toBeUndefined();
  });
});
