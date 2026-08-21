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
 * Handles partial/empty data gracefully for draft reports
 */
export const formatReportForPDF = (report: PrincipalRegistryWeeklyReport): PDFSectionContent[] => {
  const sections: PDFSectionContent[] = [];

  // ─── Section 1: Administrative Overview ──────────────────────
  const adminOverview = report.administrativeOverview || { keyActivities: [], notableIssues: [], resolutionsStatus: [] };
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
  const caseMgmt = report.caseManagement || { 
    form30PendingCount: 0, 
    forwardedToGp: false,
    submissionDates: null,
    noticesSubmittedCount: null,
    nonSubmissionReason: null,
    expectedSubmissionDate: null,
  };
  
  const caseItems: PDFContentItem[] = [
    {
      label: 'Number of Form 30s - pending/status',
      value: caseMgmt.form30PendingCount ?? 0,
      type: 'number',
      formattedValue: formatNumberForPDF(caseMgmt.form30PendingCount),
    },
    {
      label: 'Applications forwarded to GP this week',
      value: caseMgmt.forwardedToGp ?? false,
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
  const autoStatus = report.automationStatus || { 
    excelUpdateStatus: '', 
    systemBuildStatus: '' 
  };
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
  const challenges = report.serviceDeliveryChallenges || {
    hasChallenges: false,
    challengeDetails: null,
    proposedSolutions: [],
    needsRhcIntervention: false,
    interventionDetails: null,
  };
  
  const challengeItems: PDFContentItem[] = [
    {
      label: 'Any challenge affecting service delivery encountered within report period',
      value: challenges.hasChallenges ?? false,
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
    value: challenges.needsRhcIntervention ?? false,
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
  const highlights = report.highlights || { achievements: [] };
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
  const otherInfo = report.otherInformation || {
    ctsEfilingChanges: [],
    gpChanges: [],
    signOff: {
      preparedDate: '',
      preparedByName: '',
      preparedByDesignation: '',
    },
  };
  
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
  const signOff = otherInfo.signOff || {
    preparedDate: '',
    preparedByName: '',
    preparedByDesignation: '',
  };
  
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
  
  // Sanitize the week ending date for filename
  const sanitizedWeekEnding = weekEnding.replace(/[^a-zA-Z0-9-]/g, '');
  return `Principal_Registry_Weekly_Report_${sanitizedWeekEnding}_${date}.pdf`;
};

/**
 * Get the week ending dates as a string for the PDF header
 */
export const getWeekEndingString = (weekEndingDates: string[]): string => {
  if (!weekEndingDates || weekEndingDates.length === 0) return '';
  
  const formattedDates = weekEndingDates
    .filter(d => d) // Remove empty/null dates
    .map(d => formatDateForPDF(d));
  
  if (formattedDates.length === 0) return '';
  if (formattedDates.length === 1) return formattedDates[0];
  
  const last = formattedDates.pop();
  return `${formattedDates.join(', ')} and ${last}`;
};

/**
 * Check if a section has any meaningful data
 * Useful for conditional display in the PDF
 */
export const hasSectionData = (section: PDFSectionContent): boolean => {
  if (!section.items || section.items.length === 0) return false;
  
  return section.items.some(item => {
    if (item.value === null || item.value === undefined) return false;
    if (typeof item.value === 'string') return item.value.trim().length > 0 && item.value !== 'Not provided';
    if (Array.isArray(item.value)) return item.value.length > 0;
    if (typeof item.value === 'object') {
      return Object.values(item.value).some(v => {
        if (typeof v === 'string') return v.trim().length > 0 && v !== 'Not provided';
        if (Array.isArray(v)) return v.length > 0;
        return v !== null && v !== undefined;
      });
    }
    return true;
  });
};