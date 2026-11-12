/** @type {import('next').NextConfig} */
// Keep static-generation workers bounded on the constrained hosted build image.
// This affects build concurrency only; route behavior and runtime flags are unchanged.
const config={poweredByHeader:false,experimental:{cpus:1},async headers(){return [{source:'/:path*',headers:[
  {key:'Content-Security-Policy',value:"default-src 'self'; script-src 'self' 'unsafe-inline' https://sandbox.web.squarecdn.com; style-src 'self' 'unsafe-inline' https://sandbox.web.squarecdn.com; img-src 'self' data:; font-src 'self' https://square-fonts-production-f.squarecdn.com https://d1g145x70srn7h.cloudfront.net; connect-src 'self' https://sandbox.web.squarecdn.com https://pci-connect.squareupsandbox.com https://o160250.ingest.sentry.io; frame-src https://sandbox.web.squarecdn.com; frame-ancestors 'none'; form-action 'self'; base-uri 'self'"},
  {key:'X-Content-Type-Options',value:'nosniff'},
  {key:'X-Frame-Options',value:'DENY'},
  {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},
  {key:'X-Robots-Tag',value:'noindex, nofollow'},
  {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'}
]},{source:'/order-status',headers:[{key:'Referrer-Policy',value:'no-referrer'},{key:'Cache-Control',value:'no-store'},{key:'Content-Security-Policy',value:"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"}]},{source:'/food-truck/scan',headers:[{key:'Content-Security-Policy',value:"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"},{key:'Permissions-Policy',value:'camera=(self), microphone=(), geolocation=()'},{key:'Referrer-Policy',value:'no-referrer'},{key:'Cache-Control',value:'no-store'}]}];}};
export default config;
