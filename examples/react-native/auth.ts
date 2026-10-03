/** Connect this function to your application's secure token refresh flow. */
export async function getFreshAccessToken(): Promise<string> {
  throw new Error("Connect getFreshAccessToken() to your application's secure token provider.");
}
