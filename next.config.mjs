/** @type {import('next').NextConfig} */
const config={poweredByHeader:false,async headers(){return [{source:'/:path*',headers:[
  {key:'Content-Security-Policy',value:"default-src 'self'; script-src 'self' 'unsafe-inline' https://sandbox.web.squarecdn.com; style-src 'self' 'unsafe-inline' https://sandbox.web.squarecdn.com; img-src 'self' data:; font-src 'self' https://square-fonts-production-f.squarecdn.com https://d1g145x70srn7h.cloudfront.net; connect-src 'self' https://sandbox.web.squarecdn.com https://pci-connect.squareupsandbox.com https://o160250.ingest.sentry.io; frame-src https://sandbox.web.squarecdn.com; frame-ancestors 'none'; form-action 'self'; base-uri 'self'"},
  {key:'X-Content-Type-Options',value:'nosniff'},
  {key:'X-Frame-Options',value:'DENY'},
  {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},
  {key:'X-Robots-Tag',value:'noindex, nofollow'},
  {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'}
]}];}};
export default config;
