export const socialProviderAvailability = {
  google: Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
  ),
  facebook: Boolean(
    process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET,
  ),
  github: Boolean(
    process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET,
  ),
};
