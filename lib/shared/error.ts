export function getTechnicalErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return "internal_error";
  }

  return "Technical error during node execution";
}
