class ApplicationAdapter {
  constructor(platform) { this.platform = platform; }
  canHandle(job) { return job?.applicationPlatform === this.platform; }
  async getApplicationForm() {
    return { status: 'NEEDS_REVIEW', verified: false, failureCode: 'INTERACTIVE_FORM_REQUIRED', reason: `${this.platform} requires an interactive application flow or an authorized submission API.` };
  }
  async prepareApplication(context) { return context; }
  async submitApplication() {
    return { status: 'NEEDS_REVIEW', verified: false, failureCode: 'AUTOMATIC_SUBMISSION_UNAVAILABLE', reason: `Verified automatic submission is not configured for ${this.platform}.` };
  }
  async getSubmissionStatus() { return { status: 'UNVERIFIED', verified: false }; }
}

module.exports = ApplicationAdapter;
