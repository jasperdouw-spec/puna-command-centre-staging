/** @type {import('next').NextConfig} */
const config={poweredByHeader:false,async headers(){return [{source:'/:path*',headers:[
  {key:'Content-Security-Policy',value:"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src 'none'; frame-ancestors 'none'; form-action 'self'; base-uri 'self'"},
  {key:'X-Content-Type-Options',value:'nosniff'},
  {key:'X-Frame-Options',value:'DENY'},
  {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},
  {key:'X-Robots-Tag',value:'noindex, nofollow'},
  {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'}
]}];}};
export default config;
