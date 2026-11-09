export const APPLICATION_ERRORS = {
    notSignedIn: "You must be signed in to apply for leave.",
    noLinkedEmployee: "Your account is not linked to an employee record.",
    notOwnEmployee: "You can only apply for leave for yourself.",
    deleteUnauthorized: "Only Admin or HR can delete applications.",
    noteRequired: "Reason for leave is required.",
    nameRequired: "Applicant name is required.",
    invalidLeaveType: "Invalid or inactive leave type.",
    overlap:
      "This employee already has a pending or approved leave covering part of that range.",
    noWorkdays: "The selected dates contain no workdays.",
    notFound: "Leave application not found.",
    notPending: "Only pending applications can be deleted.",
    submitFailed: "Failed to submit leave application.",
    invalidStatus: "Invalid status filter.",
    loadFailed: "Failed to load leave applications.",
    deleteFailed: "Failed to delete leave application.",
    previewFailed: "Failed to calculate leave days.",
    reviewUnauthorized: "Only Admin or HR can review applications.",
    invalidDecision: "Decision must be approved or denied.",
    reviewNotPending: "Only pending applications can be reviewed.",
    noteTooLong: "Review note must be 255 characters or less.",
    approvedOverlap:
      "Cannot approve: this employee already has an approved leave covering part of that range.",
    reviewFailed: "Failed to review leave application.",
  } as const;
  
  export const APPLICATION_STATUSES = ["pending", "approved", "denied", "cancelled"] as const;