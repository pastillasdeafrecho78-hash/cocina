/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_AUTH_GOOGLE_ENABLED:
      process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET ? 'true' : '',
  },
}

module.exports = nextConfig








