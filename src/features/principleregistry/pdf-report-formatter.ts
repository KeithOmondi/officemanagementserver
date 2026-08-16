// pdf-report-formatter.ts
import type {
  PrincipalRegistryWeeklyReport,
  PDFSectionContent,
  PDFContentItem,
} from './principal-registry-report.types';
import {
  formatListForPDF,
  formatDateForPDF,
  formatBooleanForPDF,
  formatNumberForPDF,
  formatDateListForPDF,
  formatTextForPDF,
} from './principal-registry-report.types';

/**
 * Format report data into PDF sections
 */
export const formatReportForPDF = (report: PrincipalRegistryWeeklyReport): PDFSectionContent[] => {
  const sections: PDFSectionContent[] = [];

  // ─── Section 1: Administrative Overview ──────────────────────
  const adminOverview = report.administrativeOverview;
  sections.push({
    title: '1. Administrative Overview',
    items: [
      {
        label: 'Key activities undertaken',
        value: adminOverview.keyActivities || [],
        type: 'list',
        formattedValue: formatListForPDF(adminOverview.keyActivities),
      },
      {
        label: 'Notable issues handled',
        value: adminOverview.notableIssues || [],
        type: 'list',
        formattedValue: formatListForPDF(adminOverview.notableIssues),
      },
      {
        label: 'Status of implementation of resolutions from the last check-in meeting',
        value: adminOverview.resolutionsStatus || [],
        type: 'list',
        formattedValue: formatListForPDF(adminOverview.resolutionsStatus),
      },
    ],
  });

  // ─── Section 2: Case Management ──────────────────────────────
  const caseMgmt = report.caseManagement;
  const caseItems: PDFContentItem[] = [
    {
      label: 'Number of Form 30s - pending/status',
      value: caseMgmt.form30PendingCount ?? 0,
      type: 'number',
      formattedValue: formatNumberForPDF(caseMgmt.form30PendingCount),
    },
    {
      label: 'Applications forwarded to GP this week',
      value: caseMgmt.forwardedToGp,
      type: 'boolean',
      formattedValue: formatBooleanForPDF(caseMgmt.forwardedToGp),
    },
  ];

  if (caseMgmt.forwardedToGp) {
    caseItems.push({
      label: 'Date(s) of submission',
      value: caseMgmt.submissionDates || [],
      type: 'date_list',
      formattedValue: formatDateListForPDF(caseMgmt.submissionDates),
    });
    caseItems.push({
      label: 'Number of notices submitted',
      value: caseMgmt.noticesSubmittedCount ?? 0,
      type: 'number',
      formattedValue: formatNumberForPDF(caseMgmt.noticesSubmittedCount),
    });
  } else {
    caseItems.push({
      label: 'Reason for non-submission',
      value: caseMgmt.nonSubmissionReason || 'Not provided',
      type: 'text',
      formattedValue: formatTextForPDF(caseMgmt.nonSubmissionReason),
    });
    caseItems.push({
      label: 'Expected submission date',
      value: caseMgmt.expectedSubmissionDate || 'Not provided',
      type: 'date',
      formattedValue: formatDateForPDF(caseMgmt.expectedSubmissionDate),
    });
  }

  sections.push({
    title: '2. Case Management',
    items: caseItems,
  });

  // ─── Section 3: Automating the Principal Registry ────────────
  const autoStatus = report.automationStatus;
  sections.push({
    title: '3. Automating the Principal Registry',
    items: [
      {
        label: 'Status of updating the Excel sheet',
        value: autoStatus.excelUpdateStatus || 'Not provided',
        type: 'text',
        formattedValue: formatTextForPDF(autoStatus.excelUpdateStatus),
      },
      {
        label: 'Status of system being built',
        value: autoStatus.systemBuildStatus || 'Not provided',
        type: 'text',
        formattedValue: formatTextForPDF(autoStatus.systemBuildStatus),
      },
    ],
  });

  // ─── Section 4: Service Delivery Challenges ──────────────────
  const challenges = report.serviceDeliveryChallenges;
  const challengeItems: PDFContentItem[] = [
    {
      label: 'Any challenge affecting service delivery encountered within report period',
      value: challenges.hasChallenges,
      type: 'boolean',
      formattedValue: formatBooleanForPDF(challenges.hasChallenges),
    },
  ];

  if (challenges.hasChallenges) {
    challengeItems.push({
      label: 'Nature of challenge',
      value: challenges.challengeDetails || [],
      type: 'list',
      formattedValue: formatListForPDF(challenges.challengeDetails),
    });
  }

  challengeItems.push({
    label: 'Proposed solution',
    value: challenges.proposedSolutions || [],
    type: 'list',
    formattedValue: formatListForPDF(challenges.proposedSolutions),
  });

  challengeItems.push({
    label: "Do you need the RHC's intervention for this solution to be deployed?",
    value: challenges.needsRhcIntervention,
    type: 'boolean',
    formattedValue: formatBooleanForPDF(challenges.needsRhcIntervention),
  });

  if (challenges.needsRhcIntervention) {
    challengeItems.push({
      label: 'Specify what intervention is needed',
      value: challenges.interventionDetails || [],
      type: 'list',
      formattedValue: formatListForPDF(challenges.interventionDetails),
    });
  }

  sections.push({
    title: '4. Service Delivery Challenges',
    items: challengeItems,
  });

  // ─── Section 5: Highlights / Achievements ────────────────────
  const highlights = report.highlights;
  sections.push({
    title: '5. Highlights / Achievements',
    items: [
      {
        label: 'List of highlights/achievements for the period',
        value: highlights.achievements || [],
        type: 'list',
        formattedValue: formatListForPDF(highlights.achievements),
      },
    ],
  });

  // ─── Section 6: Any Other Information ────────────────────────
  const otherInfo = report.otherInformation;
  sections.push({
    title: '6. Any Other Information',
    items: [
      {
        label: 'CTS and E-filing changes',
        value: otherInfo.ctsEfilingChanges || [],
        type: 'list',
        formattedValue: formatListForPDF(otherInfo.ctsEfilingChanges),
      },
      {
        label: 'GP Changes',
        value: otherInfo.gpChanges || [],
        type: 'list',
        formattedValue: formatListForPDF(otherInfo.gpChanges),
      },
    ],
  });

  // ─── Sign-off ──────────────────────────────────────────────────
  const signOff = otherInfo.signOff;
  sections.push({
    title: 'Sign-off',
    items: [
      {
        label: 'Report Prepared this [date]',
        value: signOff.preparedDate || 'Not provided',
        type: 'date',
        formattedValue: formatDateForPDF(signOff.preparedDate),
      },
      {
        label: 'By: [Name]',
        value: signOff.preparedByName || 'Not provided',
        type: 'text',
        formattedValue: formatTextForPDF(signOff.preparedByName),
      },
      {
        label: 'Designation: [Role]',
        value: signOff.preparedByDesignation || 'Not provided',
        type: 'text',
        formattedValue: formatTextForPDF(signOff.preparedByDesignation),
      },
    ],
  });

  return sections;
};

/**
 * Generate a filename for the PDF report
 */
export const generatePDFFileName = (report: PrincipalRegistryWeeklyReport): string => {
  const date = new Date().toISOString().split('T')[0];
  const weekEnding = report.weekEndingDates?.length 
    ? report.weekEndingDates[0] 
    : date;
  return `Principal_Registry_Weekly_Report_${weekEnding}_${date}.pdf`;
};

/**
 * Get the week ending dates as a string for the PDF header
 */
export const getWeekEndingString = (weekEndingDates: string[]): string => {
  if (!weekEndingDates || weekEndingDates.length === 0) return '';
  
  const formattedDates = weekEndingDates.map(d => formatDateForPDF(d));
  if (formattedDates.length === 1) return formattedDates[0];
  
  const last = formattedDates.pop();
  return `${formattedDates.join(', ')} and ${last}`;
};