// prSeeder.ts
// Seeds the question catalog for the Principal Registry Weekly Report.
// Idempotent: safe to re-run — upserts on question_key.

import { pool } from "./config/db";

type QuestionType =
  | 'text'        // free text
  | 'list'        // array of strings (bullet points)
  | 'number'      // integer
  | 'boolean'     // Yes/No
  | 'date'        // single ISO date
  | 'date_list'   // array of ISO dates (multi-batch submissions)
  | 'group';      // non-data section/group header (e.g. "Sign-off")

interface ConditionalOn {
  questionKey: string;          // the question this one depends on
  equals: boolean | string | number;
}

interface ReportQuestionSeed {
  questionKey: string;
  sectionNumber: number;
  sectionTitle: string;
  questionLabel: string;
  questionType: QuestionType;
  parentQuestionKey?: string | null;
  displayOrder: number;
  isRequired: boolean;
  conditionalOn?: ConditionalOn | null;
}

export class PrincipalRegistryReportQuestionsSeeder {
  static async run(): Promise<void> {
    console.log('Seeding Principal Registry Weekly Report question catalog...');

    // Clear existing data first to avoid conflicts
    await pool.query('TRUNCATE TABLE principal_registry_report_questions RESTART IDENTITY CASCADE');

    const questions = PrincipalRegistryReportQuestionsSeeder.buildQuestions();

    for (const question of questions) {
      await PrincipalRegistryReportQuestionsSeeder.upsertQuestion(question);
    }

    console.log(`✅ Seeded ${questions.length} report questions.`);
  }

  private static async upsertQuestion(question: ReportQuestionSeed): Promise<void> {
    const query = `
      INSERT INTO principal_registry_report_questions (
        question_key, section_number, section_title, question_label,
        question_type, parent_question_key, display_order, is_required, conditional_on
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (question_key) DO UPDATE SET
        section_number = EXCLUDED.section_number,
        section_title = EXCLUDED.section_title,
        question_label = EXCLUDED.question_label,
        question_type = EXCLUDED.question_type,
        parent_question_key = EXCLUDED.parent_question_key,
        display_order = EXCLUDED.display_order,
        is_required = EXCLUDED.is_required,
        conditional_on = EXCLUDED.conditional_on,
        updated_at = now();
    `;

    await pool.query(query, [
      question.questionKey,
      question.sectionNumber,
      question.sectionTitle,
      question.questionLabel,
      question.questionType,
      question.parentQuestionKey ?? null,
      question.displayOrder,
      question.isRequired,
      question.conditionalOn ? JSON.stringify(question.conditionalOn) : null,
    ]);
  }

  private static buildQuestions(): ReportQuestionSeed[] {
    return [
      // ═══════════════════════════════════════════════════════════════════
      // SECTION 1: Administrative Overview
      // ═══════════════════════════════════════════════════════════════════
      {
        questionKey: 'administrativeOverview.keyActivities',
        sectionNumber: 1,
        sectionTitle: 'Administrative Overview',
        questionLabel: 'Key activities undertaken',
        questionType: 'list',
        displayOrder: 1,
        isRequired: true,
      },
      {
        questionKey: 'administrativeOverview.notableIssues',
        sectionNumber: 1,
        sectionTitle: 'Administrative Overview',
        questionLabel: 'Notable issues handled',
        questionType: 'list',
        displayOrder: 2,
        isRequired: false,
      },
      {
        questionKey: 'administrativeOverview.resolutionsStatus',
        sectionNumber: 1,
        sectionTitle: 'Administrative Overview',
        questionLabel: 'Status of implementation of resolutions from the last check-in meeting',
        questionType: 'list',
        displayOrder: 3,
        isRequired: false,
      },

      // ═══════════════════════════════════════════════════════════════════
      // SECTION 2: Case Management
      // ═══════════════════════════════════════════════════════════════════
      {
        questionKey: 'caseManagement.form30PendingCount',
        sectionNumber: 2,
        sectionTitle: 'Case Management',
        questionLabel: 'Number of Form 30s – pending/status',
        questionType: 'number',
        displayOrder: 1,
        isRequired: true,
      },
      {
        questionKey: 'caseManagement.forwardedToGp',
        sectionNumber: 2,
        sectionTitle: 'Case Management',
        questionLabel: 'Applications forwarded to GP this week (Yes/No)',
        questionType: 'boolean',
        displayOrder: 2,
        isRequired: true,
      },
      // Conditional fields when forwardedToGp === true
      {
        questionKey: 'caseManagement.submissionDates',
        sectionNumber: 2,
        sectionTitle: 'Case Management',
        questionLabel: 'If Yes, date(s) of submission',
        questionType: 'date_list',
        parentQuestionKey: 'caseManagement.forwardedToGp',
        displayOrder: 3,
        isRequired: false,
        conditionalOn: { questionKey: 'caseManagement.forwardedToGp', equals: true },
      },
      {
        questionKey: 'caseManagement.noticesSubmittedCount',
        sectionNumber: 2,
        sectionTitle: 'Case Management',
        questionLabel: 'No. of notices submitted',
        questionType: 'number',
        parentQuestionKey: 'caseManagement.forwardedToGp',
        displayOrder: 4,
        isRequired: false,
        conditionalOn: { questionKey: 'caseManagement.forwardedToGp', equals: true },
      },
      // Conditional fields when forwardedToGp === false
      {
        questionKey: 'caseManagement.nonSubmissionReason',
        sectionNumber: 2,
        sectionTitle: 'Case Management',
        questionLabel: 'If No, reason for non-submission',
        questionType: 'text',
        parentQuestionKey: 'caseManagement.forwardedToGp',
        displayOrder: 5,
        isRequired: false,
        conditionalOn: { questionKey: 'caseManagement.forwardedToGp', equals: false },
      },
      {
        questionKey: 'caseManagement.expectedSubmissionDate',
        sectionNumber: 2,
        sectionTitle: 'Case Management',
        questionLabel: 'Expected submission date',
        questionType: 'date',
        parentQuestionKey: 'caseManagement.forwardedToGp',
        displayOrder: 6,
        isRequired: false,
        conditionalOn: { questionKey: 'caseManagement.forwardedToGp', equals: false },
      },

      // ═══════════════════════════════════════════════════════════════════
      // SECTION 3: Automating the Principal Registry
      // ═══════════════════════════════════════════════════════════════════
      {
        questionKey: 'automationStatus.excelUpdateStatus',
        sectionNumber: 3,
        sectionTitle: 'Automating the Principal Registry',
        questionLabel: 'Status of updating the Excel sheet',
        questionType: 'text',
        displayOrder: 1,
        isRequired: true,
      },
      {
        questionKey: 'automationStatus.systemBuildStatus',
        sectionNumber: 3,
        sectionTitle: 'Automating the Principal Registry',
        questionLabel: 'Status of system being built',
        questionType: 'text',
        displayOrder: 2,
        isRequired: true,
      },

      // ═══════════════════════════════════════════════════════════════════
      // SECTION 4: Service Delivery Challenges
      // ═══════════════════════════════════════════════════════════════════
      {
        questionKey: 'serviceDeliveryChallenges.hasChallenges',
        sectionNumber: 4,
        sectionTitle: 'Service Delivery Challenges',
        questionLabel: 'Any challenge affecting service delivery encountered within report period (Yes/No)',
        questionType: 'boolean',
        displayOrder: 1,
        isRequired: true,
      },
      {
        questionKey: 'serviceDeliveryChallenges.challengeDetails',
        sectionNumber: 4,
        sectionTitle: 'Service Delivery Challenges',
        questionLabel: 'If Yes, nature of challenge',
        questionType: 'list',
        parentQuestionKey: 'serviceDeliveryChallenges.hasChallenges',
        displayOrder: 2,
        isRequired: false,
        conditionalOn: { questionKey: 'serviceDeliveryChallenges.hasChallenges', equals: true },
      },
      {
        questionKey: 'serviceDeliveryChallenges.proposedSolutions',
        sectionNumber: 4,
        sectionTitle: 'Service Delivery Challenges',
        questionLabel: 'Proposed solution',
        questionType: 'list',
        displayOrder: 3,
        isRequired: true,
      },
      {
        questionKey: 'serviceDeliveryChallenges.needsRhcIntervention',
        sectionNumber: 4,
        sectionTitle: 'Service Delivery Challenges',
        questionLabel: "Do you need the RHC's intervention for this solution to be deployed (Yes/No)",
        questionType: 'boolean',
        displayOrder: 4,
        isRequired: true,
      },
      {
        questionKey: 'serviceDeliveryChallenges.interventionDetails',
        sectionNumber: 4,
        sectionTitle: 'Service Delivery Challenges',
        questionLabel: 'If Yes, specify what intervention is needed',
        questionType: 'list',
        parentQuestionKey: 'serviceDeliveryChallenges.needsRhcIntervention',
        displayOrder: 5,
        isRequired: false,
        conditionalOn: { questionKey: 'serviceDeliveryChallenges.needsRhcIntervention', equals: true },
      },

      // ═══════════════════════════════════════════════════════════════════
      // SECTION 5: Highlights / Achievements
      // ═══════════════════════════════════════════════════════════════════
      {
        questionKey: 'highlights.achievements',
        sectionNumber: 5,
        sectionTitle: 'Highlights / Achievements',
        questionLabel: 'List of highlights/achievements for the period',
        questionType: 'list',
        displayOrder: 1,
        isRequired: false,
      },

      // ═══════════════════════════════════════════════════════════════════
      // SECTION 6: Any Other Information - FIXED DISPLAY ORDERS
      // ═══════════════════════════════════════════════════════════════════
      // Group: Changes Implemented in the PR Module
      {
        questionKey: 'otherInformation.changesImplementedGroup',
        sectionNumber: 6,
        sectionTitle: 'Any Other Information',
        questionLabel: 'Changes Implemented in the PR Module',
        questionType: 'group',
        displayOrder: 1,
        isRequired: false,
      },
      {
        questionKey: 'otherInformation.ctsEfilingChanges',
        sectionNumber: 6,
        sectionTitle: 'Any Other Information',
        questionLabel: 'CTS and E-filing changes',
        questionType: 'list',
        parentQuestionKey: 'otherInformation.changesImplementedGroup',
        displayOrder: 2,
        isRequired: false,
      },
      {
        questionKey: 'otherInformation.gpChanges',
        sectionNumber: 6,
        sectionTitle: 'Any Other Information',
        questionLabel: 'GP Changes',
        questionType: 'list',
        parentQuestionKey: 'otherInformation.changesImplementedGroup',
        displayOrder: 3,
        isRequired: false,
      },

      // Group: Sign-off - FIXED: Unique display orders at section level
      {
        questionKey: 'otherInformation.signOffGroup',
        sectionNumber: 6,
        sectionTitle: 'Any Other Information',
        questionLabel: 'Sign-off',
        questionType: 'group',
        displayOrder: 4,  // ← Unique at section level
        isRequired: false,
      },
      {
        questionKey: 'otherInformation.signOff.preparedDate',
        sectionNumber: 6,
        sectionTitle: 'Any Other Information',
        questionLabel: 'Report Prepared this [date]',
        questionType: 'date',
        parentQuestionKey: 'otherInformation.signOffGroup',
        displayOrder: 5,  // ← Changed from 1 to 5
        isRequired: true,
      },
      {
        questionKey: 'otherInformation.signOff.preparedByName',
        sectionNumber: 6,
        sectionTitle: 'Any Other Information',
        questionLabel: 'By: [Name]',
        questionType: 'text',
        parentQuestionKey: 'otherInformation.signOffGroup',
        displayOrder: 6,  // ← Changed from 2 to 6
        isRequired: true,
      },
      {
        questionKey: 'otherInformation.signOff.preparedByDesignation',
        sectionNumber: 6,
        sectionTitle: 'Any Other Information',
        questionLabel: 'Designation: [Role]',
        questionType: 'text',
        parentQuestionKey: 'otherInformation.signOffGroup',
        displayOrder: 7,  // ← Changed from 3 to 7
        isRequired: true,
      },
    ];
  }
}

// Allow running directly
if (require.main === module) {
  PrincipalRegistryReportQuestionsSeeder.run()
    .then(() => {
      console.log('✅ Done.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Seeding failed:', err);
      process.exit(1);
    });
}