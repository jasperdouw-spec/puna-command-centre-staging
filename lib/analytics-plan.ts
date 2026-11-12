// Review-only configuration. No SDK, tag, request, cookie or event dispatcher.
// Activation requires a separately reviewed implementation and policy approval.
export const analyticsPlan = {
  enabled: false,
  measurementId: null,
  tagManagerId: null,
  consentRequired: true,
  advertising: false,
  crossDomain: false,
  userId: false,
  enhancedMeasurement: false,
  routeAllowlist: ['/'],
  proposedEvents: ['view_menu', 'select_product', 'begin_checkout', 'purchase'],
  forbiddenData: ['email', 'phone', 'name', 'address', 'notes', 'receipt_token', 'qr_token', 'query_string'],
} as const;
